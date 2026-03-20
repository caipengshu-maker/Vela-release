# M2 Spike Audit

Truth source: `M2_INTERACTION_CONTRACT.md`

## Reused
- Provider streaming scaffolding from `spike/m2-expression-wip` for OpenAI-compatible and anthropic-like SSE handling.
- Event bridge patterns in `electron/main.js` and `electron/preload.js`.
- Renderer audio queue basics in `src/audio-stream-player.js`.
- Placeholder speech route and the MiniMax WebSocket session skeleton as a starting point.

## Rewritten
- `src/core/vela-core.js` around the frozen M2 contract, not the spike flow.
- Deterministic policy layer in `src/core/interaction-policy.js` and `src/core/interaction-contract.js`.
- Presence/state machine handling for `idle / listening / thinking / speaking`.
- TTS orchestration, segmenting, queueing, interrupt/reset behavior, and UI state sync.
- Thinking-mode mapping so `fast / balanced / deep` map through provider-specific request tuning.
- MiniMax WS task-start handling so TTS defaults to `emotion_mode=auto`, only forces when policy requires it, and safely downgrades `whisper` / `fluent` from `speech-2.8-*` to `speech-2.6-*`.

## Discarded
- The spike's heuristic avatar logic as a source of truth.
- Any spike behavior that let the old WIP dictate architecture instead of the frozen contract.
- The idea of adding a second policy model; M2 now stays deterministic.
- Non-M2 expansion work such as deep ASR, routing/fallback projects, or heavy runtime/avatar overhauls.
