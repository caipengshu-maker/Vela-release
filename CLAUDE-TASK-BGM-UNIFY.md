# TASK: Unify BGM controls + fix slider CSS

## Problem (confirmed by user screenshot)
1. There are TWO independent BGM controls that don't sync:
   - Avatar panel speaker toggle button → controls `bgmEnabled` (boolean state)
   - Settings modal BGM Volume slider → controls `bgmVolume` (0-100 state)
   They are independent states. Toggling one doesn't update the other.

2. The range slider thumb doesn't visually reach 0 position (CSS issue).

## Fix: Eliminate `bgmEnabled` entirely

### Step 1: Remove `bgmEnabled` state from App.jsx
- Delete `const [bgmEnabled, setBgmEnabled] = useState(true);`
- Derive it: `const bgmEnabled = Number(state.audio?.bgmVolume ?? 42) > 0;`
- This means bgmVolume = 0 → bgm is off, bgmVolume > 0 → bgm is on.

### Step 2: Change avatar panel speaker toggle
- Instead of toggling a boolean, it should toggle bgmVolume between 0 and a stored "last volume":
  - Add a ref: `const lastBgmVolumeRef = useRef(42);`
  - When clicking the speaker button:
    - If bgmVolume > 0: save current volume to ref, then set bgmVolume to 0 (via IPC update-settings or direct state)
    - If bgmVolume === 0: restore from ref
  - Call bgm.setVolume() accordingly

### Step 3: Update the BGM loading effect
- Remove `bgmEnabled` from the dependency array
- Use the derived `bgmEnabled` (from bgmVolume > 0) for the enabled check
- The effect should depend on `[state.audio?.bgmVolume, isLoading, state.onboarding?.required]` or just keep existing deps but use derived value

### Step 4: Fix slider CSS
In `src/styles.css`, add proper range input styling:
```css
.settings-slider-block input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: rgba(19, 32, 38, 0.12);
  outline: none;
  margin: 8px 0;
}

.settings-slider-block input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #2d7d77;
  cursor: pointer;
  border: 2px solid white;
  box-shadow: 0 2px 6px rgba(0,0,0,0.15);
}
```
This ensures the thumb can visually reach position 0 without any dead zone.

### Step 5: Make Settings modal reflect external changes
- When Settings modal opens (`isOpen` becomes true), it reads `initialValues.bgmVolume`
- Since the speaker toggle now directly changes `bgmVolume` (in state.audio), the Settings modal will naturally show the correct value when opened.

## Key constraint
- `bgmControllerRef.current.setVolume(v)` and `bgm.setEnabled(v > 0)` should both be called whenever bgmVolume changes
- The BgmController itself (bgm-controller.js) should NOT need changes — it already has setVolume() and setEnabled()

## Verification
1. npm run build passes
2. Settings slider at 0 → silence + thumb visually at 0
3. Avatar speaker toggle OFF → Settings slider shows 0 when opened
4. Avatar speaker toggle ON → Settings slider shows restored volume
5. No double BGM sources
6. Commit: `fix(audio): unify BGM controls into single bgmVolume state`
