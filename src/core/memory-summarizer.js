import { randomUUID } from "node:crypto";
import { resolveLocale } from "./config.js";
import { generateReply } from "./provider.js";

const MEMORY_SUMMARIZER_PROMPTS = {
  "zh-CN": `你在为一个陪伴型聊天系统生成一条“触发式”对话记忆。
只输出一个 JSON 对象，不要代码块，不要解释，不要额外文本。结构如下：
{
  "id": "string",
  "createdAt": "ISO-8601 string",
  "turnIndex": 0,
  "summary": "string",
  "bridgeSummary": "string",
  "openFollowUps": ["string"],
  "facts": [
    {
      "type": "preference | event | fact",
      "key": "string",
      "value": "string",
      "confidence": 0.0
    }
  ],
  "emotionalMoment": {
    "detected": true,
    "emotion": "string",
    "intensity": 0.0
  },
  "topicLabel": "string"
}

要求：
- summary 用简洁中文概括这一轮对话，1 到 2 句即可。
- bridgeSummary 用一条更短的“接话摘要”，方便之后隔一段时间重新接回。
- openFollowUps 只保留后续值得继续追的问题，最多 3 条；没有就输出空数组。
- facts 只保留长期有价值的信息，没有就输出空数组。
- preference 用于用户偏好、习惯、稳定倾向。
- event 用于明确发生过或即将发生的重要事件。
- confidence 取值 0 到 1。
- emotionalMoment 如果不明显也要输出对象，detected=false 时 emotion 写 "calm"，intensity 写 0。
- topicLabel 用 2 到 8 个字概括话题。
- 使用输入里的 id、createdAt、turnIndex 原样写回。`,
  en: `You are generating one trigger-based conversation memory for a companionship chat system.
Output exactly one JSON object. No code fences, no explanations, no extra text. Use this structure:
{
  "id": "string",
  "createdAt": "ISO-8601 string",
  "turnIndex": 0,
  "summary": "string",
  "bridgeSummary": "string",
  "openFollowUps": ["string"],
  "facts": [
    {
      "type": "preference | event | fact",
      "key": "string",
      "value": "string",
      "confidence": 0.0
    }
  ],
  "emotionalMoment": {
    "detected": true,
    "emotion": "string",
    "intensity": 0.0
  },
  "topicLabel": "string"
}

Requirements:
- summary should be a concise English summary of this turn in 1 to 2 sentences.
- bridgeSummary should be a shorter English handoff line that makes it easy to resume later.
- openFollowUps should keep only questions worth returning to later, with at most 3 items. Use an empty array if there are none.
- facts should keep only information with long-term value. Use an empty array if there are none.
- Use preference for user preferences, habits, and stable tendencies.
- Use event for important events that clearly happened or are about to happen.
- confidence must be between 0 and 1.
- emotionalMoment must always be present. If nothing stands out, set detected=false, emotion="calm", intensity=0.
- topicLabel should be a short English topic tag in 1 to 4 words.
- Copy id, createdAt, and turnIndex back exactly as provided in the input.`
};

function buildMemorySummarizerPrompt(locale = "zh-CN") {
  return MEMORY_SUMMARIZER_PROMPTS[resolveLocale(locale)];
}

function buildSummarizerConfig(config) {
  return {
    ...config,
    llm: {
      ...config.llm,
      temperature: 0.3,
      maxTokens: 300,
      thinking: {
        ...config.llm.thinking,
        enabled: false
      }
    }
  };
}

function normalizeConfidence(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.max(0, Math.min(1, numeric));
}

function normalizeStringList(values, limit = 3) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => String(value?.text || value?.summary || value || "").trim())
    .filter(Boolean)
    .slice(0, limit);
}

function extractJsonObject(text) {
  const source = String(text || "").trim();
  const fenced = source.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  const start = fenced.indexOf("{");

  if (start < 0) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < fenced.length; index += 1) {
    const char = fenced[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === "\"") {
        inString = false;
      }

      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return fenced.slice(start, index + 1);
      }
    }
  }

  return null;
}

