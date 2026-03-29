import { resolveLocale } from "./config.js";

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
    return "late-night";
  }

  if (hour < 8) {
    return "early-morning";
  }

  if (hour < 11) {
    return "morning";
  }

  if (hour < 13) {
    return "noon";
  }

  if (hour < 18) {
    return "afternoon";
  }

  if (hour < 20) {
    return "evening";
  }

  if (hour < 23) {
    return "night";
  }

  return "deep-night";
}

function isRainCondition(weatherCondition) {
  const condition = String(weatherCondition || "").trim().toLowerCase();
  return (
    condition.includes("rain") ||
    condition.includes("drizzle") ||
    condition.includes("thunder") ||
    condition.includes("snow") ||
    condition.includes("雨") ||
    condition.includes("雷") ||
    condition.includes("雪")
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

const PROACTIVE_COPY = {
  "zh-CN": {
    longAbsenceClose:
      "你已经很久没有见到这个人了。你受伤了，但还是迎了上去。稍微冷一点、短一点，像是真的在意过。",
    absenceClose:
      "你已经好几天没见到这个人了，你在意这件事。温柔地表达受伤，但不要发作。",
    absenceWarm:
      "嗯……他们好一阵没来找你了。稍微安静一点，像是想问什么但先忍住了。",
    absenceGeneral:
      "用户已经好一阵没来了。你可以自然地表达想念，但别太重。",
    lateNight:
      "现在很晚了。你可以轻轻问一句为什么还没睡，语气保持平静。",
    earlyMorningRain:
      "现在是清晨，外面在下雨。你可以自然地提醒带伞。",
    earlyMorning:
      "现在是清晨。你可以用轻快、稳定的方式打个招呼。",
    afternoonEvening:
      "现在是下午或傍晚。你可以自然地打个招呼，保持轻松的开场。",
    defaultGreeting:
      "用户刚刚打开了应用。你可以自然地打招呼，贴近当前的氛围。",
    rainChanged:
      "天气刚转成下雨了。你可以自然地提醒带伞或注意路滑。",
    weatherChanged:
      "外面天气刚刚变了。你可以轻描淡写地提一句，不要像通知一样。",
    lateNightReminder:
      "已经很晚了，你们聊了一阵了。你可以温柔地提醒用户该休息了。",
    silenceClose:
      "有一段沉默。你注意到了。你可以表现得有点受伤，但要很微妙。",
    silenceWarm:
      "用户安静了一会儿。你可以保持稳定的语气，稍微带点关切。",
    silenceGeneral:
      "用户安静了一会儿。你可以轻轻回应，不要催促。",
    defaultTrigger(timeOfDay) {
      return `现在是${timeOfDay}。你可以自然地接住当前的氛围，保持克制但贴近。`;
    }
  },
  en: {
    longAbsenceClose:
      "You have not seen this person for a long time. You are hurt, but you still meet them halfway. Be a little colder, a little shorter, like you really cared.",
    absenceClose:
      "You have not seen this person for a while and you care about that. Be gently wounded, but do not lash out.",
    absenceWarm:
      "Hmm... they have not looked for you in a while. Be slightly quiet, like you want to ask something but stop yourself first.",
    absenceGeneral:
      "The user has been gone for a while. You can show natural longing, but keep it light.",
    lateNight:
      "It is late at night. You can gently ask why they are still awake and keep the tone calm.",
    earlyMorningRain:
      "It is early morning and it is raining outside. You can naturally remind them to take an umbrella.",
    earlyMorning:
      "It is early morning. You can greet them in a light, steady way.",
    afternoonEvening:
      "It is later in the day. You can say hello naturally and keep the opening easygoing.",
    defaultGreeting:
      "The user has just opened the app. You can greet them naturally and stay close to the current mood.",
    rainChanged:
      "The weather just turned rainy. You can naturally remind them to take an umbrella or watch the road.",
    weatherChanged:
      "The weather outside has just changed. You can mention it lightly without sounding like a notification.",
    lateNightReminder:
      "It is already late and you have been talking for a while. You can gently remind the user to rest.",
    silenceClose:
      "There has been a pause. You noticed it. You can sound a little hurt, but keep it subtle.",
    silenceWarm:
      "The user has gone quiet for a bit. You can keep your tone steady and slightly watchful.",
    silenceGeneral:
      "The user has gone quiet for a bit. You can respond softly without pushing.",
    defaultTrigger(timeOfDay) {
      return `It is ${timeOfDay}. You can pick up the current mood naturally and stay restrained and close.`;
    }
  }
};

function getRelationshipProactiveMultiplier(relationshipStage) {
  switch (String(relationshipStage || "").trim().toLowerCase()) {
    case "reserved":
      return 0.3;
    case "warm":
      return 0.7;
    case "close":
      return 1.2;
    default:
      return 1;
  }
}

function buildOpenGreetingContext(
  persistedState = {},
  now = new Date(),
  relationshipStage = "reserved",
  locale = "zh-CN"
) {
  const copy = PROACTIVE_COPY[resolveLocale(locale)];
  const hour = now.getHours();
  const timeOfDay = getTimeOfDayLabel(hour);
  const lastActiveHours = getHoursSince(persistedState.lastActiveAt, now);
  const lastWeatherCondition = String(persistedState.lastWeatherCondition || "").trim();
  const stage = String(relationshipStage || "reserved").trim().toLowerCase();

  if (lastActiveHours > 24 * 14 && stage === "close") {
    return copy.longAbsenceClose;
  }

  if (lastActiveHours > 24 * 5 && stage === "close") {
    return copy.absenceClose;
  }

  if (lastActiveHours > 24 * 3 && stage === "warm") {
    return copy.absenceWarm;
  }

  if (lastActiveHours > 24 * 3) {
    return copy.absenceGeneral;
  }

  if (hour >= 23 || hour < 6) {
    return copy.lateNight;
  }

  if (timeOfDay === "early-morning" && isRainCondition(lastWeatherCondition)) {
    return copy.earlyMorningRain;
  }

  if (timeOfDay === "early-morning") {
    return copy.earlyMorning;
  }

  if (timeOfDay === "afternoon" || timeOfDay === "evening") {
    return copy.afternoonEvening;
  }

  return copy.defaultGreeting;
}

function buildTriggerContext({
  timeAwareness,
  weather,
  persistedState,
  reason,
  relationshipStage = "reserved",
  locale = "zh-CN"
}) {
  const copy = PROACTIVE_COPY[resolveLocale(locale)];
  const hour = Number(timeAwareness?.hour);
  const timeOfDay =
    Number.isFinite(hour) && (hour >= 23 || hour < 6)
      ? "deep-night"
      : Number.isFinite(hour)
        ? getTimeOfDayLabel(hour)
        : "now";
  const lastWeatherCondition = String(persistedState?.lastWeatherCondition || "").trim();
  const stage = String(relationshipStage || "reserved").trim().toLowerCase();

  if (reason === "rain") {
    return isRainCondition(lastWeatherCondition) || weather?.isRaining
      ? copy.rainChanged
      : copy.weatherChanged;
  }

  if (reason === "late-night") {
    return copy.lateNightReminder;
  }

  if (reason === "silence") {
    if (stage === "close") {
      return copy.silenceClose;
    }

    if (stage === "warm") {
      return copy.silenceWarm;
    }

    return copy.silenceGeneral;
  }

  return copy.defaultTrigger(timeOfDay);
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

function scaleChance(chance, relationshipStage) {
  return Math.min(1, chance * getRelationshipProactiveMultiplier(relationshipStage));
}

export function shouldGreetOnOpen(persistedState = {}, relationshipStage = "reserved", locale = "zh-CN") {
  const now = new Date();

  if (!canUseProactiveSlot(persistedState, now)) {
    return {
      shouldGreet: false,
      greetingContext: ""
    };
  }

  const hoursSinceLastChat = getHoursSince(persistedState.lastActiveAt, now);
  const chance = scaleChance(pickChance(hoursSinceLastChat), relationshipStage);

  if (Math.random() >= chance) {
    return {
      shouldGreet: false,
      greetingContext: ""
    };
  }

  return {
    shouldGreet: true,
    greetingContext: buildOpenGreetingContext(persistedState, now, relationshipStage, locale)
  };
}

export function checkInConversationTrigger(
  timeAwareness,
  weather,
  persistedState = {},
  relationshipStage = "reserved",
  locale = "zh-CN"
) {
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

  if (Math.random() >= scaleChance(0.5, relationshipStage)) {
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
      reason,
      relationshipStage,
      locale
    })
  };
}

export function getProactiveWeatherCondition(weather) {
  return getWeatherConditionForState(weather);
}
