import { RELATIONSHIP_STAGES } from "./interaction-contract.js";

const DEEP_EMOTIONS = new Set([
  "happy",
  "sad",
  "affectionate",
  "playful",
  "concerned",
  "angry",
  "whisper",
  "surprised",
  "curious",
  "shy",
  "determined"
]);

function clampStage(stage) {
  const value = String(stage || "reserved").trim().toLowerCase();
  return RELATIONSHIP_STAGES.includes(value) ? value : "reserved";
}

function parseDate(value) {
  const timestamp = Date.parse(String(value || "").trim());
  return Number.isFinite(timestamp) ? timestamp : null;
}

function getCalendarDayDiff(startAt, endAt = new Date()) {
  const startTimestamp = parseDate(startAt);
  if (startTimestamp === null) {
    return 0;
  }

  const startDate = new Date(startTimestamp);
  const endDate = endAt instanceof Date ? endAt : new Date(endAt);
  const startDay = Date.UTC(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate()
  );
  const endDay = Date.UTC(
    endDate.getFullYear(),
    endDate.getMonth(),
    endDate.getDate()
  );

  return Math.max(0, Math.floor((endDay - startDay) / 86400000));
}

function normalizeTurns(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : fallback;
}

export class RelationshipTracker {
  constructor(persistedState = null) {
    this.stage = clampStage(persistedState?.stage);
    this.firstInteractionAt = persistedState?.firstInteractionAt || null;
    this.stageEnteredAt = persistedState?.stageEnteredAt || null;
    this.emotionalTurnCount = normalizeTurns(persistedState?.emotionalTurnCount, 0);
    this.lastInteractionAt = persistedState?.lastInteractionAt || null;
    this.totalTurnCount = normalizeTurns(persistedState?.totalTurnCount, 0);
    this.regressionMoodTurnsRemaining = normalizeTurns(
      persistedState?.regressionMoodTurnsRemaining,
      0
    );
  }

  recordTurn(emotionFromLLM) {
    const now = new Date();
    const nowIso = now.toISOString();

    if (!this.firstInteractionAt) {
      this.firstInteractionAt = nowIso;
    }

    if (!this.stageEnteredAt) {
      this.stageEnteredAt = nowIso;
    }

    this.lastInteractionAt = nowIso;
    this.totalTurnCount += 1;

    if (DEEP_EMOTIONS.has(String(emotionFromLLM || "").trim().toLowerCase())) {
      this.emotionalTurnCount += 1;
    }

    if (this.regressionMoodTurnsRemaining > 0) {
      this.regressionMoodTurnsRemaining -= 1;
    }

    this._checkProgression(now);
  }

  checkRegression(now = new Date()) {
    if (!this.lastInteractionAt || this.regressionMoodTurnsRemaining > 0) {
      return;
    }

    const daysSinceLastInteraction = getCalendarDayDiff(this.lastInteractionAt, now);

    if (daysSinceLastInteraction >= 14) {
      if (this.stage === "close") {
        this._regressStage(now);
        this.regressionMoodTurnsRemaining = 3;
        console.log("[relationship] regression mood set for 3 turns");
      } else if (this.stage === "warm") {
        this._regressStage(now);
        this.regressionMoodTurnsRemaining = 3;
        console.log("[relationship] regression mood set for 3 turns");
      }
      return;
    }

    if (this.stage === "close" && daysSinceLastInteraction >= 5) {
      this.regressionMoodTurnsRemaining = 3;
      console.log("[relationship] regression mood set for 3 turns");
      return;
    }

    if (this.stage === "warm" && daysSinceLastInteraction >= 3) {
      this.regressionMoodTurnsRemaining = 2;
      console.log("[relationship] regression mood set for 2 turns");
    }
  }

  _checkProgression(now) {
    const stageDays = getCalendarDayDiff(this.stageEnteredAt || this.firstInteractionAt, now);

    if (this.stage === "reserved" && stageDays >= 3 && this.emotionalTurnCount >= 5) {
      this._advanceStage(now);
      return;
    }

    if (this.stage === "warm" && stageDays >= 7 && this.emotionalTurnCount >= 12) {
      this._advanceStage(now);
    }
  }

  _advanceStage(now) {
    const currentIndex = RELATIONSHIP_STAGES.indexOf(this.stage);
    if (currentIndex < 0 || currentIndex >= RELATIONSHIP_STAGES.length - 1) {
      return;
    }

    const nextStage = RELATIONSHIP_STAGES[currentIndex + 1];
    console.log(`[relationship] stage ${this.stage} -> ${nextStage}`);
    this.stage = nextStage;
    this.stageEnteredAt = now.toISOString();
    this.emotionalTurnCount = 0;
  }

  _regressStage(now) {
    const currentIndex = RELATIONSHIP_STAGES.indexOf(this.stage);
    if (currentIndex <= 0) {
      return;
    }

    const nextStage = RELATIONSHIP_STAGES[currentIndex - 1];
    console.log(`[relationship] stage ${this.stage} -> ${nextStage}`);
    this.stage = nextStage;
    this.stageEnteredAt = now.toISOString();
    this.emotionalTurnCount = 0;
  }

  get isInRegressionMood() {
    return this.regressionMoodTurnsRemaining > 0;
  }

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
