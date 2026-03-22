# M4-T6c: Replace hand-written idle with Mixamo FBX animations

## Goal
Replace the hand-written quaternion-based idle animation system in `src/core/vrm-avatar-controller.js` with Mixamo FBX animations loaded via `vrm-mixamo-retarget` + THREE.AnimationMixer.

## Animation Files
Located at `D:/Vela/assets/animations/`:
- `Breathing Idle.fbx`
- `Happy Idle.fbx`
- `Standing Idle.fbx`
- `Idle.fbx`
- `Bored.fbx`
- `Thinking.fbx`

These are Mixamo FBX Binary format, "Without Skin" (skeleton-only, no mesh).

## What to ADD

### 1. Imports
```js
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { retargetAnimation } from "vrm-mixamo-retarget";
```

### 2. Animation loading
In `_mountVrm()`, after the existing setup, load all FBX files from a configurable list, retarget each to the VRM, and store the resulting AnimationClips.

```js
// Animation asset paths (relative to app root, served by Vite)
const IDLE_ANIMATIONS = [
  "/assets/animations/Breathing Idle.fbx",
  "/assets/animations/Happy Idle.fbx",  
  "/assets/animations/Standing Idle.fbx",
  "/assets/animations/Idle.fbx",
  "/assets/animations/Bored.fbx",
  "/assets/animations/Thinking.fbx"
];
```

### 3. AnimationMixer setup
- Create `this.mixer = new THREE.AnimationMixer(vrm.scene)` in constructor
- In `update(delta)`, call `this.mixer.update(delta)` BEFORE `this.vrm.update(delta)`
- Store retargeted clips in `this.idleClips = []`
- Store current action in `this.currentIdleAction`

### 4. Idle animation playback
- After loading, immediately play a random idle clip
- Every 15-30 seconds, crossfade to a different random clip (don't repeat same)
- Use `action.crossFadeTo(newAction, 1.5)` for smooth transitions
- When presence is NOT "idle"/"listening", stop mixer playback
- When presence returns to "idle", resume with a random clip

### 5. Vite static asset config
The FBX files are in `D:/Vela/assets/animations/`. Vite needs to serve them. Add to `vite.config.js`:
```js
// In the server config or as a public directory alias
```
Actually, the simplest approach: copy the animations to `public/assets/animations/` so Vite serves them as static files. Do this:
- Create `public/assets/animations/` directory
- Copy FBX files there (or symlink)
- Reference them as `/assets/animations/Breathing Idle.fbx` in code

## What to REMOVE
Delete the entire hand-written idle motion system. Specifically:
- `IDLE_MOTION_TYPES` array and constants (`IDLE_MOTION_INTERVAL_MIN/MAX`, `IDLE_RAMP_IN`, etc.)
- `randomRange()` function (unless used elsewhere)  
- `randomMagnitude()` function (unless used elsewhere)
- `createIdleMotionState()` function
- `this.idleMotion` state object
- `this.idlePoseDeltas` object
- `this.idleArmOverride` object
- `this.lastIdleMotionType` tracking
- `_tickIdleMotion()` method entirely
- `_generateIdleParams()` method entirely
- `_applyIdleMotionFrame()` method entirely
- `_clearIdlePoseDeltas()` method entirely
- `_applyIdlePoseDeltasToPresentation()` method entirely
- The idle-related code in `_applyArmsDownFrame()` that references `idleArmOverride`
- The `_diagArmAxes()` diagnostic method (no longer needed)

## What to KEEP (do NOT touch)
- `_applyRelaxedHands()` and all finger curl logic (FINGER_CURL_BONES, Z-axis curl)
- `_computeBlink()` and blink system
- `_updateExpressions()` and expression/emotion system
- `_updateCamera()` and camera system
- `_updateLookAt()` and gaze system
- `_applyArmsDown()` and `_setupArmTargets()` and `_resolveUpperArmOffset()` — the arms-down system. BUT: the arm Y-axis forward push for left arm (`Y: -0.14`) in `_applyArmsDownFrame` should be REMOVED since the Mixamo animations will handle arm positioning.
- `_logArmBoneSummary()` can stay for debugging
- All bone caching (`_cacheBones`, `_cacheFingerBones`)

## Important constraints
- The AnimationMixer should update BEFORE `vrm.update(delta)` so VRM spring bones react to the animation
- After mixer.update, the relaxed hand pose (`_applyRelaxedHands`) should still apply on top (mixer won't animate fingers if the Mixamo clips don't have finger data - "Without Skin" clips should have finger bones but they may be in T-pose)
- The arms-down system (`_applyArmsDownFrame`) might conflict with mixer animations. If the Mixamo idle animations already position arms naturally, DISABLE the arm-down euler override during mixer playback. Keep `_setupArmTargets` for reference but skip applying in the frame loop when mixer is active.
- Build must pass: `npm run build`
- Tests must pass: `npm run verify:core`

## Architecture summary
```
update(delta):
  elapsed += delta
  _updateCamera(delta)
  mixer.update(delta)        // NEW: Mixamo animation drives bones
  _updateExpressions(...)    // facial expressions (keep)
  _updatePose(...)           // mouth open / body pose from emotion (keep, but may need to not conflict)
  _updateLookAt(...)         // gaze (keep)
  _applyRelaxedHands(delta)  // finger curl (keep)
  vrm.update(delta)          // VRM spring bones
  // NO MORE _applyArmsDownFrame or _tickIdleMotion
  renderer.render(...)
```

## File paths
- Main file: `src/core/vrm-avatar-controller.js`
- Vite config: `vite.config.js`  
- Animation source: `D:/Vela/assets/animations/*.fbx`
- Public dir for serving: `public/assets/animations/`
- Working directory: `C:\Users\caipe\.openclaw\workspace\Vela`
