import {
  ACTION_INTENTS,
  CAMERA_STATES,
  CAMERA_SWITCH_COOLDOWN_MS,
  CLOSE_HOLD_MS,
  EMOTION_FAMILIES,
  EMOTION_STRENGTHS,
  RELATIONSHIP_STAGES,
  TTS_EMOTION_MODES,
  TTS_FORCE_CONTINUITY_WINDOW_MS,
  TTS_PRESET_MAP,
  normalizeTtsEmotionMode,
  supportsMiniMaxProviderEmotion,
  sanitizeEnum,
  supportsMiniMaxWhisper
} from "./interaction-contract.js";
import { normalizeThinkingMode } from "./providers/thinking-mode.js";

function inferEmotionIntent({ replyText, userMessage, relationshipStage }) {
  if (/(小声|轻一点|靠近一点|只跟你说|低声)/.test(replyText)) {
    return relationshipStage === "close" ? "whisper" : "affectionate";
  }

  if (/(别急|慢一点|先缓|我在|先停一下|接住)/.test(replyText)) {
    return "concerned";
  }

  if (/(记得|陪你|靠近|在这儿|继续吧|慢慢说)/.test(replyText)) {
    return relationshipStage === "reserved" ? "calm" : "affectionate";
  }

  if (/(哼|才不是|逗你|嘴硬|又来)/.test(replyText)) {
    return "playful";
  }

  if (/(好呀|当然|挺好|高兴|轻松一点)/.test(replyText)) {
    return "happy";
  }

  if (/(遗憾|难过|心酸|轻轻地|慢一些)/.test(replyText)) {
    return "sad";
  }

  if (/(不该|不能这样|够了|别再)/.test(replyText) && /(我会|先|但)/.test(replyText)) {
    return "angry";
  }

  if (/(累|难过|焦虑|害怕|失眠|崩|压力)/.test(userMessage)) {
    return "concerned";
  }

  return "calm";
}

function inferEmotionStrength({ emotion, replyText, lateNight }) {
  if (lateNight || emotion === "angry" || emotion === "whisper") {
    return "light";
  }

  if (replyText.length > 140 && emotion !== "happy") {
    return "light";
  }

  return "normal";
}

function defaultActionForEmotion(emotion) {
  switch (emotion) {
    case "happy":
      return "nod";
    case "affectionate":
      return "lean-in";
    case "playful":
      return "head-tilt";
    case "concerned":
      return "lean-in";
    case "sad":
      return "none";
    case "angry":
      return "none";
    case "whisper":
      return "lean-in";
    default:
      return "none";
  }
}

function cohereAction(emotion, action, relationshipStage) {
  let nextAction = sanitizeEnum(action, ACTION_INTENTS, defaultActionForEmotion(emotion));

  if ((emotion === "sad" || emotion === "angry") && nextAction === "soft-smile") {
    nextAction = "none";
  }

  if ((emotion === "sad" || emotion === "angry") && nextAction === "head-tilt") {
    nextAction = "none";
  }

  if (relationshipStage === "reserved" && nextAction === "lean-in") {
    nextAction = "none";
  }

  return nextAction;
}

function cohereEmotion(emotion, relationshipStage, lateNight, gapMs) {
  let nextEmotion = sanitizeEnum(emotion, EMOTION_FAMILIES, "calm");

  if (relationshipStage === "reserved" && nextEmotion === "whisper") {
    nextEmotion = "calm";
  }

  if (lateNight && nextEmotion === "angry") {
    nextEmotion = "concerned";
  }

  if (lateNight && nextEmotion === "playful") {
    nextEmotion = "calm";
  }

  if (gapMs !== null && gapMs > 12 * 60 * 60 * 1000 && nextEmotion === "calm") {
    nextEmotion = relationshipStage === "close" ? "affectionate" : "concerned";
  }

  return nextEmotion;
}

function resolveExpressionForPresence(presence, emotion) {
  if (presence === "idle") {
    return "neutral";
  }

  if (presence === "listening") {
    return "relaxed";
  }

  if (presence === "thinking") {
    return "neutral";
  }

  switch (emotion) {
    case "happy":
    case "playful":
      return "happy";
    case "affectionate":
    case "concerned":
    case "whisper":
      return "relaxed";
    case "sad":
      return "sad";
    case "angry":
      return "angry";
    default:
      return "neutral";
  }
}

function resolveMotionForPresence(presence, emotion) {
  if (presence === "idle") {
    return "still";
  }

  if (presence === "listening") {
    return "listen-settle";
  }

  if (presence === "thinking") {
    return "tiny-head-drop";
  }

  switch (emotion) {
    case "happy":
      return "tiny-nod";
    case "affectionate":
    case "concerned":
    case "whisper":
      return "soft-lean";
    case "playful":
      return "tiny-head-tilt";
    case "sad":
      return "head-down-light";
    case "angry":
    case "calm":
    default:
      return "still";
  }
}

