# Systemd Service Templates

These templates help you run Open Brain as system services that start automatically.

## Setup Instructions

1. **Edit the templates** - Replace placeholders with your actual values:
   - `YOUR_USER` - Your Linux username
   - `/path/to/open-brain-selfhosted` - Absolute path to your installation

2. **Copy to systemd**:
   ```bash
   sudo cp openbrain-api.service /etc/systemd/system/
   sudo cp openbrain-mcp.service /etc/systemd/system/
   ```

3. **Enable and start**:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable openbrain-api openbrain-mcp
   sudo systemctl start openbrain-api openbrain-mcp
   ```

4. **Check status**:
   ```bash
   sudo systemctl status openbrain-api
   sudo systemctl status openbrain-mcp
   ```

5. **View logs**:
   ```bash
   # Follow live logs
   sudo journalctl -u openbrain-api -f
   sudo journalctl -u openbrain-mcp -f
   
   # View recent logs
   sudo journalctl -u openbrain-api -n 50
   sudo journalctl -u openbrain-mcp -n 50
   ```

## Managing Services

```bash
# Stop services
sudo systemctl stop openbrain-api openbrain-mcp

# Restart services
sudo systemctl restart openbrain-api openbrain-mcp

# Disable auto-start
sudo systemctl disable openbrain-api openbrain-mcp

# Check if running
sudo systemctl is-active openbrain-api
```

## Troubleshooting

### Service won't start

1. Check the service status for errors:
   ```bash
   sudo systemctl status openbrain-api
   ```

2. View full logs:
   ```bash
   sudo journalctl -u openbrain-api -n 100 --no-pager
   ```

3. Common issues:
   - Wrong path in `WorkingDirectory` or `ExecStart`
   - Wrong username in `User`
   - Database not running: `sudo systemctl status postgresql`
   - Ollama not running: `sudo systemctl status ollama`

### Port already in use

Check what's using the port:
```bash
sudo lsof -i :3000
```

### Permission errors

Make sure the user has access to the installation directory:
```bash
sudo chown -R YOUR_USER:YOUR_USER /path/to/open-brain-selfhosted
```

## Service Files

### openbrain-api.service

```ini
[Unit]
Description=Open Brain API Server
Documentation=https://github.com/yourusername/open-brain-selfhosted
After=network.target postgresql.service ollama.service
Requires=postgresql.service

[Service]
Type=simple
User=YOUR_USER
Group=YOUR_USER
WorkingDirectory=/path/to/open-brain-selfhosted/server

# Main process
ExecStart=/usr/bin/node src/api.js

# Restart policy
Restart=always
RestartSec=10

# Environment
Environment=NODE_ENV=production

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=openbrain-api

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/path/to/open-brain-selfhosted/server

[Install]
WantedBy=multi-user.target
```

### openbrain-mcp.service

```ini
[Unit]
Description=Open Brain MCP Server
Documentation=https://github.com/yourusername/open-brain-selfhosted
After=network.target postgresql.service ollama.service openbrain-api.service
Requires=postgresql.service

[Service]
Type=simple
User=YOUR_USER
Group=YOUR_USER
WorkingDirectory=/path/to/open-brain-selfhosted/server

# Main process
ExecStart=/usr/bin/node src/mcp.js

# Restart policy
Restart=always
RestartSec=10

# Environment
Environment=NODE_ENV=production

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=openbrain-mcp

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/path/to/open-brain-selfhosted/server

[Install]
WantedBy=multi-user.target
```

## Alternative: Running with PM2

If you prefer PM2 instead of systemd:

```bash
# Install PM2
npm install -g pm2

# Start services
cd server
pm2 start src/api.js --name openbrain-api
pm2 start src/mcp.js --name openbrain-mcp

# Save configuration
pm2 save

# Setup auto-start on boot
pm2 startup

# Manage
pm2 status
pm2 logs openbrain-api
pm2 restart openbrain-api
```
