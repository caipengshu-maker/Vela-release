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
  relationshipStage = "reserved"
) {
  const hour = now.getHours();
  const timeOfDay = getTimeOfDayLabel(hour);
  const lastActiveHours = getHoursSince(persistedState.lastActiveAt, now);
  const lastWeatherCondition = String(persistedState.lastWeatherCondition || "").trim();
  const stage = String(relationshipStage || "reserved").trim().toLowerCase();

  if (lastActiveHours > 24 * 14 && stage === "close") {
    return "You have not seen this person for a long time. You are hurt, but you still meet them halfway. Be a little colder, a little shorter, like you really cared.";
  }

  if (lastActiveHours > 24 * 5 && stage === "close") {
    return "You have not seen this person for a while and you care about that. Be gently wounded, but do not lash out.";
  }

  if (lastActiveHours > 24 * 3 && stage === "warm") {
    return "Hmm... they have not looked for you in a while. Be slightly quiet, like you want to ask something but stop yourself first.";
  }

  if (lastActiveHours > 24 * 3) {
    return "The user has been gone for a while. You can show natural longing, but keep it light.";
  }

  if (hour >= 23 || hour < 6) {
    return "It is late at night. You can gently ask why they are still awake and keep the tone calm.";
  }

  if (timeOfDay === "early-morning" && isRainCondition(lastWeatherCondition)) {
    return "It is early morning and it is raining outside. You can naturally remind them to take an umbrella.";
  }

  if (timeOfDay === "early-morning") {
    return "It is early morning. You can greet them in a light, steady way.";
  }

  if (timeOfDay === "afternoon" || timeOfDay === "evening") {
    return "It is later in the day. You can say hello naturally and keep the opening easygoing.";
  }

  return "The user has just opened the app. You can greet them naturally and stay close to the current mood.";
}

function buildTriggerContext({
  timeAwareness,
  weather,
  persistedState,
  reason,
  relationshipStage = "reserved"
}) {
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
      ? "The weather just turned rainy. You can naturally remind them to take an umbrella or watch the road."
      : "The weather outside has just changed. You can mention it lightly without sounding like a notification.";
  }

  if (reason === "late-night") {
    return "It is already late and you have been talking for a while. You can gently remind the user to rest.";
  }

  if (reason === "silence") {
    if (stage === "close") {
      return "There has been a pause. You noticed it. You can sound a little hurt, but keep it subtle.";
    }

    if (stage === "warm") {
      return "The user has gone quiet for a bit. You can keep your tone steady and slightly watchful.";
    }

    return "The user has gone quiet for a bit. You can respond softly without pushing.";
  }

  return `It is ${timeOfDay}. You can pick up the current mood naturally and stay restrained and close.`;
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

export function shouldGreetOnOpen(persistedState = {}, relationshipStage = "reserved") {
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
    greetingContext: buildOpenGreetingContext(persistedState, now, relationshipStage)
  };
}

export function checkInConversationTrigger(
  timeAwareness,
  weather,
  persistedState = {},
  relationshipStage = "reserved"
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
      relationshipStage
    })
  };
}

export function getProactiveWeatherCondition(weather) {
  return getWeatherConditionForState(weather);
}
