@echo off
chcp 65001 >nul
title 荒野余烬 · 饥荒局域网联机服务器
cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo [错误] 未检测到 Node.js 环境，请先安装 Node.js ^(https://nodejs.org/^)！
  pause
  exit /b 1
)

echo 正在启动《荒野余烬：饥荒局域网联机网页版》服务...
node server/index.js --open
pause
