@echo off
title Nostalgic Map Server
echo Starting Nostalgic Map local server...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1"
pause
