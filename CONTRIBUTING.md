# Contributing to Vela

Thanks for contributing. Vela is a local-first anime companion project, so changes should protect that identity instead of drifting toward a generic assistant app.

## Before You Start

- Keep the product boundary intact: Vela is a companion, not a system-control agent.
- Prefer local-first behavior and transparent data handling.
- Do not promise or merge features that sound impressive but do not fit the core experience.
- If your change affects emotion, relationship progression, memory behavior, or voice output, test the actual feel, not just the code path.

## Development Setup

Recommended baseline: a current Node.js LTS release and npm.

1. Install dependencies.

```bash
npm install
```

2. Update [`vela.jsonc`](vela.jsonc) for your machine before first run.

- Set `avatar.assetPath` to a real local `.vrm` file
- Set your LLM and optional TTS API keys
- Adjust `runtime.storageRoot` if you do not want the current local path
- If you want mic input, use `asr.provider: "webspeech"`

3. Run Vela.

```bash
npm start
```

Useful commands:

```bash
npm run dev
npm run build
npm run smoke
npm run verify:core
npm run verify:providers
```

Current repo reality:

- This is still a source-first desktop repo
- Packaging work is not finished yet
- Some checked-in config values are machine-specific and should be replaced locally

## Project Structure

- `electron/`: Electron main process and preload bridge
- `src/App.jsx`: main renderer shell, chat flow, voice mode, settings wiring
- `src/vrm-avatar-stage.jsx`: React wrapper around the 3D avatar scene
- `src/audio-player.js`: streamed audio playback, replay cache, lip-sync hook-up
- `src/core/vela-core.js`: app runtime orchestration
- `src/core/emotion-presets.js`: coordinated emotion presets for face, pose, camera, and animation
- `src/core/interaction-policy.js`: reply-to-presentation planning
- `src/core/relationship.js`: relationship score and stage progression
- `src/core/memory-store.js`: local memory persistence
- `src/core/memory-retriever.js`: relevant-memory retrieval
- `src/core/memory-summarizer.js`: post-turn memory generation
- `src/core/tts/`: speech orchestration and providers
- `src/core/providers/`: LLM provider adapters and routing
- `public/assets/`: shipped audio and animation assets
- `docs/`: design notes, architecture docs, and release-facing documentation

## Code Style Notes

- Follow the existing ES module style and current file conventions.
- Keep modules focused. If a change starts touching memory, relationship, avatar, and TTS all at once, reconsider the boundary.
- Prefer extending existing systems over adding parallel ones.
- Avoid new runtime dependencies unless the payoff is strong and local-first.
- Preserve or improve graceful fallback behavior. Vela should degrade quietly, not explode loudly.
- Do not hardcode private API keys, local absolute asset paths, or one-machine assumptions in docs or code you plan to publish.
- If you touch UI, include screenshots or short video captures in your PR when possible.

## Submitting Pull Requests

1. Keep PRs focused. One coherent change is better than a mixed bundle.
2. Explain the user-facing impact clearly.
3. Call out any config migrations, new assets, or compatibility risks.
4. Run `npm run build` before you open the PR.
5. If relevant, also run `npm run smoke` or the verify scripts listed above.
6. For avatar, voice, onboarding, or settings changes, include visual proof.

Good PR descriptions usually include:

- what changed
- why it changed
- how you tested it
- what still needs follow-up

## Reporting Issues

Please use the issue templates and include enough detail to reproduce the problem.

Helpful details:

- OS version
- Node.js and npm versions
- whether you ran `npm start` or `npm run dev`
- the relevant redacted parts of [`vela.jsonc`](vela.jsonc)
- exact steps to reproduce
- expected behavior
- actual behavior
- screenshots, logs, or short recordings if the bug is visual or timing-related

If the issue involves secrets, local paths, or personal conversation data, redact them first.

## Good First Areas to Help

- README and setup clarity
- packaging and path cleanup
- avatar polish and motion tuning
- lip-sync reliability
- onboarding flow improvements
- release-safe asset handling
- tests and verification scripts
