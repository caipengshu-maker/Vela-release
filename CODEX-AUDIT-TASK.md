# CODEX AUDIT TASK — Vela release-readiness technical audit

## Goal
Do a **product-grade technical audit** of the Vela desktop app, focusing on issues that will break or degrade normal-user installs (EXE packaging or npm-installed desktop run), not just the current developer machine.

## Current user-reported problems
1. **BGM pathing was broken** in Electron production mode. A temporary fix now loads BGM by reading absolute files from `D:\Vela\assets\bgm\...` via preload. This works on the developer machine but is likely a **local-machine patch**, not a distributable solution.
2. **BGM volume slider mapping is wrong**: the UI slider does not map to real volume correctly; it reaches near-zero / zero too early before the handle reaches the far left.
3. **TTS / character voice volume control has not been verified yet** and should be audited together.
4. Splash/title/main loading sequence was recently refactored. Audit whether it is now structurally sound or still has release risks.

## What to audit
### A. Audio resource architecture
- Inspect BGM loading path from App -> BgmController -> Electron runtime.
- Identify the **correct release-safe strategy** for bundled audio assets in Electron:
  - dev mode
  - built EXE
  - npm-installed user app
- Determine whether audio should come from:
  - Vite public/dist assets,
  - Electron packaged resources,
  - preload binary reads,
  - or another proper pathing strategy.
- Call out any **double source-of-truth** problem between `public/assets/bgm`, `dist/assets/bgm`, and `D:\Vela\assets\bgm`.

### B. Volume control correctness
- Audit BGM volume slider behavior end-to-end.
- Check whether slider value is linear while perceived loudness should be logarithmic (or vice versa).
- Identify why it hits near-zero too early.
- Audit TTS / speech volume control path too.
- Recommend a correct mapping strategy for both UX and implementation.

### C. Packaging / install robustness
- Find any hardcoded local-machine paths (`D:\Vela`, absolute asset paths, etc.) that will break on user machines.
- Find any assumptions that only work in the current repo/dev environment.
- Review Electron main/preload/resource access patterns for portability.
- Check whether the splash/title/logo assets also rely on absolute paths and whether that is acceptable for release.

### D. Startup sequence / loading screens
- Review the current splash/title/main overlay structure.
- Confirm whether it is logically sound for release or still fragile.
- Note any race conditions, timing hacks, or likely regressions.

## Deliverable format
Create a concise markdown audit report at:
- `Vela/artifacts/audits/release-readiness-audit-2026-03-26.md`

Include:
1. **Executive summary**
2. **Findings** grouped by severity: Critical / High / Medium / Low
3. For each finding:
   - symptom
   - root cause
   - why it matters for release
   - recommended fix
4. **Recommended remediation plan** in order
5. A short section: **What can be safely fixed now vs what needs a deliberate M6 packaging pass**

## Optional fixes
If there are **small, clearly safe, local fixes** (especially volume mapping bugs or obvious hardcoded-path cleanup) you may implement them, but:
- Do **not** do large speculative refactors
- Do **not** introduce new architecture without explaining it in the report
- If you patch anything, verify with `npx vite build`

## Verify
- Run `npx vite build`
- If you patch code, include a short summary of what changed

## Important
Think from the perspective of a real future user who installs Vela on a different machine. The question is not “does it work on Kevin’s machine right now?” but “will this survive packaging, distribution, and first-run on user machines?”
