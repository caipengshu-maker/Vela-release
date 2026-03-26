# VRC Model Analysis: Eku ver1.1

## Task
Analyze the VRChat model at `D:\BaiduNetdiskDownload\EKU\ver1.1` and produce a feasibility report for migrating it to Vela (Electron + three.js + @pixiv/three-vrm).

## Phase 1: Directory & File Inventory
1. List ALL files in `D:\BaiduNetdiskDownload\EKU\ver1.1` recursively (with sizes)
2. Identify file types: .fbx, .unitypackage, .prefab, .mat, .png, .psd, .tga, .shader, .anim, .controller, .vrm, .vrc*, etc.
3. Note the Unity project structure if present (Assets/, ProjectSettings/, etc.)

## Phase 2: Model Analysis
For each .fbx or .blend file found:
1. Parse and list bone hierarchy (if possible with available tools)
2. Count total bones, identify humanoid bones
3. List mesh names and vertex counts
4. List material names and texture references
5. Check for blend shapes / morph targets

For any .vrm files found:
1. Run `node C:\Users\caipe\.openclaw\workspace\Vela\scripts\analyze-vrm.mjs` (modify VRM_PATH if needed)
2. Compare bone count and quality with the existing Eku VRM at `D:\Vela\assets\avatars\eku\Eku_VRM_v1_0_0.vrm`

## Phase 3: Comparison with Current VRM
The current VRM model (`Eku_VRM_v1_0_0.vrm`) has:
- VRM 0.0 format, 252 nodes, 53/54 humanoid bones (missing: jaw)
- 17 blend shape groups (Neutral, A/I/U/E/O, Blink, Joy, Angry, Sorrow, Fun, LookUp/Down/Left/Right, Blink_L/R)
- 37 morph targets on Body mesh
- 17 skins
- Known issue: finger bones exist but may not be properly rigged (fingers appear stuck in spread position)

Compare:
- Bone quality and completeness
- Blend shape / expression richness
- Texture resolution and material quality
- Finger rigging quality specifically
- Any additional features (physics, dynamic bones, cloth, etc.)

## Phase 4: Migration Feasibility Report
Produce a report covering:
1. **Format**: What format is the VRC model in? Can it be directly loaded by three.js/three-vrm?
2. **Conversion path**: What tools/steps are needed to convert VRC → VRM or VRC → GLTF?
   - UniVRM export from Unity?
   - Blender import/export pipeline?
   - VRoid Studio?
   - cats-blender-plugin?
3. **Effort estimate**: How much work to migrate (hours, complexity)?
4. **Quality delta**: Would the VRC model be meaningfully better than the current VRM?
5. **Risk**: What could go wrong? (shader incompatibility, missing features, etc.)
6. **Recommendation**: Migrate or not? If yes, which path?

## Output
Save the full report to `C:\Users\caipe\.openclaw\workspace\Vela\docs\vrc-model-analysis.md`

## Constraints
- Do NOT install any npm packages
- Do NOT modify any source code
- Read-only analysis only
- If .fbx parsing is not possible without tools, note that and analyze what you can from file metadata and Unity project files
