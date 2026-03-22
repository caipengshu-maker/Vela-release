# Mixamo FBX Idle Animation Analysis

Date: 2026-03-22
Method: `node scripts/analyze-fbx-animations.mjs --json tmp/fbx-animation-analysis.json`
Assets analyzed: `public/assets/animations/Breathing Idle.fbx`, `Happy Idle.fbx`, `Standing Idle.fbx`, `Idle.fbx`, `Bored.fbx`, `Thinking.fbx`

## Method

The analysis script uses `three`'s `FBXLoader.parse()` directly in Node, so no browser mocks were needed. For each file it:

- Loads the FBX and extracts the first `AnimationClip`.
- Analyzes every track: track name, type, keyframe count, duration, start/peak/end values, movement score, peak time, and loop closure.
- Samples the animated skeleton in world space to measure head, hand, foot, and hips motion patterns.
- Separates "overall movers" from "core movers" so finger noise does not hide the body acting.

## Common Structure Across All 6 Files

- All six clips use the same Mixamo rig layout.
- Each clip contains 53 tracks: 1 `VectorKeyframeTrack` for `mixamorigHips.position` and 52 `QuaternionKeyframeTrack`s for bone rotation.
- The effective sampling rate is about 30 fps in every file.
- Loop closure is extremely clean. The largest end-to-start rotation drift found is about `0.072 deg` (`Standing Idle` neck); positional drift on hips is effectively zero.
- The expressive bones are almost always `mixamorigHips`, spine/head, shoulders/arms, upper legs/lower legs, and feet. Fingers only matter in the more performative clips (`Happy`, `Thinking`).
- The clips differ much more in amplitude, asymmetry, and timing than in which bones are present.

### Rig Families

The 52 rotation tracks cover:

- Root and torso: `mixamorigHips`, `mixamorigSpine`, `mixamorigSpine1`, `mixamorigSpine2`, `mixamorigNeck`, `mixamorigHead`
- Arms: shoulders, upper arms, forearms, hands
- Legs: upper legs, lower legs, feet, toe bases
- Fingers: thumb, index, middle, ring, pinky chains on both hands

### Clip Summary

| Animation | Duration | Structural signature | Emotional read |
| --- | ---: | --- | --- |
| Breathing Idle | 9.93s | Low-amplitude full-body sway, planted feet, alternating left/right accents | Calm, relaxed |
| Happy Idle | 2.93s | Fast bounce, big arm arcs, animated head | Cheerful, upbeat |
| Standing Idle | 6.00s | Near-static body, tiny mirrored arm/hand settles | Patient, composed |
| Idle | 16.63s | Long neutral weight-shift cycle with whole-body participation | Natural neutral standby |
| Bored | 10.67s | Large forward/back slump, head drop, late arm collapse | Bored, tired, disengaged |
| Thinking | 4.23s | Strong asymmetry, hand-to-face action, head tilt/turn | Contemplative, analytical |

## Per-Animation Findings

### Breathing Idle

- Duration: `9.93s`
- Active bones: almost the full body is alive, but the biggest core movers are `LeftArm`, `LeftLeg`, both shoulders, both feet, hips translation, and `RightLeg`.
- Hips pattern: position range is `X 18.76 / Y 2.86 / Z 3.87`. This is mostly a side-to-side shift, not a bounce.
- Rotation signature:
  - `LeftArm`: `X 13.0 / Y 18.8 / Z 9.4 deg`, peak at `6.67s`
  - `LeftShoulder`: `X 14.7 / Y 4.6 / Z 13.0 deg`, peak at `6.63s`
  - `RightShoulder`: `X 10.0 / Y 5.6 / Z 16.5 deg`, peak at `5.80s`
  - `LeftLeg`: `X 19.6 deg` dominant, peak at `1.30s`
  - `RightFoot`: `X 13.4 / Z 13.6 deg`, peak at `3.50s`
