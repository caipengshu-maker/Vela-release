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

function formatDateKey(date = new Date()) {
  const current = date instanceof Date ? date : new Date(date);
  const year = current.getFullYear();
  const month = String(current.getMonth() + 1).padStart(2, "0");
  const day = String(current.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeCachedLocation(location) {
  if (!location || typeof location !== "object") {
    return null;
  }

  const lat = Number(location.lat ?? location.latitude);
  const lon = Number(location.lon ?? location.longitude);
  const cachedAt = String(location.cachedAt || "").trim();

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !cachedAt) {
    return null;
  }

  return {
    lat,
    lon,
    cachedAt
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
    proactiveCountToday: 0,
    lastProactiveAt: null,
    lastProactiveDate: null,
    lastWeatherCondition: null,
    cachedLocation: null,
    providerRouting: defaultProviderRouting()
  };
}

function normalizePersistedState(persistedState = {}) {
  const base = defaultPersistedState();
  const merged = {
    ...base,
    ...persistedState,
    lastAvatar: {
      ...base.lastAvatar,
      ...(persistedState?.lastAvatar || {})
    },
    providerRouting: mergeProviderRouting(persistedState.providerRouting),
    cachedLocation: normalizeCachedLocation(persistedState.cachedLocation)
  };
  const today = formatDateKey();

  merged.proactiveCountToday = Number.isFinite(Number(merged.proactiveCountToday))
    ? Number(merged.proactiveCountToday)
    : 0;

  if (merged.lastProactiveDate && merged.lastProactiveDate !== today) {
    merged.proactiveCountToday = 0;
  }

  merged.lastProactiveAt = merged.lastProactiveAt || null;
  merged.lastProactiveDate = merged.lastProactiveDate || null;
  merged.lastWeatherCondition =
    String(merged.lastWeatherCondition || "").trim() || null;

  return merged;
}

export class SessionStateStore {
  constructor(store) {
    this.store = store;
  }

  async initialize() {
    await this.store.ensureDir("state");
    await this.store.writeJson(
      SESSION_STATE_FILE,
      normalizePersistedState(
        await this.store.readJson(SESSION_STATE_FILE, defaultPersistedState())
      )
    );
  }

  async loadPersistedState() {
    const persistedState = await this.store.readJson(
      SESSION_STATE_FILE,
      defaultPersistedState()
    );

    return normalizePersistedState(persistedState);
  }

  async updatePersistedState(updater) {
    const persistedState = await this.loadPersistedState();
    const nextState =
      typeof updater === "function"
        ? updater(structuredClone(persistedState))
        : { ...persistedState, ...(updater || {}) };

    const normalized = normalizePersistedState({
      ...persistedState,
      ...nextState
    });

    await this.store.writeJson(SESSION_STATE_FILE, normalized);
    return normalized;
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

  async save(runtimeSession, avatar, summary, providerMeta = null, persistedStatePatch = {}) {
    const persistedState = await this.loadPersistedState();
    const providerRouting = mergeProviderRouting(runtimeSession.providerRouting);

    if (providerMeta) {
      providerRouting.lastResolved = {
        ...providerMeta,
        at: new Date().toISOString()
      };
    }

    const nextState = normalizePersistedState({
      ...persistedState,
      ...persistedStatePatch,
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

    await this.store.writeJson(SESSION_STATE_FILE, nextState);
    return nextState;
  }

  async savePreferences(runtimeSession) {
    const persistedState = await this.loadPersistedState();

    await this.store.writeJson(
      SESSION_STATE_FILE,
      normalizePersistedState({
        ...persistedState,
        voiceModeEnabled: Boolean(runtimeSession.voiceModeEnabled),
        thinkingMode: runtimeSession.thinkingMode || "balanced",
        providerRouting: mergeProviderRouting(runtimeSession.providerRouting)
      })
    );
  }

  async saveProviderRouting(runtimeSession) {
    const persistedState = await this.loadPersistedState();

    await this.store.writeJson(
      SESSION_STATE_FILE,
      normalizePersistedState({
        ...persistedState,
        voiceModeEnabled: Boolean(runtimeSession.voiceModeEnabled),
        thinkingMode: runtimeSession.thinkingMode || "balanced",
        providerRouting: mergeProviderRouting(runtimeSession.providerRouting)
      })
    );
  }
}
