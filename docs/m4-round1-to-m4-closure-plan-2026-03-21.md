# M4 Round 1 to M4 Closure Plan

Date: 2026-03-21
Baseline: current M4 Round 1 review baseline in repo, plus `docs/m4-round1-codex-neutral-review-2026-03-21.md`
Planning constraints adopted as fixed:

- D1. Current M4 Round 1 is a review baseline, not a final closure baseline.
- D2. Round 1 gets exactly one tightening pass before closure. No broad new scope.
- D3. Memory direction pivots to context-first, with lightweight persistent memory as a supplement.
- D4. Vela should exploit modern long-context models better before adding more memory machinery.
- D5. Minimum effective persistent memory should favor stable profile/preferences, compact relationship state, small bridge summaries, and open follow-ups.
- D6. UI must resolve duplicated status surfaces. Companion-first beats control-panel visibility.
- D7. Post-Round-1 M4 should prioritize naturalness and closure discipline over infrastructure expansion.

## 1. Starting Point Summary

The repo is in a real M4 Round 1 review state, not a hypothetical one. The runtime path already includes context fusion, time/weather awareness, heuristic behavior patterns, provider cooldown plus fallback routing, session-level model selection, assistant replay audio, and a materially reworked UI. The main integration points are already wired in `src/core/vela-core.js`, `src/core/context-fusion.js`, `src/core/provider.js`, `src/core/session-state.js`, `src/App.jsx`, and `src/audio-player.js`.

At the same time, Round 1 is not closed. The docs still describe user UX acceptance as pending, `../SESSION-STATE.md` records unresolved duplicated status surfaces, and the worktree is still dirty rather than frozen. There is also documentation drift: `docs/M4-R1-REPORT.md` says `vela.jsonc` does not explicitly define `user.location.city`, but `vela.jsonc` already does.

Memory is active but not yet right-sized for the actual model era being targeted. The live prompt still only includes `runtimeSession.messages.slice(-6)` in `src/core/context-builder.js`, while runtime retention is capped by `sessionMessageLimit: 12` in both `vela.jsonc` and `src/core/config.js`. In parallel, `src/core/vela-core.js` still runs per-turn summarization, fact extraction, profile updates, relationship evaluation on cadence, and behavior-pattern refresh. That is acceptable as a baseline, but it is not the right final direction for M4.

The UI is improved but not yet disciplined. `src/App.jsx` currently exposes overlapping status surfaces through:

- `presence-brief` in the avatar panel
- a second status badge in the chat header
- a header-level voice toggle
- a separate fallback banner
- session turn counters in the main conversation header

This matches the unresolved feedback already captured in session state.

## 2. Closure Strategy for M4 Round 1

### What to change

Round 1 closure should be a single tightening pass focused on product naturalness, status hierarchy, and doc/state freeze discipline.

Required closure-pass changes:

- Resolve duplicate status surfaces in `src/App.jsx` and `src/styles.css`.
- Remove or demote internal/system framing from the main chat surface, especially visible session turn counts.
- Keep one clear status hierarchy so the avatar and conversation remain primary.
- Run one real UX acceptance pass specifically against the tightened UI.
- Freeze Round 1 properly after that pass: sync the project docs, confirm the exact accepted baseline, and close the milestone cleanly.

### What not to change

The closure pass should not reopen the architecture or add new feature lanes. Keep the Round 1 functional core intact:

- Keep provider cooldown, fallback routing, and `/model minimax|k2p5|auto`.
- Keep awareness packet assembly, including time/weather/relationship/profile signals.
- Keep assistant replay audio.
- Keep the current dependency-light, local-file-based architecture.
- Keep the current provider abstraction and TTS/ASR surface unless a direct closure bug is discovered.

### Do not expand scope rules

These are explicit non-goals for the Round 1 tightening pass:

- Do not add proactive-engine behavior.
- Do not add new memory layers, new stores, vector search, embeddings, or per-turn memory sophistication.
- Do not add network search.
- Do not reopen idle animation, arm naturalness, or broader avatar motion work.
- Do not redesign provider routing or cooldown semantics beyond UI presentation polish.
- Do not broaden the UI into a settings/control surface.
- Do not treat documentation cleanup as an excuse to reopen code scope.

## 3. Memory System Adjustment Plan

### What to keep

The current memory system has enough useful pieces to retain:

- `profile.json` / durable user preferences and notes
- `relationship.json` stage plus short note
- small recent summary index
- relevant episodic retrieval when actually helpful
- lightweight fact persistence

These are the right kinds of persistence for Vela at this stage because they support cross-session continuity without requiring a larger memory platform.

### What to simplify or defer

The current issue is not that the memory system is huge. The issue is that it is running too often relative to how little live transcript is being used.

Simplify or defer after Round 1 closure:

- Stop treating per-turn summarization as the default steady-state path.
- Stop treating behavior-pattern generation as something the request path should refresh on every message.
- Defer richer relationship mechanics and shared-moment expansion.
- Defer any heavier retrieval or scoring sophistication.

