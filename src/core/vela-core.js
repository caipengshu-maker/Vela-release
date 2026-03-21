import path from "node:path";
import { randomUUID } from "node:crypto";
import { loadConfig } from "./config.js";
import {
  buildPersona,
  onboardingOptions,
  relationshipPreset
} from "./default-persona.js";
import { LocalStore } from "./local-store.js";
import { MemoryStore } from "./memory-store.js";
import { MemoryRetriever, inferEmotionFromText } from "./memory-retriever.js";
import { MemorySummarizer } from "./memory-summarizer.js";
import { SessionStateStore } from "./session-state.js";
import { buildContext } from "./context-builder.js";
import { updateBehaviorPatternsIfNeeded } from "./behavior-patterns.js";
import { buildContextFusion } from "./context-fusion.js";
import { getTimeAwareness } from "./context-providers/time-provider.js";
import { getWeatherAwareness } from "./context-providers/weather-provider.js";
import {
  mapAvatarState,
  settleAvatarState
} from "./avatar-state.js";
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

function extractTopicLabel(text) {
  const cleaned = String(text || "").replace(/\s+/g, " ").trim();
  return cleaned ? clipText(cleaned, 18) : "近况";
}

function createTurnSummary({ sessionId, userMessage, assistantReply, avatar }) {
  const createdAt = new Date().toISOString();
  const topicLabel = extractTopicLabel(userMessage);

  return {
    id: randomUUID(),
    sessionId,
    createdAt,
    topicLabel,
    summary: `聊到“${topicLabel}”，Vela 以${avatar.emotionLabel}、克制的方式把这轮对话接住了。`,
    userSnippet: clipText(userMessage, 48),
    assistantSnippet: clipText(assistantReply, 60),
    avatar
  };
}

function buildWelcomeNote(recentSummary) {
  if (!recentSummary) {
    return "如果你今天有想继续的事，或者只想先说一句，也可以直接开始。";
  }

  return `上次我们停在“${recentSummary.topicLabel || clipText(recentSummary.summary, 24)}”。如果你愿意，可以从那里继续，也可以换一件新的事。`;
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
    prompt: "先告诉我，我该怎么称呼你。轻轻一句就够了。",
    fields: {
      velaName: onboarding.velaName || "Vela",
      userName: onboarding.userName || "",
      temperament: onboarding.temperament || "gentle-cool",
      distance: onboarding.distance || "warm"
    },
    options: onboardingOptions
  };
}

function buildMemoryPeek(memory) {
  return memory.recentSummaries[0]
    ? {
        summary: memory.recentSummaries[0].summary,
        createdAtLabel: formatTime(memory.recentSummaries[0].createdAt)
      }
    : null;
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
  const stage = String(relationship?.stage || "warm").trim().toLowerCase();

  switch (stage) {
    case "reserved":
      return ["先保持礼貌和分寸，重点是接住情绪，不要抢着靠近。"];
    case "warm":
      return ["可以有一点朦胧和靠近感，但不要突然使用强亲密称呼。"];
    case "close":
      return ["亲密感可以更自然一点，但仍然以真实和克制为先。"];
    case "intimate":
      return ["已经足够熟悉，也要避免用力过猛，保持自然流动。"];
    default:
      return ["先保持自然和分寸，不要突然越级表达。"];
  }
}

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

