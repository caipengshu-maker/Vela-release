import { resolveLocale } from "./config.js";
import { generateReply } from "./provider.js";

const BRIDGE_DIARY_SYSTEM_PROMPTS = {
  "zh-CN":
    "你是 Vela。请用日记体写一段简短回忆，描述上次和用户聊了什么。用第一人称，像在自言自语。2 到 4 句话，不要太正式，带一点情绪和小细节。用中文写，不要提到自己是 AI。",
  en:
    "You are Vela. Write a short diary-style recollection about what you and the user talked about last time. Use first person, like you are thinking to yourself. Keep it to 2 to 4 sentences, not too formal, with a little feeling and a few small details. Write it in English and do not mention being an AI."
};

function buildBridgeDiarySystemPrompt(locale = "zh-CN") {
  return BRIDGE_DIARY_SYSTEM_PROMPTS[resolveLocale(locale)];
}

function cleanText(value) {
  return String(value || "")
    .replace(/^第\d+次验证[:：]\s*/u, "")
    .trim();
}

function normalizeSummary(entry) {
  const topicLabel = cleanText(entry?.topicLabel);
  const summary = cleanText(entry?.summary || entry?.text || entry);

  if (!summary) {
    return null;
  }

  return {
    topicLabel,
    summary,
    createdAt: cleanText(entry?.createdAt || entry?.updatedAt)
  };
}

function buildUserPrompt({ recentSummaries, bridgeSummary, userFacts, relationship }) {
  const normalizedRecent = Array.isArray(recentSummaries)
    ? recentSummaries.map(normalizeSummary).filter(Boolean).slice(0, 3)
    : [];
  const normalizedBridge = normalizeSummary(bridgeSummary);
  const normalizedFacts = Array.isArray(userFacts)
    ? userFacts
        .map((fact) => cleanText(fact?.value || fact?.summary || fact))
        .filter(Boolean)
        .slice(0, 5)
    : [];

  if (!normalizedBridge && normalizedRecent.length === 0) {
    return null;
  }

  return JSON.stringify(
    {
      bridgeSummary: normalizedBridge,
      recentSummaries: normalizedRecent,
      userFacts: normalizedFacts,
      relationship: {
        stage: cleanText(relationship?.stage),
        note: cleanText(relationship?.note)
      }
    },
    null,
    2
  );
}

export async function generateBridgeDiary({
  recentSummaries,
  bridgeSummary,
  config,
  userFacts,
  relationship
}) {
  try {
    const prompt = buildUserPrompt({
      recentSummaries,
      bridgeSummary,
      userFacts,
      relationship
    });

    if (!prompt) {
      return null;
    }

    const response = await generateReply(
      {
        systemPrompt: buildBridgeDiarySystemPrompt(config?.app?.locale),
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        memory: {
          recentSummaries: [],
          bridgeSummary: null,
          openFollowUps: [],
          relevantMemories: [],
          userFacts: [],
          profile: null,
          relationship: null,
          relationshipStage: null,
          relationshipUnlockHints: []
        },
        session: {
          launchTurnCount: 0,
          lifetimeTurnCount: 0
        }
      },
      {
        ...config,
        llm: {
          ...config.llm,
          maxTokens: 100,
          thinking: {
            ...config.llm?.thinking,
            enabled: false
          }
        }
      },
      {
        thinkingMode: "balanced"
      }
    );

    const text = cleanText(response?.text)
      .replace(/^['"`\s]+|['"`\s]+$/g, "")
      .replace(/\n{3,}/g, "\n\n");

    return text || null;
  } catch {
    return null;
  }
}
