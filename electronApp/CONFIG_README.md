# Configuration Guide

## Overview

This application is configured entirely through the `config.json` file located in the `electronApp` directory. All settings that were previously available through the UI have been moved to this configuration file.

## Configuration File Location

- **Development**: `electronApp/config.json`
- **Runtime**: `electronApp/src/renderer/public/config.json` (automatically copied during build)

## Configuration Structure

```json
{
  "general": {
    "language": "en",
    "showSubtitle": true,
    "imageCompressionQuality": 0.8,
    "imageMaxWidth": 512
  },
  "websocket": {
    "wsUrl": "ws://127.0.0.1:12393/client-ws",
    "baseUrl": "http://127.0.0.1:12393"
  },
  "background": {
    "backgroundUrl": "http://127.0.0.1:12393/bg/ceiling-window-room-night.jpeg",
    "useCameraBackground": false
  },
  "character": {
    "configFilename": ""
  },
  "proactiveSpeak": {
    "allowProactiveSpeak": false,
    "idleSecondsToSpeak": 5,
    "allowButtonTrigger": false
  },
  "vad": {
    "micOn": false,
    "autoStopMic": false,
    "autoStartMicOn": false,
    "autoStartMicOnConvEnd": false,
    "positiveSpeechThreshold": 50,
    "negativeSpeechThreshold": 35,
    "redemptionFrames": 35
  },
  "live2d": {
    "scrollToResize": true,
    "pointerInteractive": true
  }
}
```

## Configuration Options

### General Settings

- **language**: Application language (`"en"` or `"zh"`)
- **showSubtitle**: Show/hide subtitles (`true`/`false`)
- **imageCompressionQuality**: JPEG compression quality (0.1-1.0, default: 0.8)
- **imageMaxWidth**: Maximum image width in pixels (0 for no limit, default: 512)

### WebSocket Settings

- **wsUrl**: WebSocket server URL
- **baseUrl**: Base HTTP server URL

### Background Settings

- **backgroundUrl**: URL of the background image
- **useCameraBackground**: Use camera as background (`true`/`false`)

### Character Settings

- **configFilename**: Character configuration filename

### Proactive Speak Settings

- **allowProactiveSpeak**: Enable proactive speaking (`true`/`false`)
- **idleSecondsToSpeak**: Seconds of idle time before proactive speak
- **allowButtonTrigger**: Allow button trigger for speaking (`true`/`false`)

### VAD (Voice Activity Detection) Settings

- **micOn**: Initial microphone state (`true`/`false`)
- **autoStopMic**: Auto stop mic when AI starts speaking (`true`/`false`)
- **autoStartMicOn**: Auto start mic when AI starts speaking (`true`/`false`)
- **autoStartMicOnConvEnd**: Auto start mic when conversation ends (`true`/`false`)
- **positiveSpeechThreshold**: Positive speech detection threshold (0-100, default: 50)
- **negativeSpeechThreshold**: Negative speech detection threshold (0-100, default: 35)
- **redemptionFrames**: Number of frames for speech redemption (default: 35)

### Live2D Settings

- **scrollToResize**: Enable scroll to resize model (`true`/`false`)
- **pointerInteractive**: Enable pointer interaction with model (`true`/`false`)

## How to Modify Configuration

1. Open `electronApp/config.json` in a text editor
2. Modify the desired settings
3. Save the file
4. Restart the application for changes to take effect

## Notes

- The configuration file must be valid JSON
- All settings are loaded at application startup
- Changes require application restart
- Invalid configuration values will fall back to defaults

