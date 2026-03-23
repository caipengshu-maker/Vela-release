import fs from "node:fs/promises";
import { generateReply } from "./provider.js";

const PROFILE_FILE = "memory/profile.json";
const USER_MODEL_FILE = "memory/user-model.json";
const RELATIONSHIP_FILE = "memory/relationship.json";
const SUMMARY_INDEX_FILE = "memory/memory-summary.json";
const FACTS_FILE = "memory/facts.jsonl";
const SESSIONS_DIR = "memory/sessions";
const EPISODES_DIR = "memory/episodes";

const RELATIONSHIP_NOTE_PROMPT = `你在为一位长期聊天伴侣系统生成关系阶段备注。

只输出一句中文，不要引号，不要 JSON，不要解释。
要求：
- 15 到 30 个字
- 语气克制、自然，不油腻
- 描述双方当前关系感受，不要提系统、模型、阶段名、轮数`;

function defaultProfile() {
  return {
    user: {
      name: "",
      preferences: [],
      notes: []
    },
    vela: {
      personaId: "vela-default"
    },
    onboarding: {
      completed: false,
      velaName: "Vela",
      userName: "",
      temperament: "gentle-cool",
      distance: "warm"
    }
  };
}

function defaultUserModel() {
  return {
    updatedAt: null,
    user: {
      preferences: [],
      notes: []
    }
  };
}

function defaultRelationship() {
  return {
    stage: "warm",
    note: "熟悉，但仍然克制。",
    sharedMoments: []
  };
}

