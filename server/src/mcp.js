// Open Brain MCP Server
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import db from './db.js';
import { generateEmbedding } from './embeddings.js';
import { extractMetadata } from './metadata.js';

dotenv.config();

const ACCESS_KEY = process.env.ACCESS_KEY;

// Create MCP server
const server = new Server(
  {
    name: 'open-brain',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * List available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'search_thoughts',
        description: 'Search captured thoughts by meaning. Use this when the user asks about a topic, person, or idea they\'ve previously captured.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'What to search for',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results. Default: 10',
              default: 10,
            },
            threshold: {
              type: 'number',
              description: 'Similarity threshold (0.0-1.0). Default: 0.5',
              default: 0.5,
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'list_thoughts',
        description: 'List recently captured thoughts with optional filters by type, topic, person, or time range.',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Number of thoughts to return. Default: 10',
              default: 10,
            },
            type: {
              type: 'string',
              description: 'Filter by type: observation, task, idea, reference, person_note',
            },
            topic: {
              type: 'string',
              description: 'Filter by topic tag',
            },
            person: {
              type: 'string',
              description: 'Filter by person mentioned',
            },
            days: {
              type: 'number',
              description: 'Only thoughts from the last N days',
            },
          },
        },
      },
      {
        name: 'thought_stats',
        description: 'Get a summary of all captured thoughts: totals, types, top topics, and people.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'capture_thought',
        description: 'Save a new thought to the Open Brain. Generates an embedding and extracts metadata automatically. Use this when the user wants to save something to their brain directly from any AI client.',
        inputSchema: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'The thought to capture - a clear, standalone statement that will make sense when retrieved later',
            },
          },
          required: ['content'],
        },
      },
    ],
  };
});

