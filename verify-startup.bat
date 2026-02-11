@echo off
REM Copilot Workflow Composer - Setup Verification (Windows)
REM Run this in PowerShell or Command Prompt to verify your setup

setlocal enabledelayedexpansion
set PASSED=0
set FAILED=0
set WARNINGS=0

echo.
echo ===============================================================
echo Copilot Workflow Composer - Setup Verification (Windows)
echo ===============================================================
echo.
echo System: Windows !date! !time!
echo.

REM Check Node.js
echo 1. Checking Node.js
where node >nul 2>&1
if !errorlevel! equ 0 (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
    echo [OK] Node.js installed: !NODE_VERSION!
    set /a PASSED+=1
) else (
    echo [FAIL] Node.js not found
    echo        Install from: https://nodejs.org/
    set /a FAILED+=1
)
echo.

REM Check npm
echo 2. Checking npm
where npm >nul 2>&1
if !errorlevel! equ 0 (
    for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
    echo [OK] npm installed: !NPM_VERSION!
    set /a PASSED+=1
) else (
    echo [FAIL] npm not found
    echo        Install with Node.js
    set /a FAILED+=1
)
echo.

REM Check Git
echo 3. Checking Git
where git >nul 2>&1
if !errorlevel! equ 0 (
    echo [OK] Git installed
    set /a PASSED+=1
) else (
    echo [FAIL] Git not found
    echo        Install from: https://git-scm.com/
    set /a FAILED+=1
)
echo.

REM Check GitHub CLI
echo 4. Checking GitHub CLI
where gh >nul 2>&1
if !errorlevel! equ 0 (
    echo [OK] GitHub CLI installed
    gh auth status >nul 2>&1
    if !errorlevel! equ 0 (
        echo [OK] GitHub authentication: Active
        set /a PASSED+=2
    ) else (
        echo [WARN] GitHub not authenticated
        echo         Run: gh auth login
        set /a WARNINGS+=1
    )
) else (
    echo [FAIL] GitHub CLI not found
    echo        Install from: https://cli.github.com/
    set /a FAILED+=1
)
echo.

REM Check Bun (optional)
echo 5. Checking Bun (Optional, Recommended)
where bun >nul 2>&1
if !errorlevel! equ 0 (
    for /f "tokens=*" %%i in ('bun --version') do set BUN_VERSION=%%i
    echo [OK] Bun installed: !BUN_VERSION!
    set /a PASSED+=1
) else (
    echo [WARN] Bun not installed (optional but recommended)
    echo         Install from: https://bun.sh
    set /a WARNINGS+=1
)
echo.

REM Check project structure
echo 6. Checking Project Structure
if exist "package.json" (
    echo [OK] package.json found
    set /a PASSED+=1
) else (
    echo [FAIL] package.json not found
    set /a FAILED+=1
)

if exist "tsconfig.json" (
    echo [OK] tsconfig.json found
    set /a PASSED+=1
) else (
    echo [FAIL] tsconfig.json not found
    set /a FAILED+=1
)

if exist "src\" (
    echo [OK] src\ directory found
    set /a PASSED+=1
) else (
    echo [FAIL] src\ directory not found
    set /a FAILED+=1
)

if exist "tests\" (
    echo [OK] tests\ directory found
    set /a PASSED+=1
) else (
    echo [WARN] tests\ directory not found
    set /a WARNINGS+=1
)
echo.

REM Check dependencies
echo 7. Checking Dependencies
if exist "node_modules\" (
    echo [OK] node_modules\ found (dependencies installed)
    set /a PASSED+=1
    
    if exist "node_modules\typescript" (
        echo [OK] typescript installed
        set /a PASSED+=1
    ) else (
        echo [WARN] typescript not found
        set /a WARNINGS+=1
    )
) else (
    echo [WARN] node_modules\ not found
    echo         Run: npm install
    set /a WARNINGS+=1
)
echo.

REM Check build artifacts
echo 8. Checking Build Status
if exist "dist\cli.js" (
    echo [OK] dist\cli.js found (built successfully)
    set /a PASSED+=1
) else (
    echo [WARN] dist\cli.js not found
    echo         Run: npm run build
    set /a WARNINGS+=1
)
echo.

REM Check .env file
echo 9. Checking Configuration
if exist ".env" (
    echo [OK] .env configuration file found
    set /a PASSED+=1
) else if exist ".env.example" (
    echo [WARN] .env not found (using defaults)
    echo         Create from example: copy .env.example .env
    set /a WARNINGS+=1
) else (
    echo [INFO] No .env file needed (using defaults)
)
echo.

REM Summary
echo ===============================================================
echo Verification Summary
echo ===============================================================
echo.
echo Passed:  !PASSED!
echo Warnings: !WARNINGS!
echo Failed:  !FAILED!
echo.

if !FAILED! equ 0 (
    echo [SUCCESS] Setup verification complete!
    echo.
    echo Next steps:
    echo   1. Run: node dist\cli.js --help
    echo   2. Create a test workflow in YAML
    echo   3. Execute: node dist\cli.js workflow.yaml
    echo.
    echo For more help, see:
    echo   - STARTUP_GUIDE.md (comprehensive guide)
    echo   - QUICK_SETUP_CARD.md (quick reference)
    echo   - README.md (project overview)
    exit /b 0
) else (
    echo [FAIL] Setup verification found issues
    echo.
    echo Please fix the failed items above and run this script again.
    exit /b 1
)
