// Database operations for Open Brain
import pkg from 'pg';
const { Pool } = pkg;
import pgvector from 'pgvector/pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const _regClient = await pool.connect();
await pgvector.registerType(_regClient);
_regClient.release();

/**
 * Store a thought in the database
 * @param {string} content
 * @param {number[]} embedding
 * @param {object} metadata
 * @param {Date|string|null} eventDate - when the described event happened (vs. when captured)
 */
export async function storeThought(content, embedding, metadata = {}, eventDate = null) {
  const query = `
    INSERT INTO thoughts (content, embedding, metadata, event_date)
    VALUES ($1, $2, $3, $4)
    RETURNING id, content, metadata, created_at, event_date, superseded_by
  `;
  const embeddingString = pgvector.toSql(embedding);
  const result = await pool.query(query, [content, embeddingString, metadata, eventDate || null]);
  return result.rows[0];
}

/**
 * Check for near-duplicate thoughts (similarity >= threshold)
 * Returns the most similar existing thought, or null if none found.
 */
export async function checkNearDuplicate(queryEmbedding, threshold = 0.92) {
  const query = `
    SELECT id, content, metadata, created_at, event_date,
           1 - (embedding <=> $1) AS similarity
    FROM thoughts
    WHERE superseded_by IS NULL
      AND 1 - (embedding <=> $1) >= $2
    ORDER BY embedding <=> $1
    LIMIT 1
  `;
  const embeddingString = pgvector.toSql(queryEmbedding);
  const result = await pool.query(query, [embeddingString, threshold]);
  return result.rows[0] || null;
}

/**
 * Find thoughts that may be contradicted by new content (similarity 0.6–0.92)
 * Returns candidates for contradiction checking.
 */
export async function findContradictionCandidates(queryEmbedding, limit = 5) {
  const query = `
    SELECT id, content, metadata, created_at, event_date,
           1 - (embedding <=> $1) AS similarity
    FROM thoughts
    WHERE superseded_by IS NULL
      AND 1 - (embedding <=> $1) BETWEEN 0.60 AND 0.91
    ORDER BY embedding <=> $1
    LIMIT $2
  `;
  const embeddingString = pgvector.toSql(queryEmbedding);
  const result = await pool.query(query, [embeddingString, limit]);
  return result.rows;
}

/**
 * Store a relationship between two thoughts
 * type: 'extends' | 'infers' | 'contradicts'
 */
export async function storeRelationship(fromId, toId, type, reason = null) {
  const query = `
    INSERT INTO thought_relationships (from_id, to_id, type, reason)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (from_id, to_id, type) DO NOTHING
    RETURNING id
  `;
  const result = await pool.query(query, [fromId, toId, type, reason]);
  return result.rows[0];
}

/**
 * Get all thoughts related to a given thought (both directions)
 */
export async function getRelatedThoughts(thoughtId) {
  const query = `SELECT * FROM get_related_thoughts($1)`;
  const result = await pool.query(query, [thoughtId]);
  return result.rows;
}

/**
 * Mark a thought as superseded by a newer one
 */
export async function markSuperseded(oldId, newId) {
  const query = `
    UPDATE thoughts SET superseded_by = $2
    WHERE id = $1
    RETURNING id
  `;
  const result = await pool.query(query, [oldId, newId]);
  return result.rows[0];
}

/**
 * Search thoughts by semantic similarity (vector-only, excludes superseded)
 */
export async function searchThoughts(queryEmbedding, threshold = 0.3, limit = 10, filter = {}) {
  const query = `SELECT * FROM match_thoughts($1, $2, $3, $4)`;
  const embeddingString = pgvector.toSql(queryEmbedding);
  const result = await pool.query(query, [embeddingString, threshold, limit, filter]);
  return result.rows;
}

/**
 * Hybrid search: vector + full-text (excludes superseded)
 */
export async function searchThoughtsHybrid(queryEmbedding, queryText, threshold = 0.2, limit = 10, filter = {}) {
  const query = `SELECT * FROM match_thoughts_hybrid($1, $2, $3, $4, $5)`;
  const embeddingString = pgvector.toSql(queryEmbedding);
  const result = await pool.query(query, [embeddingString, queryText, threshold, limit, filter]);
  return result.rows;
}

/**
 * Keyword-only search using full-text (excludes superseded)
 */
export async function searchThoughtsKeyword(queryText, limit = 10, filter = {}) {
  const query = `SELECT * FROM match_thoughts_keyword($1, $2, $3)`;
  const result = await pool.query(query, [queryText, limit, filter]);
  return result.rows;
}

/**
 * Get recent thoughts (active only by default)
 */
export async function getRecentThoughts(limit = 20, offset = 0, includeSuperseded = false) {
  const query = `
    SELECT id, content, metadata, created_at, event_date, superseded_by
    FROM thoughts
    ${includeSuperseded ? '' : 'WHERE superseded_by IS NULL'}
    ORDER BY created_at DESC
    LIMIT $1 OFFSET $2
  `;
  const result = await pool.query(query, [limit, offset]);
  return result.rows;
}

/**
 * Get thoughts within a date range (by capture date or event date)
 */
export async function getThoughtsByDateRange(startDate, endDate, dateField = 'created_at') {
  const field = dateField === 'event_date' ? 'event_date' : 'created_at';
  const query = `
    SELECT id, content, metadata, created_at, event_date, superseded_by
    FROM thoughts
    WHERE ${field} >= $1 AND ${field} <= $2
      AND superseded_by IS NULL
    ORDER BY ${field} DESC
  `;
  const result = await pool.query(query, [startDate, endDate]);
  return result.rows;
}

/**
 * Get a single thought by ID (includes superseded)
 */
export async function getThoughtById(id) {
  const query = `
    SELECT id, content, metadata, created_at, event_date, superseded_by
    FROM thoughts WHERE id = $1
  `;
  const result = await pool.query(query, [id]);
  return result.rows[0];
}

/**
 * Get brain statistics
 */
export async function getStats() {
  const query = `SELECT * FROM brain_stats`;
  const result = await pool.query(query);
  return result.rows[0];
}

/**
 * Delete a thought by ID
 */
export async function deleteThought(id) {
  const query = `DELETE FROM thoughts WHERE id = $1 RETURNING id`;
  const result = await pool.query(query, [id]);
  return result.rows[0];
}

/**
 * Update thought metadata
 */
export async function updateMetadata(id, metadata) {
  const query = `
    UPDATE thoughts
    SET metadata = metadata || $2
    WHERE id = $1
    RETURNING id, content, metadata, created_at, event_date, superseded_by
  `;
  const result = await pool.query(query, [id, metadata]);
  return result.rows[0];
}

/**
 * Test database connection
 */
export async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW()');
    return { success: true, timestamp: result.rows[0].now };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Close database connection pool
 */
export async function closePool() {
  await pool.end();
}

export default {
  storeThought,
  checkNearDuplicate,
  findContradictionCandidates,
  storeRelationship,
  getRelatedThoughts,
  markSuperseded,
  searchThoughts,
  searchThoughtsHybrid,
  searchThoughtsKeyword,
  getRecentThoughts,
  getThoughtsByDateRange,
  getThoughtById,
  getStats,
  deleteThought,
  updateMetadata,
  testConnection,
  closePool,
};
