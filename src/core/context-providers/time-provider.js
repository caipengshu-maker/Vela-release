import { resolveLocale } from "../config.js";

const DAY_OF_WEEK_LABELS = {
  "zh-CN": ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
};

const TIME_OF_DAY_LABELS = {
  "zh-CN": {
    "late-night": "深夜",
    dawn: "凌晨",
    "early-morning": "早上",
    morning: "上午",
    midday: "中午",
    afternoon: "下午",
    "early-evening": "傍晚",
    evening: "晚上"
  },
  en: {
    "late-night": "late night",
    dawn: "late night",
    "early-morning": "early morning",
    morning: "morning",
    midday: "midday",
    afternoon: "afternoon",
    "early-evening": "early evening",
    evening: "evening"
  }
};

const SEASON_LABELS = {
  "zh-CN": {
    spring: "春季",
    summer: "夏季",
    autumn: "秋季",
    winter: "冬季"
  },
  en: {
    spring: "spring",
    summer: "summer",
    autumn: "autumn",
    winter: "winter"
  }
};

export function getTimeOfDayBucket(hour) {
  if (hour >= 23 || hour < 2) {
    return "late-night";
  }

  if (hour < 5) {
    return "dawn";
  }

  if (hour < 8) {
    return "early-morning";
  }

  if (hour < 11) {
    return "morning";
  }

  if (hour < 13) {
    return "midday";
  }

  if (hour < 18) {
    return "afternoon";
  }

  if (hour < 20) {
    return "early-evening";
  }

  return "evening";
}

export function getTimeOfDayLabel(hourOrBucket, locale = "zh-CN") {
  const resolvedLocale = resolveLocale(locale);
  const bucket =
    typeof hourOrBucket === "number"
      ? getTimeOfDayBucket(hourOrBucket)
      : String(hourOrBucket || "").trim() || "afternoon";

  return TIME_OF_DAY_LABELS[resolvedLocale][bucket] || TIME_OF_DAY_LABELS[resolvedLocale].afternoon;
}

export function getSeasonLabel(month, locale = "zh-CN") {
  const resolvedLocale = resolveLocale(locale);
  const season =
    month >= 2 && month <= 4
      ? "spring"
      : month >= 5 && month <= 7
        ? "summer"
        : month >= 8 && month <= 10
          ? "autumn"
          : "winter";

  return SEASON_LABELS[resolvedLocale][season];
}

function diffMinutes(from, to) {
  const fromTime = Date.parse(from || "");
  const toTime = Date.parse(to || "");

  if (!Number.isFinite(fromTime) || !Number.isFinite(toTime)) {
    return null;
  }

  return Math.max(0, Math.round((toTime - fromTime) / 60000));
}

function diffDays(from, to) {
  const minutes = diffMinutes(from, to);

  if (minutes === null) {
    return null;
  }

  return Math.max(0, Math.floor(minutes / 1440));
}

function getLastMessageAt(runtimeSession) {
  const messages = Array.isArray(runtimeSession?.messages)
    ? runtimeSession.messages
    : [];

  if (messages.length === 0) {
    return null;
  }

  const lastMessage = messages[messages.length - 1];
  if (lastMessage?.role === "user" && messages.length > 1) {
    return messages[messages.length - 2]?.createdAt || null;
  }

  return lastMessage?.createdAt || null;
}

export function getTimeAwareness({
  now = new Date(),
  runtimeSession = null,
  lastActiveAt = null,
  locale = "zh-CN"
} = {}) {
  const resolvedLocale = resolveLocale(locale);
  const current = now instanceof Date ? now : new Date(now);
  const hour = current.getHours();
  const minute = current.getMinutes();
  const dayIndex = current.getDay();
  const lastMessageAt = getLastMessageAt(runtimeSession);

  return {
    hour,
    minute,
    dayOfWeek: DAY_OF_WEEK_LABELS[resolvedLocale][dayIndex],
    isWorkday: dayIndex >= 1 && dayIndex <= 5,
    timeOfDayLabel: getTimeOfDayLabel(hour, resolvedLocale),
    season: getSeasonLabel(current.getMonth(), resolvedLocale),
    daysSinceLastChat: diffDays(lastActiveAt, current.toISOString()),
    minutesSinceLastMessage: diffMinutes(lastMessageAt, current.toISOString())
  };
}