function defaultSummaryIndex() {
  return {
    updatedAt: null,
    recent: [],
    bridgeSummary: null,
    openFollowUps: []
  };
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

function normalizeEpisodeRecord(episode = {}) {
  if (!episode || typeof episode !== "object" || Array.isArray(episode)) {
    return null;
  }

  const type = String(episode.type || "summary").trim().toLowerCase();
  const createdAt = normalizeTimestamp(episode.createdAt);

  if (type === "raw-fallback") {
    return {
      id: String(episode.id || "").trim() || undefined,
      type: "raw-fallback",
      userMessage: String(episode.userMessage || "").trim(),
      assistantReply: String(episode.assistantReply || "").trim(),
      createdAt,
      reason: String(episode.reason || "parse-error").trim() || "parse-error"
    };
  }

  return {
    ...episode,
    id: String(episode.id || "").trim() || undefined,
    type,
    createdAt,
    turnIndex: Number.isFinite(Number(episode.turnIndex))
      ? Number(episode.turnIndex)
      : 0,
    summary: String(episode.summary || "").trim(),
    bridgeSummary: String(episode.bridgeSummary || episode.summary || "").trim(),
    openFollowUps: normalizeStringList(episode.openFollowUps, 3),
    facts: Array.isArray(episode.facts) ? episode.facts : [],
    emotionalMoment:
      episode.emotionalMoment && typeof episode.emotionalMoment === "object"
        ? episode.emotionalMoment
        : {
            detected: false,
            emotion: "calm",
            intensity: 0
          },
    topicLabel: String(episode.topicLabel || "").trim()
  };
}

function mergeProfile(profile = {}) {
  const base = defaultProfile();

  return {
    ...base,
    ...profile,
    user: {
      ...base.user,
      ...(profile.user || {})
    },
    vela: {
      ...base.vela,
      ...(profile.vela || {})
    },
    onboarding: {
      ...base.onboarding,
      ...(profile.onboarding || {})
    }
  };
}

function mergeUserModel(userModel = {}) {
  const base = defaultUserModel();

  return {
    ...base,
    ...userModel,
    user: {
      ...base.user,
      ...(userModel.user || {}),
      preferences: Array.isArray(userModel.user?.preferences)
        ? userModel.user.preferences
        : [],
      notes: Array.isArray(userModel.user?.notes) ? userModel.user.notes : []
    }
  };
}

function mergeRelationship(relationship = {}) {
  const base = defaultRelationship();

  return {
    ...base,
    ...relationship,
    sharedMoments: Array.isArray(relationship.sharedMoments)
      ? relationship.sharedMoments
      : []
  };
}

function sanitizeDay(createdAt) {
  const iso = String(createdAt || "").trim();
  return /^\d{4}-\d{2}-\d{2}/.test(iso)
    ? iso.slice(0, 10)
    : new Date().toISOString().slice(0, 10);
}

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

function normalizeTimestamp(value, fallback = new Date().toISOString()) {
  const iso = String(value || "").trim();
  return iso ? iso : fallback;
}

function normalizeConfidence(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.max(0, Math.min(1, numeric));
}

function normalizeFactType(value) {
  const type = String(value || "fact").trim().toLowerCase();
  return type || "fact";
}

function normalizeFact(fact, defaults = {}) {
  if (!fact || typeof fact !== "object" || Array.isArray(fact)) {
    return null;
  }

  const key = String(fact.key || defaults.key || "").trim();
  const value = String(fact.value || defaults.value || "").trim();

  if (!key || !value) {
    return null;
  }

  return {
    id: String(fact.id || defaults.id || "").trim() || undefined,
    episodeId:
      String(fact.episodeId || defaults.episodeId || "").trim() || undefined,
    turnIndex:
      Number.isFinite(Number(fact.turnIndex)) || Number.isFinite(Number(defaults.turnIndex))
        ? Number(fact.turnIndex ?? defaults.turnIndex)
        : undefined,
    createdAt: normalizeTimestamp(fact.createdAt || defaults.createdAt),
    type: normalizeFactType(fact.type || defaults.type),
    key,
    value,
    confidence: normalizeConfidence(
      fact.confidence ?? defaults.confidence,
      0
    )
  };
}

function isHighConfidenceFact(fact) {
  if (!fact) {
    return false;
  }

  if (fact.type === "event") {
    return fact.confidence >= 0.8;
  }

  return fact.confidence >= 0.7;
}

function formatFactLabel(entry) {
  const key = String(entry?.key || "").trim();
  const value = String(entry?.value || "").trim();

  if (!key) {
    return value;
  }

  return value.includes(key) ? value : `${key}：${value}`;
}

function upsertFactBucket(items, fact, limit) {
  const nextItem = {
    key: fact.key,
    value: fact.value,
    confidence: fact.confidence,
    updatedAt: normalizeTimestamp(fact.createdAt)
  };
  const filtered = items.filter((item) => item?.key !== nextItem.key);

  return [nextItem, ...filtered].slice(0, limit);
}

function sortByCreatedAtDesc(items) {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left?.createdAt || 0);
    const rightTime = Date.parse(right?.createdAt || 0);
    return rightTime - leftTime;
  });
}

function countEmotionalEpisodes(episodes) {
  return episodes.filter((episode) => {
    if (!episode?.emotionalMoment || typeof episode.emotionalMoment !== "object") {
      return false;
    }

    if (episode.emotionalMoment.detected === false) {
      return false;
    }

    return Boolean(String(episode.emotionalMoment.emotion || "").trim());
  }).length;
}

function downgradeRelationshipStage(stage) {
  switch (stage) {
    case "intimate":
      return "close";
    case "close":
      return "warm";
    case "warm":
      return "warm";
    default:
      return stage;
  }
}

function getFallbackRelationshipNote(stage) {
  switch (stage) {
    case "reserved":
      return "还带着一点试探，但已经知道该怎么接住彼此。";
    case "warm":
      return "熟悉感在积累，靠近时依然克制而自然。";
    case "close":
      return "彼此更容易接上话，也更懂对方话里的重量。";
    case "intimate":
      return "默契已经很深，很多情绪不必说满也能被接住。";
    default:
      return defaultRelationship().note;
  }
}

export class MemoryStore {
  constructor(store, config) {
    this.store = store;
    this.config = config;
  }

