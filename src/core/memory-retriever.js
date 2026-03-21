import fs from "node:fs/promises";

const CJK_RE = /[\u3400-\u9fff]/;
const CJK_SEQUENCE_RE = /[\u3400-\u9fff]+/g;
const LATIN_SEQUENCE_RE = /[a-zA-Z0-9']+/g;

function parseJsonLines(raw) {
  return String(raw || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
}

function tokenizeChinese(text) {
  const tokens = [];
  const matches = String(text || "").match(CJK_SEQUENCE_RE) || [];

  for (const segment of matches) {
    if (segment.length < 2) {
      continue;
    }

    for (let index = 0; index < segment.length - 1; index += 1) {
      tokens.push(segment.slice(index, index + 2));
    }
  }

  return tokens;
}

function tokenizeEnglish(text) {
  return (String(text || "").match(LATIN_SEQUENCE_RE) || [])
    .map((token) => token.toLowerCase())
    .filter(Boolean);
}

function tokenize(text) {
  return [...tokenizeChinese(text), ...tokenizeEnglish(text)];
}

function intersectionRatio(leftTokens, rightTokens) {
  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let matches = 0;

  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      matches += 1;
    }
  }

  return matches / leftTokens.size;
}

function buildDecay(daysSince, intensity) {
  const baseCoefficient = 0.12;
  const effectiveCoefficient =
    Number(intensity) >= 0.7 ? baseCoefficient * 0.3 : baseCoefficient;

  return Math.exp(-Math.max(0, daysSince) * effectiveCoefficient);
}

function getDaysSince(createdAt) {
  const timestamp = Date.parse(createdAt || "");

  if (!Number.isFinite(timestamp)) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(0, (Date.now() - timestamp) / 86400000);
}

export function inferEmotionFromText(text) {
  const source = String(text || "").toLowerCase();

  if (!source.trim()) {
    return "calm";
  }

  const rules = [
    {
      emotion: "sad",
      keywords: ["难过", "委屈", "沮丧", "伤心", "低落", "悲伤", "upset", "sad"]
    },
    {
      emotion: "concerned",
      keywords: ["焦虑", "压力", "担心", "不安", "害怕", "累", "崩", "stress", "anxious"]
    },
    {
      emotion: "happy",
      keywords: ["开心", "高兴", "顺利", "终于", "兴奋", "快乐", "great", "happy", "glad"]
    },
    {
      emotion: "angry",
      keywords: ["生气", "烦", "火大", "受不了", "angry", "mad", "annoyed"]
    },
    {
      emotion: "curious",
      keywords: ["为什么", "怎么", "想知道", "好奇", "wonder", "curious"]
    }
  ];

  for (const rule of rules) {
    if (rule.keywords.some((keyword) => source.includes(keyword))) {
      return rule.emotion;
    }
  }

  return "calm";
}

export class MemoryRetriever {
  constructor({ store }) {
    this.store = store;
    this.fileCache = new Map();
  }

  async loadEpisodes() {
    try {
      const directoryPath = this.store.resolve("memory/episodes");
      const fileNames = (await fs.readdir(directoryPath))
        .filter((fileName) => fileName.endsWith(".jsonl"))
        .sort()
        .reverse();
      const episodes = [];

      for (const fileName of fileNames) {
        const fullPath = this.store.resolve("memory/episodes", fileName);
        const stat = await fs.stat(fullPath);
        const cached = this.fileCache.get(fullPath);

        if (
          cached &&
          cached.mtimeMs === stat.mtimeMs &&
          cached.size === stat.size
        ) {
          episodes.push(...cached.episodes);
          continue;
        }

        const raw = await fs.readFile(fullPath, "utf8");
        const parsedEpisodes = parseJsonLines(raw).filter(
          (episode) => episode && typeof episode === "object"
        );

        this.fileCache.set(fullPath, {
          mtimeMs: stat.mtimeMs,
          size: stat.size,
          episodes: parsedEpisodes
        });
        episodes.push(...parsedEpisodes);
      }

      return episodes.sort((left, right) => {
        const leftTime = Date.parse(left?.createdAt || 0);
        const rightTime = Date.parse(right?.createdAt || 0);
        return rightTime - leftTime;
      });
    } catch (error) {
      if (error?.code !== "ENOENT") {
        console.warn("memory retriever load episodes failed:", error?.message || error);
      }
      return [];
    }
  }

  async retrieveRelevantMemories({ userInput, currentEmotion, limit = 5 }) {
    try {
      const trimmedInput = String(userInput || "").trim();

      if (!trimmedInput) {
        return [];
      }

      const queryTokens = new Set(tokenize(trimmedInput));
      if (queryTokens.size === 0) {
        return [];
      }

      const emotion = String(currentEmotion || "").trim() || inferEmotionFromText(trimmedInput);
      const episodes = await this.loadEpisodes();
      const scoredEpisodes = episodes
        .map((episode) => {
          const summaryText = `${episode.summary || ""} ${episode.topicLabel || ""}`;
          const episodeTokens = new Set(tokenize(summaryText));
          const topicMatch = intersectionRatio(queryTokens, episodeTokens) * 1.0;
          const emotionMatch =
            emotion &&
            emotion === String(episode?.emotionalMoment?.emotion || "").trim()
              ? 1.5
              : 0;
          const daysSince = getDaysSince(episode.createdAt);
          const recencyBonus = daysSince <= 7 ? 2.0 : 0;
          const decay = buildDecay(
            daysSince,
            episode?.emotionalMoment?.intensity ?? 0
          );
          const score = (topicMatch + emotionMatch + recencyBonus) * decay;

          return {
            episode,
            score,
            topicMatch,
            emotionMatch
          };
        })
        .filter(({ episode, score, topicMatch, emotionMatch }) => {
          if (!episode?.summary || score <= 0) {
            return false;
          }

          return topicMatch > 0 || emotionMatch > 0;
        })
        .sort((left, right) => {
          if (right.score !== left.score) {
            return right.score - left.score;
          }

          return Date.parse(right.episode?.createdAt || 0) - Date.parse(left.episode?.createdAt || 0);
        })
        .slice(0, limit);

      return scoredEpisodes.map(({ episode }) => episode.summary);
    } catch (error) {
      console.warn("memory retriever failed:", error?.message || error);
      return [];
    }
  }
}
