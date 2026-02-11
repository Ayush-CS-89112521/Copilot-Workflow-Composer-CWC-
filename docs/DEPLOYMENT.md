# Deployment Guide - Copilot Workflow Composer

**Production Deployment and Operations Guide**

---

## 🎯 Overview

This guide covers deploying Copilot Workflow Composer (CWC) to production environments, including installation, configuration, monitoring, and troubleshooting.

---

## 📋 Prerequisites

### System Requirements

- **OS**: Linux, macOS, or Windows (WSL2)
- **Runtime**: Bun >= 1.0.0 or Node.js >= 18.0.0
- **Memory**: 512MB minimum, 2GB recommended
- **Disk**: 100MB for installation, 1GB for data and logs
- **Network**: Internet access for MCP tool discovery

### Dependencies

- **GitHub CLI**: `gh` command-line tool
- **GitHub Copilot**: Active GitHub Copilot subscription
- **Git**: For version control integration

---

## 🚀 Installation

### Option 1: NPM Global Install

```bash
# Install globally
npm install -g copilot-workflow-composer

# Verify installation
cwc --version
```

### Option 2: Local Install

```bash
# Clone repository
git clone https://github.com/your-org/copilot-workflow-composer.git
cd copilot-workflow-composer

# Install dependencies
npm install

# Build
npm run build

# Link locally
npm link

# Verify
cwc --version
```

### Option 3: From Source (Development)

```bash
# Clone repository
git clone https://github.com/your-org/copilot-workflow-composer.git
cd copilot-workflow-composer

# Install dependencies with Bun
bun install

# Run directly
bun run src/cli.ts --version
```

---

## ⚙️ Configuration

### 1. GitHub Authentication

```bash
# Authenticate with GitHub
gh auth login

# Verify authentication
gh auth status

# Verify Copilot access
cwc --check-auth
```

### 2. Environment Variables (Optional)

**Note:** GitHub authentication is handled by `gh` CLI, NOT environment variables.

Create `.env` file in project root for optional configuration:

```bash
# Optional - Debug
DEBUG=false
VERBOSE=false

# Optional - Resource Limits
MAX_CPU_PERCENT=80
MAX_MEMORY_MB=512

# Optional - Safety
REQUIRE_APPROVAL=true
AUTO_APPROVE_SAFE=true
DETAILED_AUDIT=true

# Optional - Web Scraping (uses Claude API)
ANTHROPIC_API_KEY=your_key_here
ENABLE_WEB_SCRAPING=true

# Optional - API Keys (if using external tools)
FIGMA_API_KEY=your-figma-key
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
```

### 3. Workflow Directory Structure

```bash
# Create project structure
mkdir -p ~/cwc-workflows/{workflows,outputs,logs}

# Create sample workflow
cat > ~/cwc-workflows/workflows/hello.yaml << 'EOF'
name: "Hello World"
version: "1.0.0"

steps:
  - id: greet
    agent: github
    prompt: "Echo 'Hello from CWC!'"
EOF

# Test workflow
cwc ~/cwc-workflows/workflows/hello.yaml
```

---

## 🏭 Production Deployment

### Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Production Environment                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐      ┌──────────────┐                   │
│  │   Engineers   │─────▶│     CWC      │                   │
│  │  (50 users)   │      │   CLI Tool   │                   │
│  └──────────────┘      └──────┬───────┘                   │
│                                │                            │
│                                ▼                            │
│                       ┌────────────────┐                   │
│                       │  8-Layer Safety │                   │
│                       │   Architecture  │                   │
│                       └────────┬───────┘                   │
│                                │                            │
│                                ▼                            │
│                       ┌────────────────┐                   │
│                       │  GitHub Copilot │                   │
│                       │      API        │                   │
│                       └────────────────┘                   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Data Collection                                      │ │
│  │  • audit.jsonl (RLHF training data)                 │ │
│  │  • execution-logs/ (workflow execution logs)        │ │
│  │  • metrics/ (performance metrics)                   │ │
│  └──────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Deployment Steps

#### 1. Prepare Production Server

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Bun
curl -fsSL https://bun.sh/install | bash

# Install GitHub CLI
sudo apt install gh -y

# Create service user
sudo useradd -r -s /bin/bash -d /opt/cwc cwc-service
sudo mkdir -p /opt/cwc
sudo chown cwc-service:cwc-service /opt/cwc
```

#### 2. Deploy Application

```bash
# Switch to service user
sudo su - cwc-service

# Clone repository
git clone https://github.com/your-org/copilot-workflow-composer.git /opt/cwc/app
cd /opt/cwc/app

# Install dependencies
bun install

# Build
bun run build

# Create directories
mkdir -p /opt/cwc/{workflows,outputs,logs,data}
```

#### 3. Configure Environment

```bash
# Authenticate with GitHub CLI (as cwc-service user)
gh auth login

# Verify authentication
gh auth status
gh copilot --version

