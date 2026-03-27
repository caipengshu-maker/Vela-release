import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { parse } from "jsonc-parser";
import { loadConfig, CONFIG_SCHEMA_VERSION } from "./config.js";
import {
  buildPersona,
  onboardingOptions
} from "./default-persona.js";
import { LocalStore } from "./local-store.js";
import { MemoryStore } from "./memory-store.js";
import { MemoryRetriever, inferEmotionFromText } from "./memory-retriever.js";
import { MemorySummarizer } from "./memory-summarizer.js";
import { SessionStateStore } from "./session-state.js";
import { buildContext } from "./context-builder.js";
import { generateBridgeDiary } from "./bridge-diary.js";
import {
  loadBehaviorPatterns,
  updateBehaviorPatternsIfNeeded
} from "./behavior-patterns.js";
import { buildContextFusion } from "./context-fusion.js";
import { getTimeAwareness } from "./context-providers/time-provider.js";
import { getWeatherAwareness } from "./context-providers/weather-provider.js";
import {
  checkInConversationTrigger,
  getProactiveWeatherCondition,
  shouldGreetOnOpen
} from "./proactive.js";
import {
  mapAvatarState,
  settleAvatarState
} from "./avatar-state.js";
import {
  getRelationshipStageNote,
  RelationshipTracker
} from "./relationship.js";
import {
  advanceMilestones,
  buildMilestoneSystemMessage
} from "./milestones.js";
import { RELATIONSHIP_STAGES } from "./interaction-contract.js";
import {
  createStreamPrefixBuffer,
  parsePerformancePrefix
} from "./performance-parser.js";
import {
  buildInteractionIntent,
  resolveInteractionPlan
} from "./interaction-policy.js";
import {
  generateReply,
  generateReplyStream,
  listAvailableModels,
  resolveModelSelection
} from "./provider.js";
import {
  listThinkingModes,
  normalizeThinkingMode
} from "./providers/thinking-mode.js";
import { getAsrCapabilities } from "./asr/provider.js";
import { getTtsCapabilities } from "./tts/provider.js";
import { SpeechOrchestrator } from "./tts/speech-orchestrator.js";

