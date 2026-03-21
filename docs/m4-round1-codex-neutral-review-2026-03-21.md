# Vela M4 Round 1 Neutral Review

Date: 2026-03-21
Reviewer stance: external, neutral, baseline-focused
Scope reviewed: current repository state, not planned intent

## 1. Executive summary

M4 Round 1 is a credible review baseline, but not a credible final closure baseline.

What is real in the code today is not just a spec. Round 1 has already integrated context fusion, weather/time awareness, heuristic behavior patterns, provider cooldown plus fallback routing, session-level model selection, replayable TTS audio, and a materially reworked UI. The main path in `src/core/vela-core.js` is wired end to end.

What is not true yet is that Round 1 is finished as a product surface. The project documents themselves still mark user experience acceptance as pending, `../SESSION-STATE.md` records unresolved duplicate status surfaces, and the repository is still a dirty worktree rather than a truly frozen baseline. There is enough here to review. There is not enough here to call Round 1 done.

The memory direction is the main architectural question. It is not materially overengineered yet, because it stays heuristic, file-based, and dependency-light. But it is starting to optimize for older small-context assumptions while current mainstream models can carry far more live conversation directly. At this stage, Vela should rely more on long context and less on per-turn memory machinery.

## 2. What M4 Round 1 actually achieved versus what is still unfinished

### Actually achieved

- Context fusion is real, not just documented. `src/core/vela-core.js` builds an awareness packet before reply generation, and `src/core/context-fusion.js` merges time, weather, relationship, profile, recent summaries, relevant memories, and behavior patterns into a single prompt block.
- Time and weather providers are implemented and proportionate. `src/core/context-providers/time-provider.js` provides time-of-day and recency metadata. `src/core/context-providers/weather-provider.js` uses a small city map, Open-Meteo, and 30-minute cacheing.
- Provider resilience is implemented in the main path. `src/core/provider.js` has a two-failure threshold and a five-hour cooldown, with persisted routing state in `src/core/session-state.js`.
- Session-level model switching is real. `/model minimax`, `/model k2p5`, and `/model auto` are parsed in `src/core/vela-core.js`, and the active choice is persisted.
- The UI has been materially refactored. `src/App.jsx` is no longer a raw debug shell. It has a clearer avatar area, cleaner composer, voice toggle behavior, model notice, fallback banner, and replay controls.
- TTS replay is genuinely implemented. `src/audio-player.js` stores completed streamed audio as replayable blobs rather than re-requesting TTS.
- Round 0 memory is fully active in Round 1. `src/core/memory-summarizer.js`, `src/core/memory-retriever.js`, and `src/core/memory-store.js` are already participating in the runtime path.

### Still unfinished

- Product acceptance is still pending by the project’s own standard. `CURRENT-ROUTE.md`, `TASKS.md`, `../SESSION-STATE.md`, and `docs/M4-R1-REPORT.md` all say Round 1 still needs user human-eye / UX acceptance before closure.
- The duplicate status-surface problem is still present in the code. `src/App.jsx` shows model/voice status in the avatar panel, again in the chat header, and again as a fallback banner. This matches the unresolved feedback recorded in `../SESSION-STATE.md`.
- The repository is not literally frozen. `git status --short` shows Round 1 files still modified and several Round 1 files still untracked.
- Documentation is not fully synchronized with current state. `docs/M4-R1-REPORT.md` says `vela.jsonc` does not explicitly contain `user.location.city`, but the current `vela.jsonc` does contain it.
- Round 1 is technically narrower than the architecture document. `docs/M4-ARCHITECTURE.md` still frames a broader M4 memory and proactivity direction, but Round 1 product reality is mainly awareness injection, routing resilience, and UI cleanup.
- Hygiene is not review-blocking, but it is not final-baseline grade. The current `vela.jsonc` includes plaintext provider credentials, which is workable for a local private setup but not good practice for a distributable frozen artifact.

## 3. Whether freezing current Round 1 as a review baseline is reasonable

Yes, with one important distinction: it is reasonable as a review baseline, not as a final milestone closeout.

The core reason is that the baseline is functionally representative. The main architectural moves of Round 1 are already present in actual runtime files, and the open issues are mostly about product fit, UI hierarchy, and closure discipline rather than missing core plumbing.

What is not reasonable is to treat the current state as a fully closed Round 1 artifact. By the project’s own rules, real UX acceptance is still pending. By normal engineering standards, a dirty worktree is also not a true freeze. The right interpretation is: freeze now for external review, then do one last tightening pass before closure.

## 4. Memory system assessment

### Is the current memory direction proportionate or drifting toward overengineering?

Judgment: slightly drifting toward overengineering.

Reasons:

- The design is still modest in implementation terms. It is file-based, heuristic, silent-degrade, and avoids vector databases and extra dependencies. That keeps it from being materially overbuilt.
- But the runtime is already doing a lot for this stage: per-turn summarization, per-turn fact extraction, profile auto-update, relationship evaluation, episodic retrieval, behavior-pattern extraction, and awareness fusion.
- At the same time, the live prompt is still conservative. `src/core/context-builder.js` only sends the last 6 messages, and runtime session history is capped by `sessionMessageLimit` 12 in `vela.jsonc` and `src/core/config.js`.
- This means the system is compensating for a constrained live context with more persistent-memory machinery than current model windows require.

