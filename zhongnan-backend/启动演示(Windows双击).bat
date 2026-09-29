@echo off
chcp 65001 >nul
title 终南集 AGI编剧大师 - 本地演示 (关闭本窗口即停止服务)
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 没有检测到 Node.js，请先到 https://nodejs.org 下载安装 LTS 版，装完重新双击本文件。
  pause
  exit /b 1
)
if not exist node_modules (
  echo 首次运行：正在安装依赖，约 20-60 秒，请耐心等待...
  call npm install --no-audit --no-fund
  if errorlevel 1 ( echo [错误] 依赖安装失败，请把本窗口内容截图发我。 & pause & exit /b 1 )
)
if not exist dist (
  echo 首次运行：正在编译，约 30-60 秒...
  call npm run build
  if errorlevel 1 ( echo [错误] 编译失败，请把本窗口内容截图发我。 & pause & exit /b 1 )
)
echo.
echo ==========================================================
echo  启动成功后，用浏览器打开： http://127.0.0.1:8099
echo  演示账号密码统一为：demo123456
echo  高级会员账号：13900000003 ；停止服务：直接关闭本窗口
echo ==========================================================
echo.
start "" "http://127.0.0.1:8099"
node scripts\start-demo.cjs
pause
