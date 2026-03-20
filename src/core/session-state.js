import { randomUUID } from "node:crypto";

const SESSION_STATE_FILE = "state/session.json";

function defaultPersistedState() {
  return {
    lastSessionId: null,
    lifetimeTurnCount: 0,
    lastSummaryId: null,
    lastActiveAt: null,
    voiceModeEnabled: false,
    thinkingMode: "balanced",
    lastAvatar: {
      presence: "idle",
      emotion: "calm",
      camera: "wide",
      action: "none",
      ttsEmotionMode: "auto"
    },
    lastTopic: null
  };
}

export class SessionStateStore {
  constructor(store) {
    this.store = store;
  }

  async initialize() {
    await this.store.ensureDir("state");
    await this.store.writeJson(
      SESSION_STATE_FILE,
      await this.store.readJson(SESSION_STATE_FILE, defaultPersistedState())
    );
  }

  async loadPersistedState() {
    return this.store.readJson(SESSION_STATE_FILE, defaultPersistedState());
  }

  createRuntimeSession(persistedState) {
    return {
      sessionId: randomUUID(),
      launchedAt: new Date().toISOString(),
      launchTurnCount: 0,
      lifetimeTurnCount: persistedState.lifetimeTurnCount || 0,
      lastSummaryId: persistedState.lastSummaryId || null,
      voiceModeEnabled: Boolean(persistedState.voiceModeEnabled),
      thinkingMode: persistedState.thinkingMode || "balanced",
      messages: []
    };
  }

  async save(runtimeSession, avatar, summary) {
    await this.store.writeJson(SESSION_STATE_FILE, {
      lastSessionId: runtimeSession.sessionId,
      lifetimeTurnCount: runtimeSession.lifetimeTurnCount,
      lastSummaryId: summary.id,
      lastActiveAt: summary.createdAt,
      voiceModeEnabled: Boolean(runtimeSession.voiceModeEnabled),
      thinkingMode: runtimeSession.thinkingMode || "balanced",
      lastAvatar: avatar,
      lastTopic: summary.topicLabel
    });
  }

  async savePreferences(runtimeSession) {
    const persistedState = await this.loadPersistedState();

    await this.store.writeJson(SESSION_STATE_FILE, {
      ...persistedState,
      voiceModeEnabled: Boolean(runtimeSession.voiceModeEnabled),
      thinkingMode: runtimeSession.thinkingMode || "balanced"
    });
  }
}
