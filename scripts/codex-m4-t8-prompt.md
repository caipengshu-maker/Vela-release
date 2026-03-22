# M4-T8: Lightweight Proactive Mechanism for Vela

## Goal
Add a lightweight proactive system so Vela can **initiate conversation** naturally, instead of only responding to user messages.

## Existing Infrastructure (DO NOT rewrite these, build on top)
- `src/core/context-providers/time-provider.js` — already provides time of day, day of week, season, minutes since last message
- `src/core/context-providers/weather-provider.js` — already calls Open-Meteo API, caches 30 min, returns weather data. Currently uses `config.user.location.city` to look up coordinates from a hardcoded city map
- `src/core/context-fusion.js` — already formats time/weather/memory into a system prompt block. Has `isWeatherWorthMentioning()` that only surfaces rain, extreme temp, or high wind
- `src/core/vela-core.js` — `buildAwarenessPacket()` assembles context, `handleUserMessage()` processes user input

## What to Build

### 1. Dynamic Geolocation (weather-provider.js enhancement)
- Add a `getLocationFromBrowser()` function that uses `navigator.geolocation.getCurrentPosition()` to get lat/lon
- Cache the result for 1 hour (location doesn't change fast)
- In `getWeatherAwareness()`, try browser geolocation FIRST; fall back to `config.user.location.city` if geolocation is denied/unavailable
- This way weather works with dynamic location without breaking the existing city-based fallback

### 2. Proactive Greeting System (NEW file: `src/core/proactive.js`)
Create a new module that decides when Vela should speak first.

**Core design principles:**
- Maximum 3 proactive messages per day
- Randomness > regularity (don't always greet on every app open)
- Two layers:
  - Layer 1: App open greeting (morning/afternoon/evening, but NOT every time)
  - Layer 2: In-conversation natural triggers (long silence, late night, etc.)

**`shouldGreetOnOpen(persistedState)` function:**
- Returns `{ shouldGreet: boolean, greetingContext: string }` 
- Greeting context is injected into the system prompt so the LLM generates a natural greeting (NOT a hardcoded message)
- Logic:
  - Track `proactiveCountToday` and `lastProactiveAt` in persisted state
  - If `proactiveCountToday >= 3`, return false
  - If last greeting was < 2 hours ago, return false  
  - Apply a **random chance**: 70% chance to greet if > 4 hours since last chat, 40% chance if 1-4 hours, 20% if < 1 hour
  - This makes it feel natural/random, not formulaic
- Greeting context examples:
  - Morning + rain: "现在是早上，外面在下雨。你可以自然地关心用户是否需要带伞。"
  - Late night (after 23:00): "现在是深夜了。你可以温柔地问用户怎么还没睡。"
  - Long absence (> 1 day): "用户已经很久没来了。你可以表达自然的想念。"
  - Normal open: "用户刚打开应用。你可以自然地打个招呼。"

**`checkInConversationTrigger(timeAwareness, weather, persistedState)` function:**
- Returns `{ shouldTrigger: boolean, triggerContext: string }`
- Called periodically (e.g., every few minutes when app is open but user hasn't typed)
- Possible triggers:
  - User hasn't typed for > 30 minutes but app is still open
  - It's late and they've been chatting a while (> 1 hour continuous)
  - Weather just changed to rain (compare with last check)
- Same daily limit of 3 applies
- Also random: even when trigger conditions are met, only fire with 50% chance

### 3. Proactive Message Flow (vela-core.js enhancement)
- Add `async generateProactiveMessage(greetingContext)` method to VelaCore
- This builds the awareness packet + injects `greetingContext` as an extra system instruction
- Then calls the LLM with NO user message, asking it to generate a natural greeting
- The LLM response should include avatar state (emotion, expression) just like normal responses
- Returns the same app state format as `handleUserMessage()`

### 4. App.jsx Integration
- On app mount (or when becoming visible), call `shouldGreetOnOpen()` 
- If yes, call `generateProactiveMessage()` and display the greeting in chat
- Set up a periodic check (every 5 minutes) that calls `checkInConversationTrigger()`
- Display proactive messages with the same UI as assistant messages

### 5. Persisted State Updates (session-state.js)
- Add fields to persisted state:
  - `proactiveCountToday: number` (reset daily)
  - `lastProactiveAt: string (ISO)` 
  - `lastProactiveDate: string (YYYY-MM-DD)` (for daily reset)
  - `lastWeatherCondition: string` (for detecting weather changes)
  - `cachedLocation: { lat, lon, cachedAt }` (for geolocation cache)

## Emotion/Expression Sync
When Vela generates a proactive message, the LLM should output avatar emotion/expression as part of its normal response format. The greeting context should hint at appropriate emotions:
- Morning greeting → relaxed/happy
- Late night concern → calm with slight worry
- Rain warning → caring/concerned
- Missing user → shy/happy mix

## File Changes Summary
- `src/core/context-providers/weather-provider.js` — add `getLocationFromBrowser()`, modify `getWeatherAwareness()` to try geolocation first
- `src/core/proactive.js` — NEW file, greeting/trigger logic
- `src/core/vela-core.js` — add `generateProactiveMessage()`, call proactive checks
- `src/App.jsx` — integrate proactive greeting on mount and periodic checks
- `src/core/session-state.js` — add proactive tracking fields

## Constraints
- Zero new npm dependencies
- Working directory: `C:\Users\caipe\.openclaw\workspace\Vela`
- Build must pass: `npm run build`
- Tests must pass: `npm run verify:core`
- Keep all existing functionality working
- Weather provider must remain backward compatible (city-based fallback still works)
- All proactive text is generated by the LLM, NOT hardcoded strings
- Chinese language for all user-facing context/hints
