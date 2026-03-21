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
import { generateReply, generateReplyStream } from "./provider.js";
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
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return "近况";
  }

  return clipText(cleaned, 18);
}

function createTurnSummary({ sessionId, userMessage, assistantReply, avatar }) {
  const createdAt = new Date().toISOString();
  const topicLabel = extractTopicLabel(userMessage);

  return {
    id: randomUUID(),
    sessionId,
    createdAt,
    topicLabel,
    summary: `聊到“${topicLabel}”，Vela 用${avatar.emotionLabel}而克制的方式把这轮对话接住了。`,
    userSnippet: clipText(userMessage, 48),
    assistantSnippet: clipText(assistantReply, 60),
    avatar
  };
}

function buildWelcomeNote(recentSummary) {
  if (!recentSummary) {
    return "我在。今天如果有想继续的事，或者只是想随便说一句，都可以直接开始。";
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
    prompt: "先告诉我，我该怎么称呼你。轻轻一句就好。",
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
      this.buildPresenceAvatar(this.runtimeSession.voiceModeEnabled ? "listening" : "idle");
    const nextOnboarding = onboarding ||
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
          ? "第一次见面，不用填表。先决定我叫什么、像什么样的人、要用什么距离靠近你。"
          : buildWelcomeNote(memory.recentSummaries[0])),
      memoryPeek: buildMemoryPeek(memory),
      voiceMode: this.buildVoiceModeState(),
      thinkingMode: this.runtimeSession.thinkingMode,
      thinkingModes: listThinkingModes(),
      tts,
      asr,
      status: this.buildStatusSnapshot(nextAvatar),
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
      thinkingMode: this.runtimeSession.thinkingMode
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

    if (this.currentSpeech !== speech) {
      return;
    }

    if (speech?.lifecycle?.finished) {
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
          content: replyText
        }
      ],
      welcomeNote: "唤醒成功。现在你可以把第一句话交给她。",
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

    this.currentAvatar = settleAvatarState(this.currentAvatar || this.buildPresenceAvatar("idle"), {
      voiceModeEnabled: Boolean(enabled)
    });

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

  async handleUserMessage(message, options = {}) {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      return this.getBootstrapState();
    }

    if (this.currentSpeech) {
      await this.cancelCurrentSpeech(options.onEvent);
    }

    const memory = await this.loadMemorySnapshot();
    const userTurn = {
      id: randomUUID(),
      role: "user",
      content: trimmedMessage,
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
    const context = buildContext({
      persona: this.persona,
      profile: memory.profile,
      relationship: memory.relationship,
      recentSummaries: memory.recentSummaries,
      relevantMemories,
      userFacts: memory.userFacts || [],
      runtimeSession: this.runtimeSession
    });

    const assistantMessageId = randomUUID();
    let assistantResponse = null;
    let streamedText = "";
    let speech = null;
    let prefixBuffer = null;
    let streamingIntent = null;
    let streamingAvatarResolved = false;

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
        thinkingMode: this.runtimeSession.thinkingMode,
        fetchImpl: options.fetchImpl,
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
      assistantResponse = await generateReply(context, this.config, {
        thinkingMode: this.runtimeSession.thinkingMode,
        fetchImpl: options.fetchImpl
      });
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
      llmIntent: parsedPerformance.intent || streamingIntent || prefixBuffer?.getIntent() || null
    });
    this.policyHistory = {
      ...this.policyHistory,
      ...plan.historyPatch
    };

    const assistantTurn = {
      id: assistantMessageId,
      role: "assistant",
      content: assistantReply,
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
    await this.sessionStore.save(this.runtimeSession, speakingAvatar, summary);
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
    } catch (error) {
      console.warn("background memory task failed:", error?.message || error);
    }
  }
}
