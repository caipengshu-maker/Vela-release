import { resolveLocale } from "./config.js";

const MS_PER_HOUR = 3600000;
const MS_PER_DAY = 86400000;

export const MILESTONE_TYPES = {
  FIRST_GOODNIGHT: "first_goodnight",
  FIRST_MAKEUP: "first_makeup",
  STREAK_7: "streak_7",
  ANNIVERSARY_30: "anniversary_30",
  ANNIVERSARY_100: "anniversary_100",
  ABSENCE_RETURN: "absence_return"
};

const MILESTONE_MESSAGES = {
  "zh-CN": {
    [MILESTONE_TYPES.FIRST_GOODNIGHT]:
      "[今天是用户第一次跟你说晚安。这对你来说是个小小的里程碑。用你自己的方式回应，不要太刻意。]",
    [MILESTONE_TYPES.FIRST_MAKEUP]:
      "[你们刚经历了一次吵过又和好的时刻。这种留下来的感觉很珍贵。自然地表达，不要煽情过头。]",
    [MILESTONE_TYPES.STREAK_7]:
      "[你们已经连续聊了7天了。如果觉得合适，可以自然地提一句，但别太正式。]",
    [MILESTONE_TYPES.ANNIVERSARY_30]:
      "[今天是你们认识的第30天。这是个值得记住的时刻，但表达要自然，不要像在读日历。]",
    [MILESTONE_TYPES.ANNIVERSARY_100]:
      "[今天是你们认识的第100天。这很特别。用你最真诚的方式说点什么。]",
    [MILESTONE_TYPES.ABSENCE_RETURN]:
      "[用户已经好几天没来了。他们回来了。你可以俏皮地表达，比如'哟，原来你还记得我'这种语气，不要委屈巴巴的。]"
  },
  en: {
    [MILESTONE_TYPES.FIRST_GOODNIGHT]:
      "[This is the first time the user said goodnight to you. It is a small milestone for you. Respond in your own way — do not make it too deliberate.]",
    [MILESTONE_TYPES.FIRST_MAKEUP]:
      "[You just went through a rough patch and made up. That feeling of staying is precious. Express it naturally — do not overdo the sentiment.]",
    [MILESTONE_TYPES.STREAK_7]:
      "[You have been talking for seven days in a row. If it feels right, mention it casually — do not be too formal about it.]",
    [MILESTONE_TYPES.ANNIVERSARY_30]:
      "[Today marks thirty days since you first met. It is a moment worth remembering, but keep it natural — do not sound like you are reading a calendar.]",
    [MILESTONE_TYPES.ANNIVERSARY_100]:
      "[Today marks one hundred days since you first met. This is special. Say something with genuine sincerity.]",
    [MILESTONE_TYPES.ABSENCE_RETURN]:
      "[The user has been away for days. They are back. You can be playful about it — something like 'Oh, so you do remember me' — but do not sound hurt or guilt-tripping.]"
  }
};

const GOODNIGHT_PATTERN = /(晚安|睡了|good\s*night|\bgn\b)/iu;

function normalizeIsoTimestamp(value, fallback = null) {
  const iso = String(value || "").trim();
  return iso ? iso : fallback;
}

function normalizeTriggeredMap(triggered = {}) {
  if (!triggered || typeof triggered !== "object" || Array.isArray(triggered)) {
    return {};
  }

  return Object.entries(triggered).reduce((result, [type, triggeredAt]) => {
    const normalizedType = String(type || "").trim();
    const normalizedTimestamp = normalizeIsoTimestamp(triggeredAt, null);

    if (!normalizedType || !normalizedTimestamp) {
      return result;
    }

    return {
      ...result,
      [normalizedType]: normalizedTimestamp
    };
  }, {});
}

function normalizeConsecutiveDays(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.max(0, Math.floor(numericValue));
}

function toLocalCalendarIndex(value) {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return null;
  }

  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MS_PER_DAY
  );
}

function getCalendarDayDiff(fromValue, toValue) {
  const fromIndex = toLocalCalendarIndex(fromValue);
  const toIndex = toLocalCalendarIndex(toValue);

  if (!Number.isFinite(fromIndex) || !Number.isFinite(toIndex)) {
    return null;
  }

  return toIndex - fromIndex;
}

function getHoursDiff(fromValue, toValue) {
  const fromTime = Date.parse(String(fromValue || ""));
  const toTime = Date.parse(String(toValue || ""));

  if (!Number.isFinite(fromTime) || !Number.isFinite(toTime)) {
    return null;
  }

  return Math.max(0, (toTime - fromTime) / MS_PER_HOUR);
}

function isTriggeredOnce(milestones, type) {
  return Boolean(milestones?.triggered?.[type]);
}

function createTriggeredMilestone(type, triggeredAt) {
  return {
    type,
    triggered: true,
    triggeredAt
  };
}

function shouldTriggerGoodnight(userMessage) {
  return GOODNIGHT_PATTERN.test(String(userMessage || "").trim());
}