Concrete repo implications:

- `src/core/vela-core.js`: replace unconditional per-turn background summarization with trigger-based summarization.
- `src/core/memory-summarizer.js`: keep the summarizer, but use it for notable turns, bridge summaries, or session-end summaries rather than every turn.
- `src/core/behavior-patterns.js`: keep it as optional enrichment, but move it away from request-path importance.
- `src/core/memory-retriever.js`: reduce default retrieval pressure from top-5 style thinking to top 1-3 when relevant.

### How to better use long context in practice

This is the core pivot.

Current reality:

- prompt window: last 6 messages in `src/core/context-builder.js`
- runtime retention: 12 messages in `vela.jsonc` / `src/core/config.js`

That is too conservative for modern long-context models and forces persistent memory to compensate.

Recommended adjustment:

- Expand retained in-session transcript materially, not symbolically.
- Build prompt context from a larger recent transcript window instead of hard-coded `slice(-6)`.
- Use persistent memory as a supplement, not as the primary continuity mechanism.

Practical target for post-closure M4:

- Keep 24-40 recent message objects in session memory, configurable.
- Build prompt from a budget-aware recent transcript window rather than a fixed six-message slice.
- Add one compact bridge summary for prior-session continuity when the user returns after a break.
- Add one compact open-follow-ups block when there is a clear unresolved thread.
- Inject at most 1 relationship note, 1 bridge summary, 1 stable profile block, and 1-3 relevant memories.

That makes Vela behave more like a modern long-context companion and less like a system forced to summarize every turn to survive.

## 4. UI Tightening Plan

### Duplicate status surfaces

This is the Round 1 closure priority on the UI side.

Current duplication in `src/App.jsx`:

- avatar-panel `presence-brief`
- header `StatusBadge`
- header voice button
- fallback banner
- composer mic/voice affordance

This creates two problems:

- the same operational state is repeated in multiple places
- too much of the screen reads like system state instead of companion presence

### Recommended status hierarchy

Use one hierarchy and enforce it consistently.

Primary surface:

- Avatar presence and companion framing in the avatar panel.
- This is where emotional state and ambient “she is here” presentation belongs.

Secondary surface:

- Composer affordances for direct interaction control.
- Voice toggle should live with the composer interaction, not as a second major control in the header.

Exceptional-only surface:

- Fallback or degraded provider state should appear only when active, in one lightweight location.
- It should be informative but not dominate the conversation layout.

Remove from primary conversation framing:

- Persistent model-status repetition
- session turn counts
- any status chip that repeats information already available elsewhere

### Companion-first surface rules

- Default state should show no persistent operational banner.
- Normal model routing should be invisible.
- Fallback should be visible only while it is actually affecting the current route.
- Voice mode should read as an interaction mode, not as a dashboard state.
- The top of the chat should frame the conversation, not system accounting.

## 5. Detailed Phased Execution Plan

## Phase A: Round 1 Tightening and True Closure

Goal:
Complete the one allowed tightening pass, remove duplicated status surfaces, re-run targeted UX acceptance, and freeze Round 1 as a true closure baseline.

Files likely affected:

- `src/App.jsx`
- `src/styles.css`
- `CURRENT-ROUTE.md`
- `TASKS.md`
- `../SESSION-STATE.md`
- `docs/M4-R1-REPORT.md`

Possible light-touch core-file impact only if necessary:

- `src/core/vela-core.js`

What to do:

- Pick one primary status location and remove the others.
- Remove session counters from the main chat header.
- Move voice-mode prominence to the composer interaction path; demote or remove header duplication.
- Collapse fallback visibility into a single exceptional-state surface.
- Run one focused user acceptance pass against the tightened UI.
- Update project docs to reflect the accepted state exactly.
- Close Round 1 formally only after the acceptance result and doc sync match.

Verification:

- `npm run build`
- `npm run smoke`
- `npm run verify:core`
- `npm run verify:providers`
- `npm run verify:m2`
- targeted manual UX review for:
  - duplicated status removal
  - fallback notice proportion
  - voice control clarity
  - companion-first visual hierarchy

User acceptance criteria:

- There is no obvious duplicate status surface.
- The main surface reads as “companion first” rather than “operator console”.
- Voice mode is clear without being announced in multiple places.
- Fallback state is visible when needed and quiet when not needed.
- Round 1 docs, route state, and accepted UI match the shipped baseline.

Rollback / risk notes:

- Main risk: overcorrecting and hiding too much operational feedback.
- Rollback rule: if users lose clarity, reintroduce only one subtle exceptional-state notice, not another always-visible status cluster.
- Secondary risk: doc closure gets ahead of actual UX confirmation.
- Rollback rule: do not mark closure until acceptance is explicitly complete.

## Phase B: Immediate Post-Closure M4 Work

Goal:
Pivot M4 from “more memory machinery” to “better live continuity”, using a larger live context window plus a minimum effective persistent-memory layer.

Files likely affected:

