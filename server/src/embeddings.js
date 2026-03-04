// Embedding generation for Open Brain
import { Ollama } from 'ollama';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const EMBEDDING_MODE = process.env.EMBEDDING_MODE || 'local';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text';
const OPENAI_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';

// Initialize clients
let ollama = null;
let openai = null;

if (EMBEDDING_MODE === 'local' || EMBEDDING_MODE === 'hybrid') {
  ollama = new Ollama({ host: OLLAMA_URL });
}

if ((EMBEDDING_MODE === 'api' || EMBEDDING_MODE === 'hybrid') && process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

/**
 * Generate embedding using Ollama (local)
 */
async function generateLocalEmbedding(text) {
  try {
    const response = await ollama.embeddings({
      model: OLLAMA_MODEL,
      prompt: text,
    });
    
    return response.embedding;
  } catch (error) {
    console.error('Ollama embedding error:', error.message);
    throw new Error(`Local embedding failed: ${error.message}`);
  }
}

/**
 * Generate embedding using OpenAI API
 */
async function generateAPIEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: OPENAI_MODEL,
      input: text,
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('OpenAI embedding error:', error.message);
    throw new Error(`API embedding failed: ${error.message}`);
  }
}

/**
 * Main embedding function - dispatches based on mode
 */
export async function generateEmbedding(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Text must be a non-empty string');
  }

  switch (EMBEDDING_MODE) {
    case 'local':
      return await generateLocalEmbedding(text);
    
    case 'api':
      if (!openai) {
        throw new Error('API mode selected but OPENAI_API_KEY not configured');
      }
      return await generateAPIEmbedding(text);
    
    case 'hybrid':
      try {
        return await generateLocalEmbedding(text);
      } catch (error) {
        console.warn('Local embedding failed, falling back to API');
        if (!openai) {
          throw new Error('Hybrid fallback failed: OPENAI_API_KEY not configured');
        }
        return await generateAPIEmbedding(text);
      }
    
    default:
      throw new Error(`Unknown embedding mode: ${EMBEDDING_MODE}`);
  }
}

/**
 * Get embedding dimensions based on current model
 */
export function getEmbeddingDimensions() {
  if (EMBEDDING_MODE === 'local' || EMBEDDING_MODE === 'hybrid') {
    // Common Ollama embedding model dimensions
    switch (OLLAMA_MODEL) {
      case 'nomic-embed-text':
        return 768;
      case 'mxbai-embed-large':
        return 1024;
      case 'all-minilm':
        return 384;
      default:
        return 768; // Default assumption
    }
  } else {
    // OpenAI dimensions
    return OPENAI_MODEL.includes('3-small') ? 1536 : 1536;
  }
}

/**
 * Test embedding service
 */
export async function testEmbeddingService() {
  try {
    const testText = "This is a test";
    const embedding = await generateEmbedding(testText);
    
    return {
      success: true,
      mode: EMBEDDING_MODE,
      model: EMBEDDING_MODE === 'local' ? OLLAMA_MODEL : OPENAI_MODEL,
      dimensions: embedding.length,
    };
  } catch (error) {
    return {
      success: false,
      mode: EMBEDDING_MODE,
      error: error.message,
    };
  }
}

export default {
  generateEmbedding,
  getEmbeddingDimensions,
  testEmbeddingService,
};
