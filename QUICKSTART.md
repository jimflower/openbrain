# Quick Start Guide

Get your self-hosted Open Brain running in under 10 minutes.

## Prerequisites Check

Before starting, make sure you have:

```bash
# Check PostgreSQL (should be 15+)
psql --version

# Check Node.js (should be 18+)
node --version

# Check Ollama
ollama --version
```

If any are missing, see [INSTALL.md](INSTALL.md) for installation instructions.

## Automated Installation

The fastest way to get started:

```bash
# Make install script executable
chmod +x install.sh

# Run installation
./install.sh
```

This will:
- Install all dependencies
- Set up the database
- Configure the server
- Install the CLI tool
- Run tests

**Save the access key** that's printed at the end!

## Manual Setup (4 Steps)

If you prefer manual control or the script doesn't work:

### 1. Setup Database (2 minutes)

```bash
cd database
chmod +x setup.sh
./setup.sh
```

**Important:** Copy the `DATABASE_URL` that's printed. You'll need it in step 2.

### 2. Configure Server (1 minute)

```bash
cd ../server
cp .env.example .env
nano .env  # or use your preferred editor
```

Edit these settings:

```bash
# Paste the DATABASE_URL from step 1
DATABASE_URL=postgresql://openbrain:...

# Generate an access key
ACCESS_KEY=<run: openssl rand -hex 32>

# Local mode (no API keys needed)
EMBEDDING_MODE=local
METADATA_MODE=local
```

Install dependencies:

```bash
npm install
```

### 3. Download Ollama Models (3 minutes)

```bash
ollama pull nomic-embed-text     # Required for embeddings (~274MB)
ollama pull llama3:8b            # Optional for metadata (~4.7GB)
```

If you skip llama3, set `METADATA_MODE=skip` in your `.env`.

### 4. Test Everything (1 minute)

```bash
# Test the server components
npm test

# Install CLI
cd ../cli
npm install -g .

# Configure CLI
brain config --server http://localhost:3000 --key YOUR_ACCESS_KEY

# Test CLI
brain test
```

## Start Using It

### Start the Servers

Option A - Run in terminals (for testing):

```bash
# Terminal 1
cd server
npm start

# Terminal 2
cd server
npm run mcp
```

Option B - Set up as services (recommended):

```bash
# See systemd/README.md for instructions
```

### Capture Your First Thought

```bash
brain add "Setting up my Open Brain - excited to try this!"
```

You should see a confirmation with extracted metadata.

### Search for It

```bash
brain search "setup"
```

You should see your thought with a high similarity score.

### Check Stats

```bash
brain stats
```

You should see 1 total thought.

## Connect AI Clients

### Claude Code

```bash
claude mcp add open-brain \
  --transport stdio \
  --command "node" \
  --arg "/absolute/path/to/server/src/mcp.js"
```

Test it:
- Open Claude Code
- Ask: "What thoughts do I have in my brain?"

### For Gemini CLI or Other MCP Clients

Add to your MCP config file (location varies by client):

```json
{
  "mcpServers": {
    "open-brain": {
      "command": "node",
      "args": ["/absolute/path/to/server/src/mcp.js"]
    }
  }
}
```

## Common First Commands

```bash
# Capture different types of thoughts
brain add "Task: Review PR #123 by Friday"
brain add "Met with Sarah about Q2 roadmap - API redesign is priority"
brain add "Idea: Use WebSockets for real-time updates"
brain add "Decision: Moving to monthly release cycle"

# Search by topic
brain search "Sarah"
brain search "API"
brain search "tasks"

# Browse recent
brain recent 10

# Check your brain
brain stats
```

## Verify It's Working

✅ **API Server Health Check:**
```bash
curl http://localhost:3000/health
# Should return: {"status":"ok","timestamp":"..."}
```

✅ **Capture via API:**
```bash
curl -X POST http://localhost:3000/capture \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_KEY" \
  -d '{"content":"Testing API capture"}'
```

✅ **Search via API:**
```bash
curl -X POST http://localhost:3000/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_KEY" \
  -d '{"query":"testing"}'
```

✅ **MCP Server (from AI client):**
- Ask Claude Code or Gemini: "Show me my recent thoughts"
- Should list your captured thoughts

## Troubleshooting

### "Cannot connect to server"

Make sure the API server is running:
```bash
cd server
npm start
```

### "Database connection failed"

Check PostgreSQL is running:
```bash
sudo systemctl status postgresql
sudo systemctl start postgresql  # if not running
```

Test connection:
```bash
psql -U openbrain -d openbrain -c "SELECT 1"
```

### "Ollama connection error"

Check Ollama is running:
```bash
sudo systemctl status ollama
ollama serve  # start it manually if needed
```

Test it:
```bash
ollama list  # should show your models
```

### "Embedding model not found"

Pull the model:
```bash
ollama pull nomic-embed-text
```

### CLI not found after installation

Try linking instead:
```bash
cd cli
npm link
```

Or run directly:
```bash
node cli/bin/brain.js add "test"
```

## Next Steps

1. **Set up automatic startup** - See [systemd/README.md](systemd/README.md)
2. **Configure backups** - Set up a cron job for `database/backup.sh`
3. **Explore the API** - Check out the REST endpoints in the README
4. **Customize metadata** - Edit the prompt in `server/src/metadata.js`
5. **Add remote access** - Set up nginx/caddy reverse proxy with HTTPS

## Usage Patterns

### Daily Workflow

```bash
# Morning - review yesterday
brain recent 20 | grep $(date -d yesterday +%Y-%m-%d)

# Throughout the day - quick capture
brain add "Quick note here"

# Evening - search for context
brain search "today's topic"
```

### With AI Assistants

In Claude Code or Gemini CLI:

- "What did I note about the API redesign?"
- "Show me all my recent decisions"
- "Remember: decided to use PostgreSQL for the new project"
- "Find my notes about Sarah"

### Integration Ideas

- **Git hooks**: Capture commit messages
- **Shell alias**: `alias note="brain add"`
- **Vim integration**: Capture highlighted text
- **Desktop shortcut**: Quick capture dialog

## Getting Help

1. **Test all components**: `npm test` and `brain test`
2. **Check logs**: `sudo journalctl -u openbrain-api -f`
3. **Verify config**: Make sure `.env` has correct values
4. **Database check**: `psql -U openbrain -d openbrain -c "SELECT COUNT(*) FROM thoughts;"`
5. **Review installation**: See [INSTALL.md](INSTALL.md) for detailed steps

## You're All Set! 🎉

Your Open Brain is running. Start capturing your thoughts and building your personal knowledge base!
