function getHoursSince(isoString, now = new Date()) {
  const timestamp = Date.parse(isoString || "");

  if (!Number.isFinite(timestamp)) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(0, (now.getTime() - timestamp) / 3600000);
}

function getMinutesSince(isoString, now = new Date()) {
  const timestamp = Date.parse(isoString || "");

  if (!Number.isFinite(timestamp)) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(0, (now.getTime() - timestamp) / 60000);
}

function getTimeOfDayLabel(hour) {
  if (hour >= 0 && hour < 5) {
    return "\u51cc\u6668";
  }

  if (hour < 8) {
    return "\u65e9\u4e0a";
  }

  if (hour < 11) {
    return "\u4e0a\u5348";
  }

  if (hour < 13) {
    return "\u4e2d\u5348";
  }

  if (hour < 18) {
    return "\u4e0b\u5348";
  }

  if (hour < 20) {
    return "\u508d\u665a";
  }

  if (hour < 23) {
    return "\u665a\u4e0a";
  }

  return "\u6df1\u591c";
}

function isRainCondition(weatherCondition) {
  const condition = String(weatherCondition || "").trim().toLowerCase();
  return (
    condition.includes("rain") ||
    condition.includes("drizzle") ||
    condition.includes("thunder") ||
    condition.includes("snow") ||
    condition.includes("\u96e8") ||
    condition.includes("\u96f7") ||
    condition.includes("\u96ea")
  );
}

function getWeatherConditionForState(weather) {
  if (!weather) {
    return null;
  }

  if (weather.isRaining) {
    return "rain";
  }

  return String(weather.condition || "").trim() || null;
}

function buildOpenGreetingContext(persistedState = {}, now = new Date()) {
  const hour = now.getHours();
  const timeOfDay = getTimeOfDayLabel(hour);
  const lastActiveHours = getHoursSince(persistedState.lastActiveAt, now);
  const lastWeatherCondition = String(persistedState.lastWeatherCondition || "").trim();

  if (lastActiveHours > 24 * 3) {
    return "\u7528\u6237\u5df2\u7ecf\u5f88\u4e45\u6ca1\u6765\u4e86\u3002\u4f60\u53ef\u4ee5\u8868\u8fbe\u81ea\u7136\u7684\u60f3\u5ff5\uff0c\u8bed\u6c14\u8f7b\u4e00\u70b9\uff0c\u4e0d\u8981\u592a\u7528\u529b\u3002";
  }

  if (hour >= 23 || hour < 6) {
    return "\u73b0\u5728\u662f\u6df1\u591c\u4e86\u3002\u4f60\u53ef\u4ee5\u6e29\u67d4\u5730\u95ee\u7528\u6237\u600e\u4e48\u8fd8\u6ca1\u7761\uff0c\u4fdd\u6301\u5b89\u9759\u548c\u514b\u5236\u3002";
  }

  if (timeOfDay === "\u65e9\u4e0a" && isRainCondition(lastWeatherCondition)) {
    return "\u73b0\u5728\u662f\u65e9\u4e0a\uff0c\u5916\u9762\u5728\u4e0b\u96e8\u3002\u4f60\u53ef\u4ee5\u81ea\u7136\u5730\u5173\u5fc3\u7528\u6237\u662f\u5426\u9700\u8981\u5e26\u4f1e\uff0c\u8bed\u6c14\u8981\u7167\u987e\u4eba\u4e00\u70b9\u3002";
  }

  if (timeOfDay === "\u65e9\u4e0a") {
    return "\u73b0\u5728\u662f\u65e9\u4e0a\u3002\u4f60\u53ef\u4ee5\u7528\u8f7b\u677e\u3001\u5b89\u5b9a\u7684\u611f\u89c9\u81ea\u7136\u5730\u6253\u4e2a\u62db\u547c\u3002";
  }

  if (timeOfDay === "\u4e0b\u5348" || timeOfDay === "\u508d\u665a") {
    return "\u73b0\u5728\u662f\u767d\u5929\u504f\u540e\u6bb5\u3002\u4f60\u53ef\u4ee5\u81ea\u7136\u5730\u6253\u4e2a\u62db\u547c\uff0c\u8ba9\u5f00\u573a\u663e\u5f97\u8f7b\u677e\u4f46\u4e0d\u6253\u6270\u3002";
  }

  return "\u7528\u6237\u521a\u6253\u5f00\u5e94\u7528\u3002\u4f60\u53ef\u4ee5\u81ea\u7136\u5730\u6253\u4e2a\u62db\u547c\uff0c\u8bed\u6c14\u4fdd\u6301\u8f7b\u677e\u3001\u8d34\u8fd1\u5f53\u524d\u6c1b\u56f4\u3002";
}

