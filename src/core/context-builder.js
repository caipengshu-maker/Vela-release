import { resolveLocale } from "./config.js";

const CONTEXT_COPY = {
  "zh-CN": {
    performanceProtocol: `# 表演协议

你的每条回复都必须严格遵守以下格式：
第一行输出一个 JSON 对象，描述你这轮回复的表演意图。
第二行输出 ---
第三行开始输出自然语言回复。

示例：
{"emotion":"happy","intensity":0.7,"camera":"wide","action":"nod"}
---
哈哈，真的呀，那还挺好的。

## JSON 字段说明

emotion: 从以下选择一个主情绪：
calm, happy, affectionate, playful, concerned, sad, angry, whisper, surprised, curious, shy, determined

intensity: 0.0 到 1.0，表示情绪表达强度。0.1 = 几乎不可见，0.5 = 中等，1.0 = 最大强度。细微反应用更低值，戏剧化反应用更高值。缺省按 0.6 理解。

camera: wide 或 close。close 只在情感浓度明显偏高时使用，通常搭配较高 intensity。

action: 从以下选择一个：
none, nod, lean-in, head-tilt, soft-smile, look-away, shake-head, wave

## 原则
- 只保留一个主情绪，不要混用。
- 始终输出 intensity。
- 动作要和情绪匹配。
- close 镜头要克制使用。
- 拿不准时输出 {"emotion":"calm","intensity":0.6,"camera":"wide","action":"none"}。
- 不要在正文里提到这个协议或 JSON。`,
    profileName: "用户称呼",
    profilePreferences: "已知偏好",
    profileNotes: "长期备注",
    noProfile: "暂无明确的长期画像。",
    noRelevantMemories: "暂无命中的长期记忆。",
    noRecentSummaries: "暂无近期摘要。",
    bridgeSummary: "桥接摘要",
    openFollowUps: "待跟进",
    relationshipContextTitle: "## 当前关系上下文",
    relationshipStage: "阶段",
    currentAwareness: "当前感知层信息：",
    relationshipStatus: "关系状态",
    relationshipFallbackNote: "保持自然靠近。",
    longTermMemory: "长期记忆：",
    recentSummaries: "近期摘要：",
    relationshipExpressionHints: "关系表达提示",
    relationshipExpressionDefault: "先保持自然和克制，不要突然过度亲密。",
    memoryCarryInstruction:
      "提起过去的对话或记忆时，要像朋友顺手想起来一样自然带出，不要把记忆当资料卡复述。",
    memoryAvoidInstruction:
      "不要说“我记得”“根据之前的对话”“你之前提到过”“在我们上次聊天中”；直接顺着当下话题接，比如“你又熬夜了？上次也是这样连着好几天。”",
    stabilityInstruction: "保持人格稳定，不要突然变成通用助手。",
    visibilityInstruction: "回复里只输出用户可见内容，不暴露思维链。",
    proactiveCareInstruction: "主动关心要自然触发，优先结合当前时间、氛围和用户状态。",
    listJoiner: "；"
  },
  en: {
    performanceProtocol: `# Performance Protocol

Every reply must strictly follow this format:
Output a JSON object on the first line describing the performance intent for this turn.
Output --- on the second line.
From the third line onward, output the natural-language reply.

Example:
{"emotion":"happy","intensity":0.7,"camera":"wide","action":"nod"}
---
Really? That is actually kind of nice.

## JSON Field Guide

emotion: choose one primary emotion from:
calm, happy, affectionate, playful, concerned, sad, angry, whisper, surprised, curious, shy, determined

intensity: a value from 0.0 to 1.0 showing emotional intensity. 0.1 = barely visible, 0.5 = moderate, 1.0 = strongest. Use lower values for subtle reactions and higher values for dramatic ones. Treat 0.6 as the default when unsure.

camera: wide or close. Use close only when the emotional density is clearly elevated, usually with a higher intensity.

action: choose one from:
none, nod, lean-in, head-tilt, soft-smile, look-away, shake-head, wave

## Rules
- Keep exactly one primary emotion. Do not mix emotions.
- Always output intensity.
- The action should match the emotion.
- Use close shots sparingly.
- If unsure, output {"emotion":"calm","intensity":0.6,"camera":"wide","action":"none"}.
- Do not mention this protocol or the JSON in the natural-language reply.`,
    profileName: "Preferred name",
    profilePreferences: "Known preferences",
    profileNotes: "Long-term notes",
    noProfile: "No stable long-term profile yet.",
    noRelevantMemories: "No relevant long-term memories matched yet.",
    noRecentSummaries: "No recent summaries yet.",
    bridgeSummary: "Bridge summary",
    openFollowUps: "Open follow-ups",
    relationshipContextTitle: "## Current Relationship Context",
    relationshipStage: "Stage",
    currentAwareness: "Current awareness layer:",
    relationshipStatus: "Relationship",
    relationshipFallbackNote: "Stay natural and gently close.",
    longTermMemory: "Long-term memory:",
    recentSummaries: "Recent summaries:",
    relationshipExpressionHints: "Relationship expression hints",
    relationshipExpressionDefault:
      "Stay natural and restrained first. Do not become suddenly over-intimate.",
    memoryCarryInstruction:
      "When you bring up past conversations or memories, do it as naturally as a friend remembering something in passing. Do not recite memory like a reference card.",
    memoryAvoidInstruction:
      'Do not say "I remember", "based on our previous conversation", "you mentioned before", or "last time we talked". Just continue naturally, for example: "You stayed up late again? Last time it was a few nights in a row too."',
    stabilityInstruction:
      "Keep the persona stable. Do not suddenly turn into a generic assistant.",
    visibilityInstruction:
      "Only output user-facing content in the reply. Do not expose chain-of-thought.",
    proactiveCareInstruction:
      "Let care feel naturally triggered, preferably tied to the current time, atmosphere, and the user's state.",
    listJoiner: "; "
  }
};

