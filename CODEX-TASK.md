# CODEX-TASK: Fix Vela Splash → Title → Main UI Loading Sequence

## Context

The app has three loading phases:
1. **K Studio splash** (`SplashScreen.jsx`) — white bg, shows K Studio logo, timed 2.5s + fade out
2. **Vela title screen** (`VelaTitleScreen.jsx`) — black bg, shows Vela wordmark logo + thin progress line
3. **Main UI** — app-shell with VRM avatar + chat panel

## Current Bugs (all visual)

1. **Flash between K Studio → Vela title**: When K Studio splash fades out, the main app background (`#f4ebe6` warm beige) flashes briefly before Vela title screen's fade-in animation reaches full opacity. Looks jarring.

2. **App background visible during transitions**: The `app-shell` background color bleeds through during overlay transitions because both overlays use fade animations (opacity 0→1 and 1→0).

3. **VRM "hair dropping from sky"**: When the main UI first appears, the VRM character's hair visually drops from above as hair physics initialize. The title screen should fully cover this.

## Desired Behavior

- K Studio logo fades in on white bg, holds, fades out
- Vela title screen is ALREADY fully visible underneath (no gap, no flash)
- While Vela title shows, VRM + bootstrap load behind it (invisible to user)
- After VRM is loaded AND settled (hair physics stable), Vela title fades out
- Main UI appears fully ready — no flash, no falling hair, no background color bleed

## Architecture Direction

The key insight: **both overlay screens should be pre-rendered and layered by z-index, not conditionally mounted/unmounted.** The Vela title screen should be at full opacity from the start, hidden behind the K Studio splash (higher z-index). When K Studio fades out, Vela title is already there.

Suggested z-index stack:
- K Studio splash: z-index 9999 (white bg, covers everything)
- Vela title screen: z-index 9998 (black bg, covers content)
- Main content: z-index 1 (always renders, loads VRM behind overlays)

## Files to Modify

- `src/App.jsx` — restructure the return JSX: render all layers simultaneously, not ternary/conditional
- `src/SplashScreen.jsx` — ensure it overlays properly and only fades OUT (starts at full opacity)
- `src/VelaTitleScreen.jsx` — should be rendered from mount at full opacity (no fade-in needed since it's behind K Studio), only fades out when ready
- `src/styles.css` — ensure `.app-shell.is-title-active` keeps black bg; fix any z-index/opacity issues

## State Machine

```
splashDone=false, titleDone=false, isSettled=false
  → K Studio splash visible (z:9999), Vela title visible behind (z:9998), content loading behind (z:1)

splashDone=true, titleDone=false, isSettled=false
  → K Studio unmounts (faded out), Vela title now visible, content still loading

splashDone=true, titleDone=false, isSettled=true
  → Vela title progress fills to 100%, begins fade-out

splashDone=true, titleDone=true
  → Vela title unmounts, content fully visible
  → Remove is-title-active class from app-shell
```

## Constraints

- `isSettled` should be set ~600ms AFTER `setIsLoading(false)` to let VRM render first frame + hair physics settle
- K Studio splash timing: fade-in 600ms, hold 2500ms, fade-out 800ms (keep existing)
- Vela title: NO fade-in animation needed (it's pre-rendered behind splash). Only needs fade-out when done.
- Title logo path: `D:\Vela\assets\splash\vela-title-logo.png` (loaded via `window.vela.readBinaryFile`)
- Progress line behavior: crawls toward 70% while loading, rushes to 100% when `isReady` becomes true
- Build must pass: `npx vite build`

## Verification

After changes:
1. `npx vite build` succeeds
2. No conditional rendering of overlays that could cause mount/unmount flash
3. Vela title screen starts at opacity 1 (no is-entering fade-in)
4. K Studio splash z-index > Vela title z-index > content z-index
5. `app-shell` bg is black while title is active, transitions to normal after