- `vela.jsonc`
- `src/core/config.js`
- `src/core/context-builder.js`
- `src/core/vela-core.js`
- `src/core/context-fusion.js`
- `src/core/memory-summarizer.js`
- `src/core/memory-store.js`
- `src/core/memory-retriever.js`
- `src/core/behavior-patterns.js`
- `src/core/session-state.js`
- `docs/M4-ARCHITECTURE.md`

What to do:

- Increase session transcript retention beyond the current 12-message cap.
- Replace fixed recent-message slicing with a larger budget-aware prompt transcript.
- Change memory summarization from per-turn default to trigger-based summarization.
- Introduce compact bridge summaries and open follow-up tracking as the main cross-session supplement.
- Reduce episodic retrieval volume and keep retrieval selective.
- Keep behavior patterns optional and non-blocking.

Recommended implementation shape:

- Add config for a larger recent transcript budget or prompt message window.
- In `src/core/context-builder.js`, select recent transcript based on budget, not a fixed 6-message slice.
- In `src/core/vela-core.js`, trigger summarization on events such as:
  - session end or app close
  - long gap before return
  - notable emotional turn
  - every N turns as a safety net, not every turn
- In `src/core/memory-store.js` / `src/core/session-state.js`, store:
  - stable profile
  - compact relationship state
  - one bridge summary
  - open follow-ups

Verification:

- `npm run build`
- `npm run smoke`
- `npm run verify:core`
- conversation continuity test with a materially longer session
- restart-and-return test to confirm bridge-summary continuity
- regression test to confirm provider routing and replay audio still behave normally

User acceptance criteria:

- In a longer live session, Vela maintains continuity without leaning on forced recap behavior.
- After a short return gap, Vela can resume from a compact bridge summary or open follow-up naturally.
- Persistent memory feels supportive, not intrusive.
- The system does not feel more “mechanical” than the Round 1 baseline.

Rollback / risk notes:

- Main risk: larger live context raises prompt size and cost.
- Rollback rule: keep the context expansion config-gated and tune the window down before adding more memory complexity back.
- Secondary risk: reducing summarization too aggressively weakens cross-session continuity.
- Rollback rule: keep a safety-net summary cadence, but not per turn.

## Phase C: Later M4 / M5 Defer Bucket

Goal:
Hold all non-essential expansion behind M4 naturalness goals and only revisit after Phase B proves value in real use.

Files likely affected when resumed later:

- `src/core/proactive-engine.js`
- `src/core/vela-core.js`
- `src/core/interaction-contract.js`
- `src/core/vrm-avatar-controller.js`
- `src/App.jsx`
- `src/styles.css`
- `docs/M4-ARCHITECTURE.md`

Deferred items:

- proactive-engine and timed outreach
- richer relationship mechanics / shared moments expansion
- idle micro-motion and arm naturalness
- network search
- deeper retrieval sophistication
- any infrastructure-heavy memory evolution

Verification:

- feature-specific manual acceptance
- standard build/smoke/core verification
- long-running product-use validation before broadening exposure

User acceptance criteria:

- Proactive behavior feels welcome rather than intrusive.
- Avatar motion improves presence without becoming distracting.
- Any search capability feels companion-relevant, not a generic assistant detour.

Rollback / risk notes:

- Main risk: these features can quickly break naturalness and closure discipline.
- Rollback rule: keep them behind explicit flags and do not let them redefine the main surface until proven.

## 6. Prioritized Task List with Recommended Owners

1. Resolve duplicate status surfaces and remove main-surface session counters.
Owner: Codex

2. Run one focused UX acceptance pass on the tightened Round 1 UI and confirm closure readiness.
Owner: 舒彩鹤 / human reviewer

3. Sync `CURRENT-ROUTE.md`, `TASKS.md`, `../SESSION-STATE.md`, and `docs/M4-R1-REPORT.md` to the accepted closure state.
Owner: 小新

4. Freeze Round 1 formally only after code, UX acceptance, and docs all match.
Owner: 小新

5. Expand live conversation context beyond the current 6-message prompt slice and 12-message session cap.
Owner: Codex

6. Replace per-turn default summarization with trigger-based summarization plus bridge-summary/open-follow-up support.
Owner: Codex

7. Reduce memory injection to a minimum effective supplement: stable profile, compact relationship note, bridge summary, open follow-ups, and 1-3 relevant memories.
Owner: Codex

8. Demote behavior patterns from request-path importance to optional background enrichment.
Owner: Codex

9. Revalidate continuity quality after the context-first pivot with longer real conversations.
Owner: 舒彩鹤 / human reviewer

10. Keep proactive behavior, search, and avatar-motion expansion in the defer bucket until the context-first companion surface is proven.
Owner: 小新

## Recommended Closure Call

M4 Round 1 should close only after Phase A, not from the current review baseline. The rest of M4 should then proceed with a narrow post-closure agenda: exploit long context better, keep persistent memory minimal and useful, and protect companion-first product naturalness from scope creep.
