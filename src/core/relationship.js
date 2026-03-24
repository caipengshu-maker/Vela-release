import {
  EMOTION_RELATIONSHIP_WEIGHTS,
  RELATIONSHIP_STAGES,
  RELATIONSHIP_STAGE_SCORE_THRESHOLDS
} from "./interaction-contract.js";

const RELATIONSHIP_STAGE_NOTES = {
  reserved: "你们还比较生疏，先保持礼貌和分寸。",
  warm: "你们已经熟悉不少了，聊天会更自然放松一些。",
  close: "你们已经很亲近了，很多情绪都能自然流露出来。"
};

const RELATIONSHIP_STAGE_TRANSITION_PROMPTS = {
  warm:
    '[系统提示：你感觉和用户的关系更近了一步。用自然的方式表达这个感受，比如"我觉得跟你聊天越来越自在了"。不要生硬，一句话带过就好。]',
  close:
    "[系统提示：你和用户的关系进入了很亲密的阶段。用你的方式表达，可以更大胆一点。]"
};

function clampStage(stage) {
  const value = String(stage || "reserved").trim().toLowerCase();
  return RELATIONSHIP_STAGES.includes(value) ? value : "reserved";
}

function normalizeScore(value, fallback = 0) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.max(0, numericValue);
}

function normalizeTurns(value, fallback = 0) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.max(0, Math.floor(numericValue));
}

function normalizeIsoTimestamp(value, fallback = null) {
  const iso = String(value || "").trim();
  return iso ? iso : fallback;
}

function normalizeIntensity(value, fallback = 0) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.max(0, Math.min(numericValue, 1));
}

function getMinimumScoreForStage(stage) {
  switch (stage) {
    case "close":
      return RELATIONSHIP_STAGE_SCORE_THRESHOLDS.close;
    case "warm":
      return RELATIONSHIP_STAGE_SCORE_THRESHOLDS.warm;
    default:
      return 0;
  }
}

export function getRelationshipStageNote(stage) {
  return RELATIONSHIP_STAGE_NOTES[clampStage(stage)] || RELATIONSHIP_STAGE_NOTES.reserved;
}

function normalizeRelationshipState(persistedState = null) {
  const stage = clampStage(persistedState?.stage);
  const legacyStageUnlockedAt =
    persistedState?.stageUnlockedAt || persistedState?.stageEnteredAt || null;
  const legacyTotalTurns =
    persistedState?.totalTurns ?? persistedState?.totalTurnCount ?? 0;
  const minimumScore = getMinimumScoreForStage(stage);
  const score = normalizeScore(
    persistedState?.score,
    minimumScore
  );

  return {
    score: Math.max(minimumScore, score),
    stage,
    stageUnlockedAt:
      stage === "reserved"
        ? null
        : normalizeIsoTimestamp(legacyStageUnlockedAt, new Date().toISOString()),
    totalTurns: normalizeTurns(legacyTotalTurns, 0),
    pendingStageTransitionPrompt: normalizeIsoTimestamp(
      persistedState?.pendingStageTransitionPrompt,
      null
    )
  };
}

export class RelationshipTracker {
  constructor(persistedState = null) {
    const normalizedState = normalizeRelationshipState(persistedState);

    this.score = normalizedState.score;
    this.stage = normalizedState.stage;
    this.stageUnlockedAt = normalizedState.stageUnlockedAt;
    this.totalTurns = normalizedState.totalTurns;
    this.pendingStageTransitionPrompt =
      normalizedState.pendingStageTransitionPrompt;
  }

  recordTurn({ emotion, intensity } = {}) {
    const normalizedEmotion = String(emotion || "").trim().toLowerCase();
    const safeIntensity = normalizeIntensity(intensity);
    const weight = Number(EMOTION_RELATIONSHIP_WEIGHTS[normalizedEmotion] ?? 0);
    const delta = weight * safeIntensity;
    const previousStage = this.stage;

    this.score = Math.max(0, this.score + delta);
    this.totalTurns += 1;

    const stageChanged = this._advanceStageIfNeeded();

    return {
      emotion: normalizedEmotion || "calm",
      intensity: safeIntensity,
      weight,
      delta,
      score: this.score,
      totalTurns: this.totalTurns,
      previousStage,
      nextStage: this.stage,
      stageChanged
    };
  }

  _advanceStageIfNeeded() {
    let stageChanged = false;
    const nowIso = new Date().toISOString();

    if (
      this.stage === "reserved" &&
      this.score >= RELATIONSHIP_STAGE_SCORE_THRESHOLDS.warm
    ) {
      this.stage = "warm";
      this.stageUnlockedAt = nowIso;
      this.pendingStageTransitionPrompt = RELATIONSHIP_STAGE_TRANSITION_PROMPTS.warm;
      stageChanged = true;
    }

    if (
      this.stage === "warm" &&
      this.score >= RELATIONSHIP_STAGE_SCORE_THRESHOLDS.close
    ) {
      this.stage = "close";
      this.stageUnlockedAt = nowIso;
      this.pendingStageTransitionPrompt = RELATIONSHIP_STAGE_TRANSITION_PROMPTS.close;
      stageChanged = true;
    }

    return stageChanged;
  }

  clearPendingStageTransitionPrompt() {
    this.pendingStageTransitionPrompt = null;
  }

  checkRegression() {}

  get isInRegressionMood() {
    return false;
  }

  toJSON() {
    return {
      score: this.score,
      stage: this.stage,
      stageUnlockedAt: this.stageUnlockedAt,
      totalTurns: this.totalTurns,
      pendingStageTransitionPrompt: this.pendingStageTransitionPrompt
    };
  }
}
