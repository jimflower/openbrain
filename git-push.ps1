# Git setup and push script for Open Brain (Windows PowerShell)
# Run this to push to GitHub

Write-Host "Setting up Git repository..." -ForegroundColor Blue
Write-Host ""

# Get GitHub username
$GITHUB_USER = Read-Host "Enter your GitHub username"

# Initialize git if not already done
if (-not (Test-Path .git)) {
    git init
    Write-Host "✓ Git initialized" -ForegroundColor Green
}

# Add all files
git add .

# Create initial commit
$commitMessage = @"
Initial commit: Self-hosted Open Brain

- PostgreSQL + pgvector database
- Node.js API and MCP servers
- CLI tool for quick capture
- Local embeddings via Ollama
- Full self-hosted alternative to cloud services
"@

git commit -m $commitMessage

# Add remote (ignore error if already exists)
git remote add origin "https://github.com/$GITHUB_USER/openbrain.git" 2>$null
if ($LASTEXITCODE -ne 0) {
    git remote set-url origin "https://github.com/$GITHUB_USER/openbrain.git"
}

Write-Host "✓ Remote configured: https://github.com/$GITHUB_USER/openbrain" -ForegroundColor Green
Write-Host ""

# Push to GitHub
Write-Host "Pushing to GitHub..." -ForegroundColor Blue
git branch -M main
git push -u origin main

Write-Host ""
Write-Host "✓ Successfully pushed to GitHub!" -ForegroundColor Green
Write-Host "Repository: https://github.com/$GITHUB_USER/openbrain" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Clone on your server: git clone https://github.com/$GITHUB_USER/openbrain.git"
Write-Host "2. Run installation: cd openbrain && chmod +x install.sh && ./install.sh"
