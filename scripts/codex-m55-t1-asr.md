You are working on the Vela AI companion app. This is an Electron + React + Three.js app.

TASK: Implement Web Speech API ASR (voice input) for M5.5-T1.

Current state:
- src/core/asr/provider.js is a placeholder (returns available: false)
- App.jsx has voiceMode state and handleVoiceToggle but ASR input is not wired
- vela.jsonc has asr: { enabled: false, provider: 'placeholder' }
- The mic button in App.jsx currently only toggles TTS voice mode, it does NOT trigger speech recognition

What to implement:

1. Replace src/core/asr/provider.js with a real Web Speech API provider:
   - export function createWebSpeechProvider() that returns { start(onResult, onError), stop(), isListening() }
   - Use window.SpeechRecognition || window.webkitSpeechRecognition
   - lang: 'zh-CN', interimResults: false, maxAlternatives: 1
   - onResult callback receives transcript string
   - export function getAsrCapabilities(config) should return available: true when provider is 'webspeech'

2. In App.jsx, add a SEPARATE mic/PTT button for voice INPUT:
   - Add a microphone input button to the LEFT of the textarea in the composer
   - When pressed: start Web Speech recognition -> on result: fill draft with transcript AND auto-submit
   - Show visual feedback while listening (button pulses, hint text changes to '正在听...')
   - On error or no result: show brief '没听清' hint then reset
   - This is INDEPENDENT from the existing TTS voice mode toggle button - do not change that button
   - Only show this button when ASR is available

3. Update vela.jsonc: set asr.enabled: true, asr.provider: 'webspeech'

4. Update src/core/config.js normalizeAsrConfig to handle provider: 'webspeech'

5. Add CSS styles in styles.css for the listening state (pulsing animation on the PTT button)

Constraints:
- Do NOT break existing TTS voice mode toggle
- Do NOT break existing text input submit flow
- Web Speech API is natively available in Electron's Chromium renderer, no npm packages needed
- Keep it simple: PTT style (press to speak, auto-submit on result)
- Follow existing code style (no TypeScript, plain JSX/JS)
- Run `npm run build` at the end to verify

Output a brief summary of changes.
