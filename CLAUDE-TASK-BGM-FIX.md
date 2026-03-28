# URGENT: BGM Audio Bug Fix + Code Health Audit

## Critical Bug: BGM Double-Play + Volume Control

### What the user experiences:
1. TWO copies of the BGM play simultaneously (echo/phase effect)
2. Adjusting volume in Settings sometimes triggers a second BGM source
3. Volume slider doesn't reliably control BGM volume
4. Setting volume to 0 doesn't fully mute

### What we've tried (ALL FAILED):
- Added `runSerializedLoad()` async loading lock
- Added `isCurrentTrack()` dedup check
- Added `_muted` flag with `masterGain.disconnect()` — broke volume control
- Added `stopAllStaleTracks()` with track registry — didn't prevent double-play
- Added React effect cleanup `bgm.current?.source?.stop()` — CAUSED double-play (cleanup nulled current, dedup failed on re-run)
- Added `bgmLoadedTrackRef` React ref guard — stopped double-play but volume control broke
- Removed disconnect/muted logic — unclear if it helped

### Root cause analysis:
The BGM loading effect in `src/App.jsx` depends on `[bgmEnabled, isLoading, state.onboarding?.required]`. Any state change that touches these deps causes the effect to re-run, which calls `syncTrack()`, which may re-load the BGM track creating duplicate audio sources. React Strict Mode in dev doubles this problem.

The `src/core/bgm-controller.js` has been patched 8+ times tonight and is now a mess of overlapping fixes that conflict with each other.

## YOUR MISSION

### Step 1: Read and understand the current state
Read these files completely:
- `src/App.jsx` — find ALL BGM-related code (search for bgm, Bgm, BGM, audioContext, BgmController)
- `src/core/bgm-controller.js` — read the ENTIRE file
- `src/core/audio-volume.js` — read the ENTIRE file

### Step 2: Fix the BGM bug
The fix must guarantee:
1. **Exactly ONE BGM audio source plays at any time** — no echoes, no duplicates
2. **Volume slider works in real-time** — drag slider, hear volume change immediately
3. **Volume 0 = silence** — no residual audio
4. **Works in React Strict Mode** (Vite dev mode enables this)
5. **Settings save doesn't re-trigger BGM load**
6. **Day/night track switching still works** (getBundledBgmAssetPath returns different paths)

Approach suggestions (but use your judgment):
- Consider whether BgmController is over-engineered. Maybe simplify drastically.
- Consider using a single `<audio>` HTML element instead of Web Audio API BufferSourceNode
- Or if keeping Web Audio API, make the guard bulletproof with a simple approach
- The key insight: React effects re-run. Any BGM loading tied to React state WILL re-run. The guard must survive re-runs.

### Step 3: Code Health Audit
While you're in the codebase, scan for:
- Over-engineered simple features (like the BGM controller became)
- Fragile patterns that will break under React Strict Mode
- Missing error boundaries
- Dead code from failed fix attempts
- Any other obvious code smell

Write a brief audit summary as a comment at the top of any file you significantly change.

### Step 4: Build and commit
1. Run `npm run build` — must pass
2. Commit with message: `fix(audio): rewrite BGM to guarantee single source + volume control`
3. If you make health fixes in other files, use a separate commit: `chore: code health improvements from audit`

## Constraints
- You have FULL access. Fix whatever needs fixing.
- Don't be afraid to delete code. Simpler is better.
- Don't add new npm dependencies.
- The BGM fix is P0. Code health audit is P1.
- Test your logic mentally for React Strict Mode (effects run twice in dev).
