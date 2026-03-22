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
    providerEmotion: "calm"
  },
  happy: {
    id: "happy",
    providerEmotion: "happy"
  },
  affectionate: {
    id: "affectionate",
    providerEmotion: "calm"
  },
  playful: {
    id: "happy",
    providerEmotion: "happy"
  },
  concerned: {
    id: "concerned",
    providerEmotion: "calm"
  },
  sad: {
    id: "sad",
    providerEmotion: "sad"
  },
  angry: {
    id: "angry_soft",
    providerEmotion: "angry"
  },
  whisper: {
    id: "whisper",
    providerEmotion: "whisper"
  },
  surprised: {
    id: "surprised",
    providerEmotion: "surprised"
  },
  curious: {
    id: "curious",
    providerEmotion: "fluent"
  },
  shy: {
    id: "shy",
    providerEmotion: "calm"
  },
  determined: {
    id: "determined",
    providerEmotion: "fluent"
  }
};

export const EMOTION_TO_VRM_EXPRESSION = buildEmotionLegacyExpressionMap();
export { EMOTION_PRESETS_V2, EMOTION_PRESET_ORDER, EMOTION_PRESETS, resolveEmotionPreset };

export const EMOTION_TO_VRM_PRESETS = EMOTION_PRESETS;

export const EMOTION_TO_TTS_PROVIDER = {
  calm: "calm",
  happy: "happy",
  playful: "happy",
  surprised: "surprised",
  affectionate: "calm",
  shy: "calm",
  whisper: "whisper",
  concerned: "calm",
  sad: "sad",
  angry: "angry",
  determined: "fluent",
  curious: "fluent"
};

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
