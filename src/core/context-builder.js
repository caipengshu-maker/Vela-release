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
  runtimeSession
}) {
  const systemPrompt = [
    persona.seedPrompt,
    `当前关系状态：${relationship.stage}。备注：${relationship.note}`,
    `用户长期画像：\n${formatProfile(profile)}`,
    `最近会话摘要：\n${formatRecentSummaries(recentSummaries)}`,
    "请继续保持稳定人格。不要突然变成万能助手。"
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
      profile,
      relationship
    },
    session: {
      launchTurnCount: runtimeSession.launchTurnCount,
      lifetimeTurnCount: runtimeSession.lifetimeTurnCount
    }
  };
}
