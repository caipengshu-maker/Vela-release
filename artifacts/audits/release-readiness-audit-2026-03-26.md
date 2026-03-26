# Vela Release Readiness Audit

Date: 2026-03-26

## Executive summary

Vela is not release-ready for arbitrary user installs yet. The main blockers are still machine-specific storage and avatar asset paths, missing packaging/distribution rules, and startup assets that depend on `D:\Vela\...`.

During this audit I applied two small safe fixes:

- BGM now loads from app-bundled assets through Electron in both dev and built desktop runs, instead of `D:\Vela\assets\bgm\...`.
- Saved BGM volume now applies on boot instead of only after a settings save.

Verification after the patch:

- `npx vite build`: passed
- `npm run smoke`: passed

The remaining risks are still significant enough that a real M6 packaging pass is required before shipping an EXE.

## Findings

### Critical

#### 1. Core app persistence still depends on `D:/Vela/data`

- Symptom: a normal user install can fail or partially boot with missing session state, onboarding state, memory, or settings if the machine does not have the developer's `D:` layout.
- Root cause: the checked-in runtime config hardcodes `storageRoot`, `cacheRoot`, and `assetRoot` to `D:/Vela/...` in `vela.jsonc:12-15`, and `VelaCore` resolves `runtime.storageRoot` directly from config in `src/core/vela-core.js:398-405`. `SessionStateStore.initialize()` writes immediately and does not swallow filesystem errors in `src/core/session-state.js:123-130`.
- Why it matters for release: this is a first-run reliability problem, not a dev-only inconvenience. A packaged app or an `npm start` desktop run on a different machine should not require a writable `D:` drive.
- Recommended fix: make Electron `app.getPath("userData")` the default writable root for runtime state in all non-dev runs; treat repo-root or absolute overrides as explicit dev/test overrides only; add a one-time migration if old data exists.

#### 2. The shipped avatar still depends on a local absolute path

- Symptom: the main character can fail to load and the UI falls back to `Avatar asset path missing` or `Failed to load VRM`.
- Root cause: the shipped config points `avatar.assetPath` at `D:/Vela/assets/avatars/eku/Eku_VRM_v1_0_0.vrm` in `vela.jsonc:89-92`, and the renderer loads that file through preload in `src/vrm-avatar-stage.jsx:182-210`.
- Why it matters for release: Vela without the avatar is a major product degradation, not a cosmetic issue.
- Recommended fix: decide one release policy and implement it end-to-end:
  1. Bundle the VRM in app resources and load it by bundled-relative path.
  2. Or move avatar selection into first-run user configuration.
  3. Do not ship a default config that points at a developer drive.

### High

#### 3. There is no actual Electron packaging contract in the repo

- Symptom: the repo can run `electron .`, but there is no declared EXE packaging pipeline, no `files` list, and no `extraResources` rule for non-code assets.
- Root cause: `package.json:8-17` only defines dev/build/start/smoke scripts. There is no Electron Forge, electron-builder, or equivalent release manifest.
- Why it matters for release: without a packaging contract, there is no authoritative answer for what gets shipped, what stays external, or how assets are laid out in an EXE.
- Recommended fix: pick one packager, commit the config, and define:
  - packaged entry points
  - included `dist/` output
  - bundled binary assets
  - `extraResources` only where truly necessary
  - a CI smoke test that runs the packaged artifact, not just `electron .`

#### 4. Idle animation assets use root-relative URLs that are fragile under `file://`

- Symptom: packaged desktop runs can silently lose idle/motion FBX loads even if the files exist in `dist/assets/animations`.
- Root cause: `src/core/vrm-avatar-controller.js:347-359` hardcodes `"/assets/animations/..."`, and `FBXLoader.load()` consumes those strings directly in `src/core/vrm-avatar-controller.js:1763-1795`.
- Why it matters for release: Vite copies the files, but root-relative URLs are not the same as app-relative URLs when Electron loads `dist/index.html` over `file://`.
- Recommended fix: generate animation URLs from the current document location or resolve them through the same bundled-asset helper used for BGM.

#### 5. TTS volume is not an end-to-end playback control yet

- Symptom: the settings slider can say one thing while live speech and replay loudness behave differently.
- Root cause: settings save writes both `audio.ttsVolume` and provider-side `tts.voiceSettings.volume` in `src/core/vela-core.js:1024-1042`, but the actual HTML audio element in `src/audio-player.js:97-106`, `src/audio-player.js:239-255`, and `src/audio-player.js:342-347` never applies a local playback volume multiplier.
- Why it matters for release: the user-facing slider is currently closer to a provider request than a guaranteed playback control, so it can drift across providers, normalization behavior, and replay.
- Recommended fix: define one source of truth for TTS loudness:
  - preferred: keep UI volume as client playback volume and always apply it to the audio element/replay path
  - optional: keep provider volume for synthesis flavor, but do not make it the only user-facing loudness control

#### 6. Splash, title, and background visuals still depend on `D:\Vela\...`