# Create production .env (optional configuration)
cat > /opt/cwc/app/.env << 'EOF'
# No GITHUB_TOKEN needed - handled by gh CLI
DEBUG=false
VERBOSE=false
MAX_CPU_PERCENT=80
MAX_MEMORY_MB=512
REQUIRE_APPROVAL=true
AUTO_APPROVE_SAFE=false
DETAILED_AUDIT=true
EOF

# Secure .env file
chmod 600 /opt/cwc/app/.env
```

#### 4. Create Systemd Service (Optional)

For long-running workflows or daemon mode:

```bash
# Create service file
sudo cat > /etc/systemd/system/cwc.service << 'EOF'
[Unit]
Description=Copilot Workflow Composer
After=network.target

[Service]
Type=simple
User=cwc-service
WorkingDirectory=/opt/cwc/app
ExecStart=/home/cwc-service/.bun/bin/bun run /opt/cwc/app/dist/cli.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable cwc
sudo systemctl start cwc
sudo systemctl status cwc
```

---

## 📊 Monitoring

### Log Files

```bash
# Application logs
tail -f /opt/cwc/logs/cwc.log

# Execution logs
tail -f /opt/cwc/logs/execution-*.log

# Audit trail
tail -f /opt/cwc/data/audit.jsonl
```

### Metrics Collection

```bash
# Create metrics script
cat > /opt/cwc/scripts/collect-metrics.sh << 'EOF'
#!/bin/bash

# Count workflows executed today
WORKFLOWS_TODAY=$(grep "$(date +%Y-%m-%d)" /opt/cwc/logs/execution-*.log | wc -l)

# Count safety violations
VIOLATIONS_TODAY=$(grep "safety_violation" /opt/cwc/data/audit.jsonl | grep "$(date +%Y-%m-%d)" | wc -l)

# Count RLHF training examples
TRAINING_EXAMPLES=$(wc -l < /opt/cwc/data/audit.jsonl)

# Output metrics
echo "Workflows executed today: $WORKFLOWS_TODAY"
echo "Safety violations today: $VIOLATIONS_TODAY"
echo "Total training examples: $TRAINING_EXAMPLES"
EOF

chmod +x /opt/cwc/scripts/collect-metrics.sh

# Run metrics
/opt/cwc/scripts/collect-metrics.sh
```

### Health Checks

```bash
# Create health check script
cat > /opt/cwc/scripts/health-check.sh << 'EOF'
#!/bin/bash

# Check CWC is installed
if ! command -v cwc &> /dev/null; then
    echo "❌ CWC not installed"
    exit 1
fi

# Check GitHub authentication
if ! cwc --check-auth &> /dev/null; then
    echo "❌ GitHub authentication failed"
    exit 1
fi

# Check disk space
DISK_USAGE=$(df -h /opt/cwc | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 80 ]; then
    echo "⚠️  Disk usage high: ${DISK_USAGE}%"
fi

echo "✅ Health check passed"
exit 0
EOF

chmod +x /opt/cwc/scripts/health-check.sh

# Run health check
/opt/cwc/scripts/health-check.sh
```

---

## 🔒 Security

### Best Practices

1. **Credential Management**
   - GitHub authentication is handled by `gh` CLI automatically
   - Tokens are managed securely by GitHub CLI (not stored in `.env`)
   - Re-authenticate periodically: `gh auth login`
   - Use GitHub Copilot subscription with appropriate access controls

2. **Access Control**
   - Limit CWC access to authorized engineers
   - Use SSH keys for authentication
   - Enable audit logging for all access

3. **Network Security**
   - Run CWC behind firewall
   - Use VPN for remote access
   - Restrict outbound connections to GitHub API only

4. **Data Protection**
   - Encrypt audit.jsonl at rest
   - Backup training data regularly
   - Implement data retention policies

### Security Checklist

```bash
# ✅ Verify GitHub CLI authentication
gh auth status

# ✅ Secure .env file (if it exists)
chmod 600 /opt/cwc/app/.env 2>/dev/null || true

# ✅ Secure audit data
chmod 600 /opt/cwc/data/audit.jsonl

# ✅ Secure logs directory
chmod 700 /opt/cwc/logs

# ✅ Disable debug mode in production
grep "DEBUG=false" /opt/cwc/app/.env || echo "DEBUG=false"

# ✅ Enable approval for all workflows
grep "REQUIRE_APPROVAL=true" /opt/cwc/app/.env || echo "REQUIRE_APPROVAL=true"

# ✅ Verify no hardcoded credentials in source
! grep -r "ghp_\|gho_\|ghs_" /opt/cwc/app/src/
```

---

## 🔄 Backup and Recovery

### Backup Strategy

```bash
# Create backup script
cat > /opt/cwc/scripts/backup.sh << 'EOF'
#!/bin/bash

BACKUP_DIR="/opt/cwc/backups/$(date +%Y-%m-%d)"
mkdir -p "$BACKUP_DIR"

