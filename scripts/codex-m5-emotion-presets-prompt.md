# M5 Emotion-Animation-Camera Preset Design Task

## Goal
Design and implement a complete emotion→expression+animation+camera preset system for Vela's VRM avatar. The output must be a **preview/demo mode** that cycles through all presets so a human can review them on video before they go live.

## Context

### Current Architecture
- **VRM model**: Eku VRM 0.0 format, 53/54 standard bones, 37 morph targets on Body mesh
- **Animation system**: 6 Mixamo FBX idle animations loaded via `vrm-mixamo-retarget` + `THREE.AnimationMixer` (see `vrm-avatar-controller.js`)
- **Expression system**: Currently uses 1-to-1 mapping (emotion→single blend shape), only 4 emotion blend shapes used: `happy`, `relaxed`, `sad`, `angry` + `neutral`
- **12 protocol emotions**: calm, happy, affectionate, playful, concerned, sad, angry, whisper, surprised, curious, shy, determined
- **Camera**: wide/close with cooldown logic

### Key Files to Read
1. `src/core/vrm-avatar-controller.js` — main avatar controller (animations, expressions, bones, camera)
2. `src/core/interaction-contract.js` — emotion→expression and emotion→TTS mappings
3. `src/core/interaction-policy.js` — how emotions are routed from LLM output
4. `docs/fbx-animation-analysis.md` — YOUR OWN previous analysis of the 6 Mixamo FBX animations (motion patterns, emotional reads, procedural generation formulas for shy/nervous/confident/sleepy)
5. VRM model path: `D:\Vela\assets\avatars\eku\Eku_VRM_v1_0_0.vrm`

### VRM Normalized Bone Axis Mapping (verified)
- UpperArm Y = front/back swing (left -Y forward, right +Y forward)
- UpperArm Z = up/down swing (left +Z down, right -Z down)
- UpperArm X = roll (minimal visual change)
- Finger curl axis: Z (left +Z inward, right -Z inward)
- Modify normalized bones BEFORE `vrm.update()`
- Use PascalCase for `VRMHumanBoneName` keys (e.g. `LeftUpperArm`, not `leftUpperArm`)

### Available Mixamo Animations
Located in `public/assets/animations/`:
- `Breathing Idle.fbx` — calm, relaxed (9.93s)
- `Happy Idle.fbx` — cheerful, upbeat (2.93s)
- `Standing Idle.fbx` — patient, composed (6.00s)
- `Idle.fbx` — natural neutral standby (16.63s)
- `Bored.fbx` — bored, tired (10.67s)
- `Thinking.fbx` — contemplative (4.23s)

## What You Must Produce

### 1. Enumerate All 37 Morph Targets
Write a small script or add code to enumerate and log all morph target names from the VRM model's `expressionManager` and raw mesh morph targets. Output the full list to `docs/vrm-morph-targets.md`.

### 2. Design Preset Combinations
For each of the 12 emotions, design a preset that includes:
- **Blend shape recipe**: multiple morph targets with weights (0.0-1.0), not just one
- **Preferred animation clip**: which Mixamo animation fits this emotion best
- **Camera preference**: wide or close, with optional override conditions
- **Action overlay**: any bone-level adjustments on top of the animation (e.g. slight head tilt for shy)
- **Transition timing**: how fast to blend in (ms)

Output as a structured JS config object in a new file: `src/core/emotion-presets.js`

### 3. Build Preview/Demo Mode
Add a keyboard shortcut or URL param (`?preset-demo=true`) that:
- Cycles through all 12 emotion presets automatically (5 seconds each)
- Shows the current emotion name as an overlay
- Applies the full preset (expressions + animation + camera + action)
- Suitable for screen recording by a human reviewer

### 4. Integration Points (DO NOT apply yet)
Prepare the integration but gate it behind a feature flag (`EMOTION_PRESETS_V2 = false`). The current system must keep working. The new presets will only activate when the flag is true.

When the flag is true:
- `EMOTION_TO_VRM_EXPRESSION` in `interaction-contract.js` should be replaced by the new multi-blend-shape presets
- Animation selection in `vrm-avatar-controller.js` should pick clips based on emotion, not random
- Camera hints from presets should feed into the existing camera logic

## Constraints
- Do NOT add any new npm dependencies
- Do NOT modify the LLM protocol or system prompt
- Do NOT touch TTS code
- Keep the existing animation loading/retargeting pipeline intact
- All new code must pass `npm run build`
- Morph target names are case-sensitive — verify against actual model data

## Deliverables
1. `docs/vrm-morph-targets.md` — full morph target enumeration
2. `src/core/emotion-presets.js` — preset configuration
3. Modified `src/core/vrm-avatar-controller.js` — preview mode + preset application (behind flag)
4. Modified `src/core/interaction-contract.js` — new mapping (behind flag)
5. `npm run build` must pass
