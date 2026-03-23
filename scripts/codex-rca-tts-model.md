You are working on Vela (Electron + React + Vite) at C:\Users\caipe\.openclaw\workspace\Vela

# TASK: Root-cause analysis and fix for two critical bugs

## Bug 1: `window.vela.switchModel is not a function`

The frontend App.jsx calls `window.vela.switchModel(modelId)` when the user clicks a model in the model switcher dropdown. But this function does NOT exist in `electron/preload.js`.

**What to do:**
1. Check `electron/preload.js` — list all exposed functions
2. Check `electron/main.js` — find existing model switch IPC handlers (search for "model", "switch", "setModel")
3. Check `src/core/vela-core.js` — find the model switching method (there should be one since `/model` command works)
4. If the backend method exists, add the IPC bridge in `electron/main.js` and expose it in `electron/preload.js`
5. If the backend method doesn't exist, implement a simple one that updates `runtimeSession` with the selected model
6. The function should match what App.jsx expects: `window.vela.switchModel(modelId)` → returns next state

## Bug 2: TTS (text-to-speech) not working — MiniMax shows 0 consumption

The user enters voice mode (clicks "开始说话"), speaker shows as enabled, sends a text message, gets text response but NO voice output. MiniMax console confirms 0 TTS API calls.

**What to investigate:**
1. In `src/core/vela-core.js`, trace the message handling path:
   - Find where `runtimeSession.voiceModeEnabled` is checked during message processing
   - Find where `SpeechOrchestrator` is created
   - Check if TTS config (`this.config.tts.enabled`, `this.config.tts.apiKey`) is properly loaded
2. In `electron/main.js`, check the `vela:send-message` handler — does it pass `onEvent` callback properly?
3. In `electron/main.js`, check the `vela:set-voice-mode` handler — does it properly call `core.setVoiceMode(true)`?
4. Check if `SpeechOrchestrator` requires the `onEvent` callback to stream audio chunks back
5. Check `vela.jsonc` — verify TTS config is correct (enabled: true, apiKey present, wsUrl correct)
6. Add diagnostic console.log statements at key points:
   - When `setVoiceMode` is called: log `enabled` value and `runtimeSession.voiceModeEnabled` after
   - When message is being processed: log whether speech orchestrator is created
   - When TTS WebSocket tries to connect: log the connection attempt

**What to fix:**
- Fix whatever is preventing TTS from triggering
- Make sure the `onEvent` callback chain is intact from Electron main → vela-core → SpeechOrchestrator → preload → React

## Constraints
- Do NOT modify App.jsx or styles.css — frontend is fine, the bugs are in the Electron/backend layer
- DO modify: `electron/preload.js`, `electron/main.js`, `src/core/vela-core.js` as needed
- Run `npm run build` at the end
- Output a summary of: root causes found, fixes applied, diagnostic logs added

## Files to read first
- `electron/preload.js` (full file)
- `electron/main.js` (full file)
- `src/core/vela-core.js` (search for voiceModeEnabled, setVoiceMode, handleUserMessage, SpeechOrchestrator)
- `src/core/tts/speech-orchestrator.js` (check constructor and connection logic)
- `vela.jsonc` (verify TTS config)
