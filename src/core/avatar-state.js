const presenceLabels = {
  idle: "静静在场",
  listening: "在听",
  thinking: "在想",
  speaking: "开口中"
};

const emotionLabels = {
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
  determined: "坚定"
};

const cameraLabels = {
  wide: "远景",
  close: "近景"
};

const actionLabels = {
  none: "停稳",
  nod: "轻点头",
  "lean-in": "向前靠",
  "soft-smile": "轻笑",
  "head-tilt": "轻歪头",
  "look-away": "移开视线",
  "shake-head": "摇头",
  wave: "挥手",
  "listen-settle": "听你说"
};

function buildAvatarLabel(plan) {
  return presenceLabels[plan.presence] || presenceLabels.idle;
}

export function mapAvatarState(plan) {
  return {
    presence: plan.presence,
    emotion: plan.emotion,
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
    label: buildAvatarLabel(plan),
    emotionLabel: emotionLabels[plan.emotion] || emotionLabels.calm,
    cameraLabel: cameraLabels[plan.camera] || cameraLabels.wide,
    actionLabel: actionLabels[plan.action] || actionLabels.none,
    caption: plan.caption
  };
}

export function settleAvatarState(avatar, { voiceModeEnabled }) {
  const targetPresence = voiceModeEnabled ? "listening" : "idle";

  return {
    ...avatar,
    presence: targetPresence,
    label: presenceLabels[targetPresence] || presenceLabels.idle,
    action: targetPresence === "listening" ? "listen-settle" : "none",
    actionLabel:
      actionLabels[targetPresence === "listening" ? "listen-settle" : "none"],
    caption:
      targetPresence === "listening"
        ? "我在，继续吧。"
        : "在这里，等你把下一句慢慢说出来。"
  };
}

export function releaseCloseCamera(avatar) {
  if (!avatar || avatar.camera !== "close") {
    return avatar;
  }

  return {
    ...avatar,
    camera: "wide",
    cameraLabel: cameraLabels.wide
  };
}
