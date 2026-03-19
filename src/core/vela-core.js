import path from "node:path";
import { randomUUID } from "node:crypto";
import { loadConfig } from "./config.js";
import { defaultPersona } from "./default-persona.js";
import { LocalStore } from "./local-store.js";
import { MemoryStore } from "./memory-store.js";
import { SessionStateStore } from "./session-state.js";
import { buildContext } from "./context-builder.js";
import { mapAvatarState } from "./avatar-state.js";
import { generateReply } from "./provider.js";

function clipText(text, limit = 48) {
  if (!text) {
    return "";
  }

  return text.length > limit ? `${text.slice(0, limit)}…` : text;
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
    summary: `聊到「${topicLabel}」，Vela 用${avatar.emotionLabel}但克制的语气接住了这轮对话。`,
    userSnippet: clipText(userMessage, 48),
    assistantSnippet: clipText(assistantReply, 60),
    avatar
  };
}

function buildWelcomeNote(recentSummary) {
  if (!recentSummary) {
    return "我在。今天如果有想继续的事，或者只是想随便说一句，都可以直接开始。";
  }

  return `上次我们停在「${recentSummary.topicLabel || clipText(recentSummary.summary, 24)}」。如果你愿意，可以从那里继续，也可以换一件新的事。`;
}

export class VelaCore {
  constructor({ rootDir, userDataDir }) {
    this.rootDir = rootDir;
    this.userDataDir = userDataDir;
    this.config = null;
    this.persona = defaultPersona;
    this.localStore = null;
    this.memoryStore = null;
    this.sessionStore = null;
    this.runtimeSession = null;
  }

  async initialize() {
    this.config = await loadConfig(this.rootDir);

    const storageRoot = path.resolve(
      this.rootDir,
      this.config.runtime.storageRoot
    );

    this.localStore = new LocalStore(storageRoot);
    this.memoryStore = new MemoryStore(this.localStore, this.config);
    this.sessionStore = new SessionStateStore(this.localStore);

    await this.memoryStore.initialize();
    await this.sessionStore.initialize();

    const persistedState = await this.sessionStore.loadPersistedState();
    this.runtimeSession = this.sessionStore.createRuntimeSession(persistedState);
  }

  getConfig() {
    return this.config;
  }

  async getBootstrapState() {
    const memory = await this.memoryStore.loadMemorySnapshot();
    const avatar = mapAvatarState({ presence: "listening" });

    return {
      app: {
        name: this.config.app.name,
        tagline: this.config.app.tagline
      },
      persona: {
        name: this.persona.name,
        shortBio: this.persona.shortBio
      },
      avatar,
      messages: [],
      welcomeNote: buildWelcomeNote(memory.recentSummaries[0]),
      memoryPeek: memory.recentSummaries[0]
        ? {
            summary: memory.recentSummaries[0].summary,
            createdAtLabel: formatTime(memory.recentSummaries[0].createdAt)
          }
        : null,
      voiceMode: {
        enabled: false,
        available: false
      },
      session: {
        launchTurnCount: this.runtimeSession.launchTurnCount,
        lifetimeTurnCount: this.runtimeSession.lifetimeTurnCount
      }
    };
  }

  async handleUserMessage(message) {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      return this.getBootstrapState();
    }

    const memory = await this.memoryStore.loadMemorySnapshot();
    const userTurn = {
      id: randomUUID(),
      role: "user",
      content: trimmedMessage
    };

    this.runtimeSession.messages.push(userTurn);

    const context = buildContext({
      persona: this.persona,
      profile: memory.profile,
      relationship: memory.relationship,
      recentSummaries: memory.recentSummaries,
      runtimeSession: this.runtimeSession,
      userMessage: trimmedMessage
    });

    const assistantReply = await generateReply(context, this.config);
    const avatar = mapAvatarState({
      presence: "speaking",
      replyText: assistantReply
    });
    const assistantTurn = {
      id: randomUUID(),
      role: "assistant",
      content: assistantReply
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
      avatar
    });

    await this.memoryStore.appendTurnSummary(summary);
    await this.sessionStore.save(this.runtimeSession, avatar, summary);

    const nextMemory = await this.memoryStore.loadMemorySnapshot();

    return {
      app: {
        name: this.config.app.name,
        tagline: this.config.app.tagline
      },
      persona: {
        name: this.persona.name,
        shortBio: this.persona.shortBio
      },
      avatar,
      messages: this.runtimeSession.messages,
      welcomeNote: "",
      memoryPeek: nextMemory.recentSummaries[0]
        ? {
            summary: nextMemory.recentSummaries[0].summary,
            createdAtLabel: formatTime(nextMemory.recentSummaries[0].createdAt)
          }
        : null,
      voiceMode: {
        enabled: false,
        available: false
      },
      session: {
        launchTurnCount: this.runtimeSession.launchTurnCount,
        lifetimeTurnCount: this.runtimeSession.lifetimeTurnCount
      }
    };
  }
}
