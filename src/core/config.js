import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "jsonc-parser";
import { getProviderDefaults } from "./providers/registry.js";

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
    cacheRoot: "./.vela-cache",
    assetRoot: "./assets",
    recentSummaryLimit: 3,
    summaryIndexLimit: 12,
    sessionMessageLimit: 12
  },
  llm: {
    provider: "mock",
    mode: "mock",
    baseUrl: "",
    model: "gpt-4.1-mini",
    apiKeyEnv: "",
    temperature: 0.9,
    maxTokens: 260,
    endpointPath: "",
    headers: {},
    anthropicVersion: "2023-06-01",
    thinking: {
      enabled: false,
      budgetTokens: 512
    }
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

function normalizeLlmConfig(llmConfig) {
  const provider = llmConfig.provider || llmConfig.mode || "mock";
  const providerDefaults = getProviderDefaults(provider) || getProviderDefaults("mock");

  return {
    ...llmConfig,
    provider,
    mode: provider,
    baseUrl: String(llmConfig.baseUrl || providerDefaults.baseUrl || "").trim(),
    apiKeyEnv: String(llmConfig.apiKeyEnv || providerDefaults.apiKeyEnv || "").trim(),
    endpointPath: String(llmConfig.endpointPath || "").trim(),
    anthropicVersion: String(
      llmConfig.anthropicVersion || providerDefaults.anthropicVersion || "2023-06-01"
    ).trim(),
    headers: isPlainObject(llmConfig.headers) ? llmConfig.headers : {},
    thinking: {
      enabled: Boolean(llmConfig.thinking?.enabled),
      budgetTokens: Number(
        llmConfig.thinking?.budgetTokens || defaultConfig.llm.thinking.budgetTokens
      )
    }
  };
}

export async function loadConfig(rootDir) {
  const configPath = path.join(rootDir, "vela.jsonc");
  const raw = await fs.readFile(configPath, "utf8");
  const parsed = parse(raw);
  const merged = deepMerge(defaultConfig, parsed);

  return {
    ...merged,
    llm: normalizeLlmConfig(merged.llm)
  };
}
