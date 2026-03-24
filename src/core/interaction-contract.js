import {
  EMOTION_PRESET_ORDER,
  EMOTION_PRESETS,
  EMOTION_PRESETS_V2,
  buildEmotionLegacyExpressionMap,
  resolveEmotionPreset
} from "./emotion-presets.js";

export const CANONICAL_STATES = ["idle", "listening", "thinking", "speaking"];
export const EMOTION_FAMILIES = [
  "calm",
  "happy",
  "affectionate",
  "playful",
  "concerned",
  "sad",
  "angry",
  "whisper",
  "surprised",
  "curious",
  "shy",
  "determined"
];
export const TTS_EMOTION_MODES = ["auto", "force"];
export const CAMERA_STATES = ["wide", "close"];
export const ACTION_INTENTS = [
  "none",
  "nod",
  "lean-in",
  "soft-smile",
  "head-tilt",
  "look-away",
  "shake-head",
  "wave",
  "listen-settle"
];
export const EMOTION_STRENGTHS = ["light", "normal"];
export const RELATIONSHIP_STAGES = [
  "reserved",
  "warm",
  "close"
];

export const CAMERA_SWITCH_COOLDOWN_MS = 8_000;
export const CLOSE_HOLD_MS = 2_800;
export const TTS_IDLE_TIMEOUT_MS = 120_000;
export const TTS_FORCE_CONTINUITY_WINDOW_MS = 20 * 60 * 1000;

export const TTS_PRESET_MAP = {
  calm: {
    id: "calm",
    providerEmotion: "calm",
    speedMultiplier: 1.0,
    pitchOffset: 0
  },
  happy: {
    id: "happy",
    providerEmotion: "happy",
    speedMultiplier: 1.1,
    pitchOffset: 1
  },
  playful: {
    id: "happy",
    providerEmotion: "happy",
    speedMultiplier: 1.15,
    pitchOffset: 2
  },
  affectionate: {
    id: "affectionate",
    providerEmotion: "fluent",
    speedMultiplier: 0.92,
    pitchOffset: -1
  },
  concerned: {
    id: "concerned",
    providerEmotion: "sad",
    speedMultiplier: 0.9,
    pitchOffset: -1
  },
  sad: {
    id: "sad",
    providerEmotion: "sad",
    speedMultiplier: 0.85,
    pitchOffset: -2
  },
  angry: {
    id: "angry_soft",
    providerEmotion: "angry",
    speedMultiplier: 1.08,
    pitchOffset: -1
  },
  whisper: {
    id: "whisper",
    providerEmotion: "whisper",
    speedMultiplier: 0.88,
    pitchOffset: 0
  },
  surprised: {
    id: "surprised",
    providerEmotion: "surprised",
    speedMultiplier: 1.12,
    pitchOffset: 2
  },
  curious: {
    id: "curious",
    providerEmotion: "fluent",
    speedMultiplier: 1.0,
    pitchOffset: 1
  },
  shy: {
    id: "shy",
    providerEmotion: "fearful",
    speedMultiplier: 0.88,
    pitchOffset: 1
  },
  determined: {
    id: "determined",
    providerEmotion: "angry",
    speedMultiplier: 1.05,
    pitchOffset: -2
  }
};

export const EMOTION_TO_VRM_EXPRESSION = buildEmotionLegacyExpressionMap();
export { EMOTION_PRESETS_V2, EMOTION_PRESET_ORDER, EMOTION_PRESETS, resolveEmotionPreset };

export const EMOTION_TO_VRM_PRESETS = EMOTION_PRESETS;

export const EMOTION_TO_TTS_PROVIDER = Object.fromEntries(
  Object.entries(TTS_PRESET_MAP).map(([emotion, preset]) => [
    emotion,
    preset.providerEmotion
  ])
);

export function sanitizeEnum(value, allowedValues, fallback) {
  return allowedValues.includes(value) ? value : fallback;
}

export function normalizeTtsEmotionMode(mode, providerEmotion = null) {
  if (mode === "force") {
    return "force";
  }

  if (mode === "auto") {
    return "auto";
  }

  return providerEmotion ? "force" : "auto";
}

export function requiresMiniMaxSpeech26ForEmotion(providerEmotion) {
  return providerEmotion === "whisper" || providerEmotion === "fluent";
}

export function supportsMiniMaxProviderEmotion(model, providerEmotion) {
  if (!providerEmotion || !requiresMiniMaxSpeech26ForEmotion(providerEmotion)) {
    return true;
  }

  return model === "speech-2.6-hd" || model === "speech-2.6-turbo";
}

export function supportsMiniMaxWhisper(model) {
  return supportsMiniMaxProviderEmotion(model, "whisper");
}

export function resolveMiniMaxSpeechModelForEmotion(model, providerEmotion) {
  const normalizedModel = String(model || "speech-2.8-turbo").trim();

  if (supportsMiniMaxProviderEmotion(normalizedModel, providerEmotion)) {
    return normalizedModel;
  }

  if (!requiresMiniMaxSpeech26ForEmotion(providerEmotion)) {
    return normalizedModel;
  }

  if (normalizedModel.endsWith("-hd")) {
    return "speech-2.6-hd";
  }

  return "speech-2.6-turbo";
}
