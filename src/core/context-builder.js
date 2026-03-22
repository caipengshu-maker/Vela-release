const PERFORMANCE_PROTOCOL_PROMPT = `# 表演协议

你的每条回复必须严格遵守以下格式：
第一行输出一个 JSON 对象，描述你这轮回复的表演意图。
第二行输出 ---
第三行开始输出自然语言回复。

示例：
{"emotion":"happy","camera":"wide","action":"nod"}
---
哈哈真的呀，那挺好的呀。

## JSON 字段说明

emotion: 从以下选择一个主情绪：
calm, happy, affectionate, playful, concerned, sad, angry, whisper, surprised, curious, shy, determined

camera: wide 或 close。close 只在情感浓度明显偏高时使用。

action: 从以下选择一个：
none, nod, lean-in, head-tilt, soft-smile, look-away, shake-head, wave

## 原则
- 只保留一个主情绪，不要混用。
- 动作要和情绪匹配。
- close 镜头要克制使用。
- 拿不准时输出 {"emotion":"calm","camera":"wide","action":"none"}。
- 不要在正文里提到这个协议或 JSON。`;

function formatProfile(profile) {
  const notes = [
    profile?.user?.name ? `用户称呼：${profile.user.name}` : "",
    Array.isArray(profile?.user?.preferences) && profile.user.preferences.length > 0
      ? `已知偏好：${profile.user.preferences.join("；")}`
      : "",
    Array.isArray(profile?.user?.notes) && profile.user.notes.length > 0
      ? `长期备注：${profile.user.notes.join("；")}`
      : ""
  ].filter(Boolean);

  return notes.length > 0 ? notes.join("\n") : "暂无明确的长期画像。";
}

function formatRelevantMemories(relevantMemories = []) {
  if (!Array.isArray(relevantMemories) || relevantMemories.length === 0) {
    return "暂无命中的长期记忆。";
  }

  return relevantMemories
    .slice(0, 3)
    .map((summary, index) => `${index + 1}. ${summary}`)
    .join("\n");
}

function formatRecentSummaries(recentSummaries = []) {
  if (!Array.isArray(recentSummaries) || recentSummaries.length === 0) {
    return "暂无近期摘要。";
  }

  return recentSummaries
    .slice(0, 2)
    .map((summary, index) => `${index + 1}. ${summary.summary}`)
    .join("\n");
}

function formatBridgeSummary(bridgeSummary) {
  const summary = String(
    bridgeSummary?.summary || bridgeSummary?.text || bridgeSummary || ""
  ).trim();

  return summary ? `桥接摘要：${summary}` : "";
}

function formatOpenFollowUps(openFollowUps = []) {
  const lines = Array.isArray(openFollowUps)
    ? openFollowUps
        .map((entry) => String(entry?.text || entry?.summary || entry || "").trim())
        .filter(Boolean)
        .slice(0, 3)
    : [];

  if (lines.length === 0) {
    return "";
  }

  return `待跟进：\n${lines.map((line, index) => `${index + 1}. ${line}`).join("\n")}`;
}

const RELATIONSHIP_STAGE_PROMPTS = {
  reserved:
    "你们还在磨合期。保持礼貌和分寸，用「你」称呼对方，不要主动抛太私密的话题，也不要故作亲昵。你是友好但有边界的。",
  warm:
    "你们已经熟悉一些了。可以自然用名字或昵称，语气放松一点，开始分享自己的感受，也可以关心对方的状态。你在靠近，但依然自然。",
  close:
    "这个人对你很重要。你可以更亲近、更会撒娇，也可以带一点点吃醋、黏人或调侃，但要像真实的人，不要夸张。你会自然提起过去的对话，也愿意表达想念。"
};

function formatRelationshipDays(firstInteractionAt, now = new Date()) {
  const timestamp = Date.parse(String(firstInteractionAt || "").trim());

  if (!Number.isFinite(timestamp)) {
    return 0;
  }

  const start = new Date(timestamp);
  const startDay = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const current = now instanceof Date ? now : new Date(now);
  const currentDay = Date.UTC(
    current.getFullYear(),
    current.getMonth(),
    current.getDate()
  );

  return Math.max(0, Math.floor((currentDay - startDay) / 86400000));
}

