import { resolveLocale } from "./config.js";

const AVATAR_COPY = {
  "zh-CN": {
    presenceLabels: {
      idle: "安静在场",
      listening: "在听",
      thinking: "在想",
      speaking: "开口中"
    },
    emotionLabels: {
      calm: "平静",
      happy: "轻松",
      affectionate: "温和",
      playful: "逗趣",
      concerned: "关切",
      sad: "低落",
      angry: "克制",
      whisper: "轻声",
      surprised: "惊讶",
      curious: "好奇",
      shy: "害羞",
      determined: "笃定"
    },
    cameraLabels: {
      wide: "远景",
      close: "近景"
    },
    actionLabels: {
      none: "停稳",
      nod: "轻点头",
      "lean-in": "向前靠",
      "soft-smile": "轻轻笑",
      "head-tilt": "轻歪头",
      "look-away": "移开视线",
      "shake-head": "摇头",
      wave: "挥手",
      "listen-settle": "听你说"
    },
    captions: {
      listening: "我在，继续吧。",
      idle: "在这里，等你把下一句慢慢说出来。"
    }
  },
  en: {
    presenceLabels: {
      idle: "Quietly here",
      listening: "Listening",
      thinking: "Thinking",
      speaking: "Speaking"
    },
    emotionLabels: {
      calm: "Calm",
      happy: "Light",
      affectionate: "Warm",
      playful: "Playful",
      concerned: "Concerned",
      sad: "Low",
      angry: "Contained",
      whisper: "Hushed",
      surprised: "Surprised",
      curious: "Curious",
      shy: "Shy",
      determined: "Steady"
    },
    cameraLabels: {
      wide: "Wide",
      close: "Close"
    },
    actionLabels: {
      none: "Still",
      nod: "Small nod",
      "lean-in": "Lean in",
      "soft-smile": "Soft smile",
      "head-tilt": "Head tilt",
      "look-away": "Look away",
      "shake-head": "Shake head",
      wave: "Wave",
      "listen-settle": "Holding your thread"
    },
    captions: {
      listening: "I'm here. Keep going.",
      idle: "I'm here, waiting for the next line when you're ready."
    }
  }
};

function getAvatarCopy(locale = "zh-CN") {
  return AVATAR_COPY[resolveLocale(locale)];
}

function buildAvatarLabel(plan, copy) {
  return copy.presenceLabels[plan.presence] || copy.presenceLabels.idle;
}

function normalizeIntensity(value, fallback = 0.6) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.min(Math.max(numericValue, 0), 1);
}

export function mapAvatarState(plan, locale = "zh-CN") {
  const resolvedLocale = resolveLocale(locale);
  const copy = getAvatarCopy(resolvedLocale);

  return {
    presence: plan.presence,
    emotion: plan.emotion,
    intensity: normalizeIntensity(plan.intensity),
    emotionStrength: plan.emotionStrength,
    camera: plan.camera,
    action: plan.action,
    expression: plan.expression,
    motion: plan.motion,
    ttsPreset: plan.ttsPreset,
    ttsEmotionMode: plan.ttsEmotionMode || "auto",
    ttsProviderEmotion: plan.ttsProviderEmotion,
    ttsDowngradedFrom: plan.ttsDowngradedFrom || null,
    ttsForceReason: plan.ttsForceReason || null,
    cameraHoldMs: plan.cameraHoldMs || 0,
    locale: resolvedLocale,
    label: buildAvatarLabel(plan, copy),
    emotionLabel: copy.emotionLabels[plan.emotion] || copy.emotionLabels.calm,
    cameraLabel: copy.cameraLabels[plan.camera] || copy.cameraLabels.wide,
    actionLabel: copy.actionLabels[plan.action] || copy.actionLabels.none,
    caption: plan.caption
  };
}

export function settleAvatarState(avatar, { voiceModeEnabled, locale = null } = {}) {
  const resolvedLocale = resolveLocale(locale || avatar?.locale);
  const copy = getAvatarCopy(resolvedLocale);
  const targetPresence = voiceModeEnabled ? "listening" : "idle";
  const action = targetPresence === "listening" ? "listen-settle" : "none";

  return {
    ...avatar,
    locale: resolvedLocale,
    intensity: normalizeIntensity(avatar?.intensity),
    presence: targetPresence,
    label: copy.presenceLabels[targetPresence] || copy.presenceLabels.idle,
    action,
    actionLabel: copy.actionLabels[action],
    cameraHoldMs: 0,
    caption:
      targetPresence === "listening"
        ? copy.captions.listening
        : copy.captions.idle
  };
}

export function releaseCloseCamera(avatar) {
  if (!avatar || avatar.camera !== "close") {
    return avatar;
  }

  const resolvedLocale = resolveLocale(avatar?.locale);
  const copy = getAvatarCopy(resolvedLocale);

  return {
    ...avatar,
    locale: resolvedLocale,
    camera: "wide",
    cameraLabel: copy.cameraLabels.wide,
    cameraHoldMs: 0
  };
}
