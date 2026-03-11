// Metadata extraction for Open Brain
import { Ollama } from 'ollama';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const METADATA_MODE = process.env.METADATA_MODE || 'local';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_LLM_MODEL = process.env.OLLAMA_LLM_MODEL || 'llama3:8b';
const METADATA_API_MODEL = process.env.METADATA_API_MODEL || 'claude-haiku';

let ollama = null;
let anthropic = null;
let openai = null;
let googleAI = null;

if (METADATA_MODE === 'local') {
  ollama = new Ollama({ host: OLLAMA_URL });
}

if (METADATA_MODE === 'api') {
  if (process.env.ANTHROPIC_API_KEY) anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  if (process.env.OPENAI_API_KEY) openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  if (process.env.GOOGLE_API_KEY) googleAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
}

const TODAY = new Date().toISOString().split('T')[0];

const METADATA_PROMPT = `Extract metadata from the user's captured thought. Today is ${TODAY}. Return JSON only with these fields:
- "people": array of people mentioned (empty if none)
- "action_items": array of implied to-dos (empty if none)
- "dates_mentioned": array of dates YYYY-MM-DD (empty if none)
- "topics": array of 1-3 short topic tags (always at least one)
- "type": one of "observation", "task", "idea", "reference", "person_note"
- "event_date": ISO date (YYYY-MM-DD) if the thought describes something that happened on a specific date. Use today (${TODAY}) if the event is clearly recent/today. Null if no specific date applies.
- "expires_at": ISO date (YYYY-MM-DD) if the thought is about something time-sensitive that will become irrelevant after a certain point — e.g. a meeting tomorrow, a deadline this week, a temporary state ("I'm travelling next week"), a one-off event. Set to the day AFTER the thing is expected to be over. Null for permanent or ongoing facts (preferences, biographical info, skills, decisions, relationships, general observations).

Only extract what's explicitly there. Return valid JSON only, no markdown.

Thought: {{CONTENT}}

JSON:`;

const RELATIONSHIP_PROMPT = `Classify the relationship between two statements.

Statement A (existing): "{{EXISTING}}"
Statement B (new): "{{NEW}}"

Choose the single most accurate relationship type:
- CONTRADICTS: B directly contradicts, reverses, or replaces A (status changed, fact corrected, outcome reversed)
- EXTENDS: B adds new information about the same subject as A (elaborates, updates, continues the same thread)
- INFERS: A and B are related and together imply something meaningful, but neither contradicts nor extends the other
- UNRELATED: A and B are about sufficiently different topics — no meaningful relationship

Answer with exactly one word on the first line (CONTRADICTS/EXTENDS/INFERS/UNRELATED), then one brief sentence explaining why.`;

/**
 * Extract metadata using Ollama (local)
 */
async function extractLocalMetadata(content) {
  try {
    const prompt = METADATA_PROMPT.replace('{{CONTENT}}', content);
    const response = await ollama.generate({ model: OLLAMA_LLM_MODEL, prompt, stream: false });
    const text = response.response.trim();

    let jsonText = text;
    const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (jsonMatch) jsonText = jsonMatch[1];

    try {
      return cleanMetadata(JSON.parse(jsonText));
    } catch {
      return extractBasicMetadata(content);
    }
  } catch (error) {
    console.error('Ollama metadata error:', error.message);
    return extractBasicMetadata(content);
  }
}

/**
 * Classify relationship using Ollama (local)
 */
async function classifyRelationshipLocal(existingContent, newContent) {
  try {
    const prompt = RELATIONSHIP_PROMPT
      .replace('{{EXISTING}}', existingContent)
      .replace('{{NEW}}', newContent);
    const response = await ollama.generate({ model: OLLAMA_LLM_MODEL, prompt, stream: false });
    const text = response.response.trim();
    const firstLine = text.split('\n')[0].trim().toUpperCase();
    const type = ['CONTRADICTS', 'EXTENDS', 'INFERS'].includes(firstLine) ? firstLine.toLowerCase() : 'unrelated';
    return { type, reason: text.split('\n').slice(1).join(' ').trim() };
  } catch (error) {
    console.error('Relationship classify error:', error.message);
    return { type: 'unrelated', reason: 'check failed' };
  }
}

/**
 * Extract metadata using Claude API
 */
async function extractClaudeMetadata(content) {
  const message = await anthropic.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 500,
    messages: [{ role: 'user', content: METADATA_PROMPT.replace('{{CONTENT}}', content) }],
  });
  return JSON.parse(message.content[0].text.trim());
}

/**
 * Classify relationship using Claude API
 */
async function classifyRelationshipClaude(existingContent, newContent) {
  try {
    const prompt = RELATIONSHIP_PROMPT
      .replace('{{EXISTING}}', existingContent)
      .replace('{{NEW}}', newContent);
    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 100,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = message.content[0].text.trim();
    const firstLine = text.split('\n')[0].trim().toUpperCase();
    const type = ['CONTRADICTS', 'EXTENDS', 'INFERS'].includes(firstLine) ? firstLine.toLowerCase() : 'unrelated';
    return { type, reason: text.split('\n').slice(1).join(' ').trim() };
  } catch (error) {
    console.error('Relationship classify error:', error.message);
    return { type: 'unrelated', reason: 'check failed' };
  }
}

