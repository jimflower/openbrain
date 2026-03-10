// Open Brain MCP Server
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import db from './db.js';
import { generateEmbedding } from './embeddings.js';
import { extractMetadata, classifyRelationship } from './metadata.js';

dotenv.config();

const server = new Server(
  { name: 'open-brain', version: '3.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'capture_thought',
      description: 'Save a new thought to OpenBrain. Automatically deduplicates, detects contradictions with existing memories (marking old ones as superseded), extracts metadata, and supports an optional event_date for when the described event actually happened.',
      inputSchema: {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: 'The thought to capture — a clear, standalone statement that will make sense when retrieved later.',
          },
          event_date: {
            type: 'string',
            description: 'Optional ISO date (YYYY-MM-DD) for when the described event happened, if different from today. E.g. "2026-03-08" for something that happened last Friday.',
          },
        },
        required: ['content'],
      },
    },
    {
      name: 'search_thoughts',
      description: 'Search captured thoughts. Defaults to hybrid search (vector + keyword). Use mode="keyword" for exact term matching, mode="vector" for pure semantic similarity.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'What to search for' },
          mode: {
            type: 'string',
            description: 'Search mode: "hybrid" (default), "vector", or "keyword"',
            enum: ['hybrid', 'vector', 'keyword'],
            default: 'hybrid',
          },
          limit: { type: 'number', description: 'Maximum results. Default: 10', default: 10 },
          threshold: { type: 'number', description: 'Similarity threshold (0.0–1.0). Default: 0.2 for hybrid, 0.3 for vector', default: 0.2 },
        },
        required: ['query'],
      },
    },
    {
      name: 'list_thoughts',
      description: 'List recently captured thoughts with optional filters. Only returns active (non-superseded) thoughts by default.',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Number of thoughts to return. Default: 10', default: 10 },
          type: { type: 'string', description: 'Filter by type: observation, task, idea, reference, person_note' },
          topic: { type: 'string', description: 'Filter by topic tag' },
          person: { type: 'string', description: 'Filter by person mentioned' },
          days: { type: 'number', description: 'Only thoughts from the last N days' },
        },
      },
    },
    {
      name: 'get_related_thoughts',
      description: 'Get all thoughts connected to a specific thought via the relationship graph. Shows extends, infers, and contradicts links in both directions. Use this to explore context around a thought found via search.',
      inputSchema: {
        type: 'object',
        properties: {
          thought_id: { type: 'number', description: 'The ID of the thought to get relationships for' },
        },
        required: ['thought_id'],
      },
    },
    {
      name: 'thought_stats',
      description: 'Get a summary of all captured thoughts: totals, active vs superseded, relationship counts, types, top topics, and people.',
      inputSchema: { type: 'object', properties: {} },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {

      case 'capture_thought': {
        const { content, event_date = null } = args;
        if (!content) throw new Error('Content is required');

        // Generate embedding
        const embedding = await generateEmbedding(content);

        // 1. Deduplication check
        const duplicate = await db.checkNearDuplicate(embedding, 0.92);
        if (duplicate) {
          return {
            content: [{
              type: 'text',
              text: `⚡ Near-duplicate detected (${(duplicate.similarity * 100).toFixed(1)}% match) — not stored.\nExisting thought #${duplicate.id} from ${new Date(duplicate.created_at).toLocaleDateString()}: "${duplicate.content.slice(0, 120)}..."`,
            }],
          };
        }

        // 2. Relationship classification
        const candidates = await db.findContradictionCandidates(embedding, 5);
        const supersededIds = [];
        const relationships = [];
        for (const candidate of candidates) {
          const { type, reason } = await classifyRelationship(candidate.content, content);
          if (type === 'contradicts') {
            supersededIds.push({ id: candidate.id, reason });
          } else if (type === 'extends' || type === 'infers') {
            relationships.push({ id: candidate.id, type, reason });
          }
        }

        // 3. Extract metadata
        const metadata = await extractMetadata(content);
        if (supersededIds.length > 0) metadata.supersedes = supersededIds.map(s => s.id);

        // 4. Resolve event_date
        const resolvedEventDate = event_date || metadata.event_date || null;
        delete metadata.event_date;

        // 5. Store
        const thought = await db.storeThought(content, embedding, { ...metadata, source: 'mcp' }, resolvedEventDate);

        // 6. Persist relationships
        for (const s of supersededIds) {
          await db.markSuperseded(s.id, thought.id);
          await db.storeRelationship(thought.id, s.id, 'contradicts', s.reason);
        }
        for (const r of relationships) {
          await db.storeRelationship(thought.id, r.id, r.type, r.reason);
        }

        // Build confirmation
        let confirmation = `✅ Captured as ${metadata.type || 'thought'}`;
        if (Array.isArray(metadata.topics) && metadata.topics.length) {
          confirmation += ` — ${metadata.topics.join(', ')}`;
        }
        if (resolvedEventDate) {
          confirmation += ` | Event date: ${resolvedEventDate}`;
        }
        if (Array.isArray(metadata.people) && metadata.people.length) {
          confirmation += ` | People: ${metadata.people.join(', ')}`;
        }
        if (Array.isArray(metadata.action_items) && metadata.action_items.length) {
          confirmation += ` | Actions: ${metadata.action_items.join('; ')}`;
        }
        if (supersededIds.length > 0) {
          confirmation += `\n🔄 Superseded ${supersededIds.length} older thought(s): #${supersededIds.map(s => s.id).join(', #')}`;
        }
        if (relationships.length > 0) {
          const relSummary = relationships.map(r => `#${r.id} (${r.type})`).join(', ');
          confirmation += `\n🔗 Linked to: ${relSummary}`;
        }

        return { content: [{ type: 'text', text: confirmation }] };
      }

      case 'search_thoughts': {
        const { query, mode = 'hybrid', threshold, limit = 10 } = args;
        if (!query) throw new Error('Query is required');

        let results;

        if (mode === 'keyword') {
          results = await db.searchThoughtsKeyword(query, limit);
        } else if (mode === 'vector') {
          const queryEmbedding = await generateEmbedding(query);
          results = await db.searchThoughts(queryEmbedding, threshold ?? 0.3, limit);
        } else {
          const queryEmbedding = await generateEmbedding(query);
          results = await db.searchThoughtsHybrid(queryEmbedding, query, threshold ?? 0.2, limit);
        }

        if (results.length === 0) {
          return { content: [{ type: 'text', text: `No thoughts found matching "${query}" (mode: ${mode}).` }] };
        }

        const formatted = results.map((t, i) => {
          const m = t.metadata || {};
          const parts = [
            `--- Result ${i + 1} (${(t.similarity * 100).toFixed(1)}% match) ---`,
            `Captured: ${new Date(t.created_at).toLocaleDateString()}${t.event_date ? ` | Event: ${new Date(t.event_date).toLocaleDateString()}` : ''}`,
            `Type: ${m.type || 'unknown'}`,
          ];
          if (Array.isArray(m.topics) && m.topics.length) parts.push(`Topics: ${m.topics.join(', ')}`);
          if (Array.isArray(m.people) && m.people.length) parts.push(`People: ${m.people.join(', ')}`);
          if (Array.isArray(m.action_items) && m.action_items.length) parts.push(`Actions: ${m.action_items.join('; ')}`);
          parts.push(`\n${t.content}`);
          return parts.join('\n');
        });

        return {
          content: [{
            type: 'text',
            text: `Found ${results.length} thought(s) [${mode} search]:\n\n${formatted.join('\n\n')}`,
          }],
        };
      }

      case 'list_thoughts': {
        const { limit = 10, type, topic, person, days } = args;

        let thoughts = await db.getRecentThoughts(Math.max(limit * 5, 100));

        if (type) thoughts = thoughts.filter(t => t.metadata?.type === type);
        if (topic) thoughts = thoughts.filter(t => Array.isArray(t.metadata?.topics) && t.metadata.topics.includes(topic));
        if (person) thoughts = thoughts.filter(t => Array.isArray(t.metadata?.people) && t.metadata.people.includes(person));
        if (days) {
          const since = new Date();
          since.setDate(since.getDate() - days);
          thoughts = thoughts.filter(t => new Date(t.created_at) >= since);
        }

        if (thoughts.length === 0) {
          return { content: [{ type: 'text', text: 'No thoughts found.' }] };
        }

        const formatted = thoughts.slice(0, limit).map((t, i) => {
          const m = t.metadata || {};
          const topics = Array.isArray(m.topics) ? m.topics.join(', ') : '';
          const eventStr = t.event_date ? ` [event: ${new Date(t.event_date).toLocaleDateString()}]` : '';
          return `${i + 1}. [${new Date(t.created_at).toLocaleDateString()}${eventStr}] (${m.type || '??'}${topics ? ' — ' + topics : ''})\n   ${t.content}`;
        });

        return {
          content: [{
            type: 'text',
            text: `${Math.min(thoughts.length, limit)} thought(s):\n\n${formatted.join('\n\n')}`,
          }],
        };
      }

      case 'get_related_thoughts': {
        const { thought_id } = args;
        if (!thought_id) throw new Error('thought_id is required');

        const thought = await db.getThoughtById(thought_id);
        if (!thought) throw new Error(`Thought #${thought_id} not found`);

        const related = await db.getRelatedThoughts(thought_id);

        if (related.length === 0) {
          return {
            content: [{
              type: 'text',
              text: `Thought #${thought_id} has no linked relationships yet.\n\nThought: "${thought.content.slice(0, 200)}"`,
            }],
          };
        }

        const byType = { extends: [], infers: [], contradicts: [] };
        for (const r of related) {
          (byType[r.rel_type] || []).push(r);
        }

        const lines = [
          `Relationship graph for thought #${thought_id}:`,
          `"${thought.content.slice(0, 150)}${thought.content.length > 150 ? '...' : ''}"`,
          '',
        ];

        for (const [type, items] of Object.entries(byType)) {
          if (items.length === 0) continue;
          const emoji = type === 'extends' ? '📎' : type === 'infers' ? '💡' : '⚡';
          lines.push(`${emoji} ${type.toUpperCase()} (${items.length}):`);
          for (const r of items) {
            const dir = r.direction === 'outgoing' ? '→' : '←';
            lines.push(`  ${dir} #${r.id} [${new Date(r.created_at).toLocaleDateString()}]`);
            if (r.rel_reason) lines.push(`     Reason: ${r.rel_reason}`);
            lines.push(`     "${r.content.slice(0, 120)}${r.content.length > 120 ? '...' : ''}"`);
          }
          lines.push('');
        }

        return { content: [{ type: 'text', text: lines.join('\n') }] };
      }

      case 'thought_stats': {
        const stats = await db.getStats();
        const thoughts = await db.getRecentThoughts(10000, 0, true); // include superseded for counts

        const types = {};
        const topics = {};
        const people = {};

        for (const r of thoughts) {
          if (r.superseded_by) continue; // only count active thoughts
          const m = r.metadata || {};
          if (m.type) types[m.type] = (types[m.type] || 0) + 1;
          if (Array.isArray(m.topics)) for (const t of m.topics) topics[t] = (topics[t] || 0) + 1;
          if (Array.isArray(m.people)) for (const p of m.people) people[p] = (people[p] || 0) + 1;
        }

        const sort = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 10);

        const lines = [
          `Total thoughts: ${stats.total_thoughts || 0}`,
          `Active: ${stats.active_thoughts || 0} | Superseded: ${stats.superseded_thoughts || 0}`,
          `Relationships: ${stats.total_relationships || 0} total (extends: ${stats.extends_count || 0}, infers: ${stats.infers_count || 0}, contradicts: ${stats.contradicts_count || 0})`,
          `Date range: ${
            thoughts.length >= 2
              ? new Date(thoughts[thoughts.length - 1].created_at).toLocaleDateString() + ' → ' + new Date(thoughts[0].created_at).toLocaleDateString()
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

        return { content: [{ type: 'text', text: lines.join('\n') }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

async function main() {
  console.error('🧠 Open Brain MCP Server v2 starting...');
  const dbTest = await db.testConnection();
  if (!dbTest.success) {
    console.error('❌ Database connection failed:', dbTest.error);
    process.exit(1);
  }
  console.error('✓ Database connected');
  console.error('✓ MCP server ready (dedup + relationship graph + hybrid search active)');

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('MCP Server error:', error);
  process.exit(1);
});
