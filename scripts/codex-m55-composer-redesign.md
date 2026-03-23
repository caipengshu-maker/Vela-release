You are working on the Vela AI companion app (Electron + React + Vite). Project root: C:\Users\caipe\.openclaw\workspace\Vela

# TASK: Redesign the composer area with text/voice mode transition (M5.5-T1 + T5)

## Current State
- `src/App.jsx` has a composer with textarea + a single right-side button
- ASR (Web Speech API) is already wired: `createWebSpeechProvider`, `handleAsrToggle`, `submitDraftText` all exist
- TTS voice toggle exists: `handleVoiceToggle`
- Model switching exists via `window.vela.switchModel(modelId)` - currently only via `/model` command
- `state.modelStatus` has `availableModels`, `selectedModel`, `selectedLabel`, `activeLabel`
- Icons already defined: `MicIcon`, `SendIcon`, `WaveIcon`, `UpRightIcon`, `ReplayIcon`

## What to Implement

### 1. Two-Mode Composer (text mode ↔ voice mode)

**Text Mode (default):**
- Normal tall textarea (current rows="3")
- Right-side button logic:
  - Input EMPTY → "开始说话" text button (clicking enters voice mode AND starts ASR listening)
  - Input HAS TEXT → up-arrow send button (existing SendIcon)
- Left-bottom corner: small model switcher button (rocket icon or similar small icon)

**Voice Mode (entered by clicking "开始说话"):**
- Textarea shrinks to a single-line pill shape with CSS transition (~200ms ease-out on min-height, padding, border-radius)
- Above the pill: a small control bar with:
  - 🎤 Mic toggle button (controls ASR on/off independently - uses existing handleAsrToggle)
  - 🔊 Speaker toggle button (controls TTS on/off independently - uses existing handleVoiceToggle)
- Right-side button logic:
  - Input EMPTY → "停止" text button (clicking exits voice mode, stops ASR if listening)
  - Input HAS TEXT → up-arrow send button (same SendIcon, sends text then stays in voice mode)
- ASR auto-starts when entering voice mode
- When ASR recognizes text: fills input and auto-submits (existing submitDraftText logic)
- Left-bottom corner: same model switcher button (persists across modes)

### 2. Transition Animation
- Entering voice mode: textarea animates from tall (min-height ~112px) to pill (min-height ~40px, border-radius increases, padding shrinks)
- Voice control bar fades in (opacity 0→1, slight translateY)
- Exiting voice mode: reverse animation
- Use CSS transitions on the composer-field element, toggled by a class like `.is-voice-mode`
- Duration: ~200ms ease-out

### 3. Model Switcher
- Small icon button in the left-bottom of composer (below textarea, aligned with composer-actions)
- Clicking opens a floating dropdown/popover above the button
- Dropdown shows available models from `state.modelStatus.availableModels` (array of {id, label})
- If availableModels is empty or has only one entry, show at minimum: "MiniMax (主)" and "Kimi (备)" and "自动"
- Clicking a model calls `window.vela.switchModel(modelId)` and closes dropdown
- Current selection shown with a checkmark or highlight
- Dropdown appears with a subtle scale+fade animation (~150ms)
- Clicking outside closes dropdown
- The icon should be small and subtle (like Grok's rocket) - use a small diamond/star/settings icon

### 4. Voice Control Bar (in voice mode)
- Horizontal bar above the shrunken textarea pill
- Two icon buttons:
  - Mic: toggles ASR listening. Active (green/highlighted) when listening, muted (gray/dimmed) when off
  - Speaker: toggles TTS output. Active when TTS enabled, muted when off
- Each button is independent - you can have mic on + speaker off, or vice versa
- Bar has subtle background (semi-transparent dark or glass effect)

### 5. CSS Requirements
- All transitions use CSS transitions (not JS animation)
- Voice mode class `.is-voice-mode` on the composer or composer-field triggers the shape change
- Pulse animation on mic button when actively listening (existing pttPulse keyframes)
- Model dropdown uses `.model-switcher-open` class for visibility
- Responsive: composer should still look good at min window width (1120px)

### 6. Code Constraints
- Keep all existing functionality working (text submit, interrupt, proactive, replay, etc)
- DO NOT remove or break: handleSubmit, submitDraftText, handleAsrToggle, handleVoiceToggle, handleInterrupt, handleReplay
- Follow existing code style (plain JS/JSX, no TypeScript)
- The `voiceMode` state from App should now represent the UI mode (text vs voice), not just TTS toggle
- Add a new state: `const [isVoiceMode, setIsVoiceMode] = useState(false)` to control the UI mode
- Keep `voiceMode` (TTS) and ASR as independent sub-controls within voice mode
- New icons needed: a "stop" icon (square in circle), a "speaker" icon, a small icon for model switcher
- Run `npm run build` at the end to verify

### 7. Files to modify
- `src/App.jsx` - main component changes
- `src/styles.css` - all new styles and transitions
- Do NOT modify vela.jsonc, config.js, provider.js, vela-core.js (those are already correct)

Output a brief summary of all changes made.
