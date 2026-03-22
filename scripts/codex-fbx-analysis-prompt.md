# Analyze Mixamo FBX Animation Structure

## Goal
Deeply analyze the 6 Mixamo FBX idle animation files to understand:
1. What bones each animation affects and how
2. What rotation patterns/keyframes create each specific motion
3. What "emotion" or "mood" each animation conveys and why
4. How to reverse-engineer the knowledge to create new procedural animations

## Files to analyze
All in `public/assets/animations/`:
- `Breathing Idle.fbx`
- `Happy Idle.fbx`
- `Standing Idle.fbx`
- `Idle.fbx`
- `Bored.fbx`
- `Thinking.fbx`

## What to do

### Step 1: Write a Node.js analysis script
Create `scripts/analyze-fbx-animations.mjs` that:
- Loads each FBX file using three.js FBXLoader (in a browser-like env or by parsing the binary directly)
- For each AnimationClip, extracts:
  - All track names (which bones)
  - Track types (QuaternionKeyframeTrack, VectorKeyframeTrack, etc.)
  - Number of keyframes per track
  - Duration
  - Key rotation values at notable frames (start, peak movements, end)
  - Which bones have the MOST movement (highest variance in values)
  - Root/hips motion patterns

NOTE: three.js FBXLoader needs a browser environment (`self`, `document`). You may need to use a standalone FBX parser or mock the browser globals. Consider using `jsdom` + polyfills, or parse the FBX binary format directly. The npm package `fbx-parser` or `three-stdlib` might help.

If browser env is too hard to set up, alternative approach:
- Use Python with `pyfbx` or similar FBX SDK
- Or analyze the retargeted AnimationClip data by adding logging in the app

### Step 2: Document findings
Create `docs/fbx-animation-analysis.md` with:

For each animation:
- **Name**: e.g., "Breathing Idle"
- **Duration**: seconds
- **Active bones**: which bones move and how much
- **Motion pattern**: what the animation actually does (e.g., "chest expands/contracts rhythmically, slight weight shift")
- **Emotional read**: what mood it conveys and why
- **Key technique**: what makes it look natural (e.g., "overlapping action on spine chain", "asymmetric timing")

### Step 3: Synthesis
At the end of the doc, write a section "Reverse Engineering Guide" that explains:
- Common patterns across all idle animations
- How professional animators create natural-looking idles
- Rules/formulas we could use to generate NEW procedural idle variations
- Specific bone rotation recipes for emotions we don't have yet (shy, nervous, confident, sleepy)

## Constraints
- Working directory: `C:\Users\caipe\.openclaw\workspace\Vela`
- Don't modify any production code
- Output goes to `docs/fbx-animation-analysis.md` and `scripts/analyze-fbx-animations.mjs`
- If FBX parsing in Node is too painful, document why and suggest alternative approaches
- Take your time, think deeply about the motion patterns
