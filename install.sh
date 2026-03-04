#!/bin/bash

# Open Brain Self-Hosted - Quick Install Script
# For Ubuntu/Debian Linux systems

set -e

echo "=========================================="
echo "Open Brain Self-Hosted - Installation"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if running on Linux
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    echo -e "${RED}Error: This script is designed for Linux systems${NC}"
    echo "For other systems, please follow the manual installation in INSTALL.md"
    exit 1
fi

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo -e "${RED}Error: Don't run this script as root${NC}"
   echo "It will prompt for sudo when needed"
   exit 1
fi

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check version
check_version() {
    local version=$1
    local required=$2
    [ "$(printf '%s\n' "$required" "$version" | sort -V | head -n1)" = "$required" ]
}

echo -e "${BLUE}Step 1: Checking prerequisites...${NC}"
echo ""

# Check PostgreSQL
if command_exists psql; then
    PG_VERSION=$(psql --version | grep -oP '\d+' | head -1)
    echo -e "${GREEN}✓${NC} PostgreSQL $PG_VERSION installed"
else
    echo -e "${YELLOW}!${NC} PostgreSQL not found. Installing..."
    sudo apt update
    sudo apt install -y postgresql postgresql-contrib
    sudo systemctl start postgresql
    sudo systemctl enable postgresql
    echo -e "${GREEN}✓${NC} PostgreSQL installed"
fi

# Check Node.js
if command_exists node; then
    NODE_VERSION=$(node --version | grep -oP '\d+' | head -1)
    if check_version "$NODE_VERSION" "18"; then
        echo -e "${GREEN}✓${NC} Node.js $NODE_VERSION installed"
    else
        echo -e "${YELLOW}!${NC} Node.js version too old. Need 18+, have $NODE_VERSION"
        echo "Installing Node.js 20..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt install -y nodejs
        echo -e "${GREEN}✓${NC} Node.js updated"
    fi
else
    echo -e "${YELLOW}!${NC} Node.js not found. Installing..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
    echo -e "${GREEN}✓${NC} Node.js installed"
fi

# Check Ollama
if command_exists ollama; then
    echo -e "${GREEN}✓${NC} Ollama installed"
else
    echo -e "${YELLOW}!${NC} Ollama not found. Installing..."
    curl -fsSL https://ollama.com/install.sh | sh
    sudo systemctl start ollama 2>/dev/null || true
    sudo systemctl enable ollama 2>/dev/null || true
    echo -e "${GREEN}✓${NC} Ollama installed"
fi

# Check pgvector
echo ""
echo -e "${BLUE}Step 2: Installing pgvector extension...${NC}"
if dpkg -l | grep -q postgresql-.*-pgvector; then
    echo -e "${GREEN}✓${NC} pgvector already installed"
else
    PG_MAJOR=$(psql --version | grep -oP '\d+' | head -1)
    echo "Installing pgvector for PostgreSQL $PG_MAJOR..."
    sudo apt install -y postgresql-$PG_MAJOR-pgvector || {
        echo -e "${YELLOW}!${NC} Package not available, building from source..."
        sudo apt install -y build-essential postgresql-server-dev-$PG_MAJOR
        git clone --branch v0.5.1 https://github.com/pgvector/pgvector.git /tmp/pgvector
        cd /tmp/pgvector
        make
        sudo make install
        cd -
        rm -rf /tmp/pgvector
    }
    echo -e "${GREEN}✓${NC} pgvector installed"
fi

# Pull Ollama models
echo ""
echo -e "${BLUE}Step 3: Downloading Ollama models...${NC}"
echo "This may take a few minutes..."
ollama pull nomic-embed-text || echo -e "${YELLOW}!${NC} Failed to pull embedding model"
echo "Do you want to install a local LLM for metadata extraction? (recommended)"
echo "This will download ~4.7GB for llama3:8b"
read -p "Install llama3:8b? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    ollama pull llama3:8b
    METADATA_MODE="local"
else
    echo "Skipping LLM installation. You can use API-based metadata extraction instead."
    METADATA_MODE="skip"
fi

# Setup database
echo ""
echo -e "${BLUE}Step 4: Setting up database...${NC}"
cd database
chmod +x setup.sh backup.sh
./setup.sh

# Read the generated DATABASE_URL
if [ -f .env.database ]; then
    source .env.database
else
    echo -e "${RED}Error: Database setup failed${NC}"
    exit 1
fi

# Setup server
echo ""
echo -e "${BLUE}Step 5: Configuring server...${NC}"
cd ../server

# Install dependencies
echo "Installing Node.js dependencies..."
npm install

# Generate access key
ACCESS_KEY=$(openssl rand -hex 32)

# Create .env file
cat > .env << EOF
# Database
$DATABASE_URL

# Server Ports
API_PORT=3000
MCP_PORT=3001

# Security
ACCESS_KEY=$ACCESS_KEY

# Embedding Configuration
EMBEDDING_MODE=local

# Ollama settings
OLLAMA_URL=http://localhost:11434
OLLAMA_EMBEDDING_MODEL=nomic-embed-text

# Metadata Extraction
METADATA_MODE=$METADATA_MODE
OLLAMA_LLM_MODEL=llama3:8b

# Logging
LOG_LEVEL=info
NODE_ENV=production
EOF

echo -e "${GREEN}✓${NC} Server configured"

# Install CLI
echo ""
echo -e "${BLUE}Step 6: Installing CLI tool...${NC}"
cd ../cli
npm install -g .

# Configure CLI
brain config --server http://localhost:3000 --key $ACCESS_KEY

echo -e "${GREEN}✓${NC} CLI tool installed"

# Test everything
echo ""
echo -e "${BLUE}Step 7: Testing installation...${NC}"
cd ../server

# Start server in background for testing
node src/api.js &
API_PID=$!
sleep 3

# Run tests
brain test

# Stop test server
kill $API_PID 2>/dev/null || true

echo ""
echo "=========================================="
echo -e "${GREEN}Installation Complete!${NC}"
echo "=========================================="
echo ""
echo "Your Open Brain is installed and ready to use!"
echo ""
echo -e "${YELLOW}Important:${NC} Save these credentials:"
echo "  Access Key: $ACCESS_KEY"
echo ""
echo "Next steps:"
echo ""
echo "1. Start the servers:"
echo "   cd server"
echo "   npm start          # In one terminal"
echo "   npm run mcp        # In another terminal"
echo ""
echo "2. Or set up systemd services (recommended):"
echo "   See INSTALL.md Step 6 for details"
echo ""
echo "3. Try the CLI:"
echo "   brain add \"My first thought\""
echo "   brain search \"first\""
echo "   brain stats"
echo ""
echo "4. Configure AI clients:"
echo "   See INSTALL.md Step 9 for Claude Code and Gemini CLI setup"
echo ""
echo "For detailed usage, see README.md"
echo ""

# Save credentials
cat > ~/open-brain-credentials.txt << EOF
Open Brain Credentials
======================
Generated on: $(date)

Database URL: $DATABASE_URL
Access Key: $ACCESS_KEY

Server endpoints:
  API: http://localhost:3000
  MCP: Uses stdio, configure in AI clients

Installation directory: $(pwd)

Keep this file secure!
EOF

echo -e "Credentials saved to: ${GREEN}~/open-brain-credentials.txt${NC}"
echo ""
