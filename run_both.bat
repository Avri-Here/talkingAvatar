@echo off

wt -w 0 -d "%~dp0serverHere" cmd /k "uv run run_server.py" ; new-tab -d "%~dp0electronApp" cmd /k "npm run dev"

