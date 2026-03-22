# M5-T1: Emotion-Expression-Animation Fusion Preset System

## Your Mission

Design and implement a complete emotion→expression→animation→camera fusion preset system for Vela's VRM avatar. Your job is to produce **ready-to-use preset combinations** that will be reviewed via video recording before going live.

## What You Must Read First

Before writing any code, read these files to understand the existing system:

1. `docs/fbx-animation-analysis.md` — YOUR OWN analysis of 6 Mixamo FBX idle animations, including bone rotation recipes for shy/nervous/confident/sleepy
2. `src/core/interaction-contract.js` — current emotion enums, TTS mappings, and `EMOTION_TO_VRM_EXPRESSION` (currently 1-to-1 mapping)
3. `src/core/vrm-avatar-controller.js` — current expression system (`_updateExpressions`, `setPresence`, Mixamo animation mixer, `EXPRESSION_KEYS`, `EMOTION_EXPRESSION_WEIGHTS`)
4. `src/core/interaction-policy.js` — how emotions route to avatar state

## Context: Current System Limitations

### Expression System (Face)
- Model has **37 morph targets** on the Body mesh but we only use 8: `happy`, `relaxed`, `sad`, `angry`, `blink`, `aa`, `ih`, `oh`
- The other 29 morph targets are UNUSED, including valuable ones like:
  - `eye_smile`, `eye_jito` (squinting/side-eye)
  - `extra_shy`, `extra_tear`
  - `face_cheek_puku` (puffed cheeks)
  - Various eye/mouth shape variants
- Current mapping is **1 emotion → 1 blend shape** at a fixed weight (e.g. happy→happy@0.64)

### Animation System (Body)
- 6 Mixamo FBX idle animations loaded via `vrm-mixamo-retarget` + `THREE.AnimationMixer`
- Animations: `Breathing Idle`, `Happy Idle`, `Standing Idle`, `Idle`, `Bored`, `Thinking`
- Currently: **random** selection, no emotion coupling at all
- crossfade transitions already work (1.5s `crossFadeTo`)

### Camera System
- `wide` (full body) and `close` (face closeup)
- Currently only `affectionate/concerned/whisper` trigger `close`
- 8s cooldown between switches

### 12 Protocol Emotions
`calm`, `happy`, `affectionate`, `playful`, `concerned`, `sad`, `angry`, `whisper`, `surprised`, `curious`, `shy`, `determined`

## What You Must Produce

### 1. Complete Morph Target Audit Script

Write `scripts/audit-morph-targets.mjs` that:
- Loads the VRM file (`public/assets/avatars/eku/Eku_VRM_v1_0_0.vrm`) using three.js + @pixiv/three-vrm in Node
- Lists ALL morph targets on the Body mesh with their indices
- For each of the 12 emotions, log which morph targets could contribute
- Output to `docs/morph-target-audit.md`

### 2. Emotion Preset Configuration (`src/core/emotion-presets.js`)

Create a new module exporting `EMOTION_PRESETS` — a map from each of the 12 emotions to a complete preset:

```js
export const EMOTION_PRESETS = {
  calm: {
    // Face: blend shape combo with weights
    expressions: { /* morph_target_name: weight, ... */ },
    // Body: which Mixamo animations to prefer (array of clip names, weighted)
    preferredAnimations: [
      { clip: 'Breathing Idle', weight: 0.6 },
      { clip: 'Standing Idle', weight: 0.4 }
    ],
    // Camera: default camera state for this emotion
    camera: 'wide',
    // Motion: head/body micro-adjustments  
    motion: { headTiltX: 0, gazeOffsetY: 0 },
    // Transition: how fast to blend into this emotion's expression (seconds)
    transitionSpeed: 0.8,
  },
  shy: {
    expressions: {
      relaxed: 0.3,
      // Use the model's actual morph target names here
      // e.g. extra_shy: 0.7, eye_smile: 0.5, face_cheek_puku: 0.4
    },
    preferredAnimations: [
      { clip: 'Standing Idle', weight: 0.7 },
      { clip: 'Breathing Idle', weight: 0.3 }
    ],
    camera: 'close',
    motion: { headTiltX: 0.08, gazeOffsetY: -0.05 },
    transitionSpeed: 1.2,
  },
  // ... all 12 emotions
};
```

**Critical**: You MUST first run the morph target audit to discover the actual available morph target names on this model. Do NOT guess morph target names.

### 3. Integration into vrm-avatar-controller.js

Modify `_updateExpressions` to use `EMOTION_PRESETS[emotion].expressions` instead of the current 1-to-1 mapping. The combo blend shapes should:
- Smoothly interpolate (use existing `dampNumber`)
- Stack correctly (multiple morph targets active simultaneously)
- Not fight with blink/mouth systems

Modify `_startRandomIdle` / `_tickMixerCrossfade` to prefer animations from the current emotion's `preferredAnimations` array instead of pure random selection.

### 4. Preview/Demo Mode (`scripts/preview-presets.mjs` or in-app)

Build a mechanism to cycle through all 12 emotion presets sequentially, holding each for 5 seconds with visible label overlay, so we can screen-record it for review. Options:
- Add a `?demo=emotions` URL param that auto-cycles
- Or a keyboard shortcut (e.g. press D to start demo mode)

The demo should show:
- Current emotion name (large text overlay)
- Face expression blend in real-time
- Body animation switching to emotion-matched clip
- Camera position (wide/close) switching as configured

### 5. Updated interaction-contract.js

Replace `EMOTION_TO_VRM_EXPRESSION` (1-to-1 map) with a reference to the new preset system, or deprecate it in favor of `EMOTION_PRESETS`.

## Technical Constraints

- VRM 0.0 model, loaded via `@pixiv/three-vrm`
- expressionManager.setValue(name, weight) is the API for morph targets
- Normalized bone space: Y axis = forward/back swing for arms, Z axis = up/down swing (confirmed via runtime diagnosis)
- Finger curl axis: Z (left +Z inward, right -Z inward)
- Mixamo retarget: MUST filter position tracks (`clip.tracks.filter(t => !t.name.endsWith('.position'))`)
- `vrm.update()` runs BEFORE mixer update in the render loop
- Build must pass: `npm run build`
- Tests must pass: `npm run verify:core`

## Quality Bar

The presets must feel **natural, not mechanical**. Think anime game character, not robot testing blend shapes. Reference:
- Shy: not just "slightly sad" — should have visible bashfulness (averted gaze, maybe puffed cheeks, self-protective body language)
- Happy: not just "smile on" — should have eye participation (eye_smile), body bounce (Happy Idle)
- Concerned: empathetic warmth, not just "sad lite"
- Angry: controlled intensity, not grotesque
- Surprised: wide eyes + slight head back, not permanent shock face

## Output Checklist

- [ ] `scripts/audit-morph-targets.mjs` — morph target enumeration script
- [ ] `docs/morph-target-audit.md` — complete morph target list with emotion mapping notes
- [ ] `src/core/emotion-presets.js` — the 12 emotion preset configurations
- [ ] Modified `src/core/vrm-avatar-controller.js` — integration
- [ ] Modified `src/core/interaction-contract.js` — updated mappings
- [ ] Preview/demo mechanism for video review
- [ ] `npm run build` passes
- [ ] `npm run verify:core` passes