export class VelaCore {
  constructor({ rootDir, userDataDir }) {
    this.rootDir = rootDir;
    this.userDataDir = userDataDir;
    this.config = null;
    this.persona = null;
    this.localStore = null;
    this.memoryStore = null;
    this.memoryRetriever = null;
    this.memorySummarizer = null;
    this.sessionStore = null;
    this.runtimeSession = null;
    this.persistedState = null;
    this.memorySnapshot = null;
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

  async initialize() {
    this.config = await loadConfig(this.rootDir);

    const storageRoot = path.resolve(
      this.rootDir,
      this.config.runtime.storageRoot
    );

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

    await this.memoryStore.initialize();
    await this.sessionStore.initialize();

    this.persistedState = await this.sessionStore.loadPersistedState();
    this.runtimeSession = this.sessionStore.createRuntimeSession(this.persistedState);
    this.runtimeSession.thinkingMode = normalizeThinkingMode(
      this.runtimeSession.thinkingMode
    );
    this.runtimeSession.selectedModel =
      this.runtimeSession.providerRouting?.selectedModel || "auto";

    this.memorySnapshot = await this.memoryStore.loadMemorySnapshot();
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

  async loadMemorySnapshot() {
    this.memorySnapshot = await this.memoryStore.loadMemorySnapshot();
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
      (memory.profile.onboarding?.completed
        ? {
            required: false,
            completed: true
          }
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
        shortBio: this.persona.shortBio
      },
      avatar: nextAvatar,
      avatarAsset: buildAvatarAssetState(this.config),
      messages: messages ?? this.runtimeSession.messages,
      welcomeNote:
        welcomeNote ??
        (nextOnboarding.required
          ? "第一面不用填表。先决定她怎么叫你，再从第一句话开始。"
          : buildWelcomeNote(memory.recentSummaries[0])),
      memoryPeek: buildMemoryPeek(memory),
      voiceMode: this.buildVoiceModeState(),
      thinkingMode: this.runtimeSession.thinkingMode,
      thinkingModes: listThinkingModes(),
      tts,
      asr,
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
    const plan = resolveInteractionPlan({
      intent: {
        replyText: this.lastReplyText,
        thinkingMode: this.runtimeSession?.thinkingMode || "balanced"
      },
      presence,
      voiceModeEnabled: Boolean(this.runtimeSession?.voiceModeEnabled),
      ttsCapabilities: getTtsCapabilities(this.config),
      ttsModel: this.config.tts.model,
      relationshipStage: this.memorySnapshot?.relationship.stage || "warm",
      lastActiveAt: this.persistedState?.lastActiveAt || null,
      history: this.policyHistory
    });

    return mapAvatarState(plan);
  }

  buildSpeakingAvatar({ replyText, userMessage, llmIntent = null }) {
    const intent = buildInteractionIntent({
      assistantResponse: {
        text: replyText
      },
      thinkingMode: this.runtimeSession.thinkingMode,
      userMessage,
      relationshipStage: this.memorySnapshot?.relationship.stage || "warm",
      llmIntent
    });

    const plan = resolveInteractionPlan({
      intent,
      presence: "speaking",
      voiceModeEnabled: Boolean(this.runtimeSession.voiceModeEnabled),
      ttsCapabilities: getTtsCapabilities(this.config),
      ttsModel: this.config.tts.model,
      relationshipStage: this.memorySnapshot?.relationship.stage || "warm",
      lastActiveAt: this.persistedState?.lastActiveAt || null,
      history: this.policyHistory
    });

    return {
      intent,
      avatar: mapAvatarState(plan),
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

    return this.buildAppState({
      memorySnapshot: memory,
      avatar,
      messages: [],
      onboarding: memory.profile.onboarding?.completed
        ? {
            required: false,
            completed: true
          }
        : buildOnboardingState(memory.profile)
    });
  }

  async completeOnboarding(payload) {
    await this.memoryStore.completeOnboarding(payload);
    const relationship = relationshipPreset(payload.distance);
    await this.memoryStore.updateRelationship({
      stage: relationship.stage,
      note: relationship.note,
      sharedMoments: []
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
        completed: true
      }
    });
  }

  async setVoiceMode(enabled, options = {}) {
    this.runtimeSession.voiceModeEnabled = Boolean(enabled);
    await this.sessionStore.savePreferences(this.runtimeSession);

    if (!enabled && this.currentSpeech) {
      await this.cancelCurrentSpeech(options.onEvent);
    }

    this.currentAvatar = settleAvatarState(
      this.currentAvatar || this.buildPresenceAvatar("idle"),
      {
        voiceModeEnabled: Boolean(enabled)
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

  async buildAwarenessPacket(memory, relevantMemories, options = {}) {
    const behaviorPatterns = await updateBehaviorPatternsIfNeeded({
      store: this.localStore,
      memoryStore: this.memoryStore,
      turnIndex: this.runtimeSession.lifetimeTurnCount
    }).catch(() => null);
    const timeAwareness = getTimeAwareness({
      runtimeSession: this.runtimeSession,
      lastActiveAt: this.persistedState?.lastActiveAt || null
    });
    const weather = await getWeatherAwareness({
      config: this.config,
      fetchImpl: options.fetchImpl
    }).catch(() => null);
    const relationshipUnlockHints = buildRelationshipUnlockHints(memory.relationship);
    const awarenessPacket = buildContextFusion({
      timeAwareness,
      weather,
      profile: memory.profile,
      relationship: memory.relationship,
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

  async handleUserMessage(message, options = {}) {
    const trimmedMessage = String(message || "").trim();
    if (!trimmedMessage) {
      return this.getBootstrapState();
    }

    const modelCommand = parseModelCommand(trimmedMessage);
    if (modelCommand) {
      const selection = modelCommand.toLowerCase();

      if (selection !== "auto" && !resolveModelSelection(this.config, selection)) {
        return this.buildAppState({
          messages: [...this.runtimeSession.messages, buildInvalidModelMessage(this.config)],
          welcomeNote: ""
        });
      }

      await this.setModelSelection(selection);

      return this.buildAppState({
        messages: [...this.runtimeSession.messages, buildModelSwitchMessage(this.config, selection)],
        welcomeNote: ""
      });
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

    const inferredEmotion = inferEmotionFromText(trimmedMessage);
    const relevantMemories = await this.memoryRetriever.retrieveRelevantMemories({
      userInput: trimmedMessage,
      currentEmotion: inferredEmotion
    });
    const { awarenessPacket, relationshipUnlockHints } =
      await this.buildAwarenessPacket(memory, relevantMemories, options);
    const context = buildContext({
      persona: this.persona,
      profile: memory.profile,
      relationship: memory.relationship,
      recentSummaries: memory.recentSummaries,
      relevantMemories,
      userFacts: memory.userFacts || [],
      runtimeSession: this.runtimeSession,
      awarenessPacket,
      relationshipUnlockHints
    });

    const assistantMessageId = randomUUID();
    let assistantResponse = null;
    let streamedText = "";
    let speech = null;
    let prefixBuffer = null;
    let streamingIntent = null;
    let streamingAvatarResolved = false;

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

    const summary = createTurnSummary({
      sessionId: this.runtimeSession.sessionId,
      userMessage: trimmedMessage,
      assistantReply,
      avatar: speakingAvatar
    });

    await this.memoryStore.appendTurnSummary(summary);
    await this.sessionStore.save(
      this.runtimeSession,
      speakingAvatar,
      summary,
      assistantResponse.providerMeta
    );
    this.persistedState = await this.sessionStore.loadPersistedState();

    const nextMemory = await this.loadMemorySnapshot();
    this.currentAvatar = speakingAvatar;

    if (speech) {
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
      avatar: speakingAvatar,
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
    await this.emitAvatarState(options.onEvent, speakingAvatar);

    void this.runBackgroundMemoryTasks({
      userMessage: trimmedMessage,
      assistantReply,
      avatar: speakingAvatar,
      turnIndex: this.runtimeSession.lifetimeTurnCount
    });

    return nextState;
  }

  async runBackgroundMemoryTasks({ userMessage, assistantReply, avatar, turnIndex }) {
    try {
      await this.memorySummarizer?.summarizeTurn({
        userMessage,
        assistantReply,
        emotion: avatar?.emotion,
        action: avatar?.action,
        turnIndex
      });

      if (turnIndex > 0 && turnIndex % 10 === 0) {
        const episodes =
          (await this.memoryRetriever?.loadEpisodes?.()) ||
          (await this.memoryStore.loadEpisodes());
        await this.memoryStore.evaluateRelationship(episodes);
      }

      if (turnIndex > 0 && turnIndex % 20 === 0) {
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
