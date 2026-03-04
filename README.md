# Open Brain - Self-Hosted Edition

A fully self-hosted personal knowledge database with semantic search, optimized for CLI workflows and AI integrations.

## Features

- **Self-hosted**: Everything runs on your server (PostgreSQL + Node.js)
- **CLI-first**: Quick thought capture from anywhere: `brain add "your thought"`
- **MCP Integration**: Works with Claude Code, Gemini CLI, and any MCP client
- **Hybrid AI**: Local embeddings (free, fast) + optional API models for metadata
- **No cloud dependencies**: Your data stays on your infrastructure

## Architecture

```
┌─────────────┐
│  CLI Tool   │ ──┐
└─────────────┘   │
                  ├──> ┌──────────────┐      ┌────────────────┐
┌─────────────┐   │    │  API Server  │ ───> │   PostgreSQL   │
│ Claude Code │ ──┼──> │  (Node.js)   │      │  + pgvector    │
└─────────────┘   │    └──────────────┘      └────────────────┘
                  │            │
┌─────────────┐   │            ├──> Local Embeddings (Ollama)
│ Gemini CLI  │ ──┘            └──> Metadata Extraction (API/Local)
└─────────────┘
```

## Quick Start

### Prerequisites

- Linux server with:
  - PostgreSQL 15+ installed
  - Node.js 18+ installed
  - Ollama installed (for local embeddings)
- API keys (optional): OpenAI, Anthropic, or Google for metadata extraction

### Installation

1. **Setup Database**
   ```bash
   cd database
   ./setup.sh
   ```

2. **Configure Server**
   ```bash
   cd server
   cp .env.example .env
   # Edit .env with your settings
   npm install
   ```

3. **Start Services**
   ```bash
   # Start API server
   npm start
   
   # In another terminal, start MCP server
   npm run mcp
   ```

4. **Install CLI Tool**
   ```bash
   cd cli
   npm install -g .
   brain config --server http://your-server:3000
   ```

5. **Connect AI Clients**
   
   **Claude Code:**
   ```bash
   claude mcp add --transport http open-brain \
     http://your-server:3001 \
     --header "Authorization: Bearer YOUR_ACCESS_KEY"
   ```
   
   **Gemini CLI / Other MCP Clients:**
   
   Add to your MCP config file:
   ```json
   {
     "mcpServers": {
       "open-brain": {
         "command": "npx",
         "args": [
           "mcp-remote",
           "http://your-server:3001",
           "--header",
           "Authorization:Bearer ${BRAIN_KEY}"
         ],
         "env": {
           "BRAIN_KEY": "your-access-key-here"
         }
       }
     }
   }
   ```

## Usage

### Capture Thoughts

```bash
# Quick capture
brain add "Met with Sarah about the Q2 roadmap"

# Multi-line capture
brain add "Project update:
- Backend API is 80% done
- Frontend needs another sprint
- Launch target: March 15"

# Check recent captures
brain recent

# Search your brain
brain search "roadmap"
```

### With AI Clients

In Claude Code or Gemini CLI:
- "What did I capture about the Q2 roadmap?"
- "Search my brain for notes about Sarah"
- "Remember: decided to postpone the launch to March 20"
- "Show me everything I captured this week"

## Configuration

### Server Settings (`server/.env`)

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/openbrain

# Server ports
API_PORT=3000
MCP_PORT=3001

# Security
ACCESS_KEY=your-secure-random-key

# Embeddings (choose one or both)
EMBEDDING_MODE=local  # local, api, or hybrid
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=nomic-embed-text

# Metadata extraction (optional)
METADATA_MODE=local  # local, api, or skip
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...
```

### Models

**Embeddings:**
- `local`: Uses Ollama (nomic-embed-text) - free, fast, private
- `api`: Uses OpenAI's text-embedding-3-small
- `hybrid`: Tries local first, falls back to API

**Metadata:**
- `local`: Uses Ollama (llama3 or similar) - free but basic
- `api`: Uses GPT-4o-mini or Claude Haiku - costs ~$0.15/million tokens
- `skip`: No metadata extraction, just embeddings

## Cost Considerations

**Fully Local (Recommended):**
- Cost: $0/month
- Requirements: ~8GB RAM for Ollama with nomic-embed-text
- Metadata quality: Basic but functional

**Hybrid (Best of Both):**
- Cost: ~$0.10-0.30/month for 20 thoughts/day
- Uses local embeddings (free) + API for metadata (cheap)
- Metadata quality: Excellent

## Troubleshooting

### CLI tool can't connect
```bash
brain config --server http://your-server:3000 --key your-access-key
brain test
```

### MCP server not responding
Check if it's running:
```bash
curl http://localhost:3001/health
```

View logs:
```bash
cd server
npm run mcp:logs
```

### Embeddings failing
Make sure Ollama is running:
```bash
ollama serve
ollama pull nomic-embed-text
```

### PostgreSQL connection issues
```bash
psql -U openbrain -d openbrain -c "SELECT COUNT(*) FROM thoughts;"
```

## File Structure

```
open-brain-selfhosted/
├── database/
│   ├── setup.sh              # Database initialization script
│   └── schema.sql            # Database schema
├── server/
│   ├── src/
│   │   ├── api.js           # REST API for capture/search
│   │   ├── mcp.js           # MCP server for AI clients
│   │   ├── embeddings.js    # Embedding generation
│   │   ├── metadata.js      # Metadata extraction
│   │   └── db.js            # Database operations
│   ├── package.json
│   └── .env.example
├── cli/
│   ├── bin/
│   │   └── brain.js         # CLI entry point
│   ├── package.json
│   └── config.json
└── README.md
```

## Security Notes

- The API server should be behind a reverse proxy (nginx/caddy) with HTTPS
- Use a strong random key for `ACCESS_KEY` (generate with `openssl rand -hex 32`)
- Firewall rules: only expose necessary ports
- Consider VPN if accessing from outside your network

## Maintenance

### Backup
```bash
# Database backup
pg_dump -U openbrain openbrain > backup.sql

# Or use the included script
cd database
./backup.sh
```

### Monitor disk usage
```bash
brain stats
```

## License

Adapted from the Open Brain guide by Nate B. Jones
Self-hosted implementation for personal use
