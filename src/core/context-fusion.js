import { resolveLocale } from "./config.js";

const FUSION_COPY = {
  "zh-CN": {
    timePrefix: "时间感知",
    workday: "工作日",
    weekend: "周末",
    daysSinceLastChat: (value) => `距离上次聊天约 ${value} 天`,
    minutesSinceLastMessage: (value) => `距离上一条消息约 ${value} 分钟`,
    weatherPrefix: "环境感知",
    location: (value) => `位置：${value}`,
    raining: "当前有降雨",
    condition: (value) => `当前天气 ${value}`,
    temperature: (value) => `约 ${value}°C`,
    humidity: (value) => `湿度 ${value}%`,
    wind: (value) => `风速偏大（${value} km/h）`,
    weatherWorthMentioning: "天气值得自然提起。",
    weatherOptional: "如果用户主动问天气可以直接回应，否则不必主动提起。",
    userProfilePrefix: "用户画像",
    preferredName: (value) => `用户称呼：${value}`,
    fact: (key, value) => `${key}：${value}`,
    bridgeSummary: (value) => `桥接摘要：${value}`,
    openFollowUps: "待跟进",
    recentSummaries: (value) => `近期延续：${value}。`,
    relevantMemories: (value) => `相关记忆：${value}。`,
    patterns: (value) => `行为模式（可选）：${value}。`,
    peakTimes: (value) => `常聊时段 ${value}`,
    topTopics: (value) => `高频话题 ${value}`,
    relationship: "关系状态",
    expressionHint: (value) => `表达提示：${value}`,
    expressionPrinciple:
      "表达原则：优先接住当下情绪，顺手借用已知信息，不要为了显得聪明而硬提天气或旧记忆。",
    joiner: "；"
  },
  en: {
    timePrefix: "Time awareness",
    workday: "workday",
    weekend: "weekend",
    daysSinceLastChat: (value) => `about ${value} days since the last chat`,
    minutesSinceLastMessage: (value) => `about ${value} minutes since the last message`,
    weatherPrefix: "Environmental awareness",
    location: (value) => `location: ${value}`,
    raining: "it is currently raining",
    condition: (value) => `current weather: ${value}`,
    temperature: (value) => `about ${value}°C`,
    humidity: (value) => `humidity ${value}%`,
    wind: (value) => `wind is fairly strong (${value} km/h)`,
    weatherWorthMentioning: "The weather is worth mentioning naturally.",
    weatherOptional: "If the user asks about the weather, answer directly. Otherwise there is no need to bring it up first.",
    userProfilePrefix: "User profile",
    preferredName: (value) => `preferred name: ${value}`,
    fact: (key, value) => `${key}: ${value}`,
    bridgeSummary: (value) => `Bridge summary: ${value}`,
    openFollowUps: "Open follow-ups",
    recentSummaries: (value) => `Recent thread: ${value}.`,
    relevantMemories: (value) => `Relevant memories: ${value}.`,
    patterns: (value) => `Behavior patterns (optional): ${value}.`,
    peakTimes: (value) => `usual chat windows: ${value}`,
    topTopics: (value) => `frequent topics: ${value}`,
    relationship: "Relationship",
    expressionHint: (value) => `expression hint: ${value}`,
    expressionPrinciple:
      "Expression principle: meet the current emotion first, then borrow from known context naturally. Do not force weather or old memories in just to sound clever.",
    joiner: "; "
  }
};

function getFusionCopy(locale = "zh-CN") {
  return FUSION_COPY[resolveLocale(locale)];
}

function pushLine(lines, value) {
  if (value) {
    lines.push(value);
  }
}

function formatTimeLine(timeAwareness, locale = "zh-CN") {
  if (!timeAwareness) {
    return "";
  }

  const copy = getFusionCopy(locale);
  const parts = [
    `${timeAwareness.dayOfWeek} ${timeAwareness.timeOfDayLabel} ${String(
      timeAwareness.hour
    ).padStart(2, "0")}:${String(timeAwareness.minute).padStart(2, "0")}`,
    `${timeAwareness.season}`,
    timeAwareness.isWorkday ? copy.workday : copy.weekend
  ];

  if (Number.isFinite(timeAwareness.daysSinceLastChat)) {
    parts.push(copy.daysSinceLastChat(timeAwareness.daysSinceLastChat));
  }

  if (
    Number.isFinite(timeAwareness.minutesSinceLastMessage) &&
    timeAwareness.minutesSinceLastMessage > 0
  ) {
    parts.push(copy.minutesSinceLastMessage(timeAwareness.minutesSinceLastMessage));
  }

  return `${copy.timePrefix}: ${parts.join(copy.joiner)}.`;
}

function isWeatherWorthMentioning(weather) {
  if (!weather) {
    return false;
  }

  if (weather.isRaining) {
    return true;
  }

  if (
    Number.isFinite(weather.temperature) &&
    (weather.temperature <= 5 || weather.temperature >= 32)
  ) {
    return true;
  }

  return Number.isFinite(weather.windSpeed) && weather.windSpeed >= 35;
}

function formatWeatherLine(weather, locale = "zh-CN") {
  if (!weather) {
    return "";
  }

  const copy = getFusionCopy(locale);
  const parts = [];

  if (weather.cityLabel || weather.city) {
    parts.push(copy.location(weather.cityLabel || weather.city));
  }

  if (weather.isRaining) {
    parts.push(copy.raining);
  } else if (weather.condition) {
    parts.push(copy.condition(weather.condition));
  }

  if (Number.isFinite(weather.temperature)) {
    parts.push(copy.temperature(weather.temperature));
  }

  if (Number.isFinite(weather.humidity)) {
    parts.push(copy.humidity(weather.humidity));
  }

  if (Number.isFinite(weather.windSpeed) && weather.windSpeed >= 35) {
    parts.push(copy.wind(weather.windSpeed));
  }

  const proactiveHint = isWeatherWorthMentioning(weather)
    ? copy.weatherWorthMentioning
    : copy.weatherOptional;

  return `${copy.weatherPrefix}: ${parts.join(copy.joiner)}. ${proactiveHint}`;
}

