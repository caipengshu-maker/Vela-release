import { randomUUID } from "node:crypto";

const SESSION_STATE_FILE = "state/session.json";

function defaultProviderRouting() {
  return {
    selectedModel: "auto",
    primaryFailures: 0,
    cooldownUntil: null,
    lastFailureAt: null,
    lastErrorReason: null,
    lastResolved: null
  };
}

function mergeProviderRouting(providerRouting = {}) {
  const base = defaultProviderRouting();

  return {
    ...base,
    ...providerRouting,
    selectedModel:
      String(providerRouting?.selectedModel || base.selectedModel).trim() ||
      base.selectedModel,
    primaryFailures: Number.isFinite(Number(providerRouting?.primaryFailures))
      ? Number(providerRouting.primaryFailures)
      : base.primaryFailures,
    cooldownUntil: providerRouting?.cooldownUntil || null,
    lastFailureAt: providerRouting?.lastFailureAt || null,
    lastErrorReason: providerRouting?.lastErrorReason || null,
    lastResolved: providerRouting?.lastResolved || null
  };
}

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
    lastTopic: null,
    providerRouting: defaultProviderRouting()
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
    const persistedState = await this.store.readJson(
      SESSION_STATE_FILE,
      defaultPersistedState()
    );

    return {
      ...defaultPersistedState(),
      ...persistedState,
      providerRouting: mergeProviderRouting(persistedState.providerRouting)
    };
  }

  createRuntimeSession(persistedState) {
    const providerRouting = mergeProviderRouting(persistedState.providerRouting);

    return {
      sessionId: randomUUID(),
      launchedAt: new Date().toISOString(),
      launchTurnCount: 0,
      lifetimeTurnCount: persistedState.lifetimeTurnCount || 0,
      lastSummaryId: persistedState.lastSummaryId || null,
      voiceModeEnabled: Boolean(persistedState.voiceModeEnabled),
      thinkingMode: persistedState.thinkingMode || "balanced",
      selectedModel: providerRouting.selectedModel,
      providerRouting,
      messages: []
    };
  }

  async save(runtimeSession, avatar, summary, providerMeta = null) {
    const persistedState = await this.loadPersistedState();
    const providerRouting = mergeProviderRouting(runtimeSession.providerRouting);

    if (providerMeta) {
      providerRouting.lastResolved = {
        ...providerMeta,
        at: new Date().toISOString()
      };
    }

    await this.store.writeJson(SESSION_STATE_FILE, {
      ...persistedState,
      lastSessionId: runtimeSession.sessionId,
      lifetimeTurnCount: runtimeSession.lifetimeTurnCount,
      lastSummaryId: summary.id,
      lastActiveAt: summary.createdAt,
      voiceModeEnabled: Boolean(runtimeSession.voiceModeEnabled),
      thinkingMode: runtimeSession.thinkingMode || "balanced",
      lastAvatar: avatar,
      lastTopic: summary.topicLabel,
      providerRouting
    });
  }

  async savePreferences(runtimeSession) {
    const persistedState = await this.loadPersistedState();

    await this.store.writeJson(SESSION_STATE_FILE, {
      ...persistedState,
      voiceModeEnabled: Boolean(runtimeSession.voiceModeEnabled),
      thinkingMode: runtimeSession.thinkingMode || "balanced",
      providerRouting: mergeProviderRouting(runtimeSession.providerRouting)
    });
  }

  async saveProviderRouting(runtimeSession) {
    const persistedState = await this.loadPersistedState();

    await this.store.writeJson(SESSION_STATE_FILE, {
      ...persistedState,
      voiceModeEnabled: Boolean(runtimeSession.voiceModeEnabled),
      thinkingMode: runtimeSession.thinkingMode || "balanced",
      providerRouting: mergeProviderRouting(runtimeSession.providerRouting)
    });
  }
}
