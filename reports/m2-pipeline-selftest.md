# M2 Pipeline Self-Test

Date: 2026-03-20
Branch under test: `feat/m2-pipeline`

## Checklist

- `npm run build`: PASS
  - Result: `vite build` completed successfully.

- `npm run verify:core`: PASS
  - Result: `verify:core ok`.
  - Note: runtime log showed `openai-compatible` primary attempt, then configured `openai-compatible` fallback, then mock after `missing-api-key`.

- `npm run smoke`: PASS
  - Result: Electron smoke run printed `smoke:window-ready`.

- Streaming text delta events: confirmed
  - Evidence: `src/core/vela-core.js` converts provider `text-delta` events into `assistant-stream-delta` events and updates streamed content state (`src/core/vela-core.js:554`, `src/core/vela-core.js:562`).
  - Supporting check: `npm run verify:m2` passed.

- State machine transitions: confirmed
  - Evidence: canonical phases remain `idle / listening / thinking / speaking` (`src/core/interaction-contract.js:1`).
  - Evidence: the core now preserves `speaking` through the returned state and emitted completion state until the existing settle path takes over (`src/core/vela-core.js:589`, `src/core/vela-core.js:631`, `src/core/vela-core.js:656`).
  - Supporting check: `npm run verify:m2` passed.

- Thinking mode mapping: confirmed
  - Evidence: `fast / balanced / deep` map to distinct `reasoningEffort`, token, and thinking-budget settings in `src/core/providers/thinking-mode.js` (`src/core/providers/thinking-mode.js:47`, `src/core/providers/thinking-mode.js:57`, `src/core/providers/thinking-mode.js:66`, `src/core/providers/thinking-mode.js:84`).
  - Supporting check: `npm run verify:m2` passed.

- Fallback chain: confirmed
  - Evidence: `src/core/provider.js` reads `config.llm.fallback`, attempts that real fallback provider first, and only then routes to `executeMockFallback` (`src/core/provider.js:247`, `src/core/provider.js:264`, `src/core/provider.js:292`, `src/core/provider.js:304`).
  - Evidence: `vela.jsonc` is set to primary `openai-compatible` with a real fallback model (`vela.jsonc:22`, `vela.jsonc:24`, `vela.jsonc:36`, `vela.jsonc:37`, `vela.jsonc:38`).

- UI fallback indicator: confirmed
  - Evidence: the renderer shows a per-message fallback badge and a top-level fallback banner when `providerMeta.fallbackUsed` is present (`src/App.jsx:297`, `src/App.jsx:299`, `src/App.jsx:805`, `src/App.jsx:806`).

## Extra Verification

- `npm run verify:m2`: PASS
  - Used as supporting evidence for streaming deltas, state transitions, thinking-mode mapping, and fallback behavior.