  async initialize() {
    try {
      await this.store.ensureDir("memory", "sessions");
      await this.store.ensureDir("memory", "episodes");

      const profile = mergeProfile(
        await this.store.readJson(PROFILE_FILE, defaultProfile())
      );

      await this.store.writeJson(PROFILE_FILE, profile);
      await this.store.writeJson(
        USER_MODEL_FILE,
        mergeUserModel(await this.store.readJson(USER_MODEL_FILE, defaultUserModel()))
      );
      await this.store.writeJson(
        RELATIONSHIP_FILE,
        mergeRelationship(
          await this.store.readJson(RELATIONSHIP_FILE, defaultRelationship())
        )
      );
      await this.store.writeJson(
        SUMMARY_INDEX_FILE,
        await this.store.readJson(SUMMARY_INDEX_FILE, defaultSummaryIndex())
      );
    } catch (error) {
      console.warn("memory initialize failed:", error?.message || error);
    }
  }

  async loadMemorySnapshot() {
    try {
      const profile = mergeProfile(
        await this.store.readJson(PROFILE_FILE, defaultProfile())
      );
      const relationship = mergeRelationship(
        await this.store.readJson(RELATIONSHIP_FILE, defaultRelationship())
      );
      const summaryIndex = await this.store.readJson(
        SUMMARY_INDEX_FILE,
        defaultSummaryIndex()
      );
      const userFacts = (await this.loadFacts()).filter(isHighConfidenceFact);

      return {
        profile,
        relationship,
        recentSummaries: (summaryIndex.recent || []).slice(
          0,
          this.config.runtime.recentSummaryLimit
        ),
        bridgeSummary: summaryIndex.bridgeSummary || null,
        openFollowUps: normalizeStringList(summaryIndex.openFollowUps, 3),
        userFacts
      };
    } catch (error) {
      console.warn("load memory snapshot failed:", error?.message || error);
      return {
        profile: defaultProfile(),
        relationship: defaultRelationship(),
        recentSummaries: [],
        bridgeSummary: null,
        openFollowUps: [],
        userFacts: []
      };
    }
  }

  async completeOnboarding({ velaName, userName, temperament, distance }) {
    try {
      const profile = mergeProfile(
        await this.store.readJson(PROFILE_FILE, defaultProfile())
      );

      const nextProfile = {
        ...profile,
        user: {
          ...profile.user,
          name: userName || profile.user.name
        },
        onboarding: {
          ...profile.onboarding,
          completed: true,
          velaName: velaName || profile.onboarding.velaName,
          userName: userName || profile.onboarding.userName,
          temperament: temperament || profile.onboarding.temperament,
          distance: distance || profile.onboarding.distance
        }
      };

      await this.store.writeJson(PROFILE_FILE, nextProfile);
      return nextProfile;
    } catch (error) {
      console.warn("complete onboarding failed:", error?.message || error);
      return mergeProfile(defaultProfile());
    }
  }

  async updateRelationship(relationship) {
    try {
      await this.store.writeJson(
        RELATIONSHIP_FILE,
        mergeRelationship(relationship)
      );
    } catch (error) {
      console.warn("update relationship failed:", error?.message || error);
    }
  }

  async appendTurnSummary(summary) {
    try {
      const day = sanitizeDay(summary?.createdAt);
      const relativePath = `${SESSIONS_DIR}/${day}.jsonl`;
      await this.store.appendJsonLine(relativePath, summary);

      const summaryIndex = await this.store.readJson(
        SUMMARY_INDEX_FILE,
        defaultSummaryIndex()
      );
      const shouldIndex = Boolean(
        String(summary?.bridgeSummary || "").trim() ||
          normalizeStringList(summary?.openFollowUps, 3).length > 0 ||
          summary?.pinToIndex
      );
      const recent = shouldIndex
        ? [summary, ...(summaryIndex.recent || [])].slice(
            0,
            this.config.runtime.summaryIndexLimit
          )
        : summaryIndex.recent || [];
      const bridgeSummaryText = String(
        summary?.bridgeSummary || summary?.summary || ""
      ).trim();
      const openFollowUps = normalizeStringList(summary?.openFollowUps, 3);

      await this.store.writeJson(SUMMARY_INDEX_FILE, {
        updatedAt: shouldIndex ? summary.createdAt : summaryIndex.updatedAt,
        recent,
        bridgeSummary: shouldIndex && bridgeSummaryText
          ? {
              summary: bridgeSummaryText,
              createdAt: summary.createdAt,
              turnIndex: summary.turnIndex || 0,
              topicLabel: summary.topicLabel || ""
            }
          : summaryIndex.bridgeSummary || null,
        openFollowUps:
          shouldIndex && openFollowUps.length > 0
            ? openFollowUps
            : summaryIndex.openFollowUps || []
      });
    } catch (error) {
      console.warn("append turn summary failed:", error?.message || error);
    }
  }

