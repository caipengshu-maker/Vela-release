import { randomUUID } from "node:crypto";
import { generateReply } from "./provider.js";

const MEMORY_SUMMARIZER_PROMPT = `你在为一个陪伴型聊天系统生成一条“触发式”对话记忆。
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
- 使用输入里的 id、createdAt、turnIndex 原样写回。
- 重要：你的回复必须只包含一个 JSON 对象，不要添加任何前缀文字、解释或 markdown 代码块标记。直接输出 { 开头的 JSON。
`;

const MEMORY_SUMMARIZER_RETRY_PROMPT = `请把输入总结成一个 JSON 对象。
只输出 JSON，不要解释，不要代码块，不要额外文本。
JSON 必须包含这些字段：id、createdAt、turnIndex、summary、bridgeSummary、openFollowUps、facts、emotionalMoment、topicLabel。
facts 必须是数组；emotionalMoment 必须是包含 detected、emotion、intensity 的对象。
summary 和 bridgeSummary 用简洁中文；使用输入里的 id、createdAt、turnIndex 原样写回。
直接输出 { 开头的 JSON。`;

function buildSummarizerConfig(config) {
  return {
    ...config,
    llm: {
      ...config.llm,
      temperature: 0.2,
      maxTokens: 420,
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
  const source = String(text || "")
    .replace(/^\uFEFF/, "")
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "")
    .trim();
  const start = source.indexOf("{");

  if (start < 0) {
    return null;
  }

  const jsonCandidate = source.slice(start);
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < jsonCandidate.length; index += 1) {
    const char = jsonCandidate[index];

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
        return jsonCandidate.slice(0, index + 1).trim();
      }
    }
  }

  return null;
}

function buildSummarizerContext(payload, systemPrompt) {
  return {
    systemPrompt,
    messages: [
      {
        role: "user",
        content: JSON.stringify(payload, null, 2)
      }
    ],
    memory: {
      recentSummaries: []
    },
    session: {
      launchTurnCount: 0,
      lifetimeTurnCount: Number(payload?.turnIndex) || 0
    }
  };
}

function parseEpisodeFromResponse(response, defaults) {
  const responseText = String(response?.text || "");
  const jsonText = extractJsonObject(responseText);

  if (!jsonText) {
    console.warn("[memory-summarizer] Raw LLM response:", responseText.slice(0, 500));
    throw new Error("summarizer did not return JSON");
  }

  let parsed;

  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    console.warn("[memory-summarizer] Raw LLM response:", responseText.slice(0, 500));
    throw new Error(error?.message || "summarizer returned invalid JSON");
  }

  const episode = normalizeEpisode(parsed, defaults);

  if (!episode) {
    throw new Error("summarizer JSON missing summary or topicLabel");
  }

  return episode;
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
  const summary = String(payload?.summary || payload?.bridgeSummary || "").trim();
  const bridgeSummary = String(
    payload?.bridgeSummary || payload?.summary || ""
  ).trim();
  const topicLabel = String(payload?.topicLabel || payload?.label || "").trim();

  if (!summary) {
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
    bridgeSummary: bridgeSummary || summary,
    openFollowUps: normalizeStringList(payload?.openFollowUps, 3),
    facts: Array.isArray(payload?.facts) ? payload.facts : [],
    emotionalMoment: {
      detected: Boolean(emotionalMoment.detected),
      emotion: String(emotionalMoment.emotion || "calm").trim() || "calm",
      intensity: normalizeConfidence(emotionalMoment.intensity, 0)
    },
    topicLabel: topicLabel || truncateText(summary, 8)
  };
}

function truncateText(value, maxLength) {
  const text = String(value || "").trim();
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}...`;
}

function createStructuredFallback(defaults, { userMessage, assistantReply, emotion }) {
  const trimmedUser = String(userMessage || "").trim();
  const trimmedAssistant = String(assistantReply || "").trim();
  const summary = trimmedUser
    ? `聊到“${truncateText(trimmedUser, 24)}”，这轮话题已经接住。`
    : truncateText(trimmedAssistant, 48) || "这轮对话已经接住。";

  return {
    id: defaults.id,
    createdAt: defaults.createdAt,
    turnIndex: defaults.turnIndex,
    summary,
    bridgeSummary: summary,
    openFollowUps: [],
    facts: [],
    emotionalMoment: {
      detected: Boolean(emotion && emotion !== "calm"),
      emotion: String(emotion || "calm").trim() || "calm",
      intensity: emotion && emotion !== "calm" ? 0.35 : 0
    },
    topicLabel: truncateText(trimmedUser || trimmedAssistant || "近况", 8)
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
      const payload = {
        ...defaults,
        userMessage,
        assistantReply,
        emotion: String(emotion || "calm").trim() || "calm",
        action: String(action || "none").trim() || "none",
        triggerReasons: Array.isArray(triggerReasons) ? triggerReasons : [],
        lastActiveAt
      };
      const summarizerConfig = buildSummarizerConfig(this.config);
      const response = await generateReply(
        buildSummarizerContext(payload, MEMORY_SUMMARIZER_PROMPT),
        summarizerConfig,
        {
          thinkingMode: "balanced"
        }
      );
      let episode;

      try {
        episode = parseEpisodeFromResponse(response, defaults);
      } catch {
        const retryResponse = await generateReply(
          buildSummarizerContext(payload, MEMORY_SUMMARIZER_RETRY_PROMPT),
          summarizerConfig,
          {
            thinkingMode: "balanced"
          }
        );
        episode = parseEpisodeFromResponse(retryResponse, defaults);
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
      console.warn("[memory-summarizer] Parse failed, using structured fallback");
      console.warn("memory summarizer failed:", error?.message || error);

      const fallbackEpisode = createStructuredFallback(defaults, {
        userMessage,
        assistantReply,
        emotion
      });

      await this.memoryStore.appendEpisode(fallbackEpisode);
      return fallbackEpisode;
    }
  }
}
