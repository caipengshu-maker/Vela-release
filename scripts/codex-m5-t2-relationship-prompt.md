# M5-T2 Relationship Arc System — Codex Spec

## Goal
Implement a 3-stage relationship progression system (reserved → warm → close) that dynamically modulates Vela's personality, expression tendencies, camera behavior, proactive frequency, and topic boundaries. The system must feel like a real person growing closer to you, not a game mechanic.

## Design Decisions (user-confirmed)

### Stages
1. **reserved** — polite but distant. Uses 「你」. Calm/neutral expressions dominant. Rarely proactive. Won't initiate intimate topics. Camera mostly wide.
2. **warm** — naturally relaxed. Uses user's name/nickname. More expressive. Occasionally proactive. Starts sharing feelings. Camera: occasional close.
3. **close** — can be clingy, jealous, teasing. Uses intimate terms. Full expression range including shy/affectionate. Naturally proactive. Will bring up personal topics. Camera: close more frequent.

### Progression Triggers (hybrid: time × emotional depth)
- reserved → warm: ≥3 calendar days since first interaction AND ≥5 "emotionally deep" conversation turns
- warm → close: ≥7 calendar days in warm stage AND ≥12 "emotionally deep" turns in warm stage
- "Emotionally deep" = turns where LLM's emotion output is NOT calm/neutral (i.e., the conversation has real emotional content — happy, sad, affectionate, shy, concerned, etc.)

### Regression (personality-driven, not mechanical)
- **3+ days no contact in warm**: Vela acts slightly distant when user returns ("嗯…好久没找我了")
- **5+ days no contact in close**: Vela acts hurt/cold on purpose ("哦，你还记得我啊"), then gradually warms up over 2-3 turns
- **14+ days no contact**: drops one stage (close → warm, warm → reserved), but NEVER below reserved
- After user returns, regression mood lasts 2-3 turns then resolves naturally (not instant forgiveness, not permanent grudge)
- Minimum floor: reserved (never goes below)

### Visibility
- No explicit UI indicator (no relationship bar/number)
- Light hints through Vela's own dialogue (injected via persona prompt context)
- Example hints: "感觉跟你越来越熟了呢" (warm transition), "你最近是不是很忙啊…" (pre-regression)

## Implementation Plan

### 1. New file: `src/core/relationship.js`

```js
export const RELATIONSHIP_STAGES = ["reserved", "warm", "close"];

export class RelationshipTracker {
  constructor(persistedState = null) {
    // Load from persisted state or initialize defaults
    this.stage = persistedState?.stage || "reserved";
    this.firstInteractionAt = persistedState?.firstInteractionAt || null;
    this.stageEnteredAt = persistedState?.stageEnteredAt || null;
    this.emotionalTurnCount = persistedState?.emotionalTurnCount || 0;
    this.lastInteractionAt = persistedState?.lastInteractionAt || null;
    this.totalTurnCount = persistedState?.totalTurnCount || 0;
    this.regressionMoodTurnsRemaining = persistedState?.regressionMoodTurnsRemaining || 0;
  }

  // Call after each user message
  recordTurn(emotionFromLLM) {
    const now = Date.now();
    if (!this.firstInteractionAt) this.firstInteractionAt = now;
    if (!this.stageEnteredAt) this.stageEnteredAt = now;
    this.lastInteractionAt = now;
    this.totalTurnCount++;

    // Count non-calm/non-neutral emotions as "deep"
    const deepEmotions = ["happy","sad","affectionate","playful","concerned","angry","whisper","surprised","curious","shy","determined"];
    if (deepEmotions.includes(emotionFromLLM)) {
      this.emotionalTurnCount++;
    }

    // Check regression mood resolution
    if (this.regressionMoodTurnsRemaining > 0) {
      this.regressionMoodTurnsRemaining--;
    }

    // Check for stage progression
    this._checkProgression(now);
  }

  // Call on app startup to check regression
  checkRegression() {
    if (!this.lastInteractionAt) return;
    const now = Date.now();
    const daysSinceLastInteraction = (now - this.lastInteractionAt) / (1000 * 60 * 60 * 24);

    if (daysSinceLastInteraction >= 14) {
      // Drop one stage
      this._regressStage();
      this.regressionMoodTurnsRemaining = 3;
    } else if (this.stage === "close" && daysSinceLastInteraction >= 5) {
      // Don't drop stage, but set regression mood
      this.regressionMoodTurnsRemaining = 3;
    } else if (this.stage === "warm" && daysSinceLastInteraction >= 3) {
      this.regressionMoodTurnsRemaining = 2;
    }
  }

  _checkProgression(now) {
    const daysSinceStageEntry = (now - (this.stageEnteredAt || now)) / (1000 * 60 * 60 * 24);

    if (this.stage === "reserved" && daysSinceStageEntry >= 3 && this.emotionalTurnCount >= 5) {
      this._advanceStage(now);
    } else if (this.stage === "warm" && daysSinceStageEntry >= 7 && this.emotionalTurnCount >= 12) {
      this._advanceStage(now);
    }
  }

  _advanceStage(now) {
    const idx = RELATIONSHIP_STAGES.indexOf(this.stage);
    if (idx < RELATIONSHIP_STAGES.length - 1) {
      this.stage = RELATIONSHIP_STAGES[idx + 1];
      this.stageEnteredAt = now;
      this.emotionalTurnCount = 0; // Reset for next stage
    }
  }

  _regressStage() {
    const idx = RELATIONSHIP_STAGES.indexOf(this.stage);
    if (idx > 0) {
      this.stage = RELATIONSHIP_STAGES[idx - 1];
      this.stageEnteredAt = Date.now();
      this.emotionalTurnCount = 0;
    }
  }

  // Returns true if Vela should act hurt/distant right now
  get isInRegressionMood() {
    return this.regressionMoodTurnsRemaining > 0;
  }

  // Serialize for persistence
  toJSON() {
    return {
      stage: this.stage,
      firstInteractionAt: this.firstInteractionAt,
      stageEnteredAt: this.stageEnteredAt,
      emotionalTurnCount: this.emotionalTurnCount,
      lastInteractionAt: this.lastInteractionAt,
      totalTurnCount: this.totalTurnCount,
      regressionMoodTurnsRemaining: this.regressionMoodTurnsRemaining
    };
  }
}
```