  async appendEpisode(episode) {
    try {
      const normalizedEpisode = normalizeEpisodeRecord(episode);

      if (!normalizedEpisode) {
        return null;
      }

      const day = sanitizeDay(normalizedEpisode.createdAt);
      await this.store.appendJsonLine(`${EPISODES_DIR}/${day}.jsonl`, normalizedEpisode);
      return normalizedEpisode;
    } catch (error) {
      console.warn("append episode failed:", error?.message || error);
      return null;
    }
  }

  async appendFact(fact) {
    try {
      const normalizedFact = normalizeFact(fact);

      if (!normalizedFact) {
        return null;
      }

      await this.store.appendJsonLine(FACTS_FILE, normalizedFact);
      return normalizedFact;
    } catch (error) {
      console.warn("append fact failed:", error?.message || error);
      return null;
    }
  }

  async loadFacts() {
    try {
      const raw = await fs.readFile(this.store.resolve(FACTS_FILE), "utf8");
      const factsByKey = new Map();

      for (const fact of parseJsonLines(raw)) {
        const normalizedFact = normalizeFact(fact);

        if (!normalizedFact) {
          continue;
        }

        const dedupeKey = normalizedFact.key;
        if (factsByKey.has(dedupeKey)) {
          factsByKey.delete(dedupeKey);
        }
        factsByKey.set(dedupeKey, normalizedFact);
      }

      return sortByCreatedAtDesc(Array.from(factsByKey.values()));
    } catch (error) {
      if (error?.code !== "ENOENT") {
        console.warn("load facts failed:", error?.message || error);
      }
      return [];
    }
  }

  async loadEpisodes({ limit = null } = {}) {
    try {
      const directoryPath = this.store.resolve(EPISODES_DIR);
      const fileNames = (await fs.readdir(directoryPath))
        .filter((fileName) => fileName.endsWith(".jsonl"))
        .sort()
        .reverse();
      const episodes = [];

      for (const fileName of fileNames) {
        const raw = await fs.readFile(`${directoryPath}/${fileName}`, "utf8");
        episodes.push(...parseJsonLines(raw));
      }

      const sortedEpisodes = sortByCreatedAtDesc(
        episodes
          .map((episode) => normalizeEpisodeRecord(episode))
          .filter((episode) => episode && typeof episode === "object")
      );

      return Number.isFinite(limit) ? sortedEpisodes.slice(0, limit) : sortedEpisodes;
    } catch (error) {
      if (error?.code !== "ENOENT") {
        console.warn("load episodes failed:", error?.message || error);
      }
      return [];
    }
  }

  async autoUpdateProfile(facts = []) {
    try {
      const normalizedFacts = facts
        .map((fact) => normalizeFact(fact))
        .filter(Boolean);

      if (normalizedFacts.length === 0) {
        return null;
      }

      const profile = mergeProfile(
        await this.store.readJson(PROFILE_FILE, defaultProfile())
      );
      const userModel = mergeUserModel(
        await this.store.readJson(USER_MODEL_FILE, defaultUserModel())
      );

      let nextPreferences = [...userModel.user.preferences];
      let nextNotes = [...userModel.user.notes];

      for (const fact of normalizedFacts) {
        if (fact.type === "preference" && fact.confidence >= 0.7) {
          nextPreferences = upsertFactBucket(nextPreferences, fact, 30);
        }

        if (fact.type === "event" && fact.confidence >= 0.8) {
          nextNotes = upsertFactBucket(nextNotes, fact, 50);
        }
      }

      const nextUserModel = {
        ...userModel,
        updatedAt: new Date().toISOString(),
        user: {
          ...userModel.user,
          preferences: nextPreferences,
          notes: nextNotes
        }
      };

      const nextProfile = {
        ...profile,
        user: {
          ...profile.user,
          preferences: nextPreferences.map(formatFactLabel),
          notes: nextNotes.map(formatFactLabel)
        }
      };

      await this.store.writeJson(USER_MODEL_FILE, nextUserModel);
      await this.store.writeJson(PROFILE_FILE, nextProfile);
      return nextProfile;
    } catch (error) {
      console.warn("auto update profile failed:", error?.message || error);
      return null;
    }
  }

