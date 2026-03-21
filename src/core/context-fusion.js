function pushLine(lines, value) {
  if (value) {
    lines.push(value);
  }
}

function formatTimeLine(timeAwareness) {
  if (!timeAwareness) {
    return "";
  }

  const parts = [
    `现在是${timeAwareness.dayOfWeek}${timeAwareness.timeOfDayLabel}${String(
      timeAwareness.hour
    ).padStart(2, "0")}:${String(timeAwareness.minute).padStart(2, "0")}`,
    `${timeAwareness.season}`,
    timeAwareness.isWorkday ? "工作日" : "周末"
  ];

  if (Number.isFinite(timeAwareness.daysSinceLastChat)) {
    parts.push(`距上次聊天约 ${timeAwareness.daysSinceLastChat} 天`);
  }

  if (
    Number.isFinite(timeAwareness.minutesSinceLastMessage) &&
    timeAwareness.minutesSinceLastMessage > 0
  ) {
    parts.push(`距上一条消息约 ${timeAwareness.minutesSinceLastMessage} 分钟`);
  }

  return `时间感知：${parts.join("，")}。`;
}

function isWeatherWorthMentioning(weather) {
  if (!weather) {
    return false;
  }

  if (weather.isRaining) {
    return true;
  }

  if (Number.isFinite(weather.temperature) && (weather.temperature <= 5 || weather.temperature >= 32)) {
    return true;
  }

  return Number.isFinite(weather.windSpeed) && weather.windSpeed >= 35;
}

function formatWeatherLine(weather) {
  if (!isWeatherWorthMentioning(weather)) {
    return "";
  }

  const parts = [];

  if (weather.isRaining) {
    parts.push("当前有降雨");
  } else if (weather.condition) {
    parts.push(`当前天气 ${weather.condition}`);
  }

  if (Number.isFinite(weather.temperature)) {
    parts.push(`约 ${weather.temperature}°C`);
  }

  if (Number.isFinite(weather.windSpeed) && weather.windSpeed >= 35) {
    parts.push(`风速偏大（${weather.windSpeed} km/h）`);
  }

  return `环境感知：${parts.join("，")}。只有和当前话题自然相关时再提起。`;
}

function formatFacts(userFacts = [], profile = null) {
  const lines = [];

  if (profile?.user?.name) {
    lines.push(`用户称呼：${profile.user.name}`);
  }

  for (const fact of userFacts.slice(0, 4)) {
    if (!fact?.key || !fact?.value) {
      continue;
    }

    lines.push(`${fact.key}：${fact.value}`);
  }

  return lines.length > 0 ? `用户画像：${lines.join("；")}。` : "";
}

function formatRecentSummaries(recentSummaries = []) {
  const lines = recentSummaries
    .slice(0, 2)
    .map((summary) => String(summary?.summary || "").trim())
    .filter(Boolean);

  return lines.length > 0 ? `近期延续：${lines.join(" / ")}。` : "";
}

function formatRelevantMemories(relevantMemories = []) {
  const lines = relevantMemories
    .slice(0, 2)
    .map((summary) => String(summary || "").trim())
    .filter(Boolean);

  return lines.length > 0 ? `相关旧记忆：${lines.join(" / ")}。` : "";
}

function formatPatterns(behaviorPatterns) {
  if (!behaviorPatterns) {
    return "";
  }

  const parts = [];

  if (Array.isArray(behaviorPatterns.peakChatTimes) && behaviorPatterns.peakChatTimes.length > 0) {
    const topTime = behaviorPatterns.peakChatTimes
      .slice(0, 2)
      .map((entry) => entry.label)
      .join("、");
    parts.push(`常聊时段偏向 ${topTime}`);
  }

  if (Array.isArray(behaviorPatterns.topTopics) && behaviorPatterns.topTopics.length > 0) {
    const topics = behaviorPatterns.topTopics
      .slice(0, 3)
      .map((entry) => entry.label)
      .join("、");
    parts.push(`高频话题有 ${topics}`);
  }

  if (Array.isArray(behaviorPatterns.routines) && behaviorPatterns.routines.length > 0) {
    parts.push(behaviorPatterns.routines[0]);
  }

  return parts.length > 0 ? `行为模式：${parts.join("；")}。` : "";
}

function formatRelationshipLine(relationship, relationshipUnlockHints = []) {
  if (!relationship) {
    return "";
  }

  const hint = Array.isArray(relationshipUnlockHints)
    ? relationshipUnlockHints[0]
    : relationshipUnlockHints;

  const segments = [`关系状态：${relationship.stage}`];

  if (relationship.note) {
    segments.push(relationship.note);
  }

  if (hint) {
    segments.push(`表达提示：${hint}`);
  }

  return `${segments.join("；")}。`;
}

function trimToBudget(text, limit = 2400) {
  const source = String(text || "").trim();
  return source.length > limit ? `${source.slice(0, limit - 1).trim()}…` : source;
}

export function buildContextFusion({
  timeAwareness = null,
  weather = null,
  profile = null,
  relationship = null,
  recentSummaries = [],
  relevantMemories = [],
  userFacts = [],
  behaviorPatterns = null,
  relationshipUnlockHints = []
} = {}) {
  const lines = [];

  pushLine(lines, formatTimeLine(timeAwareness));
  pushLine(lines, formatWeatherLine(weather));
  pushLine(lines, formatRelationshipLine(relationship, relationshipUnlockHints));
  pushLine(lines, formatFacts(userFacts, profile));
  pushLine(lines, formatRecentSummaries(recentSummaries));
  pushLine(lines, formatRelevantMemories(relevantMemories));
  pushLine(lines, formatPatterns(behaviorPatterns));
  pushLine(
    lines,
    "表达原则：优先接住当下情绪，顺手借用已知信息，不要为了显得聪明而硬提天气或旧记忆。"
  );

  return trimToBudget(lines.join("\n"));
}