function formatFacts(userFacts = [], profile = null, locale = "zh-CN") {
  const copy = getFusionCopy(locale);
  const lines = [];

  if (profile?.user?.name) {
    lines.push(copy.preferredName(profile.user.name));
  }

  for (const fact of userFacts.slice(0, 4)) {
    if (!fact?.key || !fact?.value) {
      continue;
    }

    lines.push(copy.fact(fact.key, fact.value));
  }

  return lines.length > 0 ? `${copy.userProfilePrefix}: ${lines.join(copy.joiner)}.` : "";
}

function formatBridgeSummary(bridgeSummary, locale = "zh-CN") {
  const copy = getFusionCopy(locale);
  const summary = String(
    bridgeSummary?.summary || bridgeSummary?.text || bridgeSummary || ""
  ).trim();

  return summary ? copy.bridgeSummary(summary) : "";
}

function formatOpenFollowUps(openFollowUps = [], locale = "zh-CN") {
  const copy = getFusionCopy(locale);
  const lines = Array.isArray(openFollowUps)
    ? openFollowUps
        .map((entry) => String(entry?.text || entry?.summary || entry || "").trim())
        .filter(Boolean)
        .slice(0, 3)
    : [];

  if (lines.length === 0) {
    return "";
  }

  return `${copy.openFollowUps}:\n${lines.map((line, index) => `${index + 1}. ${line}`).join("\n")}`;
}

function formatRecentSummaries(recentSummaries = [], locale = "zh-CN") {
  const copy = getFusionCopy(locale);
  const lines = recentSummaries
    .slice(0, 2)
    .map((summary) => String(summary?.summary || "").trim())
    .filter(Boolean);

  return lines.length > 0 ? copy.recentSummaries(lines.join(" / ")) : "";
}

function formatRelevantMemories(relevantMemories = [], locale = "zh-CN") {
  const copy = getFusionCopy(locale);
  const lines = relevantMemories
    .slice(0, 2)
    .map((summary) => String(summary || "").trim())
    .filter(Boolean);

  return lines.length > 0 ? copy.relevantMemories(lines.join(" / ")) : "";
}

function formatPatterns(behaviorPatterns, locale = "zh-CN") {
  if (!behaviorPatterns) {
    return "";
  }

  const copy = getFusionCopy(locale);
  const parts = [];

  if (
    Array.isArray(behaviorPatterns.peakChatTimes) &&
    behaviorPatterns.peakChatTimes.length > 0
  ) {
    const topTime = behaviorPatterns.peakChatTimes
      .slice(0, 2)
      .map((entry) => entry.label)
      .join(copy.joiner);
    parts.push(copy.peakTimes(topTime));
  }

  if (
    Array.isArray(behaviorPatterns.topTopics) &&
    behaviorPatterns.topTopics.length > 0
  ) {
    const topics = behaviorPatterns.topTopics
      .slice(0, 3)
      .map((entry) => entry.label)
      .join(copy.joiner);
    parts.push(copy.topTopics(topics));
  }

  if (Array.isArray(behaviorPatterns.routines) && behaviorPatterns.routines.length > 0) {
    parts.push(behaviorPatterns.routines[0]);
  }

  return parts.length > 0 ? copy.patterns(parts.join(copy.joiner)) : "";
}

function formatRelationshipLine(relationship, relationshipUnlockHints = [], locale = "zh-CN") {
  if (!relationship) {
    return "";
  }

  const copy = getFusionCopy(locale);
  const hint = Array.isArray(relationshipUnlockHints)
    ? relationshipUnlockHints[0]
    : relationshipUnlockHints;
  const segments = [`${copy.relationship}: ${relationship.stage}`];

  if (relationship.note) {
    segments.push(relationship.note);
  }

  if (hint) {
    segments.push(copy.expressionHint(hint));
  }

  return `${segments.join(copy.joiner)}.`;
}

function trimToBudget(text, limit = 2400) {
  const source = String(text || "").trim();
  return source.length > limit ? `${source.slice(0, limit - 1).trim()}...` : source;
}

export function buildContextFusion({
  timeAwareness = null,
  weather = null,
  profile = null,
  relationship = null,
  bridgeSummary = null,
  openFollowUps = [],
  recentSummaries = [],
  relevantMemories = [],
  userFacts = [],
  behaviorPatterns = null,
  relationshipUnlockHints = [],
  locale = "zh-CN"
} = {}) {
  const resolvedLocale = resolveLocale(locale);
  const copy = getFusionCopy(resolvedLocale);
  const lines = [];

  pushLine(lines, formatTimeLine(timeAwareness, resolvedLocale));
  pushLine(lines, formatWeatherLine(weather, resolvedLocale));
  pushLine(lines, formatRelationshipLine(relationship, relationshipUnlockHints, resolvedLocale));
  pushLine(lines, formatFacts(userFacts, profile, resolvedLocale));
  pushLine(lines, formatBridgeSummary(bridgeSummary, resolvedLocale));
  pushLine(lines, formatOpenFollowUps(openFollowUps, resolvedLocale));
  pushLine(lines, formatRecentSummaries(recentSummaries, resolvedLocale));
  pushLine(lines, formatRelevantMemories(relevantMemories, resolvedLocale));
  pushLine(lines, formatPatterns(behaviorPatterns, resolvedLocale));
  pushLine(lines, copy.expressionPrinciple);

  return trimToBudget(lines.join("\n"));
}
