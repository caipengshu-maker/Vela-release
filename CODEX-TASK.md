# Vela T8 + T9: Window State Persistence + Lip Sync

Project root: C:\Users\caipe\.openclaw\workspace\Vela
This is an Electron + React + Three.js/VRM app.

## CRITICAL RULES
- Windows PowerShell. Do NOT use && to chain commands.
- Do NOT assign to or modify `window.vela` — it is created by Electron's contextBridge and is READ-ONLY. Any attempt to set properties on it will crash the app.
- For exposing new globals from renderer-side code, use a separate global like `window.__velaXxx`.
- All source files must be UTF-8 without BOM. Do NOT use PowerShell `Set-Content` to modify JS/JSX files.

## Architecture Context
- `electron/main.js` — Electron main process, IPC handlers, BrowserWindow creation
- `electron/preload.js` — contextBridge.exposeInMainWorld("vela", {...}) — READ-ONLY after creation
- `src/App.jsx` — Main React app, manages state, renders UI
- `src/vrm-avatar-stage.jsx` — Three.js canvas, VRM model loading, avatar controller
- `src/core/vrm-avatar-controller.js` — Controls VRM model (animations, expressions, morph targets)
- `src/core/audio-player.js` or `src/audio-player.js` — TTS audio playback via <audio> element
- `src/styles.css` — All CSS

## Task 1: T8 — Window State Persistence

Remember window size and position across app restarts.

1. In `electron/main.js`:
   - Define a helper to read/write window state from `.vela-data/window-state.json`
   - On startup, read saved state and use it for BrowserWindow bounds (x, y, width, height)
   - Fall back to config defaults if file missing or bounds invalid
   - Validate bounds are within screen using `electron.screen.getDisplayMatching()`
   - Listen for window `resize` and `move` events (debounce 500ms), save state
   - Also save on window close (before-quit)

2. No new dependencies. Use Node `fs` module.

## Task 2: T9 — Amplitude-Based Lip Sync

When TTS audio plays through the <audio> element, the VRM avatar's mouth should move.

1. Create `src/core/lip-sync.js`:
   - Export class `LipSyncAnalyser`
   - Constructor takes AudioContext
   - `connectSource(mediaElement)` — creates MediaElementSource + AnalyserNode
   - `getAmplitude()` — reads frequency data, returns normalized 0-1 float
   - `disconnect()` — cleanup
   - Handle the case where the same media element is connected twice (store and reuse MediaElementSource)

2. In `src/core/vrm-avatar-controller.js`:
   - Add method `setMouthOpenness(value)` where value is 0-1
   - Find the right blend shape: look for "mouth_open", "aa", "oh" in the VRM's expressionManager
   - Set it via `vrm.expressionManager.setValue(name, value)`

3. In `src/vrm-avatar-stage.jsx`:
   - Expose the avatar controller's setMouthOpenness via `window.__velaSetMouthOpenness = (v) => controller?.setMouthOpenness?.(v)`
   - Do NOT touch `window.vela` — it is read-only from contextBridge

4. In `src/App.jsx` (or wherever TTS audio playback is managed):
   - When TTS audio starts playing, create LipSyncAnalyser, connect to audio element
   - Start a requestAnimationFrame loop:
     - Get amplitude from analyser
     - Smooth it: `smoothed = lerp(previous, amplitude, 0.3)`
     - Call `window.__velaSetMouthOpenness(smoothed)`
   - When TTS stops/finishes/errors, cancel the RAF loop and fade mouth to 0
   - Store refs to avoid re-creating AudioContext on every TTS play

5. CSS: No changes needed for lip sync.

## Verification
- Run `npm run build` and confirm it passes
- Check that the app starts without errors

## Commit
After ALL changes are verified:
```
git add -A
git commit -m "feat(t8+t9): window state persistence + amplitude-based lip sync"
```