In plain terms: the architecture is still sane, but it is starting to solve a “small context window” problem that mainstream 200k-1M context models have already reduced.

### Given 200k-1M context models, what should be handled by long context versus persistent memory?

Long context should handle:

- The full active conversation, or at least a much larger recent window than 6 turns.
- The current session’s unresolved topics, tone, and pacing.
- A recent-session carryover block when the user returns soon after a prior conversation.
- Most short-horizon continuity that does not need to survive across days or weeks.

Persistent memory should handle:

- Durable user facts and preferences that remain useful across sessions.
- A compact relationship state and note.
- A small number of episodic summaries for genuinely meaningful conversations or emotional moments.
- Important future events or commitments worth recalling later.

Persistent memory should not try to absorb every turn just because it can. At this stage, per-turn summarization is more machinery than product necessity.

### What is the minimum effective memory architecture for Vela at this stage?

Minimum effective architecture:

- Keep a much larger live conversation window in prompt, using the model’s actual context budget rather than a fixed 6-message slice.
- Keep `profile.json` style durable preferences and explicit facts.
- Keep `relationship.json` style stage plus one short note.
- Write episodic summaries only at session end, after a notable emotional turn, or every several turns, not every single turn.
- Retrieve only the top 1-3 relevant durable memories when useful.
- Treat behavior patterns as optional background enrichment, not a central prompt dependency.

If Vela shipped with only that, it would still have a believable memory story for this product stage.

### Additional assessment

- `docs/M4-ARCHITECTURE.md` says awareness should be constrained to `<=800 token`, but `src/core/context-fusion.js` actually trims by characters (`trimToBudget(..., 2400)`), not by token count. That is not a blocker, but it shows the implementation is simpler and rougher than the architecture language suggests.
- The current memory system is valuable mainly because the live context budget is underused. If live context is expanded, some of the memory complexity becomes optional rather than foundational.

## 5. UI / product surface assessment

The current UI is improved, but it still has unresolved companion-vs-control-panel tension.

What is working:

- The UI is cleaner than a generic AI tool shell.
- The avatar surface is clearly intended to be the emotional center.
- Composer simplification, SVG icon cleanup, and replay support all move in the right direction.

What still pulls it back toward a control panel:

- Status duplication is real. `src/App.jsx` renders status badges in the avatar panel (`presence-brief`), then another status badge in the chat header, then a fallback banner below the header.
- Voice mode also appears in two places: as a prominent top-right button and again as the primary composer action when the draft is empty.
- The chat header includes session counters (`本次 X 轮，总共 Y 轮`). That is internal/system framing, not companion framing.
- The surface still spends too much of its visual budget explaining routing, mode, and system state instead of quietly letting the companion feel primary.

The current product reads as:

"a companion UI with several still-visible operator surfaces"

not yet:

"a companion-first product whose system complexity has fully stepped back"

This matters because Vela’s stated product goal is not general assistant utility. It is a pure chat companion. In that product, duplicated operational status is not harmless clutter. It directly competes with presence.

## 6. Concrete recommendations in priority order

### Keep

- Keep provider cooldown, fallback routing, and session-persisted model selection. This is proportionate engineering and improves actual reliability.
- Keep the awareness-packet approach for time, weather, and relationship context. It is a good fit for the product and avoids runtime tool-call sprawl.
- Keep TTS replay. It is user-visible, product-relevant, and clearly implemented.
- Keep the current dependency-light approach. No vector stack, no orchestration platform, no separate memory service is the right level for Vela now.

### Trim

- Trim duplicated status surfaces down to one primary status location. The current model-status repetition is the clearest UI problem in the baseline.
- Trim the amount of memory machinery that runs every turn. Per-turn summarization, fact extraction, and pattern updates are more than this stage needs.
- Trim the assumption that live context is scarce. Expand the in-prompt recent conversation window before adding more memory layers.
- Trim internal metrics from the main surface. Session turn counts should not be on the primary companion UI.
- Trim architecture/documentation mismatch. Before closing Round 1, produce one actual frozen commit and make the docs describe that exact state.

### Postpone

- Postpone deeper memory sophistication beyond the current heuristic layer until long-context usage is expanded and product value is demonstrated.
- Postpone proactive-engine work until the passive conversation surface feels settled and non-intrusive.
- Postpone richer relationship mechanics and “shared moments” expansion until the current relationship state proves useful in real usage.
- Postpone network search as a product priority unless it clearly serves the companion experience. It is not the bottleneck in the current baseline.

## 7. Final verdict

- SAFE_TO_FREEZE_FOR_REVIEW_BASELINE: yes
- SAFE_TO_CLOSE_ROUND1_AS_FINAL: no
- MEMORY_SYSTEM_OVERENGINEERED: slightly

Short rationale:

- `SAFE_TO_FREEZE_FOR_REVIEW_BASELINE: yes` because the baseline is representative, integrated, and reviewable.
- `SAFE_TO_CLOSE_ROUND1_AS_FINAL: no` because UX acceptance is still pending, the UI still has duplicate status surfaces, and the repo is not actually frozen in source control.
- `MEMORY_SYSTEM_OVERENGINEERED: slightly` because it is still lightweight by industry standards, but it is beginning to add persistent-memory machinery faster than the product currently needs, especially given modern long-context models.
