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

// Initialize clients
let ollama = null;
let anthropic = null;
let openai = null;
let googleAI = null;

if (METADATA_MODE === 'local') {
  ollama = new Ollama({ host: OLLAMA_URL });
}

if (METADATA_MODE === 'api') {
  if (process.env.ANTHROPIC_API_KEY) {
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  if (process.env.GOOGLE_API_KEY) {
    googleAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
  }
}

const METADATA_PROMPT = `Extract metadata from the following thought. Respond ONLY with valid JSON, no explanation.

Return this structure:
{
  "type": "one of: thought, task, note, person_note, idea, decision, question, meeting_note, resource",
  "tags": ["2-5 relevant keywords"],
  "people": ["names mentioned"],
  "action_items": ["any tasks or follow-ups"],
  "summary": "one sentence summary"
}

Thought: {{CONTENT}}

JSON:`;

/**
 * Extract metadata using Ollama (local)
 */
async function extractLocalMetadata(content) {
  try {
    const prompt = METADATA_PROMPT.replace('{{CONTENT}}', content);
    
    const response = await ollama.generate({
      model: OLLAMA_LLM_MODEL,
      prompt: prompt,
      stream: false,
    });
    
    // Try to parse JSON from response
    const text = response.response.trim();
    
    // Extract JSON from markdown code blocks if present
    let jsonText = text;
    const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }
    
    try {
      const metadata = JSON.parse(jsonText);
      return cleanMetadata(metadata);
    } catch (parseError) {
      console.warn('Failed to parse local metadata, using basic extraction');
      return extractBasicMetadata(content);
    }
  } catch (error) {
    console.error('Ollama metadata error:', error.message);
    return extractBasicMetadata(content);
  }
}

/**
 * Extract metadata using Claude API
 */
async function extractClaudeMetadata(content) {
  const message = await anthropic.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: METADATA_PROMPT.replace('{{CONTENT}}', content),
    }],
  });
  
  const text = message.content[0].text.trim();
  return JSON.parse(text);
}

/**
 * Extract metadata using OpenAI API
 */
async function extractOpenAIMetadata(content) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{
      role: 'user',
      content: METADATA_PROMPT.replace('{{CONTENT}}', content),
    }],
    response_format: { type: 'json_object' },
    max_tokens: 500,
  });
  
  const text = response.choices[0].message.content.trim();
  return JSON.parse(text);
}

/**
 * Extract metadata using Google Gemini API
 */
async function extractGeminiMetadata(content) {
  const model = googleAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const result = await model.generateContent(
    METADATA_PROMPT.replace('{{CONTENT}}', content)
  );
  const text = result.response.text().trim();
  
  // Extract JSON from response
  let jsonText = text;
  const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
  if (jsonMatch) {
    jsonText = jsonMatch[1];
  }
  
  return JSON.parse(jsonText);
}

/**
 * Basic metadata extraction (fallback)
 */
function extractBasicMetadata(content) {
  const words = content.toLowerCase().split(/\s+/);
  
  // Extract potential names (capitalized words)
  const people = [];
  const nameMatches = content.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g);
  if (nameMatches) {
    people.push(...nameMatches.slice(0, 5));
  }
  
  // Determine type based on keywords
  let type = 'note';
  if (content.includes('?')) type = 'question';
  else if (words.some(w => ['todo', 'task', 'need to', 'should', 'must'].includes(w))) type = 'task';
  else if (words.some(w => ['decided', 'decision', 'choosing'].includes(w))) type = 'decision';
  else if (words.some(w => ['meeting', 'discussed', 'met with'].includes(w))) type = 'meeting_note';
  else if (words.some(w => ['idea', 'what if', 'could we'].includes(w))) type = 'idea';
  
  // Extract basic tags
  const tags = [];
  if (content.length < 100) tags.push('quick-note');
  if (people.length > 0) tags.push('people');
  
  return {
    type,
    tags: tags.slice(0, 5),
    people: [...new Set(people)],
    action_items: [],
    summary: content.slice(0, 60) + (content.length > 60 ? '...' : ''),
  };
}

/**
 * Clean and validate metadata structure
 */
function cleanMetadata(metadata) {
  return {
    type: metadata.type || 'note',
    tags: (metadata.tags || []).slice(0, 5),
    people: (metadata.people || []).slice(0, 10),
    action_items: (metadata.action_items || []).slice(0, 5),
    summary: metadata.summary || '',
  };
}

/**
 * Main metadata extraction function
 */
export async function extractMetadata(content) {
  if (METADATA_MODE === 'skip') {
    return extractBasicMetadata(content);
  }
  
  try {
    if (METADATA_MODE === 'local') {
      return await extractLocalMetadata(content);
    }
    
    if (METADATA_MODE === 'api') {
      // Try API providers in order of preference
      if (METADATA_API_MODEL === 'claude-haiku' && anthropic) {
        const metadata = await extractClaudeMetadata(content);
        return cleanMetadata(metadata);
      } else if (METADATA_API_MODEL === 'gpt-4o-mini' && openai) {
        const metadata = await extractOpenAIMetadata(content);
        return cleanMetadata(metadata);
      } else if (METADATA_API_MODEL === 'gemini-flash' && googleAI) {
        const metadata = await extractGeminiMetadata(content);
        return cleanMetadata(metadata);
      } else {
        // Try any available API
        if (anthropic) {
          const metadata = await extractClaudeMetadata(content);
          return cleanMetadata(metadata);
        } else if (openai) {
          const metadata = await extractOpenAIMetadata(content);
          return cleanMetadata(metadata);
        } else if (googleAI) {
          const metadata = await extractGeminiMetadata(content);
          return cleanMetadata(metadata);
        } else {
          throw new Error('No API keys configured');
        }
      }
    }
  } catch (error) {
    console.error('Metadata extraction error:', error.message);
    return extractBasicMetadata(content);
  }
  
  return extractBasicMetadata(content);
}

/**
 * Test metadata service
 */
export async function testMetadataService() {
  try {
    const testContent = "Met with Sarah about the Q2 roadmap. Need to follow up on the API redesign.";
    const metadata = await extractMetadata(testContent);
    
    return {
      success: true,
      mode: METADATA_MODE,
      model: METADATA_MODE === 'local' ? OLLAMA_LLM_MODEL : METADATA_API_MODEL,
      metadata,
    };
  } catch (error) {
    return {
      success: false,
      mode: METADATA_MODE,
      error: error.message,
    };
  }
}

export default {
  extractMetadata,
  testMetadataService,
};
