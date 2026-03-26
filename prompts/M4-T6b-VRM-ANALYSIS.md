# M4-T6b: VRM Model Deep Analysis + Natural Idle Animations

## Phase 1: Analyze the VRM model (MUST complete before Phase 2)

Write a Node.js script `scripts/analyze-vrm.mjs` that:

1. Reads the VRM/GLB file at `D:/Vela/assets/avatars/eku/Eku_VRM_v1_0_0.vrm`
2. Parses the GLB binary format (header + JSON chunk + binary chunk)
3. Extracts from the GLTF JSON:
   - All nodes with their names, positions, rotations, scales
   - The `VRMC_vrm` extension → `humanoid.humanBones` mapping (bone name → node index)
   - The `VRMC_vrm` extension → `specVersion`
   - All skin/joint references
4. For each humanoid bone, prints:
   - Bone name (e.g., `leftUpperArm`)
   - Node index and node name
   - Rest position (translation)
   - Rest rotation (quaternion)
   - Parent node index and name
   - Children node indices and names
5. Specifically enumerate ALL hand/finger bones available:
   - leftHand, rightHand
   - All thumb/index/middle/ring/little bones (proximal/intermediate/distal)
6. Print a summary: total bones found, which standard VRM bones are present vs missing
7. Also check if there are any morph targets / blend shapes on the mesh nodes

Run this script with `node scripts/analyze-vrm.mjs` and save the full output to `docs/vrm-bone-analysis.txt`.

This script must use ONLY Node.js built-in modules (fs, path, buffer). No npm dependencies.

## Phase 2: Implement natural idle animations based on analysis

Based on the REAL bone data from Phase 1, modify `src/core/vrm-avatar-controller.js` to:

### 2a. Relaxed hand pose
- Add finger bone manipulation so hands look natural (slightly curled fingers, not flat T-pose hands)
- Use the actual finger bone names found in Phase 1
- Apply this as the default rest pose for hands (set once on mount, not per-frame)
- Cache finger bone nodes in `_cacheBones()` alongside existing arm bones

### 2b. Enhanced idle motion pool
Replace the current simple idle motions with richer, multi-bone choreographed gestures:

1. **Hair touch (right hand)**: Right upper arm raises ~45°, elbow bends ~90°, wrist rotates toward head. Head tilts slightly left to match. 3-4s hold.
2. **Weight shift**: Hips sway left/right with slight upper body counter-lean. 4-5s hold.
3. **Hands clasped in front**: Both arms move inward, elbows bend more, hands meet at waist level. 5-8s hold.
4. **Hand on hip (left)**: Left upper arm abducts, elbow bends, right arm stays relaxed. 4-6s hold.
5. **Shoulder shrug**: Both shoulders rise slightly, hold 1s, release. Quick gesture.
6. **Gentle stretch**: Spine extends back slightly, arms open a bit. 3s hold.
7. **Gaze wander + micro-smile**: LookAt target drifts, expression shifts to relaxed briefly.

Rules:
- Each gesture uses the ACTUAL bone names from Phase 1 analysis
- Each gesture has ramp-in (0.5-1.0s), hold, ramp-out (0.5-1.0s) phases
- Gestures don't overlap — finish one before starting another
- Random interval 12-25s between gestures
- Never repeat the same gesture consecutively
- When presence changes away from idle/listening, smoothly cancel current gesture
- All rotations use the existing `dampFactor`/`dampNumber` helpers for smooth interpolation

### 2c. Arm sway improvements
- Use actual bone axis data from Phase 1 to set correct sway axes
- Keep left/right asymmetry and different frequencies

## Files to modify
- `scripts/analyze-vrm.mjs` — NEW, Phase 1 analysis script
- `docs/vrm-bone-analysis.txt` — NEW, Phase 1 output
- `src/core/vrm-avatar-controller.js` — Phase 2 changes

## Files NOT to modify
- Do not touch `interaction-contract.js`, `App.jsx`, `styles.css`, `vela-core.js`, or any other file
- Do not add npm dependencies

## Verification
- `node scripts/analyze-vrm.mjs` must run and produce output
- `npm run build` must pass after Phase 2 changes
- Phase 2 code must reference only bones that actually exist in the model (from Phase 1)

## Technical notes
- VRM file is GLB format: 12-byte header, then chunks (JSON chunk type 0x4E4F534A, binary chunk type 0x004E4942)
- The JSON chunk contains standard GLTF JSON with VRM extensions
- Bone manipulation in the controller happens AFTER `this.vrm.update(delta)` for raw-bone fallback
- Existing helpers: `dampNumber`, `dampFactor`, `dampVector`, `createBonePose`
- `VRMHumanBoneName` enum from `@pixiv/three-vrm` has PascalCase keys
- Current arm system uses `armBones` Map and `armTargetOffsets` Map
- Current idle motion system uses `idleMotion` state object and `idlePoseDeltas`
