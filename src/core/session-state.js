import { randomUUID } from "node:crypto";

const SESSION_STATE_FILE = "state/session.json";

function defaultPersistedState() {
  return {
    lastSessionId: null,
    lifetimeTurnCount: 0,
    lastSummaryId: null,
    lastActiveAt: null,
    lastAvatar: {
      presence: "listening",
      emotion: "calm"
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
      messages: []
    };
  }

  async save(runtimeSession, avatar, summary) {
    await this.store.writeJson(SESSION_STATE_FILE, {
      lastSessionId: runtimeSession.sessionId,
      lifetimeTurnCount: runtimeSession.lifetimeTurnCount,
      lastSummaryId: summary.id,
      lastActiveAt: summary.createdAt,
      lastAvatar: avatar,
      lastTopic: summary.topicLabel
    });
  }
}
