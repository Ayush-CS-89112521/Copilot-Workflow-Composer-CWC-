# Installation Guide - Copilot Workflow Composer

**Complete installation guide for Linux, macOS, and Windows**

---

## Table of Contents

1. [Quick Setup (5 Minutes)](#-quick-setup-5-minutes)
2. [Prerequisites](#-prerequisites)
3. [Platform-Specific Installation](#-platform-specific-installation)
4. [Installation Checklist](#-installation-checklist)
5. [First Run & Verification](#-first-run--verification)
6. [Troubleshooting](#-troubleshooting)

---

## ⚡ Quick Setup (5 Minutes)

### Choose Your Platform

<details>
<summary><b>🐧 Linux (Ubuntu/Debian)</b></summary>

```bash
# Install dependencies
sudo apt-get update
sudo apt-get install -y git curl build-essential nodejs npm gh

# Clone and setup
git clone <repo-url>
cd copilot-workflow-composer
npm install && npm run build
npm test

# Authenticate with GitHub
gh auth login

# First run
node dist/cli.js --help
```

**Make it global (optional):**
```bash
sudo ln -s $(pwd)/dist/cli.js /usr/local/bin/cwc
cwc --help
```

</details>

<details>
<summary><b>🍎 macOS</b></summary>

```bash
# Install dependencies (Homebrew)
brew install git curl node gh

# Clone and setup
git clone <repo-url>
cd copilot-workflow-composer
npm install && npm run build
npm test

# Authenticate with GitHub
gh auth login

# First run
node dist/cli.js --help
```

**Make it global (optional):**
```bash
ln -s $(pwd)/dist/cli.js /usr/local/bin/cwc
cwc --help
```

</details>

<details>
<summary><b>🪟 Windows (PowerShell)</b></summary>

```powershell
# Install dependencies (Chocolatey)
choco install nodejs gh

# Clone and setup
git clone <repo-url>
cd copilot-workflow-composer
npm install
npm run build
npm test

# Authenticate with GitHub
gh auth login

# First run
node dist/cli.js --help
```

**Make it global (optional):**
```powershell
# Create batch file
"@echo off`nnode C:\path\to\project\dist\cli.js %*" | Out-File cwc.bat
# Move cwc.bat to a folder in your PATH
```

</details>

### ⚡ Faster Setup with Bun (Recommended)

**Install Bun:**
```bash
# Linux/macOS
curl -fsSL https://bun.sh/install | bash

# Windows (PowerShell)
powershell -Command "irm bun.sh/install.ps1 | iex"
```

**Setup with Bun (5-10x faster):**
```bash
bun install
bun run build
bun test
bun dist/cli.js --help
```

---

## 📋 Prerequisites

### System Requirements

| OS | Minimum | Recommended |
|---|---|---|
| **Linux** | 512MB RAM, 100MB disk | 2GB RAM, 500MB disk |
| **macOS** | M1/Intel, 10.13+, 512MB RAM | M2+, 12.0+, 2GB RAM |
| **Windows** | Windows 10/11, 512MB RAM | Windows 11, 2GB RAM |

### Required Software

- **Node.js**: v18+ or **Bun**: v1.0+ (recommended)
- **GitHub CLI**: `gh` command
- **Git**: Version control
- **Text Editor**: VS Code, Vim, Nano, etc.
- **Internet Connection**: For setup and GitHub Copilot API

---

## 🔧 Platform-Specific Installation

### 🐧 Linux

#### Install Node.js

**Ubuntu/Debian:**
```bash
# Option 1: Via apt
sudo apt-get update
sudo apt-get install -y nodejs npm

# Option 2: Via NodeSource (newer versions)
curl -sL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node --version  # Should be v18+
```

**Fedora/RedHat:**
```bash
sudo dnf install nodejs npm
```

**Arch Linux:**
```bash
sudo pacman -S nodejs npm
```

#### Install GitHub CLI

```bash
# Ubuntu/Debian
sudo apt-key adv --keyserver keyserver.ubuntu.com --recv-key C99B11DEB97541F0
sudo apt-add-repository https://cli.github.com/packages
sudo apt update
sudo apt install gh

# Or with snap
sudo snap install gh

# Verify
gh --version
```

#### Additional Setup

```bash
# Make CLI executable
chmod +x dist/cli.js

# Add to PATH (optional)
sudo ln -s $(pwd)/dist/cli.js /usr/local/bin/cwc
```

---

### 🍎 macOS

#### Install Homebrew (if needed)

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

#### Install Dependencies

```bash
# Install Node.js and Git
brew install git curl node

# Install GitHub CLI
brew install gh

# Verify
node --version  # Should be v18+
gh --version
```

#### M1/M2 Mac Specific

```bash
# Check your CPU type
uname -m

# If you see "arm64" - you're on native Apple Silicon
# If you see "x86_64" - you're running under Rosetta

# For native Apple Silicon, ensure Node is ARM64
file $(which node)
# Should show: Mach-O 64-bit executable arm64
```

#### Make CLI Global

```bash
# Create symlink
sudo ln -s $(pwd)/dist/cli.js /usr/local/bin/cwc

# Or add to .zshrc/.bash_profile
echo 'export PATH="'$(pwd)'/dist:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

---

### 🪟 Windows

#### PowerShell Setup

**Open PowerShell as Administrator:**

```powershell
# Set execution policy
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Verify git is installed
git --version
```

#### Install Node.js

```powershell
# Option 1: Using Chocolatey
choco install nodejs

# Option 2: Download from https://nodejs.org/ (LTS version)

# Verify
node --version  # Should be v18+
npm --version
```

#### Install GitHub CLI

```powershell
# Using Chocolatey
choco install gh

# Or download from https://github.com/cli/cli/releases

# Verify
gh --version
```

#### Add to PATH

**Option A: Using Windows Terminal**
```powershell
# PowerShell automatically detects executables
.\dist\cli.js --help
```

**Option B: Add to System PATH**
1. Press `Win + X` → "System"
2. Click "Advanced system settings"
3. Click "Environment Variables"
4. Under "User variables", edit "Path"
5. Add: `C:\path\to\project\dist`
6. Restart terminal

**Option C: Create Command Shortcut**
```powershell
$batchContent = @"
@echo off
node C:\path\to\project\dist\cli.js %*
"@
$batchContent | Out-File -FilePath "C:\Windows\cwc.bat" -Encoding ASCII -Force
```

---

## ✅ Installation Checklist

### Phase 1: Prerequisites

- [ ] **Node.js v18+** installed
- [ ] **npm** installed
- [ ] **Git** installed
- [ ] **GitHub CLI** installed
- [ ] **Bun** installed (optional, for speed)
- [ ] Restarted terminal after installations

**Last Updated**: February 11, 2026  
**Installation Guide Version**: 7.0 (Stable)  
**Status**: Verified on Linux, macOS, Windows

### Phase 2: Get the Project

**Option A: Clone from GitHub**
```bash
git clone https://github.com/Ayush-CS-89112521/Copilot-Workflow-Composer-CWC-.git
cd copilot-workflow-composer
```
- [ ] Repository cloned
- [ ] Changed to project directory

**Option B: Download ZIP**
- [ ] ZIP file downloaded
- [ ] Extracted to location
- [ ] Terminal open in project folder

### Phase 3: Install Dependencies

```bash
# Using npm
npm install

# OR using Bun (faster)
bun install
```
- [ ] Dependencies installed without errors
- [ ] `node_modules/` folder created

### Phase 4: Build the Project

```bash
npm run build
# Or: bun run build
```
- [ ] Build completed successfully
- [ ] `dist/cli.js` file created
- [ ] No build errors

### Phase 5: Verify Installation

```bash
# Check versions
node --version  # Should be v18+
npm --version   # Should be v8+
git --version
gh --version

# Check project structure
ls dist/cli.js  # Should exist
ls src/cli.ts   # Should exist
ls tests/       # Should exist
```
- [ ] All versions correct
- [ ] All files exist

### Phase 6: GitHub Authentication

```bash
gh auth login
```

**Follow the prompts:**
1. Choose "GitHub.com"
2. Choose "HTTPS"
3. Choose authentication method
4. Complete authentication

```bash
# Verify
gh auth status
gh copilot suggest "echo hello"
```
- [ ] Logged in to GitHub CLI
- [ ] `gh auth status` shows authenticated
- [ ] Copilot suggestion works
- [ ] GitHub account has Copilot access

### Phase 7: Run Tests

```bash
npm test
# Or: bun test
```
- [x] All tests executed
- [x] 98% of tests passed (434/444)
- [x] Execution time < 15 seconds

---

## 🎯 First Run & Verification

### Test 1: Run CLI Help

```bash
node dist/cli.js --help

# Or (if added to PATH):
cwc --help
```
- [ ] Help displayed successfully
- [ ] Version shown

### Test 2: Create Your First Workflow

**Create `hello.yaml`:**
```yaml
name: "Hello World Workflow"
description: "Your first CWC workflow"
steps:
  - id: greet
    tool: echo
    args:
      message: "Hello from Copilot Workflow Composer! 🎉"
```

**Execute the workflow:**
```bash
node dist/cli.js hello.yaml
# Or: cwc hello.yaml
```

**Expected Output:**
```
✓ Workflow executed successfully
✓ Step 'greet' completed
Output: Hello from Copilot Workflow Composer! 🎉
```
- [ ] Workflow executed successfully
- [ ] Got expected output

### Test 3: Try Interactive Mode

**Create `interactive.yaml`:**
```yaml
name: "Interactive Example"
description: "Test step-by-step mode"
steps:
  - id: step1
    tool: echo
    args:
      message: "First step"
  
  - id: step2
    tool: echo
    args:
      message: "Second step"
```

**Run with step-mode:**
```bash
node dist/cli.js interactive.yaml --step-mode
```

**At each pause, choose:**
- `a` - Approve (continue)
- `m` - Modify (edit step)
- `d` - Deny (skip step)

- [ ] Step-mode executed
- [ ] Could approve/skip steps

### Test 4: Explore Features

```bash
# Check example workflows
ls examples/

# Check documentation
ls docs/

# Explore MCP tools
node dist/cli.js connect --list
```
- [ ] Reviewed examples
- [ ] Explored documentation

---

## 🆘 Troubleshooting

### 🐧 Linux Issues

#### "Command not found: node"

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y nodejs npm

# Verify
node --version
```

#### "Permission denied: dist/cli.js"

```bash
# Make executable
chmod +x dist/cli.js

# Or run with node
node dist/cli.js --help
```

#### "npm: permission denied"

```bash
# Fix npm permissions (recommended)
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
export PATH=~/.npm-global/bin:$PATH
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

#### "gh: command not found"

```bash
# Ubuntu/Debian
sudo apt-key adv --keyserver keyserver.ubuntu.com --recv-key C99B11DEB97541F0
sudo apt-add-repository https://cli.github.com/packages
sudo apt update
sudo apt install gh

# Or with snap
sudo snap install gh
```

---

### 🍎 macOS Issues

#### "Command not found: node"

```bash
# Install Homebrew first
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js
brew install node

# Verify
node --version
```

#### "Permission denied: .zshrc"

```bash
# Fix permissions
chmod 644 ~/.zshrc

# Edit safely
nano ~/.zshrc
```

#### M1/M2 Mac: Native vs Rosetta

```bash
# Check CPU type
uname -m

# Reinstall Node.js for native Apple Silicon
brew uninstall node
brew install node

# Verify architecture
file $(which node)
# Should show: Mach-O 64-bit executable arm64
```

#### "npm install" hangs

```bash
# Kill the process (Ctrl+C)

# Clear npm cache
npm cache clean --force

# Try again
npm install --verbose

# Or use Bun
curl -fsSL https://bun.sh/install | bash
bun install
```

---

### 🪟 Windows Issues

#### "Node.js not found in PowerShell"

**Solution 1: Reinstall Node.js**
1. Download from https://nodejs.org/ (LTS version)
2. Run installer with **default settings**
3. **Restart PowerShell** completely
4. Test: `node --version`

**Solution 2: Use Chocolatey**
```powershell
# Install Chocolatey first
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Install Node.js
choco install nodejs

# Restart PowerShell
node --version
```

#### "GitHub CLI not found"

```powershell
# Using Chocolatey
choco install gh

# Or download from https://github.com/cli/cli/releases

# Verify
gh --version
```

#### "Execution policy prevents script execution"

```powershell
# Run PowerShell as Administrator
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Verify
Get-ExecutionPolicy
# Should show: RemoteSigned
```

#### "npm install fails"

```powershell
# Option 1: Use --legacy-peer-deps
npm install --legacy-peer-deps

# Option 2: Clear cache
npm cache clean --force
npm install

# Option 3: Use Bun
powershell -Command "irm bun.sh/install.ps1 | iex"
bun install
```

#### "Build fails with TypeScript errors"

```powershell
# Clear and reinstall
Remove-Item -Recurse -Force dist
Remove-Item -Recurse -Force node_modules

npm install
npm run build

# If still fails, update TypeScript
npm install -g typescript@latest
npm install typescript@latest --save-dev
npm run build
```

#### "Long path names cause issues"

```powershell
# Enable Long Path Support (Windows 10+)
# Run PowerShell as Administrator
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force

# Or move project to shorter path
# From: C:\Users\YourName\Desktop\very\long\path\copilot-workflow-composer
# To: C:\projects\cwc
```

---

### 🌐 Cross-Platform Issues

#### "Port already in use"

**Linux/macOS:**
```bash
# Find process
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use different port
PORT=3001 npm start
```

**Windows:**
```powershell
# Find process
netstat -ano | findstr :3000

# Kill process
taskkill /PID <PID> /F

# Or use different port
$env:PORT = 3001
npm start
```

#### "Cannot find module" errors

```bash
# Reinstall dependencies
rm -rf node_modules
npm install

# If specific module missing
npm install <module-name>

# Verify
npm ls
```

#### "GitHub Copilot API errors"

```bash
# 1. Verify GitHub CLI
gh --version

# 2. Check authentication
gh auth status

# 3. Re-authenticate
gh auth logout
gh auth login

# 4. Test Copilot
gh copilot suggest "echo test"

# 5. Check subscription at github.com/settings/copilot
```

#### "YAML parsing errors"

```bash
# Common causes:
# 1. Tabs instead of spaces (YAML requires spaces)
# 2. Inconsistent indentation
# 3. Missing colons or quotes

# Validate at: https://www.yamllint.com/

# Example valid YAML (2-space indentation):
name: "Workflow Name"
steps:
  - id: step1
    tool: echo
    args:
      message: "Hello"
```

#### "Build errors"

```bash
# Clear everything
rm -rf dist node_modules tsconfig.tsbuildinfo

# Reinstall
npm install

# Rebuild with verbose output
npm run build -- --listFiles

# Check TypeScript version
npm list typescript
```

---

## 🎉 Success Checklist

- [ ] Phase 1: All prerequisites installed
- [ ] Phase 2: Project obtained
- [ ] Phase 3: Dependencies installed
- [ ] Phase 4: Project built successfully
- [ ] Phase 5: Verification passed
- [ ] Phase 6: GitHub authenticated
- [ ] Phase 7: Tests passed
- [ ] First workflow executed
- [ ] Interactive mode tested
- [ ] Documentation reviewed

---

## 📚 Next Steps

### Learn the Basics
- Read [README.md](../../README.md) - Full project overview
- Check [examples/](../../examples/) folder - Sample workflows
- Explore [docs/](../) - Additional documentation

### Try Advanced Features
- **Step Mode**: `--step-mode` flag for interactive approval
- **Planning Mode**: `--plan` flag for AI-generated plans
- **MCP Tools**: Connect 1,241+ external tools
- **RLHF Data**: Export training data with `cwc audit export`

### Create Your First Production Workflow
1. Design workflow in YAML
2. Test with `--step-mode` flag
3. Review auto-generated audit trail
4. Export labeled examples for fine-tuning

---

## 🆘 Getting Help

### For Issues
1. Check this troubleshooting section
2. Review existing GitHub issues
3. Create new issue with:
   - OS and version
   - Node.js version (`node --version`)
   - Full error message
   - Steps to reproduce

### For Questions
- Review [API.md](../API.md) documentation
- Check [examples/](../../examples/) folder
- Ask in GitHub discussions

---

## 💡 Pro Tips

1. **Use Bun** - 5-10x faster than npm
2. **Step Mode** - Add `--step-mode` flag for interactive approval
3. **Watch Tests** - Run `npm test -- --watch` during development
4. **YAML Examples** - Check `examples/` folder for workflow templates
5. **GitHub Integration** - Copilot needs active GitHub subscription

---

## 📊 Performance Benchmarks

| Operation | Linux | macOS | Windows |
|---|---|---|---|
| Install | 15-30s | 20-40s | 30-60s |
| Build | 3-5s | 4-6s | 5-8s |
| Test Suite | 6s | 7s | 8-10s |
| Execution | <50ms | <60ms | <100ms |
| Safety Checks | ~30ms | ~30ms | ~30ms |

---

**🎉 You're all set! Start with: `node dist/cli.js --help`**

*Last Updated: February 2026*
