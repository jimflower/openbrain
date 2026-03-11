// Open Brain API Server
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import db from './db.js';
import { generateEmbedding, testEmbeddingService } from './embeddings.js';
import { extractMetadata, classifyRelationship, testMetadataService } from './metadata.js';

dotenv.config();

const app = express();
const PORT = process.env.API_PORT || 3000;
const ACCESS_KEY = process.env.ACCESS_KEY;

app.use(helmet());
app.use(cors());
app.use(express.json());

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  const queryKey = req.query.key;
  const providedKey = authHeader?.replace('Bearer ', '') || queryKey;

  if (!ACCESS_KEY) {
    console.warn('Warning: ACCESS_KEY not set - API is unsecured!');
    return next();
  }
  if (providedKey !== ACCESS_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.use((req, res, next) => {
  if (req.path === '/health') return next();
  authenticate(req, res, next);
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/test', async (req, res) => {
  const dbTest = await db.testConnection();
  const embeddingTest = await testEmbeddingService();
  const metadataTest = await testMetadataService();
  const allOk = dbTest.success && embeddingTest.success && metadataTest.success;
  res.status(allOk ? 200 : 500).json({
    status: allOk ? 'ok' : 'error',
    services: { database: dbTest, embeddings: embeddingTest, metadata: metadataTest },
  });
});

/**
 * Capture a new thought
 * POST /capture
 * Body: { content, event_date?, skip_dedup?, skip_contradiction?, skipMetadata? }
 *
 * Returns:
 *   { success, thought, duplicate?, superseded? }
 */
app.post('/capture', async (req, res) => {
  try {
    const {
      content,
      event_date = null,
      skip_dedup = false,
      skip_contradiction = false,
      skipMetadata = false,
    } = req.body;

    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Content is required and must be a string' });
    }

    // Generate embedding first — needed for dedup + contradiction checks
    const embedding = await generateEmbedding(content);

    // 1. Deduplication check
    if (!skip_dedup) {
      const duplicate = await db.checkNearDuplicate(embedding, 0.92);
      if (duplicate) {
        return res.json({
          success: true,
          duplicate: true,
          message: `Near-duplicate found (${(duplicate.similarity * 100).toFixed(1)}% match) — not stored.`,
          existing: {
            id: duplicate.id,
            content: duplicate.content,
            created_at: duplicate.created_at,
            similarity: duplicate.similarity,
          },
        });
      }
    }

    // 2. Relationship classification (contradicts / extends / infers)
    const supersededIds = [];
    const relationships = []; // { id, type, reason }
    if (!skip_contradiction) {
      const candidates = await db.findContradictionCandidates(embedding, 5);
      for (const candidate of candidates) {
        const { type, reason } = await classifyRelationship(candidate.content, content);
        if (type === 'contradicts') {
          supersededIds.push({ id: candidate.id, reason });
        } else if (type === 'extends' || type === 'infers') {
          relationships.push({ id: candidate.id, type, reason });
        }
      }
    }

    // 3. Extract metadata (in parallel with nothing else now, embedding already done)
    const metadata = skipMetadata ? {} : await extractMetadata(content);

    // Add supersedes list to metadata if applicable
    if (supersededIds.length > 0) {
      metadata.supersedes = supersededIds.map(s => s.id);
    }

    // 4. Parse event_date and expires_at — from param or from metadata extraction
    const resolvedEventDate = event_date || metadata.event_date || null;
    const resolvedExpiresAt = metadata.expires_at || null;
    delete metadata.event_date;  // store in dedicated column, not metadata JSONB
    delete metadata.expires_at;  // store in dedicated column, not metadata JSONB

    // 5. Store the new thought
    const thought = await db.storeThought(content, embedding, metadata, resolvedEventDate, resolvedExpiresAt);

    // 6. Mark contradicted thoughts as superseded + store all relationships
    for (const s of supersededIds) {
      await db.markSuperseded(s.id, thought.id);
      await db.storeRelationship(thought.id, s.id, 'contradicts', s.reason);
    }
    for (const r of relationships) {
      await db.storeRelationship(thought.id, r.id, r.type, r.reason);
    }

    res.json({
      success: true,
      thought: {
        id: thought.id,
        content: thought.content,
        metadata: thought.metadata,
        created_at: thought.created_at,
        event_date: thought.event_date,
        expires_at: thought.expires_at || undefined,
      },
      superseded: supersededIds.length > 0 ? supersededIds : undefined,
      relationships: relationships.length > 0 ? relationships : undefined,
    });
  } catch (error) {
    console.error('Capture error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Search thoughts
 * POST /search
 * Body: { query, threshold?, limit?, mode? }
 * mode: 'vector' (default) | 'hybrid' | 'keyword'
 */
app.post('/search', async (req, res) => {
  try {
    const { query, threshold, limit = 10, mode = 'hybrid' } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required and must be a string' });
    }

    let results;

    if (mode === 'keyword') {
      results = await db.searchThoughtsKeyword(query, limit);
    } else if (mode === 'vector') {
      const queryEmbedding = await generateEmbedding(query);
      results = await db.searchThoughts(queryEmbedding, threshold ?? 0.3, limit);
    } else {
      // hybrid (default)
      const queryEmbedding = await generateEmbedding(query);
      results = await db.searchThoughtsHybrid(queryEmbedding, query, threshold ?? 0.2, limit);
    }

    res.json({
      success: true,
      query,
      mode,
      count: results.length,
      results: results.map(r => ({
        id: r.id,
        content: r.content,
        metadata: r.metadata,
        created_at: r.created_at,
        event_date: r.event_date,
        similarity: r.similarity,
      })),
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get recent thoughts
 * GET /recent?limit=20&offset=0&include_superseded=false
 */
app.get('/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const includeSuperseded = req.query.include_superseded === 'true';
    const thoughts = await db.getRecentThoughts(limit, offset, includeSuperseded);
    res.json({ success: true, count: thoughts.length, limit, offset, thoughts });
  } catch (error) {
    console.error('Recent error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get thoughts by date range
 * GET /range?start=2024-01-01&end=2024-12-31&date_field=created_at
 */
app.get('/range', async (req, res) => {
  try {
    const { start, end, date_field = 'created_at' } = req.query;
    if (!start || !end) {
      return res.status(400).json({ error: 'start and end dates are required' });
    }
    const thoughts = await db.getThoughtsByDateRange(new Date(start), new Date(end), date_field);
    res.json({ success: true, count: thoughts.length, range: { start, end, date_field }, thoughts });
  } catch (error) {
    console.error('Range error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get a specific thought by ID
 */
app.get('/thought/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const thought = await db.getThoughtById(id);
    if (!thought) return res.status(404).json({ error: 'Thought not found' });
    res.json({ success: true, thought });
  } catch (error) {
    console.error('Get thought error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete a thought
 */
app.delete('/thought/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const deleted = await db.deleteThought(id);
    if (!deleted) return res.status(404).json({ error: 'Thought not found' });
    res.json({ success: true, deleted_id: id });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all thoughts related to a given thought (relationship graph)
 * GET /thought/:id/related
 */
app.get('/thought/:id/related', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const related = await db.getRelatedThoughts(id);
    res.json({
      success: true,
      thought_id: id,
      count: related.length,
      related: related.map(r => ({
        id: r.id,
        content: r.content,
        metadata: r.metadata,
        created_at: r.created_at,
        event_date: r.event_date,
        relationship: { type: r.rel_type, reason: r.rel_reason, direction: r.direction },
      })),
    });
  } catch (error) {
    console.error('Related error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get statistics
 */
app.get('/stats', async (req, res) => {
  try {
    const stats = await db.getStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update thought metadata
 */
app.patch('/thought/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { metadata } = req.body;
    if (!metadata || typeof metadata !== 'object') {
      return res.status(400).json({ error: 'Metadata object is required' });
    }
    const updated = await db.updateMetadata(id, metadata);
    if (!updated) return res.status(404).json({ error: 'Thought not found' });
    res.json({ success: true, thought: updated });
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🧠 Open Brain API Server running on port ${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  if (!ACCESS_KEY) console.warn('⚠️  Warning: ACCESS_KEY not set - API is unsecured!');
});

process.on('SIGTERM', async () => { await db.closePool(); process.exit(0); });
process.on('SIGINT', async () => { await db.closePool(); process.exit(0); });

export default app;
