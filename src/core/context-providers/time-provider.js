import { resolveLocale } from "../config.js";

const DAY_OF_WEEK_LABELS = {
  "zh-CN": ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
};

export function getTimeOfDayLabel(hour, locale = "zh-CN") {
  const resolvedLocale = resolveLocale(locale);

  if (resolvedLocale === "en") {
    if (hour >= 0 && hour < 5) {
      return "late night";
    }

    if (hour < 8) {
      return "early morning";
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
      return "early evening";
    }

    if (hour < 23) {
      return "evening";
    }

    return "late night";
  }

  if (hour >= 0 && hour < 5) {
    return "凌晨";
  }

  if (hour < 8) {
    return "早上";
  }

  if (hour < 11) {
    return "上午";
  }

  if (hour < 13) {
    return "中午";
  }

  if (hour < 18) {
    return "下午";
  }

  if (hour < 20) {
    return "傍晚";
  }

  if (hour < 23) {
    return "晚上";
  }

  return "深夜";
}

export function getSeasonLabel(month, locale = "zh-CN") {
  const resolvedLocale = resolveLocale(locale);

  if (resolvedLocale === "en") {
    if (month >= 2 && month <= 4) {
      return "spring";
    }

    if (month >= 5 && month <= 7) {
      return "summer";
    }

    if (month >= 8 && month <= 10) {
      return "autumn";
    }

    return "winter";
  }

  if (month >= 2 && month <= 4) {
    return "春季";
  }

  if (month >= 5 && month <= 7) {
    return "夏季";
  }

  if (month >= 8 && month <= 10) {
    return "秋季";
  }

  return "冬季";
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