/**
 * Extract metadata using OpenAI
 */
async function extractOpenAIMetadata(content) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: METADATA_PROMPT.replace('{{CONTENT}}', content) }],
    response_format: { type: 'json_object' },
    max_tokens: 500,
  });
  return JSON.parse(response.choices[0].message.content.trim());
}

/**
 * Extract metadata using Google Gemini
 */
async function extractGeminiMetadata(content) {
  const model = googleAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const result = await model.generateContent(METADATA_PROMPT.replace('{{CONTENT}}', content));
  let text = result.response.text().trim();
  const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
  if (jsonMatch) text = jsonMatch[1];
  return JSON.parse(text);
}

/**
 * Basic metadata extraction (fallback — no LLM)
 */
function extractBasicMetadata(content) {
  const words = content.toLowerCase().split(/\s+/);
  const people = [];
  const nameMatches = content.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g);
  if (nameMatches) people.push(...nameMatches.slice(0, 5));

  let type = 'observation';
  if (words.some(w => ['todo', 'task', 'need', 'should', 'must'].includes(w))) type = 'task';
  else if (words.some(w => ['idea', 'what if', 'could'].includes(w))) type = 'idea';
  else if (people.length > 0) type = 'person_note';
  else if (words.some(w => ['http', 'link', 'article', 'book', 'paper'].includes(w))) type = 'reference';

  const topics = ['uncategorized'];
  if (people.length > 0) topics.push('people');
  if (content.length < 50) topics.push('quick-note');

  return {
    type,
    topics: topics.slice(0, 3),
    people: [...new Set(people)],
    action_items: [],
    dates_mentioned: [],
    event_date: null,
    expires_at: null,
  };
}

/**
 * Clean and validate metadata structure
 */
function cleanMetadata(metadata) {
  return {
    type: metadata.type || 'observation',
    topics: (metadata.topics || ['uncategorized']).slice(0, 3),
    people: (metadata.people || []).slice(0, 10),
    action_items: (metadata.action_items || []).slice(0, 5),
    dates_mentioned: (metadata.dates_mentioned || []).slice(0, 5),
    event_date: metadata.event_date || null,
    expires_at: metadata.expires_at || null,
  };
}

/**
 * Main metadata extraction function
 */
export async function extractMetadata(content) {
  if (METADATA_MODE === 'skip') return extractBasicMetadata(content);

  try {
    if (METADATA_MODE === 'local') {
      return await extractLocalMetadata(content);
    }

    if (METADATA_MODE === 'api') {
      if (METADATA_API_MODEL === 'claude-haiku' && anthropic) {
        return cleanMetadata(await extractClaudeMetadata(content));
      } else if (METADATA_API_MODEL === 'gpt-4o-mini' && openai) {
        return cleanMetadata(await extractOpenAIMetadata(content));
      } else if (METADATA_API_MODEL === 'gemini-flash' && googleAI) {
        return cleanMetadata(await extractGeminiMetadata(content));
      } else if (anthropic) {
        return cleanMetadata(await extractClaudeMetadata(content));
      } else if (openai) {
        return cleanMetadata(await extractOpenAIMetadata(content));
      } else if (googleAI) {
        return cleanMetadata(await extractGeminiMetadata(content));
      } else {
        throw new Error('No API keys configured');
      }
    }
  } catch (error) {
    console.error('Metadata extraction error:', error.message);
    return extractBasicMetadata(content);
  }

  return extractBasicMetadata(content);
}

/**
 * Classify the relationship between two thoughts.
 * Returns { type: 'contradicts'|'extends'|'infers'|'unrelated', reason: string }
 */
export async function classifyRelationship(existingContent, newContent) {
  if (METADATA_MODE === 'skip') return { type: 'unrelated', reason: 'skip mode' };

  try {
    if (METADATA_MODE === 'local') {
      return await classifyRelationshipLocal(existingContent, newContent);
    }
    if (METADATA_MODE === 'api' && anthropic) {
      return await classifyRelationshipClaude(existingContent, newContent);
    }
  } catch (error) {
    console.error('Relationship classification failed:', error.message);
  }
  return { type: 'unrelated', reason: 'unavailable' };
}

/**
 * Test metadata service
 */
export async function testMetadataService() {
  try {
    const testContent = "Met with Sarah about the Q2 roadmap yesterday. Need to follow up on the API redesign.";
    const metadata = await extractMetadata(testContent);
    return {
      success: true,
      mode: METADATA_MODE,
      model: METADATA_MODE === 'local' ? OLLAMA_LLM_MODEL : METADATA_API_MODEL,
      metadata,
    };
  } catch (error) {
    return { success: false, mode: METADATA_MODE, error: error.message };
  }
}

export default { extractMetadata, classifyRelationship, testMetadataService };