/**
 * Handle tool calls
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'search_thoughts': {
        const { query, threshold = 0.5, limit = 10 } = args;
        
        if (!query) {
          throw new Error('Query is required');
        }
        
        // Generate embedding for query
        const queryEmbedding = await generateEmbedding(query);
        
        // Search
        const results = await db.searchThoughts(queryEmbedding, threshold, limit, {});
        
        if (results.length === 0) {
          return {
            content: [{
              type: 'text',
              text: `No thoughts found matching "${query}".`,
            }],
          };
        }
        
        // Format results matching original
        const formatted = results.map((t, i) => {
          const m = t.metadata || {};
          const parts = [
            `--- Result ${i + 1} (${(t.similarity * 100).toFixed(1)}% match) ---`,
            `Captured: ${new Date(t.created_at).toLocaleDateString()}`,
            `Type: ${m.type || 'unknown'}`,
          ];
          if (Array.isArray(m.topics) && m.topics.length)
            parts.push(`Topics: ${m.topics.join(', ')}`);
          if (Array.isArray(m.people) && m.people.length)
            parts.push(`People: ${m.people.join(', ')}`);
          if (Array.isArray(m.action_items) && m.action_items.length)
            parts.push(`Actions: ${m.action_items.join('; ')}`);
          parts.push(`\n${t.content}`);
          return parts.join('\n');
        });
        
        return {
          content: [{
            type: 'text',
            text: `Found ${results.length} thought(s):\n\n${formatted.join('\n\n')}`,
          }],
        };
      }

      case 'list_thoughts': {
        const { limit = 10, type, topic, person, days } = args;
        
        let thoughts = await db.getRecentThoughts(limit);
        
        // Apply filters
        if (type) {
          thoughts = thoughts.filter(t => t.metadata?.type === type);
        }
        if (topic) {
          thoughts = thoughts.filter(t => 
            Array.isArray(t.metadata?.topics) && t.metadata.topics.includes(topic)
          );
        }
        if (person) {
          thoughts = thoughts.filter(t => 
            Array.isArray(t.metadata?.people) && t.metadata.people.includes(person)
          );
        }
        if (days) {
          const since = new Date();
          since.setDate(since.getDate() - days);
          thoughts = thoughts.filter(t => new Date(t.created_at) >= since);
        }
        
        if (thoughts.length === 0) {
          return {
            content: [{
              type: 'text',
              text: 'No thoughts found.',
            }],
          };
        }
        
        const formatted = thoughts.slice(0, limit).map((t, i) => {
          const m = t.metadata || {};
          const topics = Array.isArray(m.topics) ? m.topics.join(', ') : '';
          return `${i + 1}. [${new Date(t.created_at).toLocaleDateString()}] (${m.type || '??'}${topics ? ' - ' + topics : ''})\n   ${t.content}`;
        });
        
        return {
          content: [{
            type: 'text',
            text: `${thoughts.length} recent thought(s):\n\n${formatted.join('\n\n')}`,
          }],
        };
      }

      case 'thought_stats': {
        const thoughts = await db.getRecentThoughts(10000); // Get all
        const stats = await db.getStats();
        
        const types = {};
        const topics = {};
        const people = {};
        
        for (const r of thoughts) {
          const m = r.metadata || {};
          if (m.type) types[m.type] = (types[m.type] || 0) + 1;
          if (Array.isArray(m.topics))
            for (const t of m.topics) topics[t] = (topics[t] || 0) + 1;
          if (Array.isArray(m.people))
            for (const p of m.people) people[p] = (people[p] || 0) + 1;
        }
        
        const sort = (o) => Object.entries(o)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10);
        
        const lines = [
          `Total thoughts: ${stats.total_thoughts || 0}`,
          `Date range: ${
            thoughts.length >= 2
              ? new Date(thoughts[thoughts.length - 1].created_at).toLocaleDateString() +
                ' → ' +
                new Date(thoughts[0].created_at).toLocaleDateString()
              : 'N/A'
          }`,
          '',
          'Types:',
          ...sort(types).map(([k, v]) => `  ${k}: ${v}`),
        ];
        
        if (Object.keys(topics).length) {
          lines.push('', 'Top topics:');
          for (const [k, v] of sort(topics)) lines.push(`  ${k}: ${v}`);
        }
        
        if (Object.keys(people).length) {
          lines.push('', 'People mentioned:');
          for (const [k, v] of sort(people)) lines.push(`  ${k}: ${v}`);
        }
        
        return {
          content: [{
            type: 'text',
            text: lines.join('\n'),
          }],
        };
      }

      case 'capture_thought': {
        const { content } = args;
        
        if (!content) {
          throw new Error('Content is required');
        }
        
        // Generate embedding and metadata in parallel
        const [embedding, metadata] = await Promise.all([
          generateEmbedding(content),
          extractMetadata(content),
        ]);
        
        // Store with MCP source marker
        const thought = await db.storeThought(content, embedding, { ...metadata, source: 'mcp' });
        
        // Format confirmation matching original
        let confirmation = `Captured as ${metadata.type || 'thought'}`;
        if (Array.isArray(metadata.topics) && metadata.topics.length)
          confirmation += ` — ${metadata.topics.join(', ')}`;
        if (Array.isArray(metadata.people) && metadata.people.length)
          confirmation += ` | People: ${metadata.people.join(', ')}`;
        if (Array.isArray(metadata.action_items) && metadata.action_items.length)
          confirmation += ` | Actions: ${metadata.action_items.join('; ')}`;
        
        return {
          content: [{
            type: 'text',
            text: confirmation,
          }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error: ${error.message}`,
      }],
      isError: true,
    };
  }
});

/**
 * Start MCP server
 */
async function main() {
  console.error('🧠 Open Brain MCP Server starting...');
  
  // Test database connection
  const dbTest = await db.testConnection();
  if (!dbTest.success) {
    console.error('❌ Database connection failed:', dbTest.error);
    process.exit(1);
  }
  
  console.error('✓ Database connected');
  console.error('✓ MCP server ready');
  console.error('   Waiting for client connection via stdio...');
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('MCP Server error:', error);
  process.exit(1);
});
