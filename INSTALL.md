# Installation Guide

Complete step-by-step guide to get your self-hosted Open Brain running.

## Prerequisites

Before starting, ensure you have:

1. **Linux Server** (Ubuntu 20.04+ recommended)
2. **PostgreSQL 15+** installed
3. **Node.js 18+** installed
4. **Ollama** installed (for local embeddings)

## Quick Install

If you want automated setup, use the install script:

```bash
./install.sh
```

Otherwise, follow the manual steps below.

## Manual Installation

### Step 1: Install System Dependencies

#### PostgreSQL

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### Node.js

```bash
# Using NodeSource repository (Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version  # Should be 18+
npm --version
```

#### Ollama (for local embeddings)

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Start Ollama service
sudo systemctl start ollama
sudo systemctl enable ollama

# Pull the embedding model
ollama pull nomic-embed-text

# Optional: Pull an LLM for local metadata extraction
ollama pull llama3:8b
```

#### pgvector Extension

```bash
# Ubuntu/Debian
sudo apt install postgresql-15-pgvector

# Or build from source
git clone --branch v0.5.1 https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install
```

### Step 2: Setup Database

```bash
cd open-brain-selfhosted/database

# Make scripts executable
chmod +x setup.sh backup.sh

# Run setup
./setup.sh
```

This will:
- Create the `openbrain` database
- Create the `openbrain` user with a generated password
- Install the pgvector extension
- Create tables and functions
- Output a `DATABASE_URL` for the next step

**Important:** Save the `DATABASE_URL` that's printed - you'll need it in Step 3.

### Step 3: Configure Server

```bash
cd ../server

# Copy environment template
cp .env.example .env

# Edit .env with your settings
nano .env
```

**Required settings:**

```bash
# Paste the DATABASE_URL from Step 2
DATABASE_URL=postgresql://openbrain:PASSWORD@localhost:5432/openbrain

# Generate a secure access key
ACCESS_KEY=<run: openssl rand -hex 32>

# Set embedding mode
EMBEDDING_MODE=local  # or api, or hybrid

# Ollama settings
OLLAMA_URL=http://localhost:11434
OLLAMA_EMBEDDING_MODEL=nomic-embed-text

# Metadata extraction
METADATA_MODE=local  # or api, or skip
OLLAMA_LLM_MODEL=llama3:8b
```

**Optional - API keys** (if using EMBEDDING_MODE=api or METADATA_MODE=api):

```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
```

### Step 4: Install Server Dependencies

```bash
npm install
```

### Step 5: Test the Server

```bash
# Run tests
npm test

# You should see:
# ✓ Database connected
# ✓ Embeddings working (local mode)
# ✓ Metadata extraction working
```

### Step 6: Start the Server

#### Development (with auto-restart)

```bash
npm run dev
```

#### Production (with systemd)

Create `/etc/systemd/system/openbrain-api.service`:

```ini
[Unit]
Description=Open Brain API Server
After=network.target postgresql.service

[Service]
Type=simple
User=YOUR_USER
WorkingDirectory=/path/to/open-brain-selfhosted/server
ExecStart=/usr/bin/node src/api.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Create `/etc/systemd/system/openbrain-mcp.service`:

```ini
[Unit]
Description=Open Brain MCP Server
After=network.target postgresql.service

[Service]
Type=simple
User=YOUR_USER
WorkingDirectory=/path/to/open-brain-selfhosted/server
ExecStart=/usr/bin/node src/mcp.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable openbrain-api openbrain-mcp
sudo systemctl start openbrain-api openbrain-mcp

# Check status
sudo systemctl status openbrain-api
sudo systemctl status openbrain-mcp

# View logs
sudo journalctl -u openbrain-api -f
```

### Step 7: Install CLI Tool

```bash
cd ../cli

# Install globally
npm install -g .

# Or link for development
npm link

# Configure
brain config --server http://localhost:3000 --key YOUR_ACCESS_KEY

# Test
brain test
```

You should see:
```
✓ All systems operational
```

### Step 8: Test Everything

```bash
# Capture a thought
brain add "Testing my Open Brain setup"

# Search for it
brain search "setup"

# Check stats
brain stats
```

If all commands work, your Open Brain is fully operational! 🎉

### Step 9: Configure AI Clients

#### Claude Code

```bash
claude mcp add open-brain \
  --transport stdio \
  --command "node" \
  --arg "/path/to/open-brain-selfhosted/server/src/mcp.js"
```

Or if you prefer to use a config file, add to `~/.config/claude/mcp_settings.json`:

```json
{
  "mcpServers": {
    "open-brain": {
      "command": "node",
      "args": ["/absolute/path/to/open-brain-selfhosted/server/src/mcp.js"],
      "env": {}
    }
  }
}
```

#### Gemini CLI

Add to your MCP config:

```json
{
  "mcpServers": {
    "open-brain": {
      "command": "node",
      "args": ["/absolute/path/to/open-brain-selfhosted/server/src/mcp.js"]
    }
  }
}
```

**Note:** The MCP server reads from the same `.env` file as the API server, so make sure your DATABASE_URL and other settings are configured.

### Step 10: Optional - Setup Reverse Proxy

For remote access with HTTPS, use nginx or caddy:

#### Nginx

```nginx
server {
    server_name brain.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    listen 443 ssl;
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
}
```

#### Caddy (simpler)

```
brain.yourdomain.com {
    reverse_proxy localhost:3000
}
```

## Troubleshooting Installation

### PostgreSQL connection error

```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Check if you can connect
psql -U openbrain -d openbrain -c "SELECT 1"

# If password fails, reset it
sudo -u postgres psql -c "ALTER USER openbrain WITH PASSWORD 'newpassword';"
```

### Ollama connection error

```bash
# Check if Ollama is running
sudo systemctl status ollama

# Or start it manually
ollama serve

# Test it
ollama list
```

### Node modules error

```bash
# Clear and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Permission errors with CLI

```bash
# Make sure the script is executable
chmod +x cli/bin/brain.js

# If global install fails, use local
cd cli
npm link
```

### Port already in use

```bash
# Find what's using port 3000
sudo lsof -i :3000

# Change port in .env
API_PORT=3001
```

## Next Steps

- Read the [README.md](../README.md) for usage examples
- Set up automatic backups: `crontab -e` and add `0 2 * * * /path/to/database/backup.sh`
- Configure your AI clients to use the MCP server
- Start capturing thoughts!

## Getting Help

- Check server logs: `sudo journalctl -u openbrain-api -f`
- Test individual components: `brain test`
- Verify database: `psql -U openbrain -d openbrain -c "SELECT COUNT(*) FROM thoughts;"`