function normalizeFact(fact, episode) {
  if (!fact || typeof fact !== "object" || Array.isArray(fact)) {
    return null;
  }

  const key = String(fact.key || "").trim();
  const value = String(fact.value || "").trim();

  if (!key || !value) {
    return null;
  }

  return {
    id: randomUUID(),
    episodeId: episode.id,
    createdAt: episode.createdAt,
    turnIndex: episode.turnIndex,
    type: String(fact.type || "fact").trim().toLowerCase() || "fact",
    key,
    value,
    confidence: normalizeConfidence(fact.confidence, 0)
  };
}

function normalizeEpisode(payload, defaults) {
  const summary = String(payload?.summary || "").trim();
  const bridgeSummary = String(
    payload?.bridgeSummary || payload?.summary || ""
  ).trim();
  const topicLabel = String(payload?.topicLabel || "").trim();

  if (!summary || !topicLabel) {
    return null;
  }

  const emotionalMoment =
    payload?.emotionalMoment && typeof payload.emotionalMoment === "object"
      ? payload.emotionalMoment
      : {};

  return {
    id: defaults.id,
    createdAt: defaults.createdAt,
    turnIndex: defaults.turnIndex,
    summary,
    bridgeSummary,
    openFollowUps: normalizeStringList(payload?.openFollowUps, 3),
    facts: Array.isArray(payload?.facts) ? payload.facts : [],
    emotionalMoment: {
      detected: Boolean(emotionalMoment.detected),
      emotion: String(emotionalMoment.emotion || "calm").trim() || "calm",
      intensity: normalizeConfidence(emotionalMoment.intensity, 0)
    },
    topicLabel
  };
}

function truncateText(value, maxLength) {
  const text = String(value || "").trim();
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}...`;
}

function createRawFallback(defaults, { userMessage, assistantReply }) {
  return {
    id: defaults.id,
    type: "raw-fallback",
    userMessage: String(userMessage || "").trim(),
    assistantReply: truncateText(assistantReply, 200),
    createdAt: defaults.createdAt,
    reason: "parse-error"
  };
}

export class MemorySummarizer {
  constructor({ memoryStore, config }) {
    this.memoryStore = memoryStore;
    this.config = config;
  }

  async summarizeTurn({
    userMessage,
    assistantReply,
    emotion,
    action,
    turnIndex,
    triggerReasons = [],
    lastActiveAt = null
  }) {
    const defaults = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      turnIndex: Number(turnIndex) || 0
    };

    try {
      const context = {
        systemPrompt: buildMemorySummarizerPrompt(this.config?.app?.locale),
        messages: [
          {
            role: "user",
            content: JSON.stringify(
              {
                ...defaults,
                userMessage,
                assistantReply,
                emotion: String(emotion || "calm").trim() || "calm",
                action: String(action || "none").trim() || "none",
                triggerReasons: Array.isArray(triggerReasons) ? triggerReasons : [],
                lastActiveAt
              },
              null,
              2
            )
          }
        ],
        memory: {
          recentSummaries: []
        },
        session: {
          launchTurnCount: 0,
          lifetimeTurnCount: defaults.turnIndex
        }
      };
      const response = await generateReply(
        context,
        buildSummarizerConfig(this.config),
        {
          thinkingMode: "balanced"
        }
      );
      const jsonText = extractJsonObject(response?.text);

      if (!jsonText) {
        throw new Error("summarizer did not return JSON");
      }

      const parsed = JSON.parse(jsonText);
      const episode = normalizeEpisode(parsed, defaults);

      if (!episode) {
        throw new Error("summarizer JSON missing summary or topicLabel");
      }

      const facts = episode.facts
        .map((fact) => normalizeFact(fact, episode))
        .filter(Boolean);
      const finalEpisode = {
        ...episode,
        facts,
        bridgeSummary: episode.bridgeSummary || episode.summary,
        openFollowUps: Array.isArray(episode.openFollowUps)
          ? episode.openFollowUps
          : []
      };

      await this.memoryStore.appendEpisode(finalEpisode);

      for (const fact of facts) {
        await this.memoryStore.appendFact(fact);
      }

      await this.memoryStore.autoUpdateProfile(facts);
      return finalEpisode;
    } catch (error) {
      console.warn("[memory-summarizer] Parse failed, using raw fallback");
      console.warn("memory summarizer failed:", error?.message || error);

      const fallbackEpisode = createRawFallback(defaults, {
        userMessage,
        assistantReply
      });

      await this.memoryStore.appendEpisode(fallbackEpisode);
      return fallbackEpisode;
    }
  }
}