- Motion pattern: the clip behaves like a slow pendulum. Early in the loop the left leg compresses, then the right leg and right foot take over around `3.5s`, then the upper body resolves later on the left side around `6.6s` to `8.2s`.
- Head/body read: head motion relative to hips is small (`X 7.85 / Y 0.30 / Z 4.93` in world-space range), and the hands never come close to the head. This keeps the acting understated.
- Emotional read: calm, relaxed, quietly alive. The body is not trying to communicate a thought. It is simply breathing and shifting weight.
- Why it works: the feet stay nearly planted, the hips lead, and shoulders/arms lag behind in phase. That overlap keeps the clip from feeling robotic even though the torso rotations are small.

### Happy Idle

- Duration: `2.93s`
- Active bones: almost everything except a couple of one-key thumb tracks. The expressive load is dominated by the arms, hands, head, forearms, and feet.
- Hips pattern: position range is `X 3.35 / Y 4.54 / Z 3.64`. Unlike `Breathing Idle`, the largest hips axis is vertical, so the loop reads as a bounce.
- Rotation signature:
  - `LeftArm`: `X 35.3 / Y 68.5 / Z 33.3 deg`, peak at `0.33s`
  - `LeftForeArm`: `Z 44.9 deg`, peak at `0.40s`
  - `LeftHand`: `X 34.8 / Y 44.2 / Z 31.9 deg`, peak at `0.63s`
  - `RightArm`: `X 15.7 / Y 26.0 / Z 32.1 deg`, peak at `1.67s`
  - `Head`: `X 22.0 / Y 16.2 / Z 26.1 deg`, peak at `1.63s`
  - `LeftFoot` and `RightFoot`: roughly `18` to `22 deg` max excursion
- Motion pattern: the loop is two-phase. The left arm explodes first in the first `0.4s`, then the right arm and head answer around `1.6s`. The feet and hips bounce under the body the whole time.
- Head/body read: the head range relative to hips is larger than `Breathing Idle`, especially on X and Z. The left hand world-space Z range is `53.59`, which means the arm silhouette opens and closes aggressively.
- Emotional read: upbeat and friendly. Quick tempo, vertical bounce, wide arm arcs, and visible head participation read as positive affect.
- Why it works: the body does not move symmetrically at the same instant. The left side leads, the right side follows, and the bounce underneath ties the phrase together.

### Standing Idle

- Duration: `6.00s`
- Active bones: this is the least busy clip by far. Only 23 of 53 tracks cross a meaningful movement threshold, and many finger tracks are single-key constants.
- Hips pattern: position range is only `X 1.10 / Y 0.05 / Z 0.92`, which means the center of mass is almost locked.
- Rotation signature:
  - `RightForeArm`: `Z 11.4 deg`, peak at `1.43s`
  - `LeftForeArm`: `Z 11.1 deg`, peak at `4.53s`
  - `LeftHand` and `RightHand`: about `6 deg`
  - `LeftArm` and `RightArm`: about `6.5 deg`
  - `Head`: only `1.76` movement score total
- Motion pattern: it is basically a mirrored two-beat settle. The right forearm/hand/arm make a tiny adjustment around `1.43s`, the hips and feet breathe once in the middle, then the left side mirrors that around `4.37s` to `4.53s`.
- Head/body read: head relative-to-hips range is only `X 0.36 / Y 0.05 / Z 0.90`. The body is intentionally almost frozen.
- Emotional read: composed, patient, waiting. It does not feel sad, bored, or happy because there is almost no pose bias.
- Why it works: a "still" idle is not truly static. There are just enough wrist/elbow corrections to prevent mannequin syndrome without advertising a mood.

### Idle

