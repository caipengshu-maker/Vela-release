# M5-T4: Emotion-Driven Animation Switching

## Objective
When the avatar's emotion changes (from LLM response or preset demo mode), the Mixamo animation should switch to match the emotion, with smooth crossfade transitions. Currently idle animations are randomly cycled regardless of emotion state.

## Project
- Path: `C:\Users\caipe\.openclaw\workspace\Vela`
- Build: `npm run build`
- Verify: `npm run verify:core`

## Current Architecture (READ THESE FILES FIRST)
1. `src/core/vrm-avatar-controller.js` - Main controller with:
   - `AnimationMixer` + 6 loaded Mixamo FBX clips (loaded in `_loadIdleAnimations`)
   - `_startRandomIdle()` / `_tickMixerCrossfade(delta)` - random idle cycling every 15-30s
   - `EMOTION_TO_SAFE_MOTION` - maps 12 emotions to motion hints (currently unused by AnimationMixer)
   - `presetDemoState` - P key demo mode that cycles through emotions every 5s
   - `this.avatarState` - current avatar state including `.emotion`
   - `IDLE_CROSSFADE_DURATION = 1.5` - existing crossfade timing

2. `src/core/emotion-presets.js` - 12 emotion presets, each with:
   - `animationClip` field (e.g. "Happy Idle", "Thinking", "Bored") - **currently defined but NOT used by AnimationMixer**
   - `EMOTION_PRESET_ORDER` - array of 12 emotion names

3. Available Mixamo FBX animations in `public/assets/animations/`:
   - `Breathing Idle.fbx` - calm, gentle breathing (good for: calm, affectionate, whisper, concerned)
   - `Happy Idle.fbx` - upbeat, slight bounce (good for: happy, playful, surprised)
   - `Standing Idle.fbx` - neutral weight shift (good for: angry, determined)
   - `Idle.fbx` - generic idle (good for: shy)
   - `Bored.fbx` - slow, disengaged (good for: sad)
   - `Thinking.fbx` - contemplative pose (good for: curious, whisper)

## What To Implement

### 1. Emotion → Animation Binding (core change)
In `vrm-avatar-controller.js`:

a) Add an `EMOTION_TO_ANIMATION` map that maps each of the 12 emotions to a preferred Mixamo clip name:
```js
const EMOTION_TO_ANIMATION = {
  calm: "Breathing Idle",
  happy: "Happy Idle", 
  affectionate: "Breathing Idle",
  playful: "Happy Idle",
  concerned: "Breathing Idle",
  sad: "Bored",
  angry: "Standing Idle",
  whisper: "Thinking",
  surprised: "Happy Idle",
  curious: "Thinking",
  shy: "Idle",
  determined: "Standing Idle"
};
```

b) When avatar emotion changes, find the matching clip and crossfade to it instead of continuing random idle cycling. Use existing `_playIdleClipByName()` method with smooth crossfade.

c) While an emotion-driven animation is playing, **pause** the random idle cycling timer (`_tickMixerCrossfade` should not override emotion-chosen clip).

d) When emotion returns to "calm" or is cleared, resume random idle cycling.

### 2. Preset Demo Mode Enhancement (P key)
The P key demo already cycles through 12 emotions every 5s changing blend shapes. Enhance it to ALSO trigger the animation switch for each emotion step. The `_tickPresetDemo` or equivalent method should call the new emotion→animation logic each time the demo emotion changes.

### 3. Blend Shape Transition Smoothness
Currently emotion blend shapes may be applied instantly. Ensure blend shape transitions between emotions use the existing `lerp` / `dampedLerp` system (strength ~8-12) for smooth 300-500ms transitions, not instant jumps.

## Key Constraints
- Do NOT remove or break existing idle cycling - only pause it during emotion-driven states
- Do NOT add new npm dependencies
- Do NOT modify the Mixamo FBX files or add new ones
- Maintain existing P key toggle behavior (on/off)
- crossfade duration for emotion switches: 0.8-1.2s (slightly faster than idle-to-idle which is 1.5s)
- When emotion is "calm", treat it as "no emotion override" and let random idle resume

## Verification
After implementation:
1. `npm run build` must pass
2. `npm run verify:core` must pass
3. In the running app, pressing P should cycle emotions AND visibly switch Mixamo animation + blend shapes together

## DEV-ONLY markers
Any new keyboard shortcuts or debug features must be wrapped with a `// DEV-ONLY: remove before production release` comment so they can be found and stripped later.

## Do NOT
- Do not touch relationship.js, context-builder.js, or vela-core.js
- Do not change the emotion preset blend shape recipes
- Do not add new emotions beyond the existing 12
- Do not refactor unrelated code
