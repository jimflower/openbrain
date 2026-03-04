// Open Brain API Server
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import db from './db.js';
import { generateEmbedding, testEmbeddingService } from './embeddings.js';
import { extractMetadata, testMetadataService } from './metadata.js';

dotenv.config();

const app = express();
const PORT = process.env.API_PORT || 3000;
const ACCESS_KEY = process.env.ACCESS_KEY;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Authentication middleware
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  const queryKey = req.query.key;
  
  const providedKey = authHeader?.replace('Bearer ', '') || queryKey;
  
  if (!ACCESS_KEY) {
    console.warn('Warning: ACCESS_KEY not set in .env - API is unsecured!');
    return next();
  }
  
  if (providedKey !== ACCESS_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  next();
}

// Apply auth to all routes except health check
app.use((req, res, next) => {
  if (req.path === '/health') {
    return next();
  }
  authenticate(req, res, next);
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Test endpoint - verifies all services
 */
app.get('/test', async (req, res) => {
  const dbTest = await db.testConnection();
  const embeddingTest = await testEmbeddingService();
  const metadataTest = await testMetadataService();
  
  const allOk = dbTest.success && embeddingTest.success && metadataTest.success;
  
  res.status(allOk ? 200 : 500).json({
    status: allOk ? 'ok' : 'error',
    services: {
      database: dbTest,
      embeddings: embeddingTest,
      metadata: metadataTest,
    },
  });
});

/**
 * Capture a new thought
 * POST /capture
 * Body: { content: string, skipMetadata?: boolean }
 */
app.post('/capture', async (req, res) => {
  try {
    const { content, skipMetadata = false } = req.body;
    
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Content is required and must be a string' });
    }
    
    // Generate embedding and metadata in parallel
    const [embedding, metadata] = await Promise.all([
      generateEmbedding(content),
      skipMetadata ? Promise.resolve({}) : extractMetadata(content),
    ]);
    
    // Store in database
    const thought = await db.storeThought(content, embedding, metadata);
    
    res.json({
      success: true,
      thought: {
        id: thought.id,
        content: thought.content,
        metadata: thought.metadata,
        created_at: thought.created_at,
      },
    });
  } catch (error) {
    console.error('Capture error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Search thoughts by semantic similarity
 * POST /search
 * Body: { query: string, threshold?: number, limit?: number }
 */
app.post('/search', async (req, res) => {
  try {
    const { query, threshold = 0.3, limit = 10 } = req.body;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required and must be a string' });
    }
    
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);
    
    // Search
    const results = await db.searchThoughts(queryEmbedding, threshold, limit);
    
    res.json({
      success: true,
      query,
      count: results.length,
      results: results.map(r => ({
        id: r.id,
        content: r.content,
        metadata: r.metadata,
        created_at: r.created_at,
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
 * GET /recent?limit=20&offset=0
 */
app.get('/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    
    const thoughts = await db.getRecentThoughts(limit, offset);
    
    res.json({
      success: true,
      count: thoughts.length,
      limit,
      offset,
      thoughts,
    });
  } catch (error) {
    console.error('Recent error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get thoughts by date range
 * GET /range?start=2024-01-01&end=2024-12-31
 */
app.get('/range', async (req, res) => {
  try {
    const { start, end } = req.query;
    
    if (!start || !end) {
      return res.status(400).json({ error: 'start and end dates are required' });
    }
    
    const thoughts = await db.getThoughtsByDateRange(new Date(start), new Date(end));
    
    res.json({
      success: true,
      count: thoughts.length,
      range: { start, end },
      thoughts,
    });
  } catch (error) {
    console.error('Range error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get a specific thought by ID
 * GET /thought/:id
 */
app.get('/thought/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const thought = await db.getThoughtById(id);
    
    if (!thought) {
      return res.status(404).json({ error: 'Thought not found' });
    }
    
    res.json({ success: true, thought });
  } catch (error) {
    console.error('Get thought error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete a thought
 * DELETE /thought/:id
 */
app.delete('/thought/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const deleted = await db.deleteThought(id);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Thought not found' });
    }
    
    res.json({ success: true, deleted_id: id });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get statistics
 * GET /stats
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
 * PATCH /thought/:id
 * Body: { metadata: object }
 */
app.patch('/thought/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { metadata } = req.body;
    
    if (!metadata || typeof metadata !== 'object') {
      return res.status(400).json({ error: 'Metadata object is required' });
    }
    
    const updated = await db.updateMetadata(id, metadata);
    
    if (!updated) {
      return res.status(404).json({ error: 'Thought not found' });
    }
    
    res.json({ success: true, thought: updated });
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🧠 Open Brain API Server running on port ${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   Test services: http://localhost:${PORT}/test?key=${ACCESS_KEY ? '***' : 'not-set'}`);
  
  if (!ACCESS_KEY) {
    console.warn('⚠️  Warning: ACCESS_KEY not set - API is unsecured!');
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing server...');
  await db.closePool();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing server...');
  await db.closePool();
  process.exit(0);
});

export default app;
