@echo off
chcp 65001 >nul
title 宝石方块乐园 - 手机试玩服务
cd /d "%~dp0"

echo.
echo   ============================================
echo    宝石方块乐园 · 手机试玩
echo   ============================================
echo.
echo   保持这个窗口开着，然后在手机浏览器里打开
echo   下面列出的其中一个「手机」地址。
echo.
echo   注意：手机和这台电脑要连同一个 WiFi。
echo.
node server.mjs
echo.
echo   服务已停止。按任意键关闭。
pause >nul
