import { getTimeOfDayLabel } from "./context-providers/time-provider.js";

const PATTERNS_FILE = "memory/patterns.json";

function defaultPatterns() {
  return {
    updatedAt: null,
    lastComputedTurnIndex: 0,
    sourceEpisodeCount: 0,
    peakChatTimes: [],
    topTopics: [],
    routines: []
  };
}

function countValues(items, mapFn) {
  const counts = new Map();

  for (const item of items) {
    const key = mapFn(item);
    if (!key) {
      continue;
    }

    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .map(([label, count]) => ({ label, count }));
}

function buildPeakChatTimes(episodes) {
  return countValues(episodes, (episode) => {
    const createdAt = Date.parse(episode?.createdAt || "");

    if (!Number.isFinite(createdAt)) {
      return null;
    }

    return getTimeOfDayLabel(new Date(createdAt).getHours());
  }).slice(0, 3);
}

function buildTopTopics(episodes) {
  return countValues(episodes, (episode) => {
    const label = String(episode?.topicLabel || "").trim();
    return label || null;
  }).slice(0, 4);
}

function buildRoutines(episodes) {
  const routines = [];
  const workMorningCount = episodes.filter((episode) => {
    const createdAt = Date.parse(episode?.createdAt || "");
    if (!Number.isFinite(createdAt)) {
      return false;
    }

    const date = new Date(createdAt);
    const weekday = date.getDay();
    const text = `${episode?.topicLabel || ""} ${episode?.summary || ""}`;
    return (
      weekday >= 1 &&
      weekday <= 5 &&
      date.getHours() >= 6 &&
      date.getHours() < 10 &&
      /(上班|通勤|开会|工作)/.test(text)
    );
  }).length;

  if (workMorningCount >= 2) {
    routines.push("工作日早上常会聊到上班、通勤或工作安排。");
  }

  const lateNightCount = episodes.filter((episode) => {
    const createdAt = Date.parse(episode?.createdAt || "");
    if (!Number.isFinite(createdAt)) {
      return false;
    }

    const date = new Date(createdAt);
    const hour = date.getHours();
    const text = `${episode?.topicLabel || ""} ${episode?.summary || ""}`;
    return (hour >= 23 || hour < 2) && /(加班|睡不着|失眠|很晚|熬夜)/.test(text);
  }).length;

  if (lateNightCount >= 2) {
    routines.push("深夜时段更容易聊到疲惫、加班或睡不着。");
  }

  const weekendCount = episodes.filter((episode) => {
    const createdAt = Date.parse(episode?.createdAt || "");
    if (!Number.isFinite(createdAt)) {
      return false;
    }

    const date = new Date(createdAt);
    const weekday = date.getDay();
    const text = `${episode?.topicLabel || ""} ${episode?.summary || ""}`;
    return (weekday === 0 || weekday === 6) && /(休息|出去|吃饭|逛|周末)/.test(text);
  }).length;

  if (weekendCount >= 2) {
    routines.push("周末更容易切到休息、出门或轻松一点的话题。");
  }

  return routines.slice(0, 3);
}

function getLatestTurnIndex(episodes) {
  return episodes.reduce((maxTurn, episode) => {
    const turnIndex = Number(episode?.turnIndex);
    return Number.isFinite(turnIndex) ? Math.max(maxTurn, turnIndex) : maxTurn;
  }, 0);
}

export async function loadBehaviorPatterns(store) {
  return store.readJson(PATTERNS_FILE, defaultPatterns());
}

export async function updateBehaviorPatternsIfNeeded({
  store,
  memoryStore,
  turnIndex = 0
} = {}) {
  const existing = await loadBehaviorPatterns(store);
  const episodes = await memoryStore.loadEpisodes();
  const latestTurnIndex = Math.max(turnIndex, getLatestTurnIndex(episodes));

  if (
    existing.updatedAt &&
    latestTurnIndex > 0 &&
    latestTurnIndex - Number(existing.lastComputedTurnIndex || 0) < 20
  ) {
    return existing;
  }

  const patterns = {
    updatedAt: new Date().toISOString(),
    lastComputedTurnIndex: latestTurnIndex,
    sourceEpisodeCount: episodes.length,
    peakChatTimes: buildPeakChatTimes(episodes),
    topTopics: buildTopTopics(episodes),
    routines: buildRoutines(episodes)
  };

  await store.writeJson(PATTERNS_FILE, patterns);
  return patterns;
}
