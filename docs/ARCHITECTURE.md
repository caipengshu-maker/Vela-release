# Vela Architecture

This document is the high-level map for how Vela works today. It stays close to the real repo layout and avoids hand-wavy platform diagrams.

## System View

```text
+-----------------------------+
| Electron Main Process       |
| electron/main.js            |
|-----------------------------|
| BrowserWindow               |
| IPC bridge                  |
| VelaCore lifecycle          |
+-------------+---------------+
              |
              v
+-----------------------------+
| Core Runtime                |
| src/core/vela-core.js       |
|-----------------------------|
| config loading              |
| session state               |
| memory + relationship       |
| awareness/context fusion    |
| LLM provider routing        |
| interaction planning        |
| speech orchestration        |
+------+------+---------------+
       |      |
       |      +--------------------------+
       |                                 |
       v                                 v
+----------------------+      +---------------------------+
| Renderer UI          |      | Speech / Audio            |
| src/App.jsx          |      |---------------------------|
|----------------------|      | speech-orchestrator.js    |
| chat shell           |      | minimax-websocket.js      |
| onboarding           |      | audio-player.js           |
| settings             |      | viseme-driver.js          |
| fullscreen / voice   |      +---------------------------+
| bridge diary         |
+----------+-----------+
           |
           v
+-----------------------------+
| 3D Avatar Presentation      |
|-----------------------------|
| vrm-avatar-stage.jsx        |
| vrm-avatar-controller.js    |
| emotion-presets.js          |
| avatar-state.js             |
+-----------------------------+
```

## Key Modules

### `electron/main.js`

- Creates the desktop window
- Sets up the IPC contract used by the renderer
- Instantiates `VelaCore`
- Handles bootstrap, messaging, onboarding, settings, voice mode, fullscreen, and bundled asset reads

### `src/core/vela-core.js`

- The runtime brain of the app
- Loads `vela.jsonc`
- Initializes local persistence and runtime session state
- Builds the app state sent to the renderer
- Handles user messages, proactive openings, onboarding, settings changes, and model switching
- Resolves the avatar presentation plan and speech plan for each reply

### Memory and relationship layer

- `src/core/memory-store.js`
  - Stores profile, relationship, summaries, facts, sessions, and episodes
- `src/core/memory-retriever.js`
  - Retrieves relevant prior memories from saved episode summaries
- `src/core/memory-summarizer.js`
  - Generates structured memory episodes after important turns
- `src/core/relationship.js`
  - Tracks relationship score and the `reserved -> warm -> close` stage flow
- `src/core/milestones.js`
  - Triggers milestone-style moments such as streaks and returns after absence
- `src/core/bridge-diary.js`
  - Generates a short "last time with you..." style note for startup continuity

### Interaction and emotion layer

- `src/core/interaction-policy.js`
  - Converts reply intent into emotion, action, camera, and TTS behavior
- `src/core/emotion-presets.js`
  - Defines the 12 emotion presets and their coordinated face/body/camera settings
- `src/core/avatar-state.js`
  - Maps interaction plans into renderer-facing avatar state

### Provider and speech layer

- `src/core/provider.js`
  - Routes the LLM request through primary/fallback logic
- `src/core/providers/*`
  - LLM adapters for mock, OpenAI-compatible, Anthropic-style, and MiniMax-style providers
- `src/core/tts/speech-orchestrator.js`
  - Splits streamed reply text into speech segments and manages TTS session lifecycle
- `src/core/tts/providers/minimax-websocket.js`
  - Streams audio chunks from MiniMax over WebSocket

### Renderer and 3D presentation

- `src/App.jsx`
  - Main UI shell, event handling, composer, onboarding, settings, replay, voice controls
- `src/audio-player.js`
  - Plays streamed audio, stores replay blobs, and feeds lip-sync updates
- `src/core/viseme-driver.js`
  - Uses HeadAudio to derive viseme weights from playback audio
- `src/vrm-avatar-stage.jsx`
  - React wrapper for the 3D stage and avatar loading
- `src/core/vrm-avatar-controller.js`
  - Loads the VRM, retargets Mixamo FBX clips, applies morphs, controls pose, and updates camera framing

## Data Flow

### User input -> LLM -> emotion -> avatar + TTS

1. The renderer sends a message through IPC with `vela:send-message`.
2. `VelaCore` loads the latest memory snapshot and session context.
3. `MemoryRetriever` pulls relevant memories from stored episode summaries.
4. Time awareness, weather awareness, behavior patterns, and relationship hints are fused into an awareness packet.
5. `buildContext(...)` creates the LLM prompt context.
6. The provider layer streams the reply from the selected LLM route.
7. As text arrives, `VelaCore` resolves an interaction plan:
   - emotion
   - intensity
   - camera
   - action
   - expression
   - TTS preset and provider emotion mode
8. The renderer updates the avatar state immediately.
9. The speech orchestrator turns streamed text into TTS segments.
10. MiniMax WebSocket TTS returns audio chunks.
11. `AudioPlayerService` plays those chunks and feeds playback into `VisemeDriver`.
12. `VrmAvatarController` applies mouth openness or viseme weights to the VRM while also running emotion/body/camera updates.
13. After the turn, background memory jobs summarize the conversation, store facts, and refresh relationship-related state.

## Storage Model

Vela persists local data under the configured `runtime.storageRoot`.

Important files and folders:

- `memory/profile.json`
  - user profile and onboarding profile
- `memory/user-model.json`
  - structured user preferences and notes derived from facts
- `memory/relationship.json`
  - relationship state plus milestone metadata
- `memory/memory-summary.json`
  - recent summaries, bridge summary, open follow-ups
- `memory/facts.jsonl`
  - extracted facts
- `memory/episodes/*.jsonl`
  - structured memory episodes
- `memory/sessions/*.jsonl`
  - turn summaries written over time
- `state/session.json`
  - runtime/session preferences, last activity, provider routing, last avatar state
- `state/relationship.json`
  - relationship tracker state used for progression logic

Static renderer assets live under `public/assets/`, including animation FBX files, BGM, and the HeadAudio model file.

Current release caveat:

- The checked-in repo still has some machine-specific asset/path assumptions in runtime config and startup assets.
- The current roadmap milestone is cleaning that up for packaging.

## Extension Points

There is no formal plugin API yet. Extension today happens through config and focused code edits.

### Custom avatar

- Set `avatar.assetPath` in `vela.jsonc` to a different `.vrm` file
- The renderer loads that file through the Electron bridge
- Avatar motion and morph behavior are handled in `src/core/vrm-avatar-controller.js`

### Custom voice

- Adjust `tts.voiceId`, `tts.model`, `tts.voiceSettings`, and `tts.audioSettings` in `vela.jsonc`
- Add a new TTS provider in `src/core/tts/providers/`
- Register it through `src/core/tts/provider.js`

### Custom personality

- Tune onboarding temperament and distance behavior in `src/core/default-persona.js`
- Change reply-to-presentation mapping in `src/core/interaction-policy.js`
- Add or retune emotion presets in `src/core/emotion-presets.js`

### Custom memory behavior

- Adjust summary triggers and background tasks in `src/core/vela-core.js`
- Change memory extraction in `src/core/memory-summarizer.js`
- Change retrieval scoring in `src/core/memory-retriever.js`

### Custom LLM routing

- Update `llm` and optional fallback config in `vela.jsonc`
- Extend provider adapters in `src/core/providers/adapters/`
- Route requests through `src/core/provider.js`
