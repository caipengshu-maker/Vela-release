# Eku VRC vs Current VRM Assessment

Date: 2026-03-26

## Executive Verdict

The practical answer is simple: the ready-made VRM inside `D:\BaiduNetdiskDownload\EKU\ver1.1` is byte-for-byte identical to Vela's current avatar, so a literal replacement gives zero product upside.

There is some real upside in the richer VRC source package behind that VRM: higher-resolution source textures, more facial morphs, alternate dress-up content, and more Unity/VRChat-side material and FX data. But Vela's current runtime is a VRM-specific pipeline, not a generic Unity/VRC avatar pipeline. To realize those gains, the team would need a new export and validation pass, plus likely expression/shader retuning.

For the product owner: the upside is not large enough to justify replacing the current avatar now. The source package is worth keeping as a future improvement source, not as an immediate swap candidate.

## Scope And Evidence

I inspected:

- Vela's current avatar configuration and runtime:
  - `vela.jsonc:95`
  - `src/core/config.js:100,336`
  - `src/vrm-avatar-stage.jsx:161-187`
  - `src/core/vrm-avatar-controller.js:559-593`, `878-900`, `927-1013`, `1405-1429`, `1661-1738`, `1762-1802`
  - `src/core/viseme-driver.js:9-27`, `214-264`
  - `src/core/emotion-presets.js:248-465`
  - `docs/ARCHITECTURE.md:114-120`, `143`
- External assets under `D:\BaiduNetdiskDownload\EKU\ver1.1`:
  - 115 files, about 4.17 GB total
  - 3 `.unitypackage`, 3 `.blend`, 3 `.fbx`, 78 `.png`, 21 `.psd`, 1 `.vrm`
- Binary comparison:
  - `assets\avatars\eku\Eku_VRM_v1_0_0.vrm`
  - `D:\BaiduNetdiskDownload\EKU\ver1.1\Eku_PC_v1_1_1\Eku_PC_v1_1_1\VRM\Eku_VRM_v1_0_0.vrm`
  - Same SHA-256: `D83AF4ECD8CD5D118A66F5E703904E7F46F72143D7020A44CE49921C21BE8CCC`

## 1. Likely Visual Quality Upside

### What is already in Vela today

Vela already ships the exact exported VRM from the external package. Current VRM facts:

- VRM 0.x export from UniVRM (`UniVRM-0.129.3`)
- 252 nodes
- 53 humanoid bones
- 17 VRM blend-shape groups
- 37 body morph targets plus 7 body-base morph targets
- 5 MToon materials
- 10 embedded textures

Important nuance: the current VRM is not using the full source-texture budget. The shipped VRM embeds:

- `Costume`, `Hair`, `Face`, `Body`: `2048x2048`
- AO masks: `2048x2048`
- Outline masks: `512x512`

The source package contains higher-resolution art:

- Default `Costume.png`, `Face.png`, `Hair.png`: `4096x4096`
- `Body.png`: `2048x2048`
- Many extra masks and material-support maps not present in the shipped VRM
- Alternate costume/add-on package `AsteriaLycee_forEku_v1_1_0` with more `4096x4096` textures, normal map, jewel/matcap/outline assets

### What upside is realistically available

There is a real but limited visual ceiling above the current VRM:

- Sharper face/hair/costume detail if re-exported from the 4K source textures
- Potentially richer facial nuance, because the FBX clearly contains many more face/eye/mouth targets than the high-level VRM preset list
- Extra wardrobe/dress-up possibilities from the Asteria Lycee package
- Potentially nicer material response in Unity due to masks, backlight, emission, matcap, fake-shadow, and other VRC-side assets

### Why that upside is smaller than it looks

Inside Vela's current runtime, most of the package's richest features do not automatically carry over:

- Vela renders VRM via `@pixiv/three-vrm`, not Unity/lilToon
- The current VRM export has already simplified the source materials down to 5 MToon materials and 10 images
- Many Unity/VRChat-side features are outside the current renderer entirely
- Vela already uses the current VRM's raw morph targets for emotional nuance, not just the 17 VRM presets

Net assessment on visual upside:

- Literal packaged-VRM replacement: none
- Proper source-model re-export for Vela: small-to-moderate likely gain
- Full VRC-look preservation inside Vela: potentially moderate gain, but only with a broader renderer/material project

## 2. Compatibility With Current VRM / Three.js / Mixamo / Lip-Sync / Expression Pipeline

### Current pipeline is strongly VRM-specific

Vela's runtime assumes a VRM avatar end to end:

- `src/core/vrm-avatar-controller.js:559-593` loads avatar data through `GLTFLoader` plus `VRMLoaderPlugin`, then requires `gltf.userData.vrm`
- `src/core/vrm-avatar-controller.js:878-900` mounts the VRM, calls `VRMUtils.rotateVRM0(vrm)`, uses `vrm.lookAt`, caches humanoid bones and morph targets, then retargets bundled Mixamo FBX animations onto the VRM
- `src/core/vrm-avatar-controller.js:1762-1802` uses `vrm-mixamo-retarget`, which is a VRM retarget flow, not a generic FBX-avatar flow
- `src/core/viseme-driver.js:9-27` maps speech visemes onto exact raw morph names like `mouth_straight`, `mouth_narrow`, `mouth_a_1`, `mouth_o_1`, `mouth_wide`, `mouth_u_1`
- `src/core/emotion-presets.js:248-465` hardcodes current-model raw morph targets such as `eye_relax`, `mouth_yaeba_2_L`, `eye_jito_2`, `eyebrow_confuse_1`, `mouth_H_narrow_R`, `extra_shy_2`, `extra_tear_1`