- Symptom: release builds on other machines will lose the splash logo, title logo, and day/night background art.
- Root cause: `src/SplashScreen.jsx:3-49`, `src/VelaTitleScreen.jsx:3-50`, and `src/vrm-avatar-stage.jsx:4-80` all read local absolute files through preload.
- Why it matters for release: these paths are guaranteed to be absent on a normal install, so first-run branding/polish degrades immediately.
- Recommended fix: move these assets under versioned bundled assets, preferably `public/assets/...`, and load them via bundled-relative paths. If they must stay external, packaging config must copy them explicitly.

### Medium

#### 7. BGM loudness mapping is still raw linear gain, not a deliberate UX taper

- Symptom: the BGM slider can feel like it collapses too quickly at the low end.
- Root cause: `BgmController` clamps and applies raw gain directly in `src/core/bgm-controller.js:6-12`, `src/core/bgm-controller.js:48-71`, and `src/core/bgm-controller.js:298-300`. The audit patch fixed boot-time synchronization in `src/App.jsx:939-946`, but it did not redesign the taper.
- Why it matters for release: the slider now reflects saved state correctly, but the loudness curve is still not intentionally tuned.
- Recommended fix: introduce a shared audio taper helper for UI percent -> playback gain, then use the same semantics for BGM and TTS. Keep `0` as hard mute and tune the rest with either a square-root taper or a dB-based curve after listening tests.

#### 8. Startup readiness is still timer-driven rather than state-driven

- Symptom: the splash/title experience can claim readiness before the app's real assets are ready, or can hold the user longer than necessary.
- Root cause: splash timing is fixed in `src/SplashScreen.jsx:4-8` and `src/SplashScreen.jsx:63-76`; title progress is simulated in `src/VelaTitleScreen.jsx:64-113`; app readiness flips after a hardcoded `600ms` timeout in `src/App.jsx:988-994`.
- Why it matters for release: packaged apps on slower disks, first-run caches, or lower-end GPUs will not match these assumptions.
- Recommended fix: replace fixed readiness timers with explicit barriers such as:
  - bootstrap complete
  - avatar scene initialized
  - critical startup artwork resolved or intentionally skipped
  - first render complete

#### 9. Audio source-of-truth is still inconsistent across `public/`, `dist/`, and legacy local assets

- Symptom: it is easy to accidentally fix an asset issue in the wrong place and think the app is ready because one machine still has `D:\Vela\...`.
- Root cause: BGM exists in versioned `public/assets/bgm`, copied into `dist/assets/bgm`, while legacy code and generator scripts still refer to `D:\Vela\assets\...`.
- Why it matters for release: `dist/` is build output, not authoring source; local drive assets are not distributable; the project currently mixes all three mental models.
- Recommended fix: define one rule:
  - `public/` is the source of truth for shipped renderer assets
  - `dist/` is generated output only
  - local drive paths are dev-only tooling and must not appear in runtime code

### Low

#### 10. `runtime.assetRoot` is configured but not actually used by the runtime

- Symptom: the config suggests there is a generalized asset-root mechanism, but runtime asset loading bypasses it.
- Root cause: `vela.jsonc:12-15` defines `assetRoot`, but the runtime codepaths are hardcoded elsewhere.
- Why it matters for release: config drift makes packaging decisions harder because the config surface does not match real runtime behavior.
- Recommended fix: either wire `assetRoot` into the runtime consistently or remove it until there is a real asset-resolution layer.

## Recommended remediation plan

1. Make writable app state release-safe.
   Keep all non-dev persistence under Electron `userData`, including session state, memory, cache, and window state.
2. Decide the asset contract.
   Ship all mandatory startup/avatar/audio assets from bundled resources or make them explicitly user-supplied. Remove runtime dependence on `D:\Vela`.
3. Commit a real packaging pipeline.
   Add Electron Forge or electron-builder config and document exactly what ships.
4. Normalize all packaged asset resolution.
   Use bundled-relative URLs or a single preload resolver for BGM, splash/title art, backgrounds, FBX animations, and VRM.
5. Redefine volume semantics.
   Make BGM and TTS both use one shared user-facing loudness model, then apply it consistently in playback.
6. Replace timer-driven startup with readiness-driven startup.
   The overlays should exit based on actual app state, not just elapsed time.

## What can be safely fixed now vs what needs a deliberate M6 packaging pass

### Safe to fix now

- Move splash/title/background art into bundled assets and stop reading them from `D:\Vela`.
- Replace root-relative FBX paths with bundled-relative URLs.
- Finish TTS playback-volume wiring on the renderer side.
- Remove remaining runtime references to local-machine asset paths.
- Keep `public/` as the only source for shipped audio/image assets.

### Needs a deliberate M6 packaging pass

- Final storage layout and migration policy under `userData`
- Avatar bundling policy and package size tradeoff
- Choice of Electron packager and release config
- Any `extraResources` rules for large binary assets
- Packaged-artifact CI smoke tests on a clean machine
