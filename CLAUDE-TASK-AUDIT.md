# TASK: Vela Full Codebase Health Audit

## Context
Vela is an AI companion app: Electron + Vite + React + Three.js VRM avatar.
Working dir: `C:\Users\caipe\.openclaw\workspace\Vela`
Source code is in `src/`.

The BGM bug was just fixed by rewriting bgm-controller.js to use <audio> element.
This task is NOT about BGM. It's a full codebase health audit.

## Your Mission

### 1. Scan the entire `src/` directory
Read every .js and .jsx file. Focus on:

**Over-engineering:**
- Simple features with unnecessarily complex implementations
- Abstractions that add indirection without value
- Code that could be 10 lines but is 100

**React anti-patterns:**
- Effects that will break under Strict Mode (double-run)
- Missing cleanup in effects that create subscriptions/timers
- State updates on unmounted components
- Stale closures in event handlers

**Error handling:**
- Uncaught promise rejections
- Missing try/catch around async operations
- Silent failures that should surface to user

**Dead code:**
- Unused imports
- Unreachable code paths
- Functions/variables that are defined but never called
- Leftover debug code (console.log that shouldn't be in production)

**Fragile patterns:**
- Race conditions in async code
- Assumptions about execution order
- Missing null checks on optional chains
- Type coercion bugs

### 2. Fix what you find
For each issue:
- If it's a quick fix (< 5 lines), fix it directly
- If it's a larger refactor, fix it if confident, or add a `// TODO(audit):` comment
- Delete dead code without hesitation
- Remove excessive console.log/console.warn that are debug-only

### 3. Key files to prioritize
- `src/App.jsx` — main component, likely has the most issues
- `src/core/vela-core.js` — core logic
- `src/core/memory-summarizer.js` — recently patched
- `src/core/tts/providers/minimax-websocket.js` — recently patched
- `src/core/tts/speech-orchestrator.js` — TTS orchestration
- `src/SettingsModal.jsx` — settings UI
- `src/OnboardingFlow.jsx` — onboarding UI
- `src/core/config.js` — config normalization
- `src/core/memory-store.js` — persistence
- `src/core/session-state.js` — session management
- `src/core/relationship.js` — relationship system
- `src/core/context-builder.js` — LLM context
- `src/core/provider.js` — LLM provider
- `src/core/providers/http-client.js` — HTTP client

### 4. Do NOT touch
- `src/core/bgm-controller.js` — just rewritten, leave it alone
- `src/core/audio-volume.js` — paired with bgm-controller
- Any file in `node_modules/`, `dist/`, `.vela-data/`
- Config files (vela.jsonc, package.json, vite.config.js)

### 5. Output
After all fixes:
1. Run `npm run build` — must pass
2. Commit fixes with message: `chore(audit): codebase health improvements`
3. Write a brief summary of what you found and fixed to `AUDIT-SUMMARY.md` in the project root

## Constraints
- You have FULL access to read and modify source files
- Prioritize: delete dead code > fix bugs > add safety > refactor
- Don't refactor working code just for style preferences
- Don't add new dependencies
- Keep changes surgical — don't rewrite entire files unless truly necessary
