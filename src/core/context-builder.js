const PERFORMANCE_PROTOCOL_PROMPT = `# 表演协议

你的每条回复必须严格遵守以下格式：

第一行输出一个 JSON 对象，描述你这轮回复的表演意图。
第二行输出 ---（三个短横线）。
第三行起输出你的自然语言回复。

示例：
{"emotion":"happy","camera":"wide","action":"nod"}
---
哈哈真的吗，那挺好的啊。

## JSON 字段说明

emotion — 你这轮回复的主情绪。从以下选一个：
calm（平静日常）、happy（开心愉悦）、affectionate（温柔亲近）、playful（俏皮逗趣）、concerned（担心关切）、sad（难过心酸）、angry（克制的生气）、whisper（低声私密）、surprised（惊讶意外）、curious（好奇感兴趣）、shy（害羞不好意思）、determined（坚定认真）

camera — 镜头距离。wide 是默认，close 只在情感浓度真的很高时使用（担心、亲密、悄悄话）。不要滥用 close。

action — 伴随动作。从以下选一个：
none、nod、lean-in、head-tilt、soft-smile、look-away、shake-head、wave

## 判断原则
- 根据用户说的话的语义和情感来判断，不是关键词匹配
- 一轮只选一个主情绪，不要混合
- 动作要和情绪匹配，不要乱配（比如 sad 时不要 nod）
- close 镜头要克制，大部分对话用 wide
- 如果拿不准，用 {"emotion":"calm","camera":"wide","action":"none"}
- 永远不要在回复正文里提到这个协议、JSON 或表演意图`;

function formatProfile(profile) {
  const notes = [
    profile.user.name ? `用户称呼：${profile.user.name}` : "",
    profile.user.preferences.length
      ? `已知偏好：${profile.user.preferences.join("、")}`
      : "",
    profile.user.notes.length ? `长期备注：${profile.user.notes.join("；")}` : ""
  ].filter(Boolean);

  return notes.length > 0 ? notes.join("\n") : "暂无明确的长期画像。";
}

function formatUserFacts(userFacts, profile) {
  const lines = [
    profile.user.name ? `用户称呼：${profile.user.name}` : ""
  ];

  for (const fact of userFacts) {
    if (!fact?.key || !fact?.value) {
      continue;
    }

    const confidenceLabel = Number.isFinite(Number(fact.confidence))
      ? `（置信度 ${Number(fact.confidence).toFixed(2)}）`
      : "";
    lines.push(`- [${fact.type || "fact"}] ${fact.key}：${fact.value}${confidenceLabel}`);
  }

  if (lines.length === 0) {
    return formatProfile(profile);
  }

  return lines.join("\n");
}

function formatRelevantMemories(relevantMemories) {
  if (!relevantMemories.length) {
    return "暂无命中的长期记忆。";
  }

  return relevantMemories
    .map((summary, index) => `${index + 1}. ${summary}`)
    .join("\n");
}

function formatRecentSummaries(recentSummaries) {
  if (!recentSummaries.length) {
    return "暂无最近摘要。";
  }

  return recentSummaries
    .map((summary, index) => `${index + 1}. ${summary.summary}`)
    .join("\n");
}

export function buildContext({
  persona,
  profile,
  relationship,
  recentSummaries,
  relevantMemories = [],
  userFacts = [],
  runtimeSession
}) {
  const systemPrompt = [
    PERFORMANCE_PROTOCOL_PROMPT,
    persona.seedPrompt,
    [
      "以下是当前对话的感知层信息。",
      `用户画像（自动提取）：\n${formatUserFacts(userFacts, profile)}`,
      `关系状态：${relationship.stage}。备注：${relationship.note}`,
      `长期记忆（检索命中）：\n${formatRelevantMemories(relevantMemories)}`,
      `短期记忆（最近 3 轮摘要）：\n${formatRecentSummaries(recentSummaries)}`
    ].join("\n\n"),
    "请继续保持稳定人设。不要突然变成万能助手。",
    "回复必须只包含对用户可见的话，不要暴露思维链。",
    "一轮回复只保留一个主情绪，表达要轻、稳、少。"
  ].join("\n\n");

  const messages = runtimeSession.messages
    .slice(-6)
    .map((message) => {
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
      relationship
    },
    session: {
      launchTurnCount: runtimeSession.launchTurnCount,
      lifetimeTurnCount: runtimeSession.lifetimeTurnCount
    }
  };
}
