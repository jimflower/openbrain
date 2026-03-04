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
        description: 'Search your personal knowledge base using semantic similarity. Use this to find notes, ideas, decisions, or information you\'ve captured before.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query - can be a question, keywords, or description of what you\'re looking for',
            },
            threshold: {
              type: 'number',
              description: 'Similarity threshold (0.0 to 1.0). Lower = more results. Default: 0.3',
              default: 0.3,
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return. Default: 10',
              default: 10,
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'capture_thought',
        description: 'Save a new thought, note, idea, task, or any information to your knowledge base. It will be automatically embedded and searchable.',
        inputSchema: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'The thought, note, idea, or information to capture',
            },
          },
          required: ['content'],
        },
      },
      {
        name: 'recent_thoughts',
        description: 'Get your most recently captured thoughts. Useful for reviewing what you\'ve saved recently or finding something you just added.',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Number of recent thoughts to return. Default: 20',
              default: 20,
            },
          },
        },
      },
      {
        name: 'brain_stats',
        description: 'Get statistics about your knowledge base - total thoughts, recent activity, etc.',
        inputSchema: {
          type: 'object',
          properties: {},
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
        const { query, threshold = 0.3, limit = 10 } = args;
        
        if (!query) {
          throw new Error('Query is required');
        }
        
        // Generate embedding for query
        const queryEmbedding = await generateEmbedding(query);
        
        // Search
        const results = await db.searchThoughts(queryEmbedding, threshold, limit);
        
        if (results.length === 0) {
          return {
            content: [{
              type: 'text',
              text: `No thoughts found matching "${query}". Try:\n- Using different keywords\n- Lowering the threshold (try 0.2)\n- Broadening your search`,
            }],
          };
        }
        
        // Format results
        let response = `Found ${results.length} thought${results.length === 1 ? '' : 's'} matching "${query}":\n\n`;
        
        results.forEach((thought, idx) => {
          const date = new Date(thought.created_at).toLocaleDateString();
          const similarity = (thought.similarity * 100).toFixed(0);
          
          response += `${idx + 1}. [${similarity}% match] ${date}\n`;
          response += `   ${thought.content}\n`;
          
          if (thought.metadata && Object.keys(thought.metadata).length > 0) {
            if (thought.metadata.type) {
              response += `   Type: ${thought.metadata.type}\n`;
            }
            if (thought.metadata.tags && thought.metadata.tags.length > 0) {
              response += `   Tags: ${thought.metadata.tags.join(', ')}\n`;
            }
            if (thought.metadata.people && thought.metadata.people.length > 0) {
              response += `   People: ${thought.metadata.people.join(', ')}\n`;
            }
          }
          
          response += '\n';
        });
        
        return {
          content: [{
            type: 'text',
            text: response,
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
        
        // Store
        const thought = await db.storeThought(content, embedding, metadata);
        
        // Format confirmation
        let confirmation = `✓ Captured\n\n"${content}"\n\n`;
        
        if (metadata && Object.keys(metadata).length > 0) {
          confirmation += 'Metadata:\n';
          if (metadata.type) confirmation += `  Type: ${metadata.type}\n`;
          if (metadata.tags && metadata.tags.length > 0) {
            confirmation += `  Tags: ${metadata.tags.join(', ')}\n`;
          }
          if (metadata.people && metadata.people.length > 0) {
            confirmation += `  People: ${metadata.people.join(', ')}\n`;
          }
          if (metadata.action_items && metadata.action_items.length > 0) {
            confirmation += `  Action items:\n`;
            metadata.action_items.forEach(item => {
              confirmation += `    - ${item}\n`;
            });
          }
        }
        
        confirmation += `\nID: ${thought.id} | Saved: ${new Date(thought.created_at).toLocaleString()}`;
        
        return {
          content: [{
            type: 'text',
            text: confirmation,
          }],
        };
      }

      case 'recent_thoughts': {
        const { limit = 20 } = args;
        
        const thoughts = await db.getRecentThoughts(limit);
        
        if (thoughts.length === 0) {
          return {
            content: [{
              type: 'text',
              text: 'No thoughts captured yet. Use capture_thought to add your first one!',
            }],
          };
        }
        
        let response = `Your ${thoughts.length} most recent thought${thoughts.length === 1 ? '' : 's'}:\n\n`;
        
        thoughts.forEach((thought, idx) => {
          const date = new Date(thought.created_at).toLocaleDateString();
          const time = new Date(thought.created_at).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          });
          
          response += `${idx + 1}. ${date} ${time}\n`;
          response += `   ${thought.content}\n`;
          
          if (thought.metadata?.type) {
            response += `   [${thought.metadata.type}]\n`;
          }
          
          response += '\n';
        });
        
        return {
          content: [{
            type: 'text',
            text: response,
          }],
        };
      }

      case 'brain_stats': {
        const stats = await db.getStats();
        
        let response = '📊 Brain Statistics\n\n';
        response += `Total thoughts: ${stats.total_thoughts || 0}\n`;
        response += `This week: ${stats.this_week || 0}\n`;
        response += `This month: ${stats.this_month || 0}\n\n`;
        
        if (stats.first_thought) {
          const firstDate = new Date(stats.first_thought).toLocaleDateString();
          response += `First thought: ${firstDate}\n`;
        }
        
        if (stats.latest_thought) {
          const latestDate = new Date(stats.latest_thought).toLocaleDateString();
          const latestTime = new Date(stats.latest_thought).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
          });
          response += `Latest thought: ${latestDate} ${latestTime}\n`;
        }
        
        return {
          content: [{
            type: 'text',
            text: response,
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
