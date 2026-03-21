import { randomUUID } from "node:crypto";
import { generateReply } from "./provider.js";

const MEMORY_SUMMARIZER_PROMPT = `你在为聊天伴侣系统提炼一轮对话记忆。

只输出一个 JSON 对象，不要代码块，不要解释，不要额外文本。
JSON 结构必须是：
{
  "id": "string",
  "createdAt": "ISO-8601 string",
  "turnIndex": 0,
  "summary": "string",
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
- summary 用简洁中文概括这一轮对话，1 到 2 句
- facts 只保留长期有价值的信息；没有就输出空数组
- preference 用于用户偏好、习惯、稳定倾向
- event 用于明确发生过或即将发生的重要事件
- confidence 取 0 到 1
- emotionalMoment 如果不明显也要输出对象，detected=false 时 emotion 用 "calm"，intensity 用 0
- topicLabel 用 2 到 8 个字概括话题
- 使用输入里给出的 id、createdAt、turnIndex 原样写回`;

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
    facts: Array.isArray(payload?.facts) ? payload.facts : [],
    emotionalMoment: {
      detected: Boolean(emotionalMoment.detected),
      emotion: String(emotionalMoment.emotion || "calm").trim() || "calm",
      intensity: normalizeConfidence(emotionalMoment.intensity, 0)
    },
    topicLabel
  };
}

export class MemorySummarizer {
  constructor({ memoryStore, config }) {
    this.memoryStore = memoryStore;
    this.config = config;
  }

  async summarizeTurn({ userMessage, assistantReply, emotion, action, turnIndex }) {
    try {
      const defaults = {
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        turnIndex: Number(turnIndex) || 0
      };
      const context = {
        systemPrompt: MEMORY_SUMMARIZER_PROMPT,
        messages: [
          {
            role: "user",
            content: JSON.stringify(
              {
                ...defaults,
                userMessage,
                assistantReply,
                emotion: String(emotion || "calm").trim() || "calm",
                action: String(action || "none").trim() || "none"
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
        facts
      };

      await this.memoryStore.appendEpisode(finalEpisode);

      for (const fact of facts) {
        await this.memoryStore.appendFact(fact);
      }

      await this.memoryStore.autoUpdateProfile(facts);
      return finalEpisode;
    } catch (error) {
      console.warn("memory summarizer failed:", error?.message || error);
      return null;
    }
  }
}
