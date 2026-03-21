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

function formatRelevantMemories(relevantMemories) {
  if (!Array.isArray(relevantMemories) || relevantMemories.length === 0) {
    return "暂无命中的长期记忆。";
  }

  return relevantMemories
    .slice(0, 3)
    .map((summary, index) => `${index + 1}. ${summary}`)
    .join("\n");
}

function formatRecentSummaries(recentSummaries) {
  if (!Array.isArray(recentSummaries) || recentSummaries.length === 0) {
    return "暂无最近摘要。";
  }

  return recentSummaries
    .slice(0, 3)
    .map((summary, index) => `${index + 1}. ${summary.summary}`)
    .join("\n");
}

function buildFallbackAwareness({
  profile,
  relationship,
  recentSummaries,
  relevantMemories
}) {
  return [
    "当前感知层信息：",
    formatProfile(profile),
    `关系状态：${relationship?.stage || "warm"}。备注：${relationship?.note || "保持自然靠近。"}`,
    `长期记忆：\n${formatRelevantMemories(relevantMemories)}`,
    `近期摘要：\n${formatRecentSummaries(recentSummaries)}`
  ].join("\n\n");
}

export function buildContext({
  persona,
  profile,
  relationship,
  recentSummaries,
  relevantMemories = [],
  userFacts = [],
  runtimeSession,
  awarenessPacket = "",
  relationshipUnlockHints = []
}) {
  const systemPrompt = [
    PERFORMANCE_PROTOCOL_PROMPT,
    persona.seedPrompt,
    awarenessPacket || buildFallbackAwareness({
      profile,
      relationship,
      recentSummaries,
      relevantMemories
    }),
    relationshipUnlockHints?.length
      ? `关系表达提示：${relationshipUnlockHints.join("；")}`
      : "关系表达提示：先保持自然和分寸，不要突然使用过强亲密称呼。",
    "请继续保持稳定人设，不要突然变成通用助手。",
    "回复里只输出用户可见内容，不暴露思维链。",
    "主动关心要自然触发，优先结合当下时间、气氛和用户状态。"
  ].join("\n\n");

  const messages = runtimeSession.messages.slice(-6).map((message) => {
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
      relevantMemories,
      userFacts,
      profile,
      relationship,
      relationshipUnlockHints
    },
    session: {
      launchTurnCount: runtimeSession.launchTurnCount,
      lifetimeTurnCount: runtimeSession.lifetimeTurnCount
    }
  };
}
