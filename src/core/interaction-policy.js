import {
  ACTION_INTENTS,
  CAMERA_STATES,
  CAMERA_SWITCH_COOLDOWN_MS,
  CLOSE_HOLD_MS,
  EMOTION_FAMILIES,
  EMOTION_TO_VRM_EXPRESSION,
  EMOTION_STRENGTHS,
  RELATIONSHIP_STAGES,
  TTS_EMOTION_MODES,
  TTS_FORCE_CONTINUITY_WINDOW_MS,
  TTS_PRESET_MAP,
  normalizeTtsEmotionMode,
  sanitizeEnum,
  supportsMiniMaxProviderEmotion,
  supportsMiniMaxWhisper
} from "./interaction-contract.js";
import { normalizeThinkingMode } from "./providers/thinking-mode.js";

const EMOTION_TO_DEFAULT_MOTION = {
  calm: "still",
  happy: "tiny-nod",
  affectionate: "soft-lean",
  playful: "tiny-head-tilt",
  concerned: "soft-lean",
  sad: "head-down-light",
  angry: "still",
  whisper: "soft-lean",
  surprised: "tiny-head-tilt",
  curious: "tiny-head-tilt",
  shy: "still",
  determined: "tiny-nod"
};

function inferEmotionIntent({ replyText, userMessage, relationshipStage }) {
  const reply = String(replyText || "");
  const user = String(userMessage || "");

  if (/(小声|轻一点|靠近一点|只跟你说|低声|悄悄)/.test(reply)) {
    return relationshipStage === "close" ? "whisper" : "affectionate";
  }

  if (/(别急|慢一点|先缓一缓|我在|先停一下|接住|疼|受伤|摔|磕|流血|难受|不舒服)/.test(user + reply)) {
    return "concerned";
  }

  if (/(记得|陪你|靠近|在这里|继续听|慢慢说)/.test(reply)) {
    return relationshipStage === "reserved" ? "calm" : "affectionate";
  }

  if (/(逗你|逗我|又来|嘴硬|调皮|打趣|故意气我)/.test(reply + user)) {
    return "playful";
  }

  if (/(哈哈|好笑|笑死|太逗|开心|高兴|太好了|真好|真棒|好耶|太棒了|喜欢|舒心)/.test(reply + user)) {
    return "happy";
  }

  if (/(遗憾|难过|心酸|低落|失落|沮丧|糟糕|可惜)/.test(reply + user)) {
    return "sad";
  }

  if (/(不该|不能这样|够了|别再|停下|太过分|我会|我来处理)/.test(reply + user)) {
    return "angry";
  }

  if (/(紧张|焦虑|害怕|失眠|压力|心慌|慌|担心)/.test(user)) {
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
    case "surprised":
      return "head-tilt";
    case "curious":
      return "head-tilt";
    case "shy":
      return "look-away";
    case "determined":
      return "nod";
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

  if (
    relationshipStage === "reserved" &&
    (nextEmotion === "whisper" || nextEmotion === "shy")
  ) {
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

  return EMOTION_TO_VRM_EXPRESSION[emotion] || "neutral";
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

  return EMOTION_TO_DEFAULT_MOTION[emotion] || "still";
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
    return "wide";
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
    speedMultiplier: preset.speedMultiplier,
    pitchOffset: preset.pitchOffset,
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
    return "我先把语境和旧事接起来。";
  }

  if (presence === "speaking") {
    if (emotion === "concerned") {
      return camera === "close"
        ? "她靠近了一点，语气也放轻了。"
        : "她把语气放轻了，但没有躲开。";
    }

    if (emotion === "affectionate" || emotion === "whisper") {
      return camera === "close"
        ? "她把这句话贴近了一点说出来。"
        : "她把回应放得更柔了一些。";
    }

    if (emotion === "playful") {
      return "她带了一点轻轻的逗趣，但没有出戏。";
    }

    if (emotion === "angry") {
      return "她语气更硬了一点，但仍然克制。";
    }

    if (emotion === "surprised") {
      return "她明显顿了一下，情绪先抬起来了。";
    }

    if (emotion === "curious") {
      return "她把注意力往前收了一点，在认真追问。";
    }

    if (emotion === "shy") {
      return "她有点不好意思，视线收了回去。";
    }

    if (emotion === "determined") {
      return "她把态度立住了，说得很认真。";
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
  relationshipStage,
  llmIntent = null
}) {
  const replyText = String(assistantResponse?.text || "").trim();

  if (llmIntent) {
    return {
      replyText,
      thinkingMode: normalizeThinkingMode(thinkingMode),
      emotionIntent: sanitizeEnum(llmIntent.emotion, EMOTION_FAMILIES, "calm"),
      cameraIntent: sanitizeEnum(llmIntent.camera, CAMERA_STATES, "wide"),
      actionIntent: sanitizeEnum(llmIntent.action, ACTION_INTENTS, "none"),
      emotionStrength: inferEmotionStrength({
        emotion: llmIntent.emotion,
        replyText,
        lateNight: false
      })
    };
  }

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
      ttsSpeedMultiplier: 1,
      ttsPitchOffset: 0,
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
      ttsSpeedMultiplier: 1,
      ttsPitchOffset: 0,
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
    ttsSpeedMultiplier: ttsPreset.speedMultiplier,
    ttsPitchOffset: ttsPreset.pitchOffset,
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