### What is compatible today

The current shipped VRM is fully compatible, because it is the exact file Vela already uses.

The source FBX/VRC content is not directly compatible:

- The `.unitypackage` content is Unity/VRChat-oriented
- The FBX is not a drop-in replacement for the runtime avatar slot
- The extra VRC controllers, expression menus, FX animations, prefabs, and ExMenu assets have no current execution path in Vela

### What looks promising in the source package

The FBX clearly contains:

- VRC viseme-related names: `vrc.v_aa`, `vrc.v_oh`, `vrc.v_ou`, `vrc.v_ih`, `vrc.v_th`, `vrc.v_nn`, `vrc.v_dd`, `vrc.v_kk`, `vrc.v_ff`, `vrc.v_ch`, `vrc.v_e`, `vrc.v_rr`, `vrc.v_ss`, `vrc.v_sil`
- Current-Vela-compatible mouth-shape names: `mouth_a_1`, `mouth_i_1`, `mouth_u_1`, `mouth_o_1`, `mouth_wide`, `mouth_narrow`
- Many extra face/eye/brow targets such as `eye_wink_*`, `eye_angry*`, `eyebrow_fun*`, `mouth_smile_*`, `face_jaw_*`

That means a carefully authored new VRM export could likely be made compatible with Vela's existing lip-sync and expression logic. But that compatibility is not automatic; it depends on the export preserving the current morph names and bone behavior.

### Compatibility verdict

- Packaged VRM: fully compatible, but already in use
- Raw VRC/Unity assets: not directly compatible
- New export from source assets: plausible, but unproven and likely to need tuning

## 3. Migration Cost

There are really three different "migration" options.

### Option A: Replace current avatar with the packaged VRM file

Effort:

- Less than 1 hour

Outcome:

- No meaningful change

Worth it:

- No

### Option B: Re-export the source FBX/Unity avatar to a new Vela-ready VRM

Expected work:

1. Import source into Unity/Blender and recreate a clean VRM export path
2. Preserve or remap humanoid bones, gaze, spring bones, and facial targets
3. Validate Mixamo retargeting in Vela
4. Validate viseme mapping and emotional expression presets
5. Retune any broken raw-morph names in `emotion-presets.js`
6. Re-test framing, idle motion, hands/fingers, and performance

Effort estimate:

- Fast technical experiment: about 0.5 to 1.5 days
- Production-ready replacement: about 3 to 7 days of engineer/technical-art time

### Option C: Try to preserve the richer VRC look/features in Vela

This is a larger renderer/features project, not an avatar swap.

Extra work would likely include:

- Custom shader/material handling beyond current VRM MToon behavior
- Handling dress-up variants, FX toggles, and maybe custom runtime controls
- Possibly new tooling for avatar authoring and regression testing

Effort estimate:

- Multiple weeks, not a small migration

## 4. Likely Breakages And Unknowns

### High-probability breakages

- Morph-name drift:
  - Vela's emotion presets target current raw morph names directly
  - A new export that renames or drops them will silently degrade expressions
- Viseme regression:
  - The lip-sync path expects exact mouth-shape names
  - If the export does not preserve them, speech animation quality drops immediately
- Bone/rest-pose changes:
  - Vela applies body overlays and arm/finger poses against current VRM assumptions
  - `src/core/vrm-avatar-controller.js:134-167`, `927-976`, `1049-1131` are model-sensitive
- Mixamo retarget regression:
  - Current idle/emotion animation flow is proven only on the shipped VRM
- Look-at / spring-bone / framing differences:
  - Any new export can shift head alignment, physics feel, and camera composition

### Medium-probability unknowns

- Texture memory/performance impact if you keep 4K assets in the new export
- Whether UniVRM export preserves the best facial targets exactly as needed
- Whether a new export lands as VRM 0.x or VRM 1.0, and whether current code paths behave identically

### Features from the VRC package that Vela would probably lose anyway

- VRChat expression menus and parameters
- VRC animator controllers and FX layers
- lilToon-specific material behavior
- Prefab toggles and dress-up logic unless separately reimplemented

## 5. Is The Gain Big Enough To Justify Replacing The Current Avatar Now?

No.

Why:

- The only ready-to-use VRM in the source package is already the current avatar
- The higher-value parts of the VRC package are not plug-compatible with Vela
- The tangible visible gain from a realistic near-term migration is probably modest:
  - likely somewhat sharper textures
  - possibly better facial nuance
  - maybe outfit variation if separately exported
- The engineering and technical-art risk is real, because Vela's current avatar system is tightly tuned to this exact VRM's bones and morph names

If avatar fidelity becomes a higher product priority later, the source package is a good candidate for a time-boxed improvement experiment. But that is not the same as saying it is worth replacing the current avatar now.

## Bottom Line

### Recommendation: DO NOT REPLACE NOW

Short rationale:

- The "replacement" VRM is already what Vela uses
- The extra value in the VRC source package requires a real re-authoring/export effort
- That effort is more likely to produce a modest improvement than a dramatic one inside the current runtime
- The probable gain does not justify the disruption and regression risk right now

If the team wants to explore this later, the right next step is a small, isolated experiment:

1. Export one new VRM from the 4K source textures
2. Validate Mixamo, lip-sync, gaze, and current emotion presets in a throwaway branch
3. Compare side-by-side with the current shipped VRM
4. Only then decide whether a broader avatar refresh is worth funding
