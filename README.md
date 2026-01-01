# Talking Avatar - AI VTuber Application

AI-powered virtual character with voice interaction, using Electron + Python backend.

## Architecture Flow

```
Electron Desktop App
    ↓ WebSocket
Python Server (FastAPI)
    ↓
┌─────────────────────────────────────┐
│ Components:                         │
│ • LLM: GitHub Models (gpt-4o-mini) │
│ • ASR: Whisper.cpp (tiny.en)       │
│ • TTS: Edge TTS (Free)             │
│ • Live2D: Character Animation       │
│ • MCP Tools: time, windowsCli       │
└─────────────────────────────────────┘
```

## Quick Start

### 1. Start Development

```bash
npm run dev
```

This will:
- Launch Electron app (port 5173)
- Auto-start Python server (port 12393)
- Connect WebSocket between them

### 2. Configuration

Main config: `serverHere/conf.yaml`

```yaml
# LLM Configuration
llm_configs:
  openai_compatible_llm:
    base_url: 'https://models.inference.ai.azure.com'
    model: 'gpt-4o-mini'
    llm_api_key: 'your-github-token'

# Voice Recognition (75MB model)
asr_config:
  asr_model: 'whisper_cpp'
  whisper_cpp:
    model_name: 'tiny.en'

# Text-to-Speech (Free)
tts_config:
  tts_model: 'edge_tts'
  edge_tts:
    voice: 'en-US-AvaMultilingualNeural'

# MCP Tools
agent_settings:
  basic_memory_agent:
    use_mcpp: True
    mcp_enabled_servers: ["time", "windowsCli"]
```

### 3. MCP Servers

Config: `serverHere/mcp_servers.json`

```json
{
  "mcp_servers": {
    "time": {
      "command": "uvx",
      "args": ["mcp-server-time", "--local-timezone=Asia/Jerusalem"]
    },
    "windowsCli": {
      "command": "npx",
      "args": ["-y", "@simonb97/server-win-cli"]
    }
  }
}
```

## Key Features

✅ **Single Client Architecture** - Optimized for one Electron instance
✅ **Shared MCP Connections** - Reuses connections across sessions
✅ **Minimal Resources** - Whisper tiny.en (75MB), Edge TTS (free)
✅ **GitHub Models** - Free tier for gpt-4o-mini
✅ **Live2D Animation** - Interactive character models

## Project Structure

```
talkingAvatar/
├── electronApp/          # Electron frontend
│   └── src/
│       ├── main/         # Main process
│       └── renderer/     # React UI
└── serverHere/           # Python backend
    ├── conf.yaml         # Main configuration
    ├── mcp_servers.json  # MCP tools config
    └── src/
        └── open_llm_vtuber/
```

## Performance Optimizations

1.  **MCP Parallel Loading** - Connects to all MCP servers simultaneously at startup for faster boot.
2.  **FastAPI Lifespan Management** - Uses standard lifespan events for stable initialization and cleanup on Windows.
3.  **Single Client Architecture** - Optimized for one Electron instance with shared tool management.
4.  **Security Headers** - Built-in Content Security Policy (CSP) to satisfy Electron security requirements.

## Requirements

- Node.js 18+
- Python 3.10+
- UV (Python package manager)
- Windows 10/11

## Troubleshooting

**No audio?**
- Edge TTS requires internet connection
- Check microphone permissions

**MCP tools not working?**
- Verify `uvx` and `npx` are in PATH
- Check `serverHere/mcp_servers.json` config





taskkill /F /IM electron.exe & taskkill /F /IM node.exe & taskkill /F /IM python.exe

Get-Process electron,node,python -ErrorAction SilentlyContinue | Stop-Process -Force