# AX-L3: HeadAudio Viseme Lip Sync Integration

## Goal
Replace the current amplitude-only lip sync with HeadAudio viseme detection. The avatar's mouth should form different shapes (aa/oh/ee/ou) matching the actual speech audio, not just open/close based on volume.

## Background
- HeadAudio: `npm install headaudio` (MIT, by met4citizen)
- It's an AudioWorklet node that analyzes audio waveform and outputs Oculus viseme blend shape values in real time
- Pre-trained model: `model-en-mixed` (English-trained but basic vowel shapes are cross-language)
- Latency: 50-100ms (compensated with DelayNode)
- Our audio comes from MiniMax TTS via WebSocket as hex-encoded MP3 chunks, decoded and played in the renderer process

## Architecture

### Current audio flow
```
MiniMax WebSocket → hex MP3 chunks → audio-player.js → HTML5 Audio element → speakers
```

### Target audio flow
```
MiniMax WebSocket → hex MP3 chunks → AudioContext + MediaElementSource
  ├→ speakers (via destination)
  └→ HeadAudio AudioWorklet → viseme values → VRM mouth morphs
```

## What To Do

### 1. Install HeadAudio
```
npm install headaudio
```

### 2. Set up AudioWorklet in the renderer

In `src/audio-player.js` (or a new `src/core/viseme-driver.js`):

- Create an AudioContext when TTS playback starts
- Register the HeadAudio worklet processor
- Create a HeadAudioNode
- Load the pre-trained model (ship `model-en-mixed.bin` in `public/assets/` or use CDN)
- Connect the audio source → HeadAudio node (for analysis, no audio output from this node)
- Connect the audio source → AudioContext.destination (for actual playback)

Important: The current audio playback uses HTML5 `<audio>` element with blob URLs. To tap into the audio for HeadAudio, you need:
```javascript
const audioCtx = new AudioContext();
const source = audioCtx.createMediaElementSource(audioElement);
// HeadAudio node connects to source for analysis
// source also connects to destination for playback
source.connect(headAudioNode); // viseme analysis
source.connect(audioCtx.destination); // actual playback
```

### 3. Map Oculus visemes to VRM morph targets

HeadAudio outputs Oculus viseme names. Map them to our VRM model's mouth morph targets:

```javascript
const VISEME_TO_VRM_MORPH = {
  viseme_sil: null,              // silence, no morph
  viseme_PP: "mouth_straight",   // bilabial (p, b, m)
  viseme_FF: "mouth_narrow",     // labiodental (f, v)
  viseme_TH: "mouth_straight",   // dental (th)
  viseme_DD: "mouth_a_1",        // alveolar (d, t, n)
  viseme_kk: "mouth_narrow",     // velar (k, g)
  viseme_CH: "mouth_narrow",     // postalveolar (ch, j, sh)
  viseme_SS: "mouth_straight",   // sibilant (s, z)
  viseme_nn: "mouth_straight",   // nasal (n, ng)
  viseme_RR: "mouth_o_1",        // approximant (r)
  viseme_aa: "mouth_a_1",        // open vowel (a, ah)
  viseme_E:  "mouth_wide",       // front vowel (e, eh)
  viseme_ih: "mouth_straight",   // near-close (i, ih)
  viseme_oh: "mouth_o_1",        // mid-back (o, oh)
  viseme_ou: "mouth_u_1",        // close-back (u, oo)
};
```

### 4. Apply viseme values to VRM controller

In `vrm-avatar-controller.js`:

- Add a method `setVisemeWeights(visemeMap)` that receives a map of morph target names → weights
- In the render loop, when viseme data is active, use viseme-driven mouth morphs INSTEAD of the current amplitude-driven `mouth_open` approach
- When viseme data is NOT active (no audio playing), fall back to current amplitude behavior
- Viseme weights should be smoothed (lerp/damp, ~8-10 strength) to avoid jittery transitions

### 5. Wire it together

- When TTS starts playing → activate HeadAudio pipeline
- HeadAudio `onvalue` callback → update viseme weights on the controller
- When TTS stops → deactivate, revert to idle mouth state
- Call `headaudio.update(deltaMs)` in the animation loop

### 6. Ship the model file

- Copy `node_modules/headaudio/dist/model-en-mixed.bin` to `public/assets/headaudio/model-en-mixed.bin`
- Load from `/assets/headaudio/model-en-mixed.bin` at runtime

### 7. Fallback

If HeadAudio fails to initialize (AudioWorklet not supported, model load fails), fall back to the current amplitude-based lip sync silently. Log a warning but don't crash.

## Constraints
- Do NOT remove the existing amplitude lip sync code — keep it as fallback
- Do NOT change TTS WebSocket or API logic
- Do NOT change emotion presets
- HeadAudio model file should be in `public/assets/headaudio/`, NOT bundled by Vite
- `npm run build` must pass
- Add console logs for viseme activity: `[VRM][viseme] active=true/false` when lip sync mode switches

## Files to create/modify
1. `src/core/viseme-driver.js` (NEW) — HeadAudio setup, model loading, viseme mapping
2. `src/audio-player.js` — wire AudioContext + HeadAudio into playback pipeline
3. `src/core/vrm-avatar-controller.js` — add `setVisemeWeights()`, integrate into render loop
4. `public/assets/headaudio/model-en-mixed.bin` — copy from node_modules after install
