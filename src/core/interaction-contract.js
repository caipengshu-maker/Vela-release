export const CANONICAL_STATES = ["idle", "listening", "thinking", "speaking"];
export const EMOTION_FAMILIES = [
  "calm",
  "happy",
  "affectionate",
  "playful",
  "concerned",
  "sad",
  "angry",
  "whisper"
];
export const TTS_EMOTION_MODES = ["auto", "force"];
export const CAMERA_STATES = ["wide", "close"];
export const ACTION_INTENTS = [
  "none",
  "nod",
  "lean-in",
  "soft-smile",
  "head-tilt",
  "listen-settle"
];
export const EMOTION_STRENGTHS = ["light", "normal"];
export const RELATIONSHIP_STAGES = [
  "reserved",
  "warm",
  "close",
  "hurt_but_connected"
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
  }
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