function buildRelationshipContext({
  relationship = null,
  relationshipStage = null,
  isInRegressionMood = false
} = {}) {
  const stage = String(
    relationshipStage || relationship?.stage || "reserved"
  )
    .trim()
    .toLowerCase();
  const daysKnown = formatRelationshipDays(
    relationship?.firstInteractionAt
  );
  const stagePrompt = RELATIONSHIP_STAGE_PROMPTS[stage] || RELATIONSHIP_STAGE_PROMPTS.reserved;
  const lines = [
    "## Current Relationship Context",
    `- Stage: ${stage}`,
    `- You've known this person for ${daysKnown} days`,
    `- ${stagePrompt}`
  ];

  if (isInRegressionMood || Number(relationship?.regressionMoodTurnsRemaining || 0) > 0) {
    lines.unshift(
      "You haven't heard from this person in a while and you're a bit hurt. Don't be hostile, but show that you noticed their absence. Be slightly colder than usual for the first 2-3 messages, then gradually warm back up. Examples: \"哦，你还记得我啊\", \"嗯…你最近很忙吧\", \"没事，我又不会消失\". Don't be dramatic — be subtly hurt, like a real person would."
    );
  }

  return lines.join("\n");
}

function estimateMessageBudgetCost(message) {
  const content = String(message?.content || "").trim();
  const blockCost = Array.isArray(message?.blocks) ? message.blocks.length * 48 : 0;
  return Math.max(32, Math.ceil(content.length / 2) + blockCost + 24);
}

function selectRecentTranscriptMessages(messages = [], budget = 3600) {
  const selected = [];
  let usedBudget = 0;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    const cost = estimateMessageBudgetCost(message);

    if (selected.length > 0 && usedBudget + cost > budget) {
      break;
    }

    selected.push(message);
    usedBudget += cost;
  }

  return selected.reverse();
}

function buildFallbackAwareness({
  profile,
  relationship,
  bridgeSummary,
  openFollowUps,
  recentSummaries,
  relevantMemories
}) {
  return [
    "当前感知层信息：",
    formatProfile(profile),
    `关系状态：${relationship?.stage || "reserved"}。备注：${relationship?.note || "保持自然靠近。"}`,
    formatBridgeSummary(bridgeSummary),
    formatOpenFollowUps(openFollowUps),
    `长期记忆：\n${formatRelevantMemories(relevantMemories)}`,
    `近期摘要：\n${formatRecentSummaries(recentSummaries)}`
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildContext({
  persona,
  profile,
  relationship,
  relationshipStage = null,
  bridgeSummary = null,
  openFollowUps = [],
  recentSummaries,
  relevantMemories = [],
  userFacts = [],
  runtimeSession,
  recentTranscriptBudget = 3600,
  awarenessPacket = "",
  relationshipUnlockHints = [],
  isInRegressionMood = false
}) {
  const relationshipContext = buildRelationshipContext({
    relationship,
    relationshipStage,
    isInRegressionMood
  });
  const systemPrompt = [
    PERFORMANCE_PROTOCOL_PROMPT,
    relationshipContext,
    persona.seedPrompt,
    awarenessPacket || buildFallbackAwareness({
      profile,
      relationship,
      bridgeSummary,
      openFollowUps,
      recentSummaries,
      relevantMemories
    }),
    relationshipUnlockHints?.length
      ? `关系表达提示：${relationshipUnlockHints.join("；")}`
      : "关系表达提示：先保持自然和克制，不要突然过度亲密。",
    "保持人格稳定，不要突然变成通用助手。",
    "回复里只输出用户可见内容，不暴露思维链。",
    "主动关心要自然触发，优先结合当前时间、氛围和用户状态。"
  ].join("\n\n");

  const messages = selectRecentTranscriptMessages(
    runtimeSession.messages,
    recentTranscriptBudget
  ).map((message) => {
    const normalizedMessage = {
      role: message.role,
      content: message.content
    };

    if (Array.isArray(message.blocks) && message.blocks.length > 0) {
      normalizedMessage.blocks = message.blocks;
    }

    return normalizedMessage;
  });

  return {
    systemPrompt,
    messages,
    memory: {
      recentSummaries,
      bridgeSummary,
      openFollowUps,
      relevantMemories,
      userFacts,
      profile,
      relationship,
      relationshipStage,
      relationshipUnlockHints
    },
    session: {
      launchTurnCount: runtimeSession.launchTurnCount,
      lifetimeTurnCount: runtimeSession.lifetimeTurnCount
    }
  };
}