function buildTriggerContext({ timeAwareness, weather, persistedState, reason }) {
  const hour = Number(timeAwareness?.hour);
  const timeOfDay =
    Number.isFinite(hour) && (hour >= 23 || hour < 6)
      ? "\u6df1\u591c"
      : Number.isFinite(hour)
        ? getTimeOfDayLabel(hour)
        : "\u73b0\u5728";
  const lastWeatherCondition = String(persistedState?.lastWeatherCondition || "").trim();

  if (reason === "rain") {
    return isRainCondition(lastWeatherCondition) || weather?.isRaining
      ? "\u521a\u521a\u5929\u6c14\u53d8\u6210\u4e0b\u96e8\u4e86\u3002\u4f60\u53ef\u4ee5\u81ea\u7136\u5730\u63d0\u9192\u7528\u6237\u5e26\u4f1e\u6216\u6ce8\u610f\u8def\u4e0a\u60c5\u51b5\uff0c\u8bed\u6c14\u8981\u5173\u5fc3\u4f46\u4e0d\u8981\u5938\u5f20\u3002"
      : "\u5916\u9762\u7684\u5929\u6c14\u521a\u53d1\u751f\u53d8\u5316\u3002\u4f60\u53ef\u4ee5\u8f7b\u8f7b\u63d0\u4e00\u4e0b\u73af\u5883\u53d8\u5316\uff0c\u4e0d\u8981\u50cf\u901a\u77e5\u4e00\u6837\u751f\u786c\u3002";
  }

  if (reason === "late-night") {
    return "\u73b0\u5728\u5df2\u7ecf\u5f88\u665a\u4e86\uff0c\u800c\u4e14\u4f60\u4eec\u5df2\u7ecf\u804a\u4e86\u4e00\u6bb5\u65f6\u95f4\u3002\u4f60\u53ef\u4ee5\u6e29\u67d4\u5730\u63d0\u9192\u7528\u6237\u65e9\u70b9\u4f11\u606f\uff0c\u8bed\u6c14\u653e\u8f7b\u4e00\u70b9\u3002";
  }

  if (reason === "silence") {
    return "\u7528\u6237\u5df2\u7ecf\u6709\u4e00\u6bb5\u65f6\u95f4\u6ca1\u8bf4\u8bdd\u4e86\u3002\u4f60\u53ef\u4ee5\u8f7b\u8f7b\u63a5\u4e00\u4e0b\uff0c\u4e0d\u8981\u592a\u6253\u6270\uff0c\u4e5f\u4e0d\u8981\u50ac\u4fc3\u3002";
  }

  return `\u73b0\u5728\u662f${timeOfDay}\u3002\u4f60\u53ef\u4ee5\u81ea\u7136\u5730\u63a5\u4e00\u4e0b\u5f53\u524d\u6c1b\u56f4\uff0c\u4fdd\u6301\u514b\u5236\u548c\u8d34\u8fd1\u3002`;
}

function pickChance(hoursSinceLastChat) {
  if (hoursSinceLastChat > 4) {
    return 0.7;
  }

  if (hoursSinceLastChat >= 1) {
    return 0.4;
  }

  return 0.2;
}

function canUseProactiveSlot(persistedState = {}, now = new Date()) {
  const proactiveCountToday = Number(persistedState.proactiveCountToday || 0);
  const lastProactiveAt = persistedState.lastProactiveAt || null;

  if (proactiveCountToday >= 3) {
    return false;
  }

  if (getMinutesSince(lastProactiveAt, now) < 120) {
    return false;
  }

  return true;
}

export function shouldGreetOnOpen(persistedState = {}) {
  const now = new Date();

  if (!canUseProactiveSlot(persistedState, now)) {
    return {
      shouldGreet: false,
      greetingContext: ""
    };
  }

  const hoursSinceLastChat = getHoursSince(persistedState.lastActiveAt, now);
  const chance = pickChance(hoursSinceLastChat);

  if (Math.random() >= chance) {
    return {
      shouldGreet: false,
      greetingContext: ""
    };
  }

  return {
    shouldGreet: true,
    greetingContext: buildOpenGreetingContext(persistedState, now)
  };
}

export function checkInConversationTrigger(timeAwareness, weather, persistedState = {}) {
  const now = new Date();

  if (!canUseProactiveSlot(persistedState, now)) {
    return {
      shouldTrigger: false,
      triggerContext: ""
    };
  }

  const triggerReasons = [];

  if (
    Number.isFinite(Number(timeAwareness?.minutesSinceLastMessage)) &&
    Number(timeAwareness.minutesSinceLastMessage) > 30
  ) {
    triggerReasons.push("silence");
  }

  const sessionMinutesActive = Number(
    timeAwareness?.sessionMinutesActive ?? timeAwareness?.conversationDurationMinutes ?? 0
  );
  const isLate = Number.isFinite(Number(timeAwareness?.hour))
    ? Number(timeAwareness.hour) >= 23 || Number(timeAwareness.hour) < 6
    : false;

  if (isLate && sessionMinutesActive >= 60) {
    triggerReasons.push("late-night");
  }

  if (weather?.isRaining && !isRainCondition(persistedState.lastWeatherCondition)) {
    triggerReasons.push("rain");
  }

  if (triggerReasons.length === 0) {
    return {
      shouldTrigger: false,
      triggerContext: ""
    };
  }

  if (Math.random() >= 0.5) {
    return {
      shouldTrigger: false,
      triggerContext: ""
    };
  }

  const reason = triggerReasons.includes("rain")
    ? "rain"
    : triggerReasons.includes("late-night")
      ? "late-night"
      : "silence";

  return {
    shouldTrigger: true,
    triggerContext: buildTriggerContext({
      timeAwareness,
      weather,
      persistedState,
      reason
    })
  };
}

export function getProactiveWeatherCondition(weather) {
  return getWeatherConditionForState(weather);
}
