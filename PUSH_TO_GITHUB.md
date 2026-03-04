# Push to GitHub

Git isn't available in this environment, so I've created push scripts for you.

## Quick Push (Windows)

1. Open PowerShell in the project directory:
   ```powershell
   cd C:\tmp\open-brain-selfhosted
   ```

2. Run the push script:
   ```powershell
   .\git-push.ps1
   ```

3. Enter your GitHub username when prompted

4. Authenticate with GitHub when prompted (will open browser or ask for token)

## Quick Push (Linux/Mac)

1. Navigate to the project:
   ```bash
   cd /tmp/open-brain-selfhosted
   ```

2. Make script executable and run:
   ```bash
   chmod +x git-push.sh
   ./git-push.sh
   ```

## Manual Push

If the scripts don't work, run these commands manually:

```bash
cd /tmp/open-brain-selfhosted

# Initialize git
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: Self-hosted Open Brain"

# Add remote (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/openbrain.git

# Push
git branch -M main
git push -u origin main
```

## After Pushing

On your Linux server:

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/openbrain.git
cd openbrain

# Run auto-install
chmod +x install.sh
./install.sh
```

The install script will:
- Install all dependencies
- Set up PostgreSQL database
- Configure the server
- Download Ollama models
- Install CLI tool
- Run tests

Total time: ~10 minutes (mostly downloading models)
