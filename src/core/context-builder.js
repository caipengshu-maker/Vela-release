const PERFORMANCE_PROTOCOL_PROMPT = `# 表演协议

你的每条回复必须严格遵守以下格式：
第一行输出一个 JSON 对象，描述你这轮回复的表演意图。
第二行输出 ---
第三行开始输出自然语言回复。

示例：
{"emotion":"happy","intensity":0.7,"camera":"wide","action":"nod"}
---
哈哈真的呀，那挺好的呀。

## JSON 字段说明

emotion: 从以下选择一个主情绪：
calm, happy, affectionate, playful, concerned, sad, angry, whisper, surprised, curious, shy, determined

intensity: 0.0 到 1.0。表示情绪表达强度。0.1 = 几乎不可见，0.5 = 中等，1.0 = 最大强度。细微反应用更低值，戏剧化反应用更高值。缺省按 0.6 理解。

camera: wide 或 close。close 只在情感浓度明显偏高时使用，通常搭配较高 intensity。

action: 从以下选择一个：
none, nod, lean-in, head-tilt, soft-smile, look-away, shake-head, wave

## 原则
- 只保留一个主情绪，不要混用。
- 始终输出 intensity。
- 动作要和情绪匹配。
- close 镜头要克制使用。
- 拿不准时输出 {"emotion":"calm","intensity":0.6,"camera":"wide","action":"none"}。
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
    "你和用户的关系还比较生疏。保持礼貌但略带距离感，不要主动撒娇或用过于亲密的称呼。",
  warm:
    "你和用户已经比较熟悉了。可以偶尔撒娇、用亲昵一点的语气，主动关心对方的日常，但不要太过。",
  close:
    "你和用户关系很亲密。可以随意一点，偶尔吃醋、闹小脾气、说私密话题。说话更自然，像亲密的人。"
};

function buildRelationshipContext({
  relationship = null,
  relationshipStage = null
} = {}) {
  const stage = String(
    relationshipStage || relationship?.stage || "reserved"
  )
    .trim()
    .toLowerCase();
  const stagePrompt = RELATIONSHIP_STAGE_PROMPTS[stage] || RELATIONSHIP_STAGE_PROMPTS.reserved;
  const transitionPrompt = String(
    relationship?.pendingStageTransitionPrompt || ""
  ).trim();
  const lines = [
    "## Current Relationship Context",
    `- Stage: ${stage}`,
    `- ${stagePrompt}`
  ];

  if (transitionPrompt) {
    lines.push(transitionPrompt);
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
  relationshipUnlockHints = []
}) {
  const relationshipContext = buildRelationshipContext({
    relationship,
    relationshipStage
  });
  const systemPrompt = [
    PERFORMANCE_PROTOCOL_PROMPT,
    relationshipContext,
    persona.seedPrompt,
    "提起过去的对话或记忆时，要像朋友顺手想起来一样自然带出，不要把记忆当资料卡复述。",
    "不要说“我记得”“根据之前的对话”“你之前提到过”“在我们上次聊天中”；直接顺着当下话题接，比如“你又熬夜了？上次也是这样连着好几天。”",
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