  async evaluateRelationship(episodes = []) {
    try {
      const relationship = mergeRelationship(
        await this.store.readJson(RELATIONSHIP_FILE, defaultRelationship())
      );
      const sourceEpisodes =
        Array.isArray(episodes) && episodes.length > 0
          ? sortByCreatedAtDesc(episodes)
          : await this.loadEpisodes();

      if (sourceEpisodes.length === 0) {
        return relationship;
      }

      const currentStage = String(relationship.stage || "warm").trim().toLowerCase();
      const totalTurns = sourceEpisodes.length;
      const recent10Emotional = countEmotionalEpisodes(sourceEpisodes.slice(0, 10));
      const recent30Emotional = countEmotionalEpisodes(sourceEpisodes.slice(0, 30));
      const latestCreatedAt = sourceEpisodes[0]?.createdAt || null;
      const daysSinceLatest = latestCreatedAt
        ? (Date.now() - Date.parse(latestCreatedAt)) / 86400000
        : 0;

      let nextStage = currentStage;

      if (daysSinceLatest > 7) {
        nextStage = downgradeRelationshipStage(currentStage);
      } else if (currentStage === "reserved" && totalTurns > 20) {
        nextStage = "warm";
      } else if (currentStage === "warm" && totalTurns > 100 && recent10Emotional >= 3) {
        nextStage = "close";
      } else if (
        currentStage === "close" &&
        totalTurns > 300 &&
        recent30Emotional >= 10
      ) {
        nextStage = "intimate";
      }

      if (nextStage === currentStage) {
        return relationship;
      }

      const note =
        (await this.generateRelationshipNote({
          currentStage,
          nextStage,
          totalTurns,
          recent10Emotional,
          recent30Emotional,
          latestEpisodes: sourceEpisodes.slice(0, 5)
        })) || getFallbackRelationshipNote(nextStage);

      const nextRelationship = {
        ...relationship,
        stage: nextStage,
        note
      };

      await this.store.writeJson(RELATIONSHIP_FILE, nextRelationship);
      return nextRelationship;
    } catch (error) {
      console.warn("evaluate relationship failed:", error?.message || error);
      return null;
    }
  }

  async generateRelationshipNote({
    currentStage,
    nextStage,
    totalTurns,
    recent10Emotional,
    recent30Emotional,
    latestEpisodes
  }) {
    try {
      const context = {
        systemPrompt: RELATIONSHIP_NOTE_PROMPT,
        messages: [
          {
            role: "user",
            content: JSON.stringify(
              {
                currentStage,
                nextStage,
                totalTurns,
                recent10Emotional,
                recent30Emotional,
                latestEpisodes: latestEpisodes.map((episode) => ({
                  summary: episode.summary,
                  topicLabel: episode.topicLabel,
                  emotionalMoment: episode.emotionalMoment
                }))
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
          lifetimeTurnCount: totalTurns
        }
      };
      const config = {
        ...this.config,
        llm: {
          ...this.config.llm,
          temperature: 0.4,
          maxTokens: 80,
          thinking: {
            ...this.config.llm.thinking,
            enabled: false
          }
        }
      };
      const response = await generateReply(context, config, {
        thinkingMode: "balanced"
      });
      const note = String(response?.text || "")
        .replace(/^["'`\s]+|["'`\s]+$/g, "")
        .replace(/\s+/g, " ")
        .trim();

      return note || null;
    } catch (error) {
      console.warn("generate relationship note failed:", error?.message || error);
      return null;
    }
  }
}
