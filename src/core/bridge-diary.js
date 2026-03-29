import { generateReply } from "./provider.js";
import { getStrings } from "../i18n/strings.js";

function resolveLocale(locale) {
  return String(locale || "").trim() || "zh-CN";
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
  relationship,
  locale
}) {
  try {
    const systemPrompt =
      getStrings(resolveLocale(locale || config?.app?.locale))[
        "bridgeDiary.systemPrompt"
      ];
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
        systemPrompt,
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