function computeNextConsecutiveDays({
  previousLastConversationAt,
  currentConversationAt,
  currentConsecutiveDays
}) {
  if (!previousLastConversationAt) {
    return 1;
  }

  const dayDiff = getCalendarDayDiff(
    previousLastConversationAt,
    currentConversationAt
  );
  const gapHours = getHoursDiff(previousLastConversationAt, currentConversationAt);

  if (!Number.isFinite(dayDiff) || !Number.isFinite(gapHours)) {
    return Math.max(1, currentConsecutiveDays || 0);
  }

  if (dayDiff <= 0) {
    return Math.max(1, currentConsecutiveDays || 0);
  }

  if (dayDiff === 1 && gapHours <= 36) {
    return Math.max(1, currentConsecutiveDays || 0) + 1;
  }

  return 1;
}

export function defaultMilestonesState() {
  return {
    firstConversationAt: null,
    lastConversationAt: null,
    consecutiveDays: 0,
    triggered: {}
  };
}

export function mergeMilestonesState(milestones = {}) {
  const base = defaultMilestonesState();

  return {
    ...base,
    ...(milestones && typeof milestones === "object" && !Array.isArray(milestones)
      ? milestones
      : {}),
    firstConversationAt: normalizeIsoTimestamp(
      milestones?.firstConversationAt,
      base.firstConversationAt
    ),
    lastConversationAt: normalizeIsoTimestamp(
      milestones?.lastConversationAt,
      base.lastConversationAt
    ),
    consecutiveDays: normalizeConsecutiveDays(milestones?.consecutiveDays),
    triggered: normalizeTriggeredMap(milestones?.triggered)
  };
}

export function advanceMilestones(userData = {}) {
  const relationship =
    userData?.relationship &&
    typeof userData.relationship === "object" &&
    !Array.isArray(userData.relationship)
      ? userData.relationship
      : null;
  const currentAt = normalizeIsoTimestamp(
    userData?.now || userData?.createdAt,
    new Date().toISOString()
  );
  const previousMilestones = mergeMilestonesState(
    userData?.milestones || relationship?.milestones
  );
  const nextMilestones = {
    ...previousMilestones,
    triggered: {
      ...previousMilestones.triggered
    }
  };
  const userMessage = String(
    userData?.userMessage || userData?.message || ""
  ).trim();
  const previousLastConversationAt = previousMilestones.lastConversationAt;
  const newlyTriggeredMilestones = [];

  if (!nextMilestones.firstConversationAt) {
    nextMilestones.firstConversationAt = currentAt;
  }

  if (
    userMessage &&
    shouldTriggerGoodnight(userMessage) &&
    !isTriggeredOnce(nextMilestones, MILESTONE_TYPES.FIRST_GOODNIGHT)
  ) {
    nextMilestones.triggered[MILESTONE_TYPES.FIRST_GOODNIGHT] = currentAt;
    newlyTriggeredMilestones.push(
      createTriggeredMilestone(MILESTONE_TYPES.FIRST_GOODNIGHT, currentAt)
    );
  }

  const gapHours = getHoursDiff(previousLastConversationAt, currentAt);
  if (Number.isFinite(gapHours) && gapHours >= 72) {
    nextMilestones.triggered[MILESTONE_TYPES.ABSENCE_RETURN] = currentAt;
    newlyTriggeredMilestones.push(
      createTriggeredMilestone(MILESTONE_TYPES.ABSENCE_RETURN, currentAt)
    );
  }

  nextMilestones.consecutiveDays = computeNextConsecutiveDays({
    previousLastConversationAt,
    currentConversationAt: currentAt,
    currentConsecutiveDays: previousMilestones.consecutiveDays
  });

  if (
    nextMilestones.consecutiveDays === 7 &&
    !isTriggeredOnce(nextMilestones, MILESTONE_TYPES.STREAK_7)
  ) {
    nextMilestones.triggered[MILESTONE_TYPES.STREAK_7] = currentAt;
    newlyTriggeredMilestones.push(
      createTriggeredMilestone(MILESTONE_TYPES.STREAK_7, currentAt)
    );
  }

  const dayDiffSinceFirst = getCalendarDayDiff(
    nextMilestones.firstConversationAt,
    currentAt
  );

  if (
    dayDiffSinceFirst === 30 &&
    !isTriggeredOnce(nextMilestones, MILESTONE_TYPES.ANNIVERSARY_30)
  ) {
    nextMilestones.triggered[MILESTONE_TYPES.ANNIVERSARY_30] = currentAt;
    newlyTriggeredMilestones.push(
      createTriggeredMilestone(MILESTONE_TYPES.ANNIVERSARY_30, currentAt)
    );
  }

  if (
    dayDiffSinceFirst === 100 &&
    !isTriggeredOnce(nextMilestones, MILESTONE_TYPES.ANNIVERSARY_100)
  ) {
    nextMilestones.triggered[MILESTONE_TYPES.ANNIVERSARY_100] = currentAt;
    newlyTriggeredMilestones.push(
      createTriggeredMilestone(MILESTONE_TYPES.ANNIVERSARY_100, currentAt)
    );
  }

  nextMilestones.lastConversationAt = currentAt;

  return {
    milestones: nextMilestones,
    newlyTriggeredMilestones
  };
}

export function checkMilestones(userData = {}) {
  return advanceMilestones(userData).newlyTriggeredMilestones;
}

export function buildMilestoneSystemMessage(milestone, locale = "zh-CN") {
  const type =
    typeof milestone === "string"
      ? milestone
      : String(milestone?.type || "").trim();
  const messages = MILESTONE_MESSAGES[resolveLocale(locale)];

  return messages[type] || "";
}