function clipText(text, limit = 48) {
  if (!text) {
    return "";
  }

  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function formatTime(isoString) {
  if (!isoString) {
    return "";
  }

  const date = new Date(isoString);
  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function sanitizeTopicLabel(text) {
  const cleaned = String(text || "")
    .replace(/\s+/g, " ")
    .replace(/^第\d+次验证[:：]\s*/u, "")
    .trim();

  return cleaned;
}

function extractTopicLabel(text) {
  const cleaned = sanitizeTopicLabel(text);
  return cleaned ? clipText(cleaned, 18) : "近况";
}

function createTurnSummary({
  sessionId,
  userMessage,
  assistantReply,
  avatar,
  triggerReasons = [],
  summaryLabel = null
}) {
  const createdAt = new Date().toISOString();
  const topicLabel = summaryLabel || extractTopicLabel(userMessage);
  const shouldBridge =
    Array.isArray(triggerReasons) &&
    triggerReasons.some((reason) => reason && reason !== "proactive");

  return {
    id: randomUUID(),
    sessionId,
    createdAt,
    topicLabel,
    summary: summaryLabel
      ? `Vela ${summaryLabel}，以${avatar.emotionLabel}、克制的方式把这轮对话接住了。`
      : `聊到“${topicLabel}”，Vela 以${avatar.emotionLabel}、克制的方式把这轮对话接住了。`,
    bridgeSummary: shouldBridge
      ? `聊到“${topicLabel}”，这轮话题已经接住。`
      : "",
    openFollowUps: [],
    userSnippet: clipText(userMessage, 48),
    assistantSnippet: clipText(assistantReply, 60),
    avatar
  };
}
function buildWelcomeNote(memory) {
  const bridgeSummary = sanitizeTopicLabel(
    memory?.bridgeSummary?.summary || memory?.bridgeSummary?.text || memory?.bridgeSummary || ""
  );

  if (bridgeSummary) {
    return `上次我们停在“${clipText(bridgeSummary, 30)}”。想接着说的话，直接从这里继续就行。`;
  }

  const recentSummary = memory?.recentSummaries?.[0];
  if (recentSummary) {
    const topicLabel = sanitizeTopicLabel(recentSummary.topicLabel);
    const summaryText = sanitizeTopicLabel(recentSummary.summary);
    return `上次我们停在“${topicLabel || clipText(summaryText, 24)}”。想继续的话可以从这里接上。`;
  }

  return "如果你想接着刚才的话题，或者只是随便说一句，都可以直接开始。";
}

function buildOnboardingState(profile) {
  const onboarding = profile.onboarding || {
    completed: false,
    velaName: "Vela",
    userName: "",
    temperament: "gentle-cool",
    distance: "warm"
  };

  return {
    required: true,
    completed: false,
    prompt: "先告诉我，你希望我怎么称呼你。",
    fields: {
      velaName: onboarding.velaName || "Vela",
      userName: onboarding.userName || "",
      temperament: onboarding.temperament || "gentle-cool",
      distance: onboarding.distance || "warm"
    },
    options: onboardingOptions
  };
}

function hasCompletedCurrentOnboarding(profile) {
  return (
    Boolean(profile?.onboarding?.completed) &&
    Number(profile?.onboarding?.completedVersion || 0) >= CONFIG_SCHEMA_VERSION
  );
}

function buildCompletedOnboardingState(profile) {
  return {
    required: false,
    completed: true,
    completedVersion:
      Number(profile?.onboarding?.completedVersion) || CONFIG_SCHEMA_VERSION
  };
}

function buildMemoryPeek(memory) {
  const source = memory.bridgeSummary || memory.recentSummaries[0];

  return source
    ? {
        summary: source.summary || source.text || String(source).trim(),
        createdAtLabel: formatTime(source.createdAt || source.updatedAt)
      }
    : null;
}

function getHoursSince(isoString) {
  const timestamp = Date.parse(isoString || "");

  if (!Number.isFinite(timestamp)) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(0, (Date.now() - timestamp) / 3600000);
}

function buildSummaryTriggers({ turnIndex, lastActiveAt, userMessage, assistantReply, avatar }) {
  const reasons = [];

  if (turnIndex <= 1) {
    reasons.push("session-start");
  }

  if (turnIndex > 0 && turnIndex % 8 === 0) {
    reasons.push("cadence");
  }

  if (getHoursSince(lastActiveAt) >= 12) {
    reasons.push("return-gap");
  }

  if (String(userMessage || "").length >= 140 || String(assistantReply || "").length >= 200) {
    reasons.push("long-turn");
  }

  if (String(avatar?.emotion || "calm") !== "calm") {
    reasons.push("notable-emotion");
  }

  return reasons;
}

function getDateKey(date = new Date()) {
  const current = date instanceof Date ? date : new Date(date);
  const year = current.getFullYear();
  const month = String(current.getMonth() + 1).padStart(2, "0");
  const day = String(current.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeWeatherConditionForState(weather) {
  return getProactiveWeatherCondition(weather);
}

function buildAvatarAssetState(config) {
  const assetPath = String(config?.avatar?.assetPath || "").trim();

  return {
    path: assetPath,
    fileName: assetPath ? path.basename(assetPath) : ""
  };
}

function replaceTextBlocks(blocks, text) {
  if (!Array.isArray(blocks)) {
    return blocks;
  }

  return blocks.map((block) =>
    block?.type === "text" ? { ...block, text } : block
  );
}

function buildRelationshipUnlockHints(relationship) {
  const stage = String(relationship?.stage || "reserved").trim().toLowerCase();
  const hints = [];

  switch (stage) {
    case "reserved":
      hints.push("先保持礼貌和分寸，重点是接住情绪，不要抢着靠近。");
      break;
    case "warm":
      hints.push("可以自然放松一点，偶尔更亲昵一点，但不要突然越级亲密。");
      break;
    case "close":
      hints.push("可以更亲近一点，偶尔调侃、撒娇或表达想念，但要像真实的人。");
      break;
    default:
      hints.push("先保持自然和分寸，不要突然越级表达。");
      break;
  }

  return hints;
}

function buildMilestonePromptBlock(milestones = []) {
  if (!Array.isArray(milestones) || milestones.length === 0) {
    return "";
  }

  return milestones
    .map((milestone) => buildMilestoneSystemMessage(milestone))
    .filter(Boolean)
    .join("\n\n");
}

function appendSystemPromptBlock(context, promptBlock) {
  const trimmedBlock = String(promptBlock || "").trim();

  if (!trimmedBlock) {
    return context;
  }

  return {
    ...context,
    systemPrompt: [context.systemPrompt, trimmedBlock].filter(Boolean).join("\n\n")
  };
}

const RELATIONSHIP_STATE_FILE = "state/relationship.json";

function parseModelCommand(message) {
  const match = String(message || "")
    .trim()
    .match(/^\/model\s+([^\s]+)\s*$/i);

  return match ? match[1] : null;
}

function buildModelStatus(config, runtimeSession, persistedState) {
  const availableModels = listAvailableModels(config).map((model) => ({
    id: model.id,
    label: model.label,
    kind: model.kind
  }));
  const providerRouting =
    runtimeSession?.providerRouting || persistedState?.providerRouting || {};
  const selectedModel =
    runtimeSession?.selectedModel || providerRouting.selectedModel || "auto";
  const resolvedSelection = resolveModelSelection(config, selectedModel);
  const lastResolved = providerRouting.lastResolved || null;
  const cooldownUntil = providerRouting.cooldownUntil || null;
  const cooldownUntilMs = Date.parse(cooldownUntil || "");
  const cooldownActive =
    Number.isFinite(cooldownUntilMs) && cooldownUntilMs > Date.now();

  return {
    availableModels,
    selectedModel,
    selectedLabel:
      selectedModel === "auto"
        ? "自动"
        : resolvedSelection?.label || selectedModel,
    activeLabel:
      lastResolved?.activeRouteLabel ||
      resolvedSelection?.label ||
      availableModels[0]?.label ||
      "主模型",
    fallbackUsed: Boolean(lastResolved?.fallbackUsed),
    fallbackReason: lastResolved?.fallbackReason || null,
    manualSelection: selectedModel !== "auto",
    cooldownUntil,
    cooldownActive
  };
}

function buildModelSwitchMessage(config, selectedModel) {
  const selection =
    selectedModel === "auto"
      ? { label: "自动路由" }
      : resolveModelSelection(config, selectedModel);

  return {
    id: randomUUID(),
    role: "assistant",
    variant: "system-tip",
    createdAt: new Date().toISOString(),
    content:
      selectedModel === "auto"
        ? "模型已切回自动路由。主模型可用时优先走主模型，必要时再优雅降级。"
        : `已切换到 ${selection?.label || selectedModel}。后续对话会优先按这个选择发送。`
  };
}

function buildInvalidModelMessage(config) {
  const options = listAvailableModels(config)
    .map((entry) => entry.id)
    .join(" / ");

  return {
    id: randomUUID(),
    role: "assistant",
    variant: "system-tip",
    createdAt: new Date().toISOString(),
    content: `可用模型：auto / ${options}。用法：/model <name>`
  };
}

function sanitizeBooleanFlag(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value > 0;
  }

  const normalized = String(value || "").trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function normalizeAssetSubPath(assetPath) {
  const normalizedPath = String(assetPath || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "");

  if (!normalizedPath) {
    return "";
  }

  return normalizedPath.startsWith("assets/")
    ? normalizedPath.slice("assets/".length)
    : normalizedPath;
}

function resolveRuntimeAssetPath(assetRoot, configuredPath) {
  const assetPath = String(configuredPath || "").trim();

  if (!assetPath) {
    return "";
  }

  if (path.isAbsolute(assetPath)) {
    return path.resolve(assetPath);
  }

  return path.resolve(assetRoot, normalizeAssetSubPath(assetPath));
}

export class VelaCore {
  constructor({
    rootDir,
    userDataDir,
    storageRootOverride,
    isDevelopment = true,
    resourcesDir = ""
  }) {
    this.rootDir = rootDir;
    this.userDataDir = userDataDir;
    this.storageRootOverride = storageRootOverride || null;
    this.isDevelopment = Boolean(isDevelopment);
    this.resourcesDir = resourcesDir || rootDir;
    this.runtimePaths = null;
    this.config = null;
    this.persona = null;
    this.localStore = null;
    this.memoryStore = null;
    this.memoryRetriever = null;
    this.memorySummarizer = null;
    this.sessionStore = null;
    this.runtimeSession = null;
    this.persistedState = null;
    this.relationshipTracker = null;
    this.memorySnapshot = null;
    this.bridgeDiaryNote = null;
    this.currentAvatar = null;
    this.currentSpeech = null;
    this.lastReplyText = "";
    this.policyHistory = {
      lastEmotion: "calm",
      lastAction: "none",
      lastCamera: "wide",
      lastTtsEmotionMode: "auto",
      lastCameraChangedAt: 0
    };
  }

  resolveRuntimePaths() {
    const storageRoot = this.storageRootOverride
      ? path.resolve(this.storageRootOverride)
      : this.isDevelopment
        ? path.resolve(this.rootDir, ".vela-data")
        : path.resolve(this.userDataDir || path.join(this.rootDir, ".vela-data"));

    return {
      storageRoot,
      cacheRoot: path.join(storageRoot, "cache"),
      assetRoot: this.isDevelopment
        ? path.resolve(this.rootDir, "assets")
        : path.resolve(this.resourcesDir, "assets"),
      userConfigPath: path.join(storageRoot, "config", "vela.user.jsonc")
    };
  }

  applyRuntimePaths(config) {
    const runtimePaths = this.runtimePaths || this.resolveRuntimePaths();

    return {
      ...config,
      runtime: {
        ...(config.runtime || {}),
        storageRoot: runtimePaths.storageRoot,
        cacheRoot: runtimePaths.cacheRoot,
        assetRoot: runtimePaths.assetRoot
      },
      avatar: {
        ...(config.avatar || {}),
        assetPath: resolveRuntimeAssetPath(
          runtimePaths.assetRoot,
          config?.avatar?.assetPath
        )
      }
    };
  }

  async reloadConfig() {
    const loadedConfig = await loadConfig(this.rootDir, {
      userConfigPath: this.runtimePaths?.userConfigPath
    });

    this.config = this.applyRuntimePaths(loadedConfig);

    if (this.runtimeSession) {
      this.runtimeSession.voiceModeEnabled = Boolean(this.config.audio?.ttsEnabled);
    }

    if (this.memoryStore) {
      this.memoryStore.config = this.config;
    }

    if (this.memorySummarizer) {
      this.memorySummarizer.config = this.config;
    }

    return this.config;
  }

  async initialize() {
    this.runtimePaths = this.resolveRuntimePaths();
    await this.reloadConfig();

    const storageRoot = this.runtimePaths.storageRoot;

    this.localStore = new LocalStore(storageRoot);
    this.memoryStore = new MemoryStore(this.localStore, this.config);
    this.memoryRetriever = new MemoryRetriever({
      store: this.localStore
    });
    this.memorySummarizer = new MemorySummarizer({
      memoryStore: this.memoryStore,
      config: this.config
    });
    this.sessionStore = new SessionStateStore(this.localStore);

    await fs.mkdir(this.config.runtime.cacheRoot, { recursive: true });
    await this.memoryStore.initialize();
    await this.sessionStore.initialize();

    this.persistedState = await this.sessionStore.loadPersistedState();
    this.runtimeSession = this.sessionStore.createRuntimeSession(this.persistedState);
    this.runtimeSession.voiceModeEnabled = Boolean(this.config.audio?.ttsEnabled);
    this.runtimeSession.thinkingMode = normalizeThinkingMode(
      this.runtimeSession.thinkingMode
    );
    this.runtimeSession.selectedModel =
      this.runtimeSession.providerRouting?.selectedModel || "auto";

    const initialMemorySnapshot = await this.memoryStore.loadMemorySnapshot();
    this.relationshipTracker = await this.loadRelationshipTracker(
      initialMemorySnapshot.relationship?.stage
    );
    await this.saveRelationshipTracker();
    await this.syncRelationshipMemoryState(initialMemorySnapshot.relationship);
    this.memorySnapshot = this.mergeRelationshipIntoMemorySnapshot(
      initialMemorySnapshot
    );
    this.persona = buildPersona(this.memorySnapshot.profile);
    this.currentAvatar = this.buildPresenceAvatar(
      this.runtimeSession.voiceModeEnabled ? "listening" : "idle"
    );
    this.policyHistory = {
      lastEmotion: this.persistedState.lastAvatar?.emotion || "calm",
      lastAction: this.persistedState.lastAvatar?.action || "none",
      lastCamera: this.persistedState.lastAvatar?.camera || "wide",
      lastTtsEmotionMode:
        this.persistedState.lastAvatar?.ttsEmotionMode || "auto",
      lastCameraChangedAt: 0
    };
  }

  getConfig() {
    return this.config;
  }

  async loadRelationshipTracker(fallbackStage = null) {
    const persistedRelationship = await this.localStore.readJson(
      RELATIONSHIP_STATE_FILE,
      null
    );
    const hasPersistedRelationship = Boolean(
      persistedRelationship && typeof persistedRelationship === "object"
    );
    const fallback = String(fallbackStage || "reserved").trim().toLowerCase();
    const stage = RELATIONSHIP_STAGES.includes(fallback) ? fallback : "reserved";
    const tracker = new RelationshipTracker(
      hasPersistedRelationship ? persistedRelationship : { stage }
    );

    if (!hasPersistedRelationship && stage) {
      await this.localStore.writeJson(RELATIONSHIP_STATE_FILE, tracker.toJSON());
    }

    return tracker;
  }

  async saveRelationshipTracker() {
    if (!this.relationshipTracker) {
      return;
    }

    await this.localStore.writeJson(
      RELATIONSHIP_STATE_FILE,
      this.relationshipTracker.toJSON()
    );
  }

  mergeRelationshipIntoMemorySnapshot(snapshot = null) {
    if (!snapshot) {
      return snapshot;
    }

    return {
      ...snapshot,
      relationship: this.getRelationshipState(snapshot.relationship)
    };
  }

  getRelationshipState(baseRelationship = null) {
    const trackerState = this.relationshipTracker?.toJSON?.() || {};
    const base =
      baseRelationship && typeof baseRelationship === "object"
        ? baseRelationship
        : {};
    const stage = String(
      trackerState.stage || base.stage || "reserved"
    )
      .trim()
      .toLowerCase();
    const baseStage = String(base.stage || "").trim().toLowerCase();
    const note =
      baseStage === stage && String(base.note || "").trim()
        ? base.note
        : getRelationshipStageNote(stage);

    return {
      ...base,
      ...trackerState,
      stage,
      note,
      pendingStageTransitionPrompt: trackerState.pendingStageTransitionPrompt || null,
      isInRegressionMood: false
    };
  }

  async syncRelationshipMemoryState(baseRelationship = null) {
    const base =
      baseRelationship && typeof baseRelationship === "object"
        ? baseRelationship
        : this.memorySnapshot?.relationship || {};
    const relationship = this.getRelationshipState(base);

    await this.memoryStore.updateRelationship({
      ...base,
      stage: relationship.stage,
      note: relationship.note,
      sharedMoments: Array.isArray(base.sharedMoments) ? base.sharedMoments : []
    });

    return relationship;
  }

  async clearPendingRelationshipTransitionPrompt(expectedPrompt = null) {
    if (!this.relationshipTracker) {
      return;
    }

    if (
      expectedPrompt &&
      this.relationshipTracker.pendingStageTransitionPrompt !== expectedPrompt
    ) {
      return;
    }

    this.relationshipTracker.clearPendingStageTransitionPrompt();
    await this.saveRelationshipTracker();
  }

  async recordRelationshipTurn(plan, baseRelationship = null) {
    if (!this.relationshipTracker) {
      return null;
    }

    const result = this.relationshipTracker.recordTurn({
      emotion: plan?.emotion || "calm",
      intensity: plan?.intensity ?? 0
    });
    await this.saveRelationshipTracker();
    await this.syncRelationshipMemoryState(baseRelationship);
    return result;
  }

  async prepareMilestonesForUserTurn(memory, userMessage, conversationAt) {
    const baseRelationship =
      memory?.relationship && typeof memory.relationship === "object"
        ? memory.relationship
        : {};
    const { milestones, newlyTriggeredMilestones } = advanceMilestones({
      relationship: baseRelationship,
      userMessage,
      now: conversationAt
    });
    const nextRelationship = {
      ...baseRelationship,
      milestones
    };

    await this.memoryStore.updateRelationship(nextRelationship);

    if (memory && typeof memory === "object") {
      memory.relationship = nextRelationship;
    }

    return {
      relationship: this.getRelationshipState(nextRelationship),
      relationshipForPersistence: nextRelationship,
      milestonePromptBlock: buildMilestonePromptBlock(newlyTriggeredMilestones),
      newlyTriggeredMilestones
    };
  }

  async loadMemorySnapshot() {
    const memorySnapshot = await this.memoryStore.loadMemorySnapshot();
    this.memorySnapshot = this.mergeRelationshipIntoMemorySnapshot(memorySnapshot);
    this.persona = buildPersona(this.memorySnapshot.profile);
    return this.memorySnapshot;
  }

  buildDefaultSpeechState() {
    const tts = getTtsCapabilities(this.config);

    return {
      provider: tts.id,
      label: tts.label,
      available: tts.available,
      reason: tts.reason,
      status: this.runtimeSession.voiceModeEnabled
        ? tts.available
          ? "primed"
          : "placeholder"
        : "idle",
      pendingSegments: 0,
      lastError: null,
      sessionId: null,
      preset: null
    };
  }

  buildStatusSnapshot(avatar) {
    const asr = getAsrCapabilities(this.config);
    const speech = this.currentSpeech
      ? this.currentSpeech.getState()
      : this.buildDefaultSpeechState();

    return {
      phase: avatar.presence,
      speech,
      asr: {
        provider: asr.id,
        label: asr.label,
        available: asr.available,
        configured: asr.configured,
        status: asr.status,
        reason: asr.reason
      },
      thinkingMode: this.runtimeSession.thinkingMode
    };
  }

  buildVoiceModeState() {
    const tts = getTtsCapabilities(this.config);

    return {
      enabled: Boolean(this.runtimeSession.voiceModeEnabled),
      available: tts.available,
      provider: tts.id,
      inputMode: "text",
      outputMode: this.runtimeSession.voiceModeEnabled
        ? tts.available
          ? "text-voice"
          : "text-voice-pending"
        : "text",
      reason: tts.reason
    };
  }

  async buildAppState({
    memorySnapshot = null,
    avatar = null,
    messages = null,
    welcomeNote = null,
    onboarding = null
  } = {}) {
    const memory = memorySnapshot || this.memorySnapshot || (await this.loadMemorySnapshot());
    const nextAvatar =
      avatar ||
      this.currentAvatar ||
      this.buildPresenceAvatar(
        this.runtimeSession.voiceModeEnabled ? "listening" : "idle"
      );
    const nextOnboarding =
      onboarding ||
      (hasCompletedCurrentOnboarding(memory.profile)
        ? buildCompletedOnboardingState(memory.profile)
        : buildOnboardingState(memory.profile));
    const tts = getTtsCapabilities(this.config);
    const asr = getAsrCapabilities(this.config);

    this.currentAvatar = nextAvatar;

    return {
      app: {
        name: this.config.app.name,
        tagline: this.config.app.tagline
      },
      persona: {
        name: this.persona.name,
        shortBio: this.persona.shortBio,
        userName: memory.profile?.user?.name || ""
      },
      avatar: nextAvatar,
      avatarAsset: buildAvatarAssetState(this.config),
      messages: messages ?? this.runtimeSession.messages,
      bridgeDiaryNote: this.bridgeDiaryNote || "",
      welcomeNote:
        welcomeNote ??
        (nextOnboarding.required
          ? "第一面不用填表。先决定她怎么叫你，再从第一句话开始。"
          : buildWelcomeNote(memory)),
      memoryPeek: buildMemoryPeek(memory),
      voiceMode: this.buildVoiceModeState(),
      thinkingMode: this.runtimeSession.thinkingMode,
      thinkingModes: listThinkingModes(),
      llm: {
        provider: this.config.llm.provider,
        apiKey: this.config.llm.apiKey,
        model: this.config.llm.model
      },
      tts: {
        ...tts,
        enabled: Boolean(this.config.tts.enabled),
        voiceId: this.config.tts?.voiceId || ""
      },
      asr: {
        ...asr,
        enabled: Boolean(this.config.asr.enabled)
      },
      audio: {
        bgmEnabled: Boolean(this.config.audio?.bgmEnabled),
        ttsEnabled: Boolean(this.config.audio?.ttsEnabled)
      },
      status: this.buildStatusSnapshot(nextAvatar),
      modelStatus: buildModelStatus(
        this.config,
        this.runtimeSession,
        this.persistedState
      ),
      onboarding: nextOnboarding,
      session: {
        launchTurnCount: this.runtimeSession.launchTurnCount,
        lifetimeTurnCount: this.runtimeSession.lifetimeTurnCount
      }
    };
  }

  buildPresenceAvatar(presence) {
    const relationshipStage = this.getRelationshipState(
      this.memorySnapshot?.relationship
    ).stage;
    const plan = resolveInteractionPlan({
      intent: {
        replyText: this.lastReplyText,
        thinkingMode: this.runtimeSession?.thinkingMode || "balanced"
      },
      presence,
      voiceModeEnabled: Boolean(this.runtimeSession?.voiceModeEnabled),
      ttsCapabilities: getTtsCapabilities(this.config),
      ttsModel: this.config.tts.model,
      relationshipStage,
      lastActiveAt: this.persistedState?.lastActiveAt || null,
      history: this.policyHistory
    });

    return {
      ...mapAvatarState(plan),
      relationshipStage
    };
  }

  buildSpeakingAvatar({ replyText, userMessage, llmIntent = null }) {
    const relationshipStage = this.getRelationshipState(
      this.memorySnapshot?.relationship
    ).stage;
    const intent = buildInteractionIntent({
      assistantResponse: {
        text: replyText
      },
      thinkingMode: this.runtimeSession.thinkingMode,
      userMessage,
      relationshipStage,
      llmIntent
    });

    const plan = resolveInteractionPlan({
      intent,
      presence: "speaking",
      voiceModeEnabled: Boolean(this.runtimeSession.voiceModeEnabled),
      ttsCapabilities: getTtsCapabilities(this.config),
      ttsModel: this.config.tts.model,
      relationshipStage,
      lastActiveAt: this.persistedState?.lastActiveAt || null,
      history: this.policyHistory
    });

    return {
      intent,
      avatar: {
        ...mapAvatarState(plan),
        relationshipStage
      },
      plan
    };
  }

  async emitAvatarState(onEvent, avatar) {
    if (!onEvent) {
      return;
    }

    onEvent({
      type: "assistant-state",
      avatar,
      status: this.buildStatusSnapshot(avatar),
      voiceMode: this.buildVoiceModeState(),
      thinkingMode: this.runtimeSession.thinkingMode,
      modelStatus: buildModelStatus(
        this.config,
        this.runtimeSession,
        this.persistedState
      )
    });
  }

  createSpeechOrchestrator(onEvent) {
    const tts = getTtsCapabilities(this.config);
    console.log("[vela-core] createSpeechOrchestrator", {
      voiceModeEnabled: Boolean(this.runtimeSession.voiceModeEnabled),
      ttsAvailable: tts.available,
      ttsProvider: tts.id,
      ttsConfigured: tts.configured,
      hasApiKey: tts.hasApiKey
    });

    const speech = new SpeechOrchestrator({
      config: this.config,
      voiceModeEnabled: this.runtimeSession.voiceModeEnabled,
      onEvent: (event) => {
        if (event.type === "speech-finished") {
          speech.lifecycle.finished = true;
          onEvent?.(event);
          if (!event.cancelled) {
            this.currentAvatar = this.buildPresenceAvatar(
              this.runtimeSession.voiceModeEnabled ? "listening" : "idle"
            );
            void this.emitAvatarState(onEvent, this.currentAvatar);
          }

          this.currentSpeech = null;
          return;
        }

        if (event.type === "speech-error") {
          speech.lifecycle.sawError = true;
        }

        onEvent?.(event);
      }
    });

    speech.lifecycle = {
      sawError: false,
      finished: false
    };
    this.currentSpeech = speech;
    speech.emitCurrentState();
    return speech;
  }

  async settleSpeechAfterFailure(onEvent, speech, error) {
    if (error) {
      onEvent?.({
        type: "speech-error",
        message: error?.message || "speech finish failed"
      });
    }

    if (this.currentSpeech !== speech || speech?.lifecycle?.finished) {
      return;
    }

    speech.lifecycle.finished = true;
    this.currentAvatar = this.buildPresenceAvatar(
      this.runtimeSession.voiceModeEnabled ? "listening" : "idle"
    );
    this.currentSpeech = null;
    onEvent?.({
      type: "speech-finished",
      sessionId: speech?.getState?.().sessionId || null,
      cancelled: false,
      failed: true
    });
    await this.emitAvatarState(onEvent, this.currentAvatar);
  }

  async cancelCurrentSpeech(onEvent) {
    const speech = this.currentSpeech;

    if (!speech) {
      return;
    }

    await speech.cancel();

    if (this.currentSpeech === speech) {
      this.currentSpeech = null;
      onEvent?.({
        type: "speech-finished",
        sessionId: speech?.getState?.().sessionId || null,
        cancelled: true
      });
    }
  }

  async getBootstrapState() {
    const memory = await this.loadMemorySnapshot();
    const avatar = this.buildPresenceAvatar(
      this.runtimeSession.voiceModeEnabled ? "listening" : "idle"
    );

    void this.generateBridgeDiaryNote(memory).catch(() => {});

    return this.buildAppState({
      memorySnapshot: memory,
      avatar,
      messages: [],
      onboarding: hasCompletedCurrentOnboarding(memory.profile)
        ? buildCompletedOnboardingState(memory.profile)
        : buildOnboardingState(memory.profile)
    });
  }

  async generateBridgeDiaryNote(memorySnapshot = null) {
    const memory = memorySnapshot || this.memorySnapshot || (await this.loadMemorySnapshot());
    const note = await generateBridgeDiary({
      recentSummaries: memory?.recentSummaries || [],
      bridgeSummary: memory?.bridgeSummary || null,
      config: this.config,
      userFacts: memory?.userFacts || [],
      relationship: this.getRelationshipState(memory?.relationship)
    });

    this.bridgeDiaryNote = note || null;
    return this.bridgeDiaryNote;
  }

  async completeOnboarding(payload) {
    const completedVersion = payload?.completedVersion ?? CONFIG_SCHEMA_VERSION;
    await this.memoryStore.completeOnboarding({
      ...(payload || {}),
      completedVersion
    });
    await this.syncRelationshipMemoryState({
      ...(this.memorySnapshot?.relationship || {}),
      sharedMoments: this.memorySnapshot?.relationship?.sharedMoments || []
    });

    const memory = await this.loadMemorySnapshot();
    const replyText = `${this.persona.name}，我醒来了。接下来我会用现在的语气陪你，也会慢慢记住关于你的事。`;
    const { avatar, plan } = this.buildSpeakingAvatar({
      replyText,
      userMessage: payload.userName || ""
    });

    this.lastReplyText = replyText;
    this.currentAvatar = avatar;
    this.policyHistory = {
      ...this.policyHistory,
      ...plan.historyPatch
    };

    return this.buildAppState({
      memorySnapshot: memory,
      avatar,
      messages: [
        {
          id: randomUUID(),
          role: "assistant",
          createdAt: new Date().toISOString(),
          content: replyText
        }
      ],
      welcomeNote: "唤醒完成。现在可以把第一句话交给她。",
      onboarding: {
        required: false,
        completed: true,
        completedVersion: CONFIG_SCHEMA_VERSION
      }
    });
  }

  async persistConfigPatch(patch = {}) {
    const configPath = this.runtimePaths?.userConfigPath;
    let parsed = {};

    if (!configPath) {
      throw new Error("User config path is unavailable");
    }

    try {
      const raw = await fs.readFile(configPath, "utf8");
      parsed = parse(raw.replace(/^\uFEFF/, "")) || {};
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw error;
      }
    }

    const mergeObjects = (base, override) => {
      const result = { ...(base || {}) };

      for (const [key, value] of Object.entries(override || {})) {
        if (
          value &&
          typeof value === "object" &&
          !Array.isArray(value) &&
          result[key] &&
          typeof result[key] === "object" &&
          !Array.isArray(result[key])
        ) {
          result[key] = mergeObjects(result[key], value);
        } else {
          result[key] = value;
        }
      }

      return result;
    };

    const nextConfig = mergeObjects(parsed, patch);
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, `${JSON.stringify(nextConfig, null, 2)}\n`, "utf8");

    await this.reloadConfig();
    return nextConfig;
  }

  async updateSettings(payload = {}) {
    const hasOwnField = (key) =>
      Object.prototype.hasOwnProperty.call(payload || {}, key);
    const llmDefaultsByProvider = {
      "openai-compatible": {
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4.1-mini",
        apiKeyEnv: "OPENAI_API_KEY"
      },
      "anthropic-messages": {
        baseUrl: "https://api.anthropic.com",
        model: "claude-sonnet-4-20250514",
        apiKeyEnv: "ANTHROPIC_API_KEY"
      },
      "minimax-messages": {
        baseUrl: "https://api.minimaxi.com/anthropic",
        model: "MiniMax-M2.7",
        apiKeyEnv: "MINIMAX_API_KEY"
      }
    };
    const userName = hasOwnField("userName")
      ? String(payload?.userName || "").trim()
      : String(
          this.config?.user?.name ||
            this.memorySnapshot?.profile?.user?.name ||
            ""
        ).trim();
    const bgmEnabled = sanitizeBooleanFlag(
      payload?.bgmEnabled,
      Boolean(this.config?.audio?.bgmEnabled)
    );
    const llmProvider = String(
      payload?.llmProvider || this.config?.llm?.provider || "openai-compatible"
    )
      .trim()
      .toLowerCase();
    const llmDefaults =
      llmDefaultsByProvider[llmProvider] ||
      llmDefaultsByProvider["openai-compatible"];
    const llmBaseUrl = String(
      payload?.llmBaseUrl || this.config?.llm?.baseUrl || llmDefaults.baseUrl
    ).trim();
    const llmModel = String(
      payload?.llmModel || this.config?.llm?.model || llmDefaults.model
    ).trim();
    const llmApiKey = hasOwnField("llmApiKey")
      ? String(payload?.llmApiKey || "").trim()
      : String(this.config?.llm?.apiKey || "").trim();
    const ttsSelection = String(
      payload?.ttsProvider ||
        (this.config?.tts?.enabled
          ? this.config?.tts?.provider || "minimax-websocket"
          : "off")
    )
      .trim()
      .toLowerCase();
    const ttsProvider =
      ttsSelection === "webspeech"
        ? "webspeech"
        : ttsSelection === "minimax-websocket"
          ? "minimax-websocket"
          : "placeholder";
    const ttsConfigured = ttsSelection !== "off";
    const audioTtsEnabled = hasOwnField("ttsEnabled")
      ? sanitizeBooleanFlag(payload?.ttsEnabled, Boolean(this.config?.audio?.ttsEnabled))
      : hasOwnField("ttsProvider") && !ttsConfigured
        ? false
        : Boolean(this.config?.audio?.ttsEnabled);
    const ttsApiKey = hasOwnField("ttsApiKey")
      ? String(payload?.ttsApiKey || "").trim()
      : String(this.config?.tts?.apiKey || "").trim();
    const voiceId = String(
      payload?.voiceId || this.config?.tts?.voiceId || ""
    ).trim();

    await this.persistConfigPatch({
      user: {
        name: userName
      },
      llm: {
        provider: llmProvider,
        baseUrl: llmBaseUrl,
        model: llmModel,
        apiKey: llmApiKey,
        apiKeyEnv: llmDefaults.apiKeyEnv
      },
      tts: {
        enabled: ttsConfigured,
        provider: ttsProvider,
        apiKey: ttsProvider === "minimax-websocket" ? ttsApiKey : "",
        apiKeyEnv: ttsProvider === "minimax-websocket" ? "MINIMAX_API_KEY" : "",
        voiceId: voiceId || this.config?.tts?.voiceId || ""
      },
      audio: {
        bgmEnabled,
        ttsEnabled: audioTtsEnabled
      }
    });

    this.runtimeSession.voiceModeEnabled = Boolean(this.config?.audio?.ttsEnabled);
    await this.sessionStore.savePreferences(this.runtimeSession);

    await this.memoryStore.completeOnboarding({
      userName,
      completedVersion: CONFIG_SCHEMA_VERSION
    });
    const memory = await this.loadMemorySnapshot();
    this.persona = buildPersona(memory.profile);

    return this.buildAppState({
      memorySnapshot: memory,
      avatar: this.currentAvatar
    });
  }

  async completeOnboardingV2(payload = {}) {
    const hasOwnField = (key) =>
      Object.prototype.hasOwnProperty.call(payload || {}, key);
    const llmDefaultsByProvider = {
      "openai-compatible": {
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4.1-mini",
        apiKeyEnv: "OPENAI_API_KEY"
      },
      "anthropic-messages": {
        baseUrl: "https://api.anthropic.com",
        model: "claude-sonnet-4-20250514",
        apiKeyEnv: "ANTHROPIC_API_KEY"
      },
      "minimax-messages": {
        baseUrl: "https://api.minimaxi.com/anthropic",
        model: "MiniMax-M2.7",
        apiKeyEnv: "MINIMAX_API_KEY"
      }
    };
    const userName = String(payload?.userName || "").trim();
    const llmProvider = String(
      payload?.llmProvider || this.config?.llm?.provider || "openai-compatible"
    )
      .trim()
      .toLowerCase();
    const llmDefaults =
      llmDefaultsByProvider[llmProvider] ||
      llmDefaultsByProvider["openai-compatible"];
    const llmBaseUrl = String(
      payload?.llmBaseUrl || this.config?.llm?.baseUrl || llmDefaults.baseUrl
    ).trim();
    const llmModel = String(
      payload?.llmModel || this.config?.llm?.model || llmDefaults.model
    ).trim();
    const llmApiKey = hasOwnField("llmApiKey")
      ? String(payload?.llmApiKey || "").trim()
      : String(this.config?.llm?.apiKey || "").trim();
    const asrEnabled = hasOwnField("asrEnabled")
      ? Boolean(payload?.asrEnabled)
      : Boolean(this.config?.asr?.enabled);
    const ttsSelection = String(payload?.ttsProvider || "off")
      .trim()
      .toLowerCase();
    const ttsProvider =
      ttsSelection === "webspeech"
        ? "webspeech"
        : ttsSelection === "minimax-websocket"
          ? "minimax-websocket"
          : "placeholder";
    const ttsEnabled = ttsSelection !== "off";
    const ttsApiKey = hasOwnField("ttsApiKey")
      ? String(payload?.ttsApiKey || "").trim()
      : String(this.config?.tts?.apiKey || "").trim();
    const voiceId = String(
      payload?.voiceId || this.config?.tts?.voiceId || ""
    ).trim();
    let isLocalOpenAiWithoutKey = false;

    if (llmProvider === "openai-compatible") {
      try {
        const parsedBaseUrl = new URL(llmBaseUrl);
        const hostname = String(parsedBaseUrl.hostname || "")
          .trim()
          .toLowerCase();
        isLocalOpenAiWithoutKey = [
          "localhost",
          "127.0.0.1",
          "0.0.0.0",
          "::1"
        ].includes(hostname);
      } catch {
        isLocalOpenAiWithoutKey = false;
      }
    }

    const effectiveLlmApiKey =
      llmApiKey ||
      (llmDefaults.apiKeyEnv ? process.env[llmDefaults.apiKeyEnv] || "" : "");
    const effectiveTtsApiKey =
      ttsProvider === "minimax-websocket"
        ? ttsApiKey ||
          (llmProvider === "minimax-messages" ? effectiveLlmApiKey : "") ||
          (process.env.MINIMAX_API_KEY || "")
        : "";

    if (!userName) {
      throw new Error("User name is required");
    }

    if (!isLocalOpenAiWithoutKey && !effectiveLlmApiKey) {
      throw new Error("LLM API key is required");
    }

    if (ttsProvider === "minimax-websocket" && !effectiveTtsApiKey) {
      throw new Error("MiniMax Voice requires an API key");
    }

    await this.persistConfigPatch({
      user: {
        name: userName
      },
      llm: {
        provider: llmProvider,
        baseUrl: llmBaseUrl,
        model: llmModel,
        apiKey: llmApiKey,
        apiKeyEnv: llmDefaults.apiKeyEnv
      },
      asr: {
        enabled: asrEnabled,
        provider: "webspeech"
      },
      tts: {
        enabled: ttsEnabled,
        provider: ttsProvider,
        apiKey: ttsProvider === "minimax-websocket" ? effectiveTtsApiKey : "",
        apiKeyEnv: ttsProvider === "minimax-websocket" ? "MINIMAX_API_KEY" : "",
        voiceId: voiceId || this.config.tts.voiceId
      }
    });

    await this.memoryStore.completeOnboarding({
      userName,
      velaName: this.persona?.name || "Vela",
      temperament: "gentle-cool",
      distance: "warm",
      completedVersion: CONFIG_SCHEMA_VERSION
    });

    const memory = await this.loadMemorySnapshot();
    this.persona = buildPersona(memory.profile);

    return this.buildAppState({
      memorySnapshot: memory,
      avatar: this.currentAvatar,
      onboarding: {
        required: false,
        completed: true,
        completedVersion: CONFIG_SCHEMA_VERSION
      },
      welcomeNote: "初始化完成，设置可随时在 Settings 里调整。"
    });
  }

  async setVoiceMode(enabled, options = {}) {
    const nextEnabled = Boolean(enabled);
    console.log("[vela-core] setVoiceMode called", {
      enabled: nextEnabled
    });

    await this.persistConfigPatch({
      audio: {
        ttsEnabled: nextEnabled
      }
    });

    this.runtimeSession.voiceModeEnabled = nextEnabled;
    await this.sessionStore.savePreferences(this.runtimeSession);
    console.log("[vela-core] setVoiceMode updated runtime session", {
      runtimeVoiceModeEnabled: Boolean(this.runtimeSession.voiceModeEnabled)
    });

    if (!nextEnabled && this.currentSpeech) {
      await this.cancelCurrentSpeech(options.onEvent);
    }

    this.currentAvatar = settleAvatarState(
      this.currentAvatar || this.buildPresenceAvatar("idle"),
      {
        voiceModeEnabled: nextEnabled
      }
    );

    await this.emitAvatarState(options.onEvent, this.currentAvatar);

    return this.buildAppState({
      avatar: this.currentAvatar
    });
  }

  async setThinkingMode(mode) {
    this.runtimeSession.thinkingMode = normalizeThinkingMode(mode);
    await this.sessionStore.savePreferences(this.runtimeSession);

    return this.buildAppState({
      avatar: this.currentAvatar
    });
  }

  async setModelSelection(selection) {
    const normalizedSelection = String(selection || "").trim().toLowerCase() || "auto";

    this.runtimeSession.selectedModel = normalizedSelection;
    this.runtimeSession.providerRouting = {
      ...this.runtimeSession.providerRouting,
      selectedModel: normalizedSelection
    };

    await this.sessionStore.saveProviderRouting(this.runtimeSession);
    this.persistedState = await this.sessionStore.loadPersistedState();
  }

  async switchModel(selection) {
    const normalizedSelection = String(selection || "").trim().toLowerCase() || "auto";

    if (
      normalizedSelection !== "auto" &&
      !resolveModelSelection(this.config, normalizedSelection)
    ) {
      return this.buildAppState({
        messages: [
          ...this.runtimeSession.messages,
          buildInvalidModelMessage(this.config)
        ],
        welcomeNote: ""
      });
    }

    await this.setModelSelection(normalizedSelection);

    return this.buildAppState({
      messages: [
        ...this.runtimeSession.messages,
        buildModelSwitchMessage(this.config, normalizedSelection)
      ],
      welcomeNote: ""
    });
  }

  async interruptOutput(options = {}) {
    if (this.currentSpeech) {
      await this.cancelCurrentSpeech(options.onEvent);
    }

    this.currentAvatar = this.buildPresenceAvatar(
      this.runtimeSession.voiceModeEnabled ? "listening" : "idle"
    );
    await this.emitAvatarState(options.onEvent, this.currentAvatar);

    return this.buildAppState({
      avatar: this.currentAvatar
    });
  }

  async persistProviderRouting(providerRouting) {
    this.runtimeSession.providerRouting = {
      ...this.runtimeSession.providerRouting,
      ...providerRouting
    };
    this.runtimeSession.selectedModel =
      this.runtimeSession.providerRouting.selectedModel ||
      this.runtimeSession.selectedModel ||
      "auto";
    await this.sessionStore.saveProviderRouting(this.runtimeSession);
    this.persistedState = await this.sessionStore.loadPersistedState();
  }

  async cacheBrowserLocation(location) {
    const lat = Number(location?.lat ?? location?.latitude);
    const lon = Number(location?.lon ?? location?.longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return null;
    }

    this.persistedState = await this.sessionStore.updatePersistedState((state) => ({
      ...state,
      cachedLocation: {
        lat,
        lon,
        cachedAt: String(location?.cachedAt || new Date().toISOString())
      }
    }));

    return this.buildAppState({
      avatar: this.currentAvatar
    });
  }

  async updateWeatherState(weather) {
    const weatherCondition = normalizeWeatherConditionForState(weather);

    if (!weatherCondition) {
      return;
    }

    this.persistedState = await this.sessionStore.updatePersistedState((state) => ({
      ...state,
      lastWeatherCondition: weatherCondition
    }));
  }

  async buildAwarenessPacket(memory, relevantMemories, options = {}) {
    const behaviorPatterns = await loadBehaviorPatterns(this.localStore).catch(
      () => null
    );
    const relationship = this.getRelationshipState(memory.relationship);
    const timeAwareness = getTimeAwareness({
      runtimeSession: this.runtimeSession,
      lastActiveAt: this.persistedState?.lastActiveAt || null
    });
    const weather = await getWeatherAwareness({
      config: this.config,
      persistedState: this.persistedState,
      fetchImpl: options.fetchImpl
    }).catch(() => null);
    await this.updateWeatherState(weather);
    const relationshipUnlockHints = buildRelationshipUnlockHints(relationship);
    const awarenessPacket = buildContextFusion({
      timeAwareness,
      weather,
      profile: memory.profile,
      relationship,
      bridgeSummary: memory.bridgeSummary,
      openFollowUps: memory.openFollowUps || [],
      recentSummaries: memory.recentSummaries,
      relevantMemories,
      userFacts: memory.userFacts || [],
      behaviorPatterns,
      relationshipUnlockHints
    });

    return {
      awarenessPacket,
      relationshipUnlockHints
    };
  }

  async maybeProactiveOpen(options = {}) {
    if (!this.memorySnapshot) {
      await this.loadMemorySnapshot();
    }

    if (!this.memorySnapshot?.profile?.onboarding?.completed) {
      return null;
    }

    if (this.currentSpeech || this.currentAvatar?.presence === "speaking") {
      return null;
    }

    const relationshipStage = this.getRelationshipState(
      this.memorySnapshot?.relationship
    ).stage;
    const decision = shouldGreetOnOpen(this.persistedState, relationshipStage);

    if (!decision.shouldGreet) {
      return null;
    }

    return this.generateProactiveMessage(decision.greetingContext, options);
  }

  async maybeProactiveTrigger(options = {}) {
    if (!this.memorySnapshot) {
      await this.loadMemorySnapshot();
    }

    if (!this.memorySnapshot?.profile?.onboarding?.completed) {
      return null;
    }

    if (this.currentSpeech || this.currentAvatar?.presence === "speaking") {
      return null;
    }

    const memory = this.memorySnapshot || (await this.loadMemorySnapshot());
    const timeAwareness = {
      ...getTimeAwareness({
        runtimeSession: this.runtimeSession,
        lastActiveAt: this.persistedState?.lastActiveAt || null
      }),
      sessionMinutesActive: Number.isFinite(Date.parse(this.runtimeSession?.launchedAt))
        ? Math.max(0, (Date.now() - Date.parse(this.runtimeSession.launchedAt)) / 60000)
        : 0
    };
    const weather = await getWeatherAwareness({
      config: this.config,
      persistedState: this.persistedState,
      fetchImpl: options.fetchImpl
    }).catch(() => null);
    const previousPersistedState = this.persistedState;
    const relationshipStage = this.getRelationshipState(
      this.memorySnapshot?.relationship
    ).stage;
    const decision = checkInConversationTrigger(
      timeAwareness,
      weather,
      previousPersistedState,
      relationshipStage
    );
    await this.updateWeatherState(weather);

    if (!decision.shouldTrigger) {
      return null;
    }

    return this.generateProactiveMessage(decision.triggerContext, options, {
      memory
    });
  }

  async generateProactiveMessage(greetingContext, options = {}, overrides = {}) {
    const trimmedContext = String(greetingContext || "").trim();

    if (!trimmedContext) {
      return this.buildAppState({
        avatar: this.currentAvatar
      });
    }

    if (this.currentSpeech) {
      await this.cancelCurrentSpeech(options.onEvent);
    }

    if (this.currentAvatar?.presence === "speaking") {
      return this.buildAppState({
        avatar: this.currentAvatar
      });
    }

    const memory =
      overrides.memory || this.memorySnapshot || (await this.loadMemorySnapshot());
    const relevantMemories = overrides.relevantMemories || [];
    const relationship = this.getRelationshipState(memory.relationship);
    const { awarenessPacket, relationshipUnlockHints } =
      overrides.awarenessPacket && overrides.relationshipUnlockHints
        ? {
            awarenessPacket: overrides.awarenessPacket,
            relationshipUnlockHints: overrides.relationshipUnlockHints
          }
        : await this.buildAwarenessPacket(memory, relevantMemories, options);
    const context = buildContext({
      persona: this.persona,
      profile: memory.profile,
      relationship,
      relationshipStage: relationship.stage,
      bridgeSummary: memory.bridgeSummary,
      openFollowUps: memory.openFollowUps || [],
      recentSummaries: memory.recentSummaries,
      relevantMemories,
      userFacts: memory.userFacts || [],
      runtimeSession: this.runtimeSession,
      recentTranscriptBudget: this.config.runtime.recentTranscriptBudget || 6000,
      awarenessPacket,
      relationshipUnlockHints,
      isInRegressionMood: relationship.isInRegressionMood
    });
    const proactiveSystemPrompt = [
      context.systemPrompt,
      `主动开场提示：${trimmedContext}`,
      "这是一次主动开口，不要表现成被动回答。",
      "请自然生成一段简短、贴近当前氛围的问候。"
    ].join("\n\n");
    const proactiveContext = {
      ...context,
      systemPrompt: proactiveSystemPrompt
    };
    const assistantMessageId = randomUUID();
    let assistantResponse = null;
    let speech = null;

    const providerOptions = {
      thinkingMode: this.runtimeSession.thinkingMode,
      fetchImpl: options.fetchImpl,
      modelSelection: this.runtimeSession.selectedModel,
      providerState: this.runtimeSession.providerRouting,
      persistProviderState: async (providerRouting) => {
        await this.persistProviderRouting(providerRouting);
      }
    };

    this.currentAvatar = this.buildPresenceAvatar("thinking");
    await this.emitAvatarState(options.onEvent, this.currentAvatar);

    if (options.onEvent) {
      options.onEvent({
        type: "assistant-stream-start",
        messageId: assistantMessageId
      });

      if (this.runtimeSession.voiceModeEnabled) {
        speech = this.createSpeechOrchestrator(options.onEvent);
      }
    }

    assistantResponse = await generateReply(
      proactiveContext,
      this.config,
      providerOptions
    );

    const parsedPerformance = parsePerformancePrefix(assistantResponse.text);
    assistantResponse.text = parsedPerformance.text;
    assistantResponse.blocks = replaceTextBlocks(
      assistantResponse.blocks,
      assistantResponse.text
    );

    const assistantReply = assistantResponse.text;
    this.lastReplyText = assistantReply;

    const { avatar: speakingAvatar, plan } = this.buildSpeakingAvatar({
      replyText: assistantReply,
      userMessage: "",
      llmIntent: parsedPerformance.intent || null
    });
    this.policyHistory = {
      ...this.policyHistory,
      ...plan.historyPatch
    };
    this.currentAvatar = speakingAvatar;

    const assistantTurn = {
      id: assistantMessageId,
      role: "assistant",
      content: assistantReply,
      createdAt: new Date().toISOString(),
      blocks: assistantResponse.blocks,
      llm: {
        text: assistantResponse.text,
        thinking: assistantResponse.thinking,
        usage: assistantResponse.usage,
        finishReason: assistantResponse.finishReason,
        providerMeta: assistantResponse.providerMeta
      }
    };

    this.runtimeSession.messages.push(assistantTurn);
    this.runtimeSession.messages = this.runtimeSession.messages.slice(
      -this.config.runtime.sessionMessageLimit
    );

    const nowIso = new Date().toISOString();
    const summary = createTurnSummary({
      sessionId: this.runtimeSession.sessionId,
      userMessage: trimmedContext,
      assistantReply,
      avatar: speakingAvatar,
      triggerReasons: ["proactive"],
      summaryLabel: "主动问候"
    });
    const proactiveCountToday = Number(this.persistedState?.proactiveCountToday || 0) + 1;

    await this.memoryStore.appendTurnSummary(summary);
    await this.recordRelationshipTurn(
      parsedPerformance.intent || { emotion: "calm", intensity: 0 }
    );
    const relationshipStage = this.relationshipTracker?.stage || speakingAvatar.relationshipStage;
    const avatarForPersistence = {
      ...speakingAvatar,
      relationshipStage
    };
    this.persistedState = await this.sessionStore.save(
      this.runtimeSession,
      avatarForPersistence,
      summary,
      assistantResponse.providerMeta,
      {
        proactiveCountToday,
        lastProactiveAt: nowIso,
        lastProactiveDate: getDateKey(nowIso)
      }
    );

    const nextMemory = await this.loadMemorySnapshot();

    if (speech) {
      void speech
        .pushDelta(assistantReply, plan)
        .then(() => speech.finish())
        .catch((error) => {
          options.onEvent?.({
            type: "speech-error",
            message: error.message || "speech delta failed"
          });
        });
    }

    options.onEvent?.({
      type: "assistant-stream-complete",
      messageId: assistantMessageId,
      content: assistantReply,
      providerMeta: assistantResponse.providerMeta
    });
    this.currentAvatar = avatarForPersistence;
    await this.emitAvatarState(options.onEvent, avatarForPersistence);

    return this.buildAppState({
      memorySnapshot: nextMemory,
      avatar: avatarForPersistence,
      messages: this.runtimeSession.messages,
      welcomeNote: "",
      onboarding: {
        required: false,
        completed: true
      }
    });
  }

  async handleUserMessage(message, options = {}) {
    const trimmedMessage = String(message || "").trim();
    if (!trimmedMessage) {
      return this.getBootstrapState();
    }

    const modelCommand = parseModelCommand(trimmedMessage);
    if (modelCommand) {
      return this.switchModel(modelCommand);
    }

    if (this.currentSpeech) {
      await this.cancelCurrentSpeech(options.onEvent);
    }

    const memory = await this.loadMemorySnapshot();
    const userTurn = {
      id: randomUUID(),
      role: "user",
      content: trimmedMessage,
      createdAt: new Date().toISOString(),
      blocks: [
        {
          type: "text",
          text: trimmedMessage
        }
      ]
    };

    this.runtimeSession.messages.push(userTurn);

    this.currentAvatar = this.buildPresenceAvatar("thinking");
    await this.emitAvatarState(options.onEvent, this.currentAvatar);

    const {
      relationship: relationship,
      relationshipForPersistence,
      milestonePromptBlock
    } = await this.prepareMilestonesForUserTurn(
      memory,
      trimmedMessage,
      userTurn.createdAt
    );

    const inferredEmotion = inferEmotionFromText(trimmedMessage);
    const relevantMemories = await this.memoryRetriever.retrieveRelevantMemories({
      userInput: trimmedMessage,
      currentEmotion: inferredEmotion,
      limit: this.config.runtime.relevantMemoryLimit || 3
    });
    const { awarenessPacket, relationshipUnlockHints } =
      await this.buildAwarenessPacket(memory, relevantMemories, options);
    let context = buildContext({
      persona: this.persona,
      profile: memory.profile,
      relationship,
      relationshipStage: relationship.stage,
      bridgeSummary: memory.bridgeSummary,
      openFollowUps: memory.openFollowUps || [],
      recentSummaries: memory.recentSummaries,
      relevantMemories,
      userFacts: memory.userFacts || [],
      runtimeSession: this.runtimeSession,
      recentTranscriptBudget: this.config.runtime.recentTranscriptBudget || 6000,
      awarenessPacket,
      relationshipUnlockHints,
      isInRegressionMood: relationship.isInRegressionMood
    });
    context = appendSystemPromptBlock(context, milestonePromptBlock);

    const assistantMessageId = randomUUID();
    let assistantResponse = null;
    let streamedText = "";
    let speech = null;
    let speechQueuedText = false;
    let prefixBuffer = null;
    let streamingIntent = null;
    let streamingAvatarResolved = false;

    console.log("[vela-core] handleUserMessage processing", {
      voiceModeEnabled: Boolean(this.runtimeSession.voiceModeEnabled),
      hasOnEvent: typeof options.onEvent === "function",
      ttsEnabled: Boolean(this.config?.tts?.enabled),
      ttsProvider: this.config?.tts?.provider || null
    });

    const providerOptions = {
      thinkingMode: this.runtimeSession.thinkingMode,
      fetchImpl: options.fetchImpl,
      modelSelection: this.runtimeSession.selectedModel,
      providerState: this.runtimeSession.providerRouting,
      persistProviderState: async (providerRouting) => {
        await this.persistProviderRouting(providerRouting);
      }
    };

    if (options.onEvent) {
      options.onEvent({
        type: "assistant-stream-start",
        messageId: assistantMessageId
      });

      if (this.runtimeSession.voiceModeEnabled) {
        speech = this.createSpeechOrchestrator(options.onEvent);
      }

      console.log("[vela-core] speech orchestrator status", {
        created: Boolean(speech)
      });

      prefixBuffer = createStreamPrefixBuffer();

      assistantResponse = await generateReplyStream(context, this.config, {
        ...providerOptions,
        onEvent: (event) => {
          if (event.type === "thinking-delta") {
            options.onEvent?.({
              type: "assistant-thinking-delta",
              messageId: assistantMessageId,
              delta: event.delta
            });
            return;
          }

          if (event.type === "text-delta") {
            const prefixResult = prefixBuffer.push(event.delta);

            if (!prefixResult.resolved) {
              return;
            }

            if (!streamingAvatarResolved) {
              streamingAvatarResolved = true;
              streamingIntent = prefixResult.intent || null;
              streamedText = prefixResult.textDelta;
            } else {
              streamedText += prefixResult.textDelta;
            }

            const { avatar, plan } = this.buildSpeakingAvatar({
              replyText: streamedText,
              userMessage: trimmedMessage,
              llmIntent: streamingIntent
            });

            this.currentAvatar = avatar;
            void this.emitAvatarState(options.onEvent, avatar);

            if (prefixResult.textDelta) {
              options.onEvent?.({
                type: "assistant-stream-delta",
                messageId: assistantMessageId,
                delta: prefixResult.textDelta,
                content: streamedText
              });
            }

            if (speech && prefixResult.textDelta) {
              speechQueuedText = true;
              void speech.pushDelta(prefixResult.textDelta, plan).catch((error) => {
                options.onEvent?.({
                  type: "speech-error",
                  message: error.message || "speech delta failed"
                });
              });
            }
          }
        }
      });
    } else {
      assistantResponse = await generateReply(context, this.config, providerOptions);
    }

    const parsedPerformance = options.onEvent
      ? prefixBuffer?.isResolved()
        ? {
            intent: streamingIntent || prefixBuffer.getIntent(),
            text: streamedText
          }
        : parsePerformancePrefix(assistantResponse.text)
      : parsePerformancePrefix(assistantResponse.text);

    assistantResponse.text = parsedPerformance.text;
    assistantResponse.blocks = replaceTextBlocks(
      assistantResponse.blocks,
      assistantResponse.text
    );

    const assistantReply = assistantResponse.text;
    this.lastReplyText = assistantReply;

    const { avatar: speakingAvatar, plan } = this.buildSpeakingAvatar({
      replyText: assistantReply,
      userMessage: trimmedMessage,
      llmIntent:
        parsedPerformance.intent ||
        streamingIntent ||
        prefixBuffer?.getIntent() ||
        null
    });
    this.policyHistory = {
      ...this.policyHistory,
      ...plan.historyPatch
    };

    const assistantTurn = {
      id: assistantMessageId,
      role: "assistant",
      content: assistantReply,
      createdAt: new Date().toISOString(),
      blocks: assistantResponse.blocks,
      llm: {
        text: assistantResponse.text,
        thinking: assistantResponse.thinking,
        usage: assistantResponse.usage,
        finishReason: assistantResponse.finishReason,
        providerMeta: assistantResponse.providerMeta
      }
    };

    this.runtimeSession.launchTurnCount += 1;
    this.runtimeSession.lifetimeTurnCount += 1;
    this.runtimeSession.messages.push(assistantTurn);
    this.runtimeSession.messages = this.runtimeSession.messages.slice(
      -this.config.runtime.sessionMessageLimit
    );

    const triggerReasons = buildSummaryTriggers({
      turnIndex: this.runtimeSession.lifetimeTurnCount,
      lastActiveAt: this.persistedState?.lastActiveAt || null,
      userMessage: trimmedMessage,
      assistantReply,
      avatar: speakingAvatar
    });

    const summary = createTurnSummary({
      sessionId: this.runtimeSession.sessionId,
      userMessage: trimmedMessage,
      assistantReply,
      avatar: speakingAvatar,
      triggerReasons
    });

    await this.memoryStore.appendTurnSummary(summary);
    await this.recordRelationshipTurn(
      parsedPerformance.intent ||
        streamingIntent ||
        prefixBuffer?.getIntent() || {
          emotion: "calm",
          intensity: 0
        },
      relationshipForPersistence
    );
    const relationshipStage = this.relationshipTracker?.stage || speakingAvatar.relationshipStage;
    const avatarForPersistence = {
      ...speakingAvatar,
      relationshipStage
    };
    await this.sessionStore.save(
      this.runtimeSession,
      avatarForPersistence,
      summary,
      assistantResponse.providerMeta
    );
    this.persistedState = await this.sessionStore.loadPersistedState();

    const nextMemory = await this.loadMemorySnapshot();
    this.currentAvatar = avatarForPersistence;

    if (speech) {
      if (!speechQueuedText && assistantReply.trim()) {
        console.log("[vela-core] speech fallback push after stream completion", {
          replyLength: assistantReply.length
        });
        try {
          await speech.pushDelta(assistantReply, plan);
          speechQueuedText = true;
        } catch (error) {
          options.onEvent?.({
            type: "speech-error",
            message: error.message || "speech fallback delta failed"
          });
        }
      }

      void speech
        .finish()
        .then(() => {
          if (speech.lifecycle?.sawError && !speech.lifecycle?.finished) {
            return this.settleSpeechAfterFailure(options.onEvent, speech);
          }

          return null;
        })
        .catch((error) =>
          this.settleSpeechAfterFailure(options.onEvent, speech, error)
        );
    }

    const nextState = await this.buildAppState({
      memorySnapshot: nextMemory,
      avatar: avatarForPersistence,
      messages: this.runtimeSession.messages,
      welcomeNote: "",
      onboarding: {
        required: false,
        completed: true
      }
    });

    options.onEvent?.({
      type: "assistant-stream-complete",
      messageId: assistantMessageId,
      content: assistantReply,
      providerMeta: assistantResponse.providerMeta
    });
    await this.emitAvatarState(options.onEvent, avatarForPersistence);

    void this.runBackgroundMemoryTasks({
      userMessage: trimmedMessage,
      assistantReply,
      avatar: avatarForPersistence,
      turnIndex: this.runtimeSession.lifetimeTurnCount
    });

    return nextState;
  }

  async runBackgroundMemoryTasks({ userMessage, assistantReply, avatar, turnIndex }) {
    try {
      const triggerReasons = buildSummaryTriggers({
        turnIndex,
        lastActiveAt: this.persistedState?.lastActiveAt || null,
        userMessage,
        assistantReply,
        avatar
      });

      if (triggerReasons.length > 0) {
        await this.memorySummarizer?.summarizeTurn({
          userMessage,
          assistantReply,
          emotion: avatar?.emotion,
          action: avatar?.action,
          turnIndex,
          triggerReasons,
          lastActiveAt: this.persistedState?.lastActiveAt || null
        });
      }

      if (turnIndex > 0 && turnIndex % 12 === 0) {
        const episodes =
          (await this.memoryRetriever?.loadEpisodes?.()) ||
          (await this.memoryStore.loadEpisodes());
        await this.memoryStore.evaluateRelationship(episodes);
      }

      if (
        turnIndex > 0 &&
        turnIndex % (this.config.runtime.behaviorPatternRefreshTurns || 24) === 0
      ) {
        await updateBehaviorPatternsIfNeeded({
          store: this.localStore,
          memoryStore: this.memoryStore,
          turnIndex
        });
      }
    } catch (error) {
      console.warn("background memory task failed:", error?.message || error);
    }
  }
}
