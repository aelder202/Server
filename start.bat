@echo off

where /q git
if errorlevel 1 (
    echo You must install Git to proceed: https://git-scm.com
    exit /b
)

where /q npm
if errorlevel 1 (
    echo You must install Node.js to proceed: https://nodejs.org
    exit /b
)

where /q bun
if errorlevel 1 (
    if exist "%USERPROFILE%\.bun\bin\bun.exe" (
        set "PATH=%USERPROFILE%\.bun\bin;%PATH%"
    ) else (
        echo You must install Bun to proceed: https://bun.sh
        exit /b
    )
)

call npm install
if errorlevel 1 exit /b %errorlevel%

node start.js
if errorlevel 1 exit /b %errorlevel%
