# M4-T6: Idle Micro-Motion + Arm Naturalness

## Context
Vela is a companion app with a VRM avatar. The avatar currently stands still in idle/listening states — no body movement except breathing and head sway. Arms are stiff ("military stance"). This makes her look like a mannequin, not a person.

## Goal
Make the avatar feel alive when idle. Two changes:

### 1. Idle Micro-Motion System
Add a randomized micro-motion system to `src/core/vrm-avatar-controller.js`.

**Micro-motions to implement** (pick randomly, 15-30s interval):
- **Weight shift**: Hips sway slightly left/right (Y rotation ±0.03 rad), one leg relaxes
- **Gaze wander**: LookAt target drifts to a random offset, then returns to camera after 2-3s
- **Head tilt reset**: Head tilts slightly to one side, holds 3s, returns
- **Subtle stretch**: Spine extends slightly (X rotation -0.02), chest opens, holds 2s, relaxes
- **Blink rhythm change**: Temporarily speed up blink interval to 1.2-1.8s for 3 blinks, then return to normal

**Rules:**
- Only trigger during `idle` or `listening` presence states
- When presence changes to `thinking` or `speaking`, immediately cancel current micro-motion and return to the normal pose for that state (use damping, not snap)
- Each micro-motion has a ramp-in (0.5s), hold (2-4s), and ramp-out (0.5s) phase
- Never overlap two micro-motions — finish one before starting another
- Randomize interval between 15-30 seconds
- Add slight randomness to motion magnitudes (±20%) so it doesn't look robotic

**Implementation approach:**
- Add an `idleMotion` state object to the controller: `{ active: false, type: null, phase: 'idle'|'ramp-in'|'hold'|'ramp-out', elapsed: 0, nextTriggerIn: 0, params: {} }`
- In `update()`, tick the idle motion timer. When `nextTriggerIn` reaches 0 and presence is idle/listening, pick a random motion and start it.
- Each motion type defines its bone targets as deltas from current pose. Apply via the existing `dampNumber`/`dampFactor` helpers.
- On presence change away from idle/listening, set `active = false` and let the normal pose damping handle the return.

### 2. Arm Naturalness
Current arm pose is too stiff and symmetric.

**Changes to `_setupArmTargets()`:**
- Left elbow bend: 0.35 → 0.42 rad (slightly more bent)
- Right elbow bend: -0.35 → -0.30 rad (less bent than left — asymmetry)
- Add a small forward rotation to left upper arm: X += 0.08 (hand slightly in front of body)
- Right upper arm stays as-is

**Idle arm sway:**
- During idle/listening, add a very subtle sinusoidal sway to upper arms:
  - Left: Z oscillates ±0.015 rad at 0.4 Hz
  - Right: Z oscillates ±0.012 rad at 0.35 Hz (different frequency = natural)
- Apply this in `_applyArmsDownFrame()` by modifying the target quaternion before slerp
- When speaking, reduce sway amplitude to 30% of idle value
- When thinking, reduce to 50%

## Files to modify
- `src/core/vrm-avatar-controller.js` — all changes go here

## Files NOT to modify
- Do not touch `interaction-contract.js`, `App.jsx`, `styles.css`, or any other file
- Do not add npm dependencies

## Verification
- `npm run build` must pass
- The avatar should visibly move during idle (not just breathe)
- Arms should look asymmetric and natural, not "military stance"
- When user sends a message (presence → speaking), micro-motion should smoothly stop

## Technical notes
- Bone manipulation must happen AFTER `this.vrm.update(delta)` for raw-bone fallback
- Use existing `dampNumber`, `dampFactor`, `dampVector` helpers for smooth transitions
- Existing arm system uses `_applyArmsDownFrame(delta)` called after `vrm.update()` — extend this
- `VRMHumanBoneName` uses PascalCase keys (e.g., `LeftUpperArm`, not `leftUpperArm`)
- Current elbow bend values are in `_setupArmTargets()` method