- Duration: `16.63s`
- Active bones: nearly the entire body is contributing. The dominant movers are both arms, both upper legs, both lower legs, hips rotation, and the left foot.
- Hips pattern: position range is `X 12.53 / Y 2.64 / Z 5.28`, so the motion is mainly lateral with some forward/back drift.
- Rotation signature:
  - `LeftArm`: `X 21.3 / Y 13.1 / Z 18.1 deg`, peak at `5.47s`
  - `RightArm`: `X 19.4 / Y 10.2 / Z 18.7 deg`, peak at `6.90s`
  - `LeftUpLeg`: `Z 27.6 deg`, peak at `5.63s`
  - `RightUpLeg`: `Z 21.4 deg`, peak at `5.57s`
  - `RightLeg`: `X 19.6 / Y 14.7 / Z 9.4 deg`, peak at `5.53s`
  - `Hips`: `Y 16.8 / Z 16.3 deg`, peak at `5.07s`
- Motion pattern: this is a long neutral phrase with one main body transfer centered around `5s` to `7s`, followed by a later left-foot resolution around `8.57s` and a long settle back to the start pose.
- Head/body read: head motion is moderate (`score 10.72`) and the hands stay far from the head. This reads like natural standing, not "acting a thought."
- Emotional read: neutral, grounded, believable standby. The loop is rich enough to avoid dead stillness but not stylized enough to signal a specific emotion.
- Why it works: it spreads motion across the whole chain instead of relying on one body part. Arms, hips, and legs all participate, so the motion feels like balance maintenance instead of a gesture.

### Bored

- Duration: `10.67s`
- Active bones: fewer tracks are meaningfully active than in `Idle`, but the bones that do move are much larger. The strongest movers are both upper arms, both hands, both feet, head, upper legs, and hips translation.
- Hips pattern: position range is `X 1.57 / Y 7.09 / Z 24.18`, with a total path length of `192.41`. This is the most dramatic root travel in the set and it is dominated by forward/back displacement.
- Rotation signature:
  - `RightArm`: `X 79.1 / Y 20.5 / Z 63.1 deg`, peak at `9.83s`
  - `LeftArm`: `X 29.8 / Y 24.4 / Z 87.3 deg`, peak at `9.77s`
  - `Head`: `X 39.1 deg` dominant, peak at `6.63s`
  - `LeftFoot`: `X 38.5 deg`, peak at `7.00s`
  - `RightFoot`: `X 40.5 deg`, peak at `7.23s`
  - `RightUpLeg`: `X 34.8 deg`, peak at `9.50s`
- Motion pattern: the loop has a heavy mid-to-late collapse. Around `6.5s` to `7.2s` the head drops and the feet/shoulders respond. Around `9.5s` to `9.8s` the arms and upper legs hit their maximum slumped swing before the pose recovers back to start.
- Head/body read: head relative-to-hips Z range is `21.11`, far larger than the calm clips. The hands also travel forward/back by about `60` units. The whole body feels like it is sagging and resetting.
- Emotional read: bored, tired, disengaged. The head droop, long forward/back torso travel, and late heavy arm collapse communicate low energy and impatience.
- Why it works: boredom here is not made by tiny noise. It is made by gravity. Big downward and forward biases, then a slow reset, read as "I do not want to hold this pose."

### Thinking

- Duration: `4.23s`
- Active bones: this clip is the most conceptually specific. Arms, forearms, hands, head, hips, and one support leg dominate. Several distal finger tips are static, which tells us the pose is about arm placement, not detailed finger choreography.
- Hips pattern: position range is `X 16.60 / Y 2.29 / Z 4.81`. Rotation on hips is also large on Y (`24.0 deg`), which means the whole body is turning into the thought.
- Rotation signature:
  - `RightForeArm`: `Z 149.7 deg`, peak at `1.80s`
  - `LeftHand`: `X 87.1 / Y 49.8 / Z 74.7 deg`, peak at `0.80s`
  - `RightHand`: `X 77.8 / Y 42.7 / Z 74.3 deg`, peak at `2.93s`
  - `LeftArm`: `X 42.9 / Y 51.6 / Z 78.0 deg`, peak at `1.37s`
  - `RightArm`: `X 37.5 / Y 50.9 / Z 50.8 deg`, peak at `2.90s`
  - `Head`: `X 18.5 / Y 36.8 / Z 41.3 deg`, peak at `1.73s`
  - `LeftUpLeg`: `Y 45.9 deg`, peak at `2.83s`
