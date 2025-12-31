# VRM Pet - Minimal Desktop Companion

A minimal Electron application that displays VRM models as desktop pets with full Python server integration.

## Features

- ✅ VRM model rendering using @pixiv/three-vrm
- ✅ Transparent, always-on-top window
- ✅ Draggable pet mode
- ✅ WebSocket connection to Python backend server
- ✅ Audio playback with lip-sync
- ✅ Facial expressions (emotions)
- ✅ Voice Activity Detection (VAD)
- ✅ Microphone input support

## Installation

1. Install dependencies:
```bash
npm install
```

2. Place your VRM model in the `models/` directory

3. Update `config.json` with your VRM model path and server settings

## Usage

1. Start the Python server:
```bash
cd ../serverHere
uv run run_server.py
```

2. Start the VRM Pet app:
```bash
npm start
```

3. Controls:
   - **Drag**: Click and drag anywhere to move the character
   - **ESC**: Quit the application
   - **Voice**: Speak to interact (automatic voice detection)

## Configuration

Edit `config.json` to customize:

```json
{
  "vrm_model": "./models/character.vrm",
  "server": {
    "host": "localhost",
    "port": 12393
  },
  "window": {
    "width": 400,
    "height": 600,
    "transparent": true,
    "alwaysOnTop": true
  }
}
```

## File Structure

```
vrmPetApp/
├── package.json          # Dependencies
├── config.json          # Configuration
├── models/              # VRM model files
├── src/
│   ├── main.js         # Electron main process
│   ├── preload.js      # IPC bridge
│   └── renderer/
│       ├── index.html         # Main HTML
│       ├── vrm-renderer.js    # VRM rendering
│       ├── websocket-client.js # Server communication
│       ├── audio-handler.js   # Audio & lip-sync
│       └── mic-input.js       # Voice input
```

## Technical Details

- **Framework**: Electron (no React, no TypeScript)
- **3D Rendering**: Three.js + @pixiv/three-vrm
- **Communication**: WebSocket (compatible with existing Python server)
- **Voice Input**: MediaRecorder API with Voice Activity Detection
- **Lip Sync**: Real-time audio analysis using Web Audio API

## Advantages

- **Simple**: ~500 lines of code
- **Fast**: Minimal overhead, instant startup
- **Compatible**: Works with existing Python backend
- **Focused**: Pure VRM pet mode, no UI clutter

## Reference

Based on [@pixiv/three-vrm documentation](https://pixiv.github.io/three-vrm/docs/modules/three-vrm)

## License

MIT

