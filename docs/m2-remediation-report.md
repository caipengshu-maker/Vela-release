# M2 Remediation Report

## What M2 Now Does

- Streams assistant text incrementally instead of waiting for a full paragraph flush.
- Exposes a user-facing `Voice Mode` toggle while keeping ASR as a placeholder.
- Persists `fast / balanced / deep` and maps them into provider-side request tuning.
- Runs a canonical interaction state machine:
  - `idle`
  - `listening`
  - `thinking`
  - `speaking`
- Applies a deterministic policy layer before UI/TTS presentation:
  - emotion whitelist filtering
  - relationship gating
  - late-night restraint
  - camera cooldown
  - action coherence checks
  - mixed TTS emotion routing (`auto` by default, `force` only when needed)
- Maps expression, light motion, and `wide / close` camera state from the same policy result.
- Uses a MiniMax WebSocket TTS adapter aligned to the local frozen-doc lifecycle.
- Uses MiniMax mixed emotion routing with safe model guards:
  - default `emotion_mode=auto`
  - omit provider `emotion` in auto mode
  - force emotion only for explicit / constrained / continuity cases
  - downgrade `whisper` / `fluent` from `speech-2.8-*` to `speech-2.6-*`
- Keeps the current default voice path locked to `Chinese (Mandarin)_Sweet_Lady`.
- Handles TTS chunk playback through an interruptible queue path in the renderer.
- Supports manual interruption via:
  - sending a new message while speaking
  - pressing `停止当前输出`
  - turning `Voice Mode` off

## Mixed Emotion Routing Closure Note

- M2 no longer always maps avatar emotion into a provider emotion field.
- The default route is now MiniMax auto inference, so the TTS payload can send `emotion_mode=auto` and omit `emotion`.
- Force routing is reserved for explicit whisper-style asks, policy-constrained turns, and short-horizon continuity where the last forced tone should hold.
- `speech-2.8-*` is treated as unsupported for `whisper` / `fluent`; the adapter safely drops to the matching `speech-2.6-*` model family before sending force emotion.

## Known Limitations

- Real MiniMax voice-out was only verified through a mocked WebSocket server in this pass.
  - No real `MINIMAX_API_KEY` smoke was run.
- ASR remains placeholder-only by contract.
- The policy layer derives optional interaction hints from reply text heuristics because current provider output is still plain assistant text plus request tuning, not a fully structured interaction-intent payload.
- `close` camera hold is implemented as a light UI-side release back to `wide`, not a full camera script system.
- The placeholder TTS route is intentionally synthetic.
  - It validates queue/state behavior, not acoustic quality.

## Second-View Validation Still Needed

- Real MiniMax key smoke against:
  - `wss://api.minimaxi.com/ws/v1/t2a_v2`
- Real provider streaming confirmation for the chosen production LLM route.
- Real `emotion_mode=auto` / `force` behavior on live MiniMax.
- Real whisper / fluent downgrade behavior on:
  - `speech-2.8-*`
  - `speech-2.6-*`
- Human validation that camera/expression/action combinations feel natural over multiple turns, not just in scripted checks.