function shouldAllowCloseCamera({
  emotion,
  requestedCamera,
  relationshipStage,
  lastCameraChangedAt,
  nowMs
}) {
  if (requestedCamera !== "close" && !["affectionate", "concerned", "whisper"].includes(emotion)) {
    return false;
  }

  if (relationshipStage === "reserved" && (emotion === "whisper" || requestedCamera === "close")) {
    return false;
  }

  if (lastCameraChangedAt && nowMs - lastCameraChangedAt < CAMERA_SWITCH_COOLDOWN_MS) {
    return false;
  }

  return true;
}

function resolveCamera({
  emotion,
  requestedCamera,
  relationshipStage,
  lastCameraChangedAt,
  nowMs,
  presence
}) {
  if (presence !== "speaking") {
    return presence === "listening" ? "wide" : "wide";
  }

  return shouldAllowCloseCamera({
    emotion,
    requestedCamera,
    relationshipStage,
    lastCameraChangedAt,
    nowMs
  })
    ? "close"
    : "wide";
}

function resolveTtsPreset({
  emotion,
  requestedEmotion,
  relationshipStage,
  voiceModeEnabled,
  ttsCapabilities,
  ttsModel,
  history,
  gapMs,
  requestedEmotionMode
}) {
  const preset = TTS_PRESET_MAP[emotion] || TTS_PRESET_MAP.calm;
  const fallbackPreset =
    relationshipStage === "close"
      ? TTS_PRESET_MAP.affectionate || TTS_PRESET_MAP.calm
      : TTS_PRESET_MAP.calm;
  const explicitForceRequested =
    normalizeTtsEmotionMode(requestedEmotionMode) === "force" ||
    requestedEmotion === "whisper";
  const constrainedForceRequested = requestedEmotion !== emotion;
  const continuityForceRequested =
    history?.lastTtsEmotionMode === "force" &&
    history?.lastEmotion === emotion &&
    emotion !== "calm" &&
    gapMs !== null &&
    gapMs <= TTS_FORCE_CONTINUITY_WINDOW_MS;
  const forceReasons = [];

  if (constrainedForceRequested) {
    forceReasons.push("constrained");
  }

  if (explicitForceRequested) {
    forceReasons.push("explicit");
  }

  if (continuityForceRequested) {
    forceReasons.push("continuity");
  }

  const emotionMode = forceReasons.length > 0 ? "force" : "auto";
  const providerEmotion = emotionMode === "force" ? preset.providerEmotion : null;
  const providerEmotionSupported = supportsMiniMaxProviderEmotion(
    ttsModel,
    providerEmotion
  );

  return {
    presetId: preset.id,
    emotionMode,
    providerEmotion,
    fallbackProviderEmotion:
      emotionMode === "force" ? fallbackPreset.providerEmotion : null,
    downgradedFrom:
      emotionMode === "force" && providerEmotion && !providerEmotionSupported
        ? String(ttsModel || "speech-2.8-turbo").trim()
        : null,
    forceReason: forceReasons[0] || null,
    forceReasons,
    providerAvailable: Boolean(voiceModeEnabled && ttsCapabilities?.available),
    modelSupportsWhisper:
      emotionMode === "force" && providerEmotion === "whisper"
        ? supportsMiniMaxWhisper(ttsModel)
        : true
  };
}

function buildCaption({ presence, emotion, camera, voiceModeEnabled }) {
  if (presence === "thinking") {
    return "让我先把语境和旧事接稳。";
  }

  if (presence === "speaking") {
    if (emotion === "concerned") {
      return camera === "close" ? "她靠近了一点，语气也放轻了。" : "她把语气放轻了，但没有飘。";
    }

    if (emotion === "affectionate" || emotion === "whisper") {
      return camera === "close" ? "她把这句话贴近了一点说出来。" : "她把回应放得更柔了一些。";
    }

    if (emotion === "playful") {
      return "她带了一点轻轻的逗趣，但没有出戏。";
    }

    if (emotion === "angry") {
      return "她语气更硬了一点，但仍然克制。";
    }

    return "她已经把回应接上来了。";
  }

  if (presence === "listening") {
    return "我在，继续吧。";
  }

  return voiceModeEnabled
    ? "她在等下一句，话筒这边保持着。"
    : "在这里，等你把下一句慢慢说出来。";
}

export function buildInteractionIntent({
  assistantResponse,
  thinkingMode,
  userMessage,
  relationshipStage
}) {
  const replyText = String(assistantResponse?.text || "").trim();
  const emotionIntent = inferEmotionIntent({
    replyText,
    userMessage,
    relationshipStage
  });

  return {
    replyText,
    thinkingMode: normalizeThinkingMode(thinkingMode),
    emotionIntent,
    cameraIntent: ["affectionate", "concerned", "whisper"].includes(emotionIntent)
      ? "close"
      : "wide",
    actionIntent: defaultActionForEmotion(emotionIntent),
    emotionStrength: inferEmotionStrength({
      emotion: emotionIntent,
      replyText,
      lateNight: false
    })
  };
}