- Motion pattern: the loop is clearly staged in phases.
  - Early (`0.57s` to `1.37s`): hips turn, left arm and left hand rise to establish the pose.
  - Mid (`1.73s` to `1.80s`): head turns/tilts and the right forearm curls hard.
  - Late (`2.83s` to `2.93s`): right hand and right arm complete the thought gesture while the left support leg shifts.
- Head/body read: the right hand comes within `23.16` units of the head at `2.67s`, which is by far the strongest "hand to face" cue in the set.
- Emotional read: contemplative, analytical, slightly self-directed. The asymmetry, head tilt, and hand-to-face action are classic "thinking" signals.
- Why it works: it is not just a static thoughtful pose. It has setup, contact, and recovery. That short internal narrative makes the emotion readable.

## Reverse Engineering Guide

## Common Patterns Across All Idles

- The clips are built on the same skeleton and the same track layout. What changes is timing, asymmetry, and amplitude.
- Hips are the control hub. Even when the emotional read is in the head or arms, the hips usually start the phrase.
- Feet are usually the truth source. Calm idles keep them planted. More emotional clips let feet and upper legs flex to support a stronger weight shift.
- Head motion alone is rarely enough. The readable clips coordinate head, shoulders, and hips so the body agrees with the thought.
- The best loops do not move everything together. They offset body parts by fractions of a second.

## How Professional Idles Stay Natural

- They preserve balance. Even stylized idles still imply a support leg and a center of mass.
- They use overlapping action. Hips lead, spine follows, head arrives later, hands settle last.
- They keep one clear idea per loop. `Happy` is bounce plus open arms. `Bored` is slump plus reset. `Thinking` is hand-to-face contemplation.
- They control symmetry. Symmetry reads as neutral or formal. Asymmetry reads as personality.
- They loop on intent, not just on numbers. The body returns to a compatible start pose after the emotional phrase has resolved.

## Procedural Rules We Can Reuse

Treat each generated idle as four stacked layers:

1. Base breath
   - `Hips.position.y`: `0.5` to `2.5` units over `3` to `5s`
   - `Spine.x`, `Spine1.x`, `Spine2.x`: each `0.5` to `3 deg`, slightly phase-shifted upward through the chain
   - `Shoulders.z`: `2` to `6 deg`, lagging the spine by `0.1` to `0.25` of the cycle

2. Weight shift
   - `Hips.position.x`: `4` to `16` units depending on mood
   - `Hips.rotation.y` or `.z`: `4` to `18 deg`
   - Support leg (`UpLeg`, `Leg`, `Foot`): `6` to `25 deg` total rotation budget
   - Free side arm: delayed swing, usually `30%` to `60%` of the leg amplitude

3. Emotional accent
   - Happy: faster cycle, more vertical bounce, wider arm arcs
   - Bored: forward bias, head drop, longer holds, heavier recovery
   - Thinking: asymmetric hand rise, head turn, one hand close to face

4. Secondary settle
   - `ForeArm`, `Hand`, and sometimes fingers arrive last
   - Delay them by `0.1` to `0.35s` relative to the shoulder or upper arm

## Practical Procedural Formula

Start with a neutral standing pose and add local rotation deltas:

```text
hips_shift_x(t) = A_shift * sin(w_shift * t + phase_shift)
hips_bob_y(t)   = A_breath * sin(w_breath * t)

spine_x(t)  = 0.35 * breath + 0.20 * shift
spine1_x(t) = 0.50 * breath + 0.30 * shift
spine2_x(t) = 0.65 * breath + 0.35 * shift
neck_x(t)   = 0.40 * breath + accent_neck(t)
head_xyz(t) = delayed_follow(spine2, 0.12s) + accent_head(t)

arm_main(t) = accent_arm(t)
forearm(t)  = delay(arm_main, 0.10s to 0.20s)
hand(t)     = delay(forearm, 0.06s to 0.12s)
```

