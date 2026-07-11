@echo off
setlocal enabledelayedexpansion

echo ===================================================
echo               KAA ERP Deployment Hub
echo ===================================================
echo.

REM Verify remotes are set up
git remote | findstr /R "^origin$" >nul
if errorlevel 1 (
    git remote add origin https://github.com/jacobjerin38/KAAERPLIVE.git
) else (
    git remote set-url origin https://github.com/jacobjerin38/KAAERPLIVE.git
)

git remote | findstr /R "^backup$" >nul
if errorlevel 1 (
    git remote add backup https://github.com/jerinjacobdream11-lang/KAAERPLIVE.git
) else (
    git remote set-url backup https://github.com/jerinjacobdream11-lang/KAAERPLIVE.git
)

set TARGET_INPUT=%1

if "%TARGET_INPUT%"=="" (
    echo Select deployment target:
    echo [1] Sandbox / UAT (Branch: KAA_ERP_SANBOX)
    echo [2] Live Production (Branch: main)
    echo.
    set /p TARGET_INPUT="Choice (1 or 2, or type 'sandbox'/'live'): "
)

REM Normalize the input
set CHOICE=0
if /I "%TARGET_INPUT%"=="1" set CHOICE=1
if /I "%TARGET_INPUT%"=="sandbox" set CHOICE=1
if /I "%TARGET_INPUT%"=="uat" set CHOICE=1

if /I "%TARGET_INPUT%"=="2" set CHOICE=2
if /I "%TARGET_INPUT%"=="live" set CHOICE=2
if /I "%TARGET_INPUT%"=="production" set CHOICE=2
if /I "%TARGET_INPUT%"=="main" set CHOICE=2

if "%CHOICE%"=="0" (
    echo Invalid choice: "%TARGET_INPUT%". Exiting deployment.
    pause
    exit /b
)

echo.
echo Check for uncommitted changes...
git diff-index --quiet HEAD --
if errorlevel 1 (
    echo You have uncommitted changes.
    set /p commit_msg="Enter commit message (or press Enter for default): "
    if "!commit_msg!"=="" set commit_msg=update: deploy changes
    git add .
    git commit -m "!commit_msg!"
) else (
    echo Working tree clean. No commit needed.
)

if "%CHOICE%"=="1" (
    echo.
    echo ===================================================
    echo Deploying to Sandbox / UAT [KAA_ERP_SANBOX]...
    echo ===================================================
    
    echo Switching to KAA_ERP_SANBOX...
    git checkout KAA_ERP_SANBOX
    
    echo Merging main...
    git merge main -m "merge: sync main to sandbox"
    
    echo Pushing to KAA_ERP_SANBOX on origin...
    git push origin KAA_ERP_SANBOX
    
    echo Pushing to KAA_ERP_SANBOX on backup...
    git push backup KAA_ERP_SANBOX
    
    echo Switching back to main...
    git checkout main
    
    echo.
    echo ===================================================
    echo Sandbox / UAT Deployment Successful!
    echo ===================================================
)

if "%CHOICE%"=="2" (
    echo.
    echo ===================================================
    echo Deploying to Live Production [main]...
    echo ===================================================
    
    echo Pushing to LIVE PRODUCTION [main] on origin...
    git push origin main
    
    echo Pushing to LIVE PRODUCTION [main] on backup...
    git push backup main
    
    echo.
    echo ===================================================
    echo Live Production Deployment Successful!
    echo ===================================================
)

pause
