#!/bin/bash

# Git setup and push script for Open Brain
# Run this on your server to push to GitHub

set -e

echo "Setting up Git repository..."

# Get GitHub username
read -p "Enter your GitHub username: " GITHUB_USER

# Initialize git if not already done
if [ ! -d .git ]; then
    git init
    echo "✓ Git initialized"
fi

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: Self-hosted Open Brain

- PostgreSQL + pgvector database
- Node.js API and MCP servers
- CLI tool for quick capture
- Local embeddings via Ollama
- Full self-hosted alternative to cloud services"

# Add remote
git remote add origin "https://github.com/${GITHUB_USER}/openbrain.git" 2>/dev/null || \
git remote set-url origin "https://github.com/${GITHUB_USER}/openbrain.git"

echo "✓ Remote configured: https://github.com/${GITHUB_USER}/openbrain"

# Push to GitHub
echo ""
echo "Pushing to GitHub..."
git branch -M main
git push -u origin main

echo ""
echo "✓ Successfully pushed to GitHub!"
echo "Repository: https://github.com/${GITHUB_USER}/openbrain"
echo ""
echo "Next steps:"
echo "1. Clone on your server: git clone https://github.com/${GITHUB_USER}/openbrain.git"
echo "2. Run installation: cd openbrain && chmod +x install.sh && ./install.sh"
