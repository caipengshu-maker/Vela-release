import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "jsonc-parser";

const defaultConfig = {
  app: {
    name: "Vela",
    tagline: "克制而持续地在场",
    window: {
      width: 1320,
      height: 860,
      minWidth: 1120,
      minHeight: 720
    }
  },
  runtime: {
    storageRoot: "./.vela-data",
    recentSummaryLimit: 3,
    summaryIndexLimit: 12,
    sessionMessageLimit: 12
  },
  llm: {
    mode: "mock",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4.1-mini",
    apiKeyEnv: "OPENAI_API_KEY",
    temperature: 0.9,
    maxTokens: 260
  },
  permissions: {
    filesystem: false,
    system: false,
    codingAssistant: false,
    toolCalls: false
  },
  proactivity: {
    enabled: false,
    welcomeBack: true
  },
  avatar: {
    defaultPresence: "listening",
    defaultEmotion: "calm"
  }
};

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepMerge(base, override) {
  const result = { ...base };

  for (const [key, value] of Object.entries(override || {})) {
    if (isPlainObject(value) && isPlainObject(base[key])) {
      result[key] = deepMerge(base[key], value);
      continue;
    }

    result[key] = value;
  }

  return result;
}

export async function loadConfig(rootDir) {
  const configPath = path.join(rootDir, "vela.jsonc");
  const raw = await fs.readFile(configPath, "utf8");
  const parsed = parse(raw);

  return deepMerge(defaultConfig, parsed);
}