### 2. Modify `src/core/context-builder.js`

Add a relationship context section to the system prompt that changes based on stage:

```
## Current Relationship Context
- Stage: {stage}
- You've known this person for {days} days
- {stage-specific behavioral instructions}
```

**Stage-specific persona modulation** (inject BEFORE the persona block):

**reserved:**
```
You are meeting this person for the first time. Be polite, warm but with clear boundaries. Use 「你」 not their name. Don't ask overly personal questions. Don't use cutesy language. Keep appropriate emotional distance. You're friendly but reserved.
```

**warm:**
```
You've gotten to know this person over the past few days. You feel comfortable around them. Use their name naturally. You can share your own feelings and ask about theirs. Your tone is relaxed and natural, occasionally playful. You're starting to care about them genuinely.
```

**close:**
```
This person is very important to you. You feel safe being vulnerable with them. You can be playful, teasing, occasionally jealous or clingy (in a cute way). You sometimes use pet names. You remember and reference past conversations with warmth. You're not afraid to express missing them or wanting their attention.
```

**Regression mood overlay** (prepend when `isInRegressionMood` is true):
```
You haven't heard from this person in a while and you're a bit hurt. Don't be hostile, but show that you noticed their absence. Be slightly colder than usual for the first 2-3 messages, then gradually warm back up. Examples: "哦，你还记得我啊", "嗯…你最近很忙吧", "没事，我又不会消失". Don't be dramatic — be subtly hurt, like a real person would.
```

### 3. Modify `src/core/proactive.js`

Scale proactive frequency by relationship stage:
- reserved: multiply base probability by 0.3 (rarely proactive)
- warm: multiply by 0.7
- close: multiply by 1.2 (slightly more than default)

### 4. Modify `src/core/vela-core.js`

- Initialize `RelationshipTracker` from persisted state on startup
- Call `checkRegression()` on app open
- Call `recordTurn(emotion)` after each LLM response (use the emotion from the performance prefix)
- Save relationship state to `{storageRoot}/state/relationship.json` after each turn
- Pass `relationshipStage` to context builder and proactive engine

### 5. Modify `src/core/emotion-presets.js`

The camera override conditions already exist (e.g., `when: { relationshipStage: "reserved" }, use: "wide"`). Make sure the avatar controller reads the current relationship stage and applies these overrides. Currently the overrides are defined but never evaluated.

### 6. Files to read first
- `src/core/context-builder.js` — understand current prompt structure
- `src/core/proactive.js` — understand current proactive trigger logic
- `src/core/vela-core.js` — understand main orchestration, state persistence patterns
- `src/core/emotion-presets.js` — see existing `relationshipStage` override branches
- `src/core/interaction-contract.js` — see `RELATIONSHIP_STAGES` enum already defined

## Constraints
- Do NOT add npm dependencies
- Do NOT modify LLM protocol (the `[vela:emotion=...]` prefix format stays the same)
- Do NOT modify TTS code
- Relationship state persisted as JSON, not in memory only
- Stage transitions should log to console for debugging
- All code must pass `npm run build`
- Keep the relationship logic simple and readable — this is NOT a dating sim engine

## Deliverables
1. `src/core/relationship.js` — RelationshipTracker class
2. Modified `src/core/context-builder.js` — stage-aware persona injection
3. Modified `src/core/proactive.js` — frequency scaling
4. Modified `src/core/vela-core.js` — tracker lifecycle + persistence
5. Modified `src/core/vrm-avatar-controller.js` — evaluate camera override conditions
6. `npm run build` must pass

## Tech Debt Note
- The P-key preset demo mode in `vrm-avatar-stage.jsx` must be stripped before production release (not part of this task)