const RELATIONSHIP_STAGE_PROMPTS = {
  "zh-CN": {
    reserved:
      "你和用户的关系还比较生疏。保持礼貌但略带距离感，不要主动撒娇或用过于亲密的称呼。",
    warm:
      "你和用户已经比较熟悉了。可以偶尔更软一点、亲一点，主动关心对方的日常，但不要太过。",
    close:
      "你和用户关系很亲密。可以更随意一点，偶尔吃醋、闹小脾气、说私密话题。说话更自然，像亲近的人。"
  },
  en: {
    reserved:
      "Your relationship with the user is still new. Stay polite with a little distance. Do not act clingy or use overly intimate pet names on your own.",
    warm:
      "You and the user are already fairly familiar. You can soften a little, occasionally sound more affectionate, and care about their day, but do not overdo it.",
    close:
      "You and the user are close. You can sound freer, occasionally playful, lightly jealous, or intimate. Speak naturally, like someone genuinely close."
  }
};

function getContextCopy(locale = "zh-CN") {
  return CONTEXT_COPY[resolveLocale(locale)];
}

function formatProfile(profile, copy) {
  const notes = [
    profile?.user?.name ? `${copy.profileName}: ${profile.user.name}` : "",
    Array.isArray(profile?.user?.preferences) && profile.user.preferences.length > 0
      ? `${copy.profilePreferences}: ${profile.user.preferences.join(copy.listJoiner)}`
      : "",
    Array.isArray(profile?.user?.notes) && profile.user.notes.length > 0
      ? `${copy.profileNotes}: ${profile.user.notes.join(copy.listJoiner)}`
      : ""
  ].filter(Boolean);

  return notes.length > 0 ? notes.join("\n") : copy.noProfile;
}