export function resolveInteractionPlan({
  intent,
  presence,
  voiceModeEnabled,
  ttsCapabilities,
  ttsModel,
  relationshipStage,
  lastActiveAt,
  history = {},
  now = new Date()
}) {
  const safeRelationshipStage = sanitizeEnum(
    relationshipStage,
    RELATIONSHIP_STAGES,
    "warm"
  );
  const nowDate = now instanceof Date ? now : new Date(now);
  const nowMs = nowDate.getTime();
  const lateNight = nowDate.getHours() >= 23 || nowDate.getHours() < 6;
  const gapMs = lastActiveAt ? Math.max(0, nowMs - new Date(lastActiveAt).getTime()) : null;

  if (presence === "thinking") {
    return {
      presence,
      thinkingMode: normalizeThinkingMode(intent?.thinkingMode),
      emotion: "calm",
      emotionStrength: "light",
      action: "none",
      camera: "wide",
      expression: resolveExpressionForPresence(presence, "calm"),
      motion: resolveMotionForPresence(presence, "calm"),
      ttsPreset: "calm",
      ttsEmotionMode: "auto",
      ttsProviderEmotion: null,
      ttsForceReason: null,
      cameraHoldMs: 0,
      caption: buildCaption({
        presence,
        emotion: "calm",
        camera: "wide",
        voiceModeEnabled
      }),
      historyPatch: {}
    };
  }

  if (presence === "idle" || presence === "listening") {
    const action = presence === "listening" ? "listen-settle" : "none";

    return {
      presence,
      thinkingMode: normalizeThinkingMode(intent?.thinkingMode),
      emotion: "calm",
      emotionStrength: "light",
      action,
      camera: "wide",
      expression: resolveExpressionForPresence(presence, "calm"),
      motion: resolveMotionForPresence(presence, "calm"),
      ttsPreset: "calm",
      ttsEmotionMode: "auto",
      ttsProviderEmotion: null,
      ttsForceReason: null,
      cameraHoldMs: 0,
      caption: buildCaption({
        presence,
        emotion: "calm",
        camera: "wide",
        voiceModeEnabled
      }),
      historyPatch: {}
    };
  }

  const requestedEmotion = sanitizeEnum(intent?.emotionIntent, EMOTION_FAMILIES, "calm");
  const emotion = cohereEmotion(
    requestedEmotion,
    safeRelationshipStage,
    lateNight,
    gapMs
  );
  const emotionStrength = sanitizeEnum(
    inferEmotionStrength({
      emotion,
      replyText: intent?.replyText || "",
      lateNight
    }),
    EMOTION_STRENGTHS,
    "light"
  );
  const action = cohereAction(
    emotion,
    intent?.actionIntent,
    safeRelationshipStage
  );
  const camera = resolveCamera({
    emotion,
    requestedCamera: sanitizeEnum(intent?.cameraIntent, CAMERA_STATES, "wide"),
    relationshipStage: safeRelationshipStage,
    lastCameraChangedAt: history.lastCameraChangedAt || 0,
    nowMs,
    presence
  });
  const ttsPreset = resolveTtsPreset({
    emotion,
    requestedEmotion,
    relationshipStage: safeRelationshipStage,
    voiceModeEnabled,
    ttsCapabilities,
    ttsModel,
    history,
    gapMs,
    requestedEmotionMode: sanitizeEnum(intent?.ttsEmotionMode, TTS_EMOTION_MODES, null)
  });

  return {
    presence,
    thinkingMode: normalizeThinkingMode(intent?.thinkingMode),
    emotion,
    emotionStrength,
    action,
    camera,
    expression: resolveExpressionForPresence(presence, emotion),
    motion: resolveMotionForPresence(presence, emotion),
    ttsPreset: ttsPreset.presetId,
    ttsEmotionMode: ttsPreset.emotionMode,
    ttsProviderEmotion: ttsPreset.providerEmotion,
    ttsDowngradedFrom: ttsPreset.downgradedFrom,
    ttsForceReason: ttsPreset.forceReason,
    cameraHoldMs: camera === "close" ? CLOSE_HOLD_MS : 0,
    caption: buildCaption({
      presence,
      emotion,
      camera,
      voiceModeEnabled
    }),
    historyPatch: {
      lastEmotion: emotion,
      lastAction: action,
      lastCamera: camera,
      lastTtsEmotionMode: ttsPreset.emotionMode,
      lastCameraChangedAt:
        camera !== history.lastCamera ? nowMs : history.lastCameraChangedAt || 0
    }
  };
}