# Backup audit data (RLHF training data)
cp /opt/cwc/data/audit.jsonl "$BACKUP_DIR/"

# Backup workflows
cp -r /opt/cwc/workflows "$BACKUP_DIR/"

# Backup configuration
cp /opt/cwc/app/.env "$BACKUP_DIR/"

# Compress backup
tar -czf "$BACKUP_DIR.tar.gz" "$BACKUP_DIR"
rm -rf "$BACKUP_DIR"

# Keep only last 30 days of backups
find /opt/cwc/backups -name "*.tar.gz" -mtime +30 -delete

echo "✅ Backup completed: $BACKUP_DIR.tar.gz"
EOF

chmod +x /opt/cwc/scripts/backup.sh

# Schedule daily backups (cron)
echo "0 2 * * * /opt/cwc/scripts/backup.sh" | crontab -
```

### Recovery Procedure

```bash
# Restore from backup
BACKUP_FILE="/opt/cwc/backups/2026-02-07.tar.gz"

# Extract backup
tar -xzf "$BACKUP_FILE" -C /tmp/

# Restore audit data
cp /tmp/2026-02-07/audit.jsonl /opt/cwc/data/

# Restore workflows
cp -r /tmp/2026-02-07/workflows/* /opt/cwc/workflows/

# Restore configuration
cp /tmp/2026-02-07/.env /opt/cwc/app/

# Verify restoration
cwc --check-auth
```

---

## 🐛 Troubleshooting

### Common Issues

#### Issue 1: GitHub Authentication Failed

**Symptoms**:
```
❌ GitHub Copilot not authenticated
```

**Solution**:
```bash
# Re-authenticate
gh auth login

# Verify
gh auth status
cwc --check-auth

# Check token permissions
gh auth status --show-token
```

#### Issue 2: Module Resolution Errors

**Symptoms**:
```
error: Cannot find module './src/interactive/steering-handler'
```

**Solution**:
```bash
# Rebuild TypeScript
cd /opt/cwc/app
bunx tsc

# Verify build
ls -la dist/

# Re-run workflow
cwc ./workflow.yaml
```

#### Issue 3: Resource Limit Exceeded

**Symptoms**:
```
❌ Memory limit exceeded
```

**Solution**:
```bash
# Increase memory limit in .env
echo "MAX_MEMORY_MB=1024" >> /opt/cwc/app/.env

# Or in workflow YAML
cat >> workflow.yaml << 'EOF'
safety:
  maxMemoryMB: 1024
EOF
```

#### Issue 4: Safety Violation Detected

**Symptoms**:
```
⚠️  Safety violations detected
🔴 [BLOCK] rm -rf command
```

**Solution**:
```bash
# Review violation
cat /opt/cwc/data/audit.jsonl | tail -1 | jq .

# Edit workflow to remove dangerous command
vim workflow.yaml

# Re-run with --step-mode for review
cwc workflow.yaml --step-mode
```

### Debug Mode

```bash
# Enable debug logging
export DEBUG=true
export VERBOSE=true

# Run workflow with debug output
cwc workflow.yaml 2>&1 | tee debug.log

# Analyze debug log
grep "ERROR" debug.log
grep "WARNING" debug.log
```

---

## 📈 Performance Tuning

### Optimization Tips

1. **Reduce Tool Index Size**
   - Use pruned tool index for planning (50 tools instead of 1,241)
   - Cache tool metadata in memory

2. **Optimize Workflow Steps**
   - Minimize step dependencies
   - Use parallel execution where possible
   - Set appropriate timeouts

3. **Resource Allocation**
   - Allocate sufficient memory (2GB recommended)
   - Use SSD for data storage
   - Enable caching for tool discovery

### Performance Benchmarks

```bash
# Measure workflow execution time
time cwc workflow.yaml

# Measure safety layer overhead
time cwc workflow.yaml --no-safety  # (if available)

# Measure tool discovery time
time cwc connect figma
```

---

## 🔄 Updates and Maintenance

### Update Procedure

```bash
# Backup current installation
/opt/cwc/scripts/backup.sh

# Pull latest changes
cd /opt/cwc/app
git pull origin main

# Install dependencies
bun install

# Rebuild
bun run build

# Run tests
bun test

# Restart service (if using systemd)
sudo systemctl restart cwc
```

### Maintenance Schedule

- **Daily**: Backup audit data
- **Weekly**: Review safety violations, check disk space
- **Monthly**: Update dependencies, rotate credentials
- **Quarterly**: Review and optimize workflows, analyze RLHF data

---

## 📚 Additional Resources

- **Documentation**: See `docs/` directory
- **Examples**: See `examples/` directory
- **Tests**: See `tests/` directory
- **Support**: GitHub Issues or internal support channel

---

**Last Updated**: February 11, 2026  
**Deployment Version**: 7.0 (Stable)  
**Status**: Production-ready