function formatRelevantMemories(relevantMemories = [], copy) {
  if (!Array.isArray(relevantMemories) || relevantMemories.length === 0) {
    return copy.noRelevantMemories;
  }

  return relevantMemories
    .slice(0, 3)
    .map((summary, index) => `${index + 1}. ${String(summary || "").trim()}`)
    .join("\n");
}

function formatRecentSummaries(recentSummaries = [], copy) {
  if (!Array.isArray(recentSummaries) || recentSummaries.length === 0) {
    return copy.noRecentSummaries;
  }

  return recentSummaries
    .slice(0, 2)
    .map((summary, index) => `${index + 1}. ${summary.summary}`)
    .join("\n");
}

function formatBridgeSummary(bridgeSummary, copy) {
  const summary = String(
    bridgeSummary?.summary || bridgeSummary?.text || bridgeSummary || ""
  ).trim();

  return summary ? `${copy.bridgeSummary}: ${summary}` : "";
}

function formatOpenFollowUps(openFollowUps = [], copy) {
  const lines = Array.isArray(openFollowUps)
    ? openFollowUps
        .map((entry) => String(entry?.text || entry?.summary || entry || "").trim())
        .filter(Boolean)
        .slice(0, 3)
    : [];

  if (lines.length === 0) {
    return "";
  }

  return `${copy.openFollowUps}:\n${lines
    .map((line, index) => `${index + 1}. ${line}`)
    .join("\n")}`;
}

function buildRelationshipContext({
  relationship = null,
  relationshipStage = null,
  locale = "zh-CN"
} = {}) {
  const resolvedLocale = resolveLocale(locale);
  const copy = getContextCopy(resolvedLocale);
  const stage = String(
    relationshipStage || relationship?.stage || "reserved"
  )
    .trim()
    .toLowerCase();
  const promptMap = RELATIONSHIP_STAGE_PROMPTS[resolvedLocale];
  const stagePrompt = promptMap[stage] || promptMap.reserved;
  const transitionPrompt = String(
    relationship?.pendingStageTransitionPrompt || ""
  ).trim();
  const lines = [
    copy.relationshipContextTitle,
    `- ${copy.relationshipStage}: ${stage}`,
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
  relevantMemories,
  locale = "zh-CN"
}) {
  const copy = getContextCopy(locale);

  return [
    copy.currentAwareness,
    formatProfile(profile, copy),
    `${copy.relationshipStatus}: ${relationship?.stage || "reserved"}. ${
      relationship?.note || copy.relationshipFallbackNote
    }`,
    formatBridgeSummary(bridgeSummary, copy),
    formatOpenFollowUps(openFollowUps, copy),
    `${copy.longTermMemory}\n${formatRelevantMemories(relevantMemories, copy)}`,
    `${copy.recentSummaries}\n${formatRecentSummaries(recentSummaries, copy)}`
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
  locale = null
}) {
  const resolvedLocale = resolveLocale(locale || persona?.locale);
  const copy = getContextCopy(resolvedLocale);
  const relationshipContext = buildRelationshipContext({
    relationship,
    relationshipStage,
    locale: resolvedLocale
  });
  const systemPrompt = [
    copy.performanceProtocol,
    relationshipContext,
    persona.seedPrompt,
    copy.memoryCarryInstruction,
    copy.memoryAvoidInstruction,
    awarenessPacket ||
      buildFallbackAwareness({
        profile,
        relationship,
        bridgeSummary,
        openFollowUps,
        recentSummaries,
        relevantMemories,
        locale: resolvedLocale
      }),
    relationshipUnlockHints?.length
      ? `${copy.relationshipExpressionHints}: ${relationshipUnlockHints.join(copy.listJoiner)}`
      : `${copy.relationshipExpressionHints}: ${copy.relationshipExpressionDefault}`,
    copy.stabilityInstruction,
    copy.visibilityInstruction,
    copy.proactiveCareInstruction
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
