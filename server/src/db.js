// Database operations for Open Brain
import pkg from 'pg';
const { Pool } = pkg;
import pgvector from 'pgvector/pg';
import dotenv from 'dotenv';

dotenv.config();

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Register pgvector types
await pgvector.registerType(pool);

/**
 * Store a thought in the database
 */
export async function storeThought(content, embedding, metadata = {}) {
  const query = `
    INSERT INTO thoughts (content, embedding, metadata)
    VALUES ($1, $2, $3)
    RETURNING id, content, metadata, created_at
  `;
  
  const embeddingString = pgvector.toSql(embedding);
  const result = await pool.query(query, [content, embeddingString, metadata]);
  return result.rows[0];
}

/**
 * Search thoughts by semantic similarity
 */
export async function searchThoughts(queryEmbedding, threshold = 0.3, limit = 10, filter = {}) {
  const query = `
    SELECT * FROM match_thoughts($1, $2, $3, $4)
  `;
  
  const embeddingString = pgvector.toSql(queryEmbedding);
  const result = await pool.query(query, [embeddingString, threshold, limit, filter]);
  return result.rows;
}

/**
 * Get recent thoughts
 */
export async function getRecentThoughts(limit = 20, offset = 0) {
  const query = `
    SELECT id, content, metadata, created_at
    FROM thoughts
    ORDER BY created_at DESC
    LIMIT $1 OFFSET $2
  `;
  
  const result = await pool.query(query, [limit, offset]);
  return result.rows;
}

/**
 * Get thoughts within a date range
 */
export async function getThoughtsByDateRange(startDate, endDate) {
  const query = `
    SELECT id, content, metadata, created_at
    FROM thoughts
    WHERE created_at >= $1 AND created_at <= $2
    ORDER BY created_at DESC
  `;
  
  const result = await pool.query(query, [startDate, endDate]);
  return result.rows;
}

/**
 * Get a single thought by ID
 */
export async function getThoughtById(id) {
  const query = `
    SELECT id, content, metadata, created_at
    FROM thoughts
    WHERE id = $1
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
    RETURNING id, content, metadata, created_at
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
  searchThoughts,
  getRecentThoughts,
  getThoughtsByDateRange,
  getThoughtById,
  getStats,
  deleteThought,
  updateMetadata,
  testConnection,
  closePool,
};