Rules:

- Keep foot world positions almost fixed unless the clip is meant to feel restless or expressive.
- Use one strong accent, not three unrelated ones.
- Make the loop close both spatially and emotionally.
- If a hand comes near the face, support it with head and shoulder rotation or it will look accidental.

## Bone Rotation Recipes For New Emotions

These are local rotation deltas in degrees on top of a neutral pose. Mirror left/right signs as needed for the side you want to favor.

### Shy

- Core pose:
  - `Hips`: `X +2`, `Y 4 to 8 away`, `Z 2 to 4`
  - `Spine/Spine1/Spine2`: `X +3 / +4 / +2`
  - `Neck`: `X +4`
  - `Head`: `X +8 to +12`, `Y 8 to 15 away`, `Z 4 to 8`
- Arms:
  - favored-side `Shoulder`: `Z +6`
  - both `Arm`: bring inward `10` to `20`
  - both `ForeArm`: curl `15` to `30`
  - one `Hand`: pull toward sternum with `10` to `20` of rotation
- Timing:
  - very slow `4` to `6s` sway
  - brief eye/head aversion accent every `6` to `10s`

### Nervous

- Core pose:
  - `Hips`: `position.x` shift `6` to `10` units with a faster `1.5` to `2.5s` cycle
  - `Spine`: `Y 2 to 5`, `Z 2 to 4`
  - `Head`: `Y 6 to 12`, `Z 4 to 8`, plus tiny `X` nods
- Arms:
  - `Shoulders`: lift `3` to `6`
  - `ForeArm`: alternating `12` to `25` curl
  - `Hand`: `8` to `18` fidgets
  - fingers: small asynchronous `5` to `12` curls on index and thumb
- Timing:
  - body sway slow, hands much faster
  - use irregular noise, not a perfect sine, for hands and head darts

### Confident

- Core pose:
  - `Hips`: `position.x` `8` to `14` units, `Y` rotation `8` to `16`
  - `Spine/Spine1/Spine2`: `X -2 / -3 / -2` to open the chest
  - `Neck`: `X -2`
  - `Head`: `X -4 to -8`, `Y 4 to 8`
- Arms:
  - `Shoulders`: roll back `4` to `8`
  - `Arm`: abduct slightly `8` to `15`
  - `ForeArm`: minimal motion, just `5` to `12` settle
  - `Hand`: keep open and quiet
- Timing:
  - slow `4` to `7s` cycle
  - wide but low-frequency weight shifts
  - avoid self-touching gestures

### Sleepy

- Core pose:
  - `Hips`: `position.y` bounce only `0.5` to `1.2`, but add slow `position.z` drift `4` to `8`
  - `Spine/Spine1/Spine2`: `X +4 / +6 / +4`
  - `Neck`: `X +6`
  - `Head`: `X +12 to +20`, `Z 4 to 8`
- Arms:
  - `Shoulders`: drop `4` to `8`
  - `Arm`: rotate inward `8` to `15`
  - `ForeArm`: soft curl `10` to `18`
  - `Hand`: loose, low-energy follow-through only
- Legs:
  - one `UpLeg` and `Leg`: slight bend `6` to `12`
  - feet stay planted
- Timing:
  - heavy `5` to `8s` cycle
  - long holds at the bottom of the head droop
  - recovery should be slower than descent

## Bottom Line

- `Breathing Idle` and `Idle` are balance-maintenance idles.
- `Standing Idle` is a restrained hold with tiny limb corrections.
- `Happy`, `Bored`, and `Thinking` are not just "more movement"; they each have a readable acting idea.
- For procedural generation, copy the architecture, not the exact curves: lead from hips, stage one dominant idea, offset the chain, and close the loop cleanly.
