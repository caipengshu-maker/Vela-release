import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "jsonc-parser";
import { getProviderDefaults } from "./providers/registry.js";

export const CONFIG_SCHEMA_VERSION = 2;
export const DEFAULT_APP_LOCALE = "zh-CN";

const SUPPORTED_APP_LOCALES = new Set(["zh-CN", "en"]);
const LOCALIZED_DEFAULTS = {
  "zh-CN": {
    tagline: "克制而持续地在场",
    tts: {
      languageBoost: "Chinese",
      voiceId: "Chinese (Mandarin)_Sweet_Lady"
    }
  },
  en: {
    tagline: "Quietly, always here",
    tts: {
      languageBoost: "English",
      voiceId: "English (US)_Sweet_Girl"
    }
  }
};

const BUILT_IN_TAGLINES = new Set(
  Object.values(LOCALIZED_DEFAULTS).map((entry) => entry.tagline)
);
const BUILT_IN_TTS_LANGUAGE_BOOSTS = new Set(
  Object.values(LOCALIZED_DEFAULTS).map((entry) => entry.tts.languageBoost)
);
const BUILT_IN_TTS_VOICE_IDS = new Set(
  Object.values(LOCALIZED_DEFAULTS).map((entry) => entry.tts.voiceId)
);

const defaultConfig = {
  app: {
    name: "Vela",
    locale: "",
    tagline: LOCALIZED_DEFAULTS[DEFAULT_APP_LOCALE].tagline,
    onboarding: {
      completed: false
    },
    window: {
      width: 1320,
      height: 860,
      minWidth: 1120,
      minHeight: 720
    }
  },
  runtime: {
    storageRoot: "./.vela-data",
    cacheRoot: "./.vela-data/cache",
    assetRoot: "assets",
    recentSummaryLimit: 2,
    summaryIndexLimit: 8,
    sessionMessageLimit: 40,
    recentTranscriptBudget: 6000,
    relevantMemoryLimit: 3,
    behaviorPatternRefreshTurns: 24
  },
  user: {
    location: {
      city: "Shanghai"
    }
  },
  llm: {
    provider: "openai-compatible",
    mode: "openai-compatible",
    baseUrl: "",
    model: "gpt-4.1-mini",
    apiKey: "",
    apiKeyEnv: "",
    temperature: 0.9,
    maxTokens: 260,
    thinkingMode: "balanced",
    endpointPath: "",
    headers: {},
    anthropicVersion: "2023-06-01",
    thinking: {
      enabled: false,
      budgetTokens: 512
    },
    fallback: null
  },
  asr: {
    enabled: false,
    provider: "placeholder",
    apiKeyEnv: "",
    model: ""
  },
  audio: {
    bgmVolume: 42,
    ttsVolume: 100
  },
  tts: {
    enabled: false,
    provider: "minimax-websocket",
    apiKey: "",
    apiKeyEnv: "MINIMAX_API_KEY",
    model: "speech-2.8-turbo",
    wsUrl: "wss://api.minimaxi.com/ws/v1/t2a_v2",
    languageBoost: LOCALIZED_DEFAULTS[DEFAULT_APP_LOCALE].tts.languageBoost,
    voiceId: LOCALIZED_DEFAULTS[DEFAULT_APP_LOCALE].tts.voiceId,
    voiceSettings: {
      speed: 1,
      volume: 1,
      pitch: 0,
      englishNormalization: false
    },
    audioSettings: {
      format: "mp3",
      sampleRate: 32000,
      bitrate: 128000,
      channel: 1
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
    defaultPresence: "idle",
    defaultEmotion: "calm",
    assetPath: "avatars/eku/Eku_VRM_v1_0_0.vrm"
  }
};

function normalizeStoredLocale(value) {
  const locale = String(value || "").trim();
  return SUPPORTED_APP_LOCALES.has(locale) ? locale : "";
}

export function resolveLocale(value, fallback = DEFAULT_APP_LOCALE) {
  const locale = normalizeStoredLocale(value);
  return locale || fallback;
}

export function getLocaleDefaults(locale) {
  return LOCALIZED_DEFAULTS[resolveLocale(locale)];
}

function resolveLocalizedDefault(value, localeDefault, builtInDefaults) {
  const normalizedValue = String(value || "").trim();

  if (!normalizedValue || builtInDefaults.has(normalizedValue)) {
    return localeDefault;
  }

  return normalizedValue;
}

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

function normalizeNumber(value, fallback) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function normalizeProviderId(value, fallback = "mock") {
  const providerId = String(value || fallback).trim().toLowerCase();
  return providerId || fallback;
}

function normalizeThinkingConfig(thinkingConfig = {}) {
  return {
    enabled: Boolean(thinkingConfig?.enabled),
    budgetTokens: normalizeNumber(
      thinkingConfig?.budgetTokens,
      defaultConfig.llm.thinking.budgetTokens
    )
  };
}

function normalizeAppConfig(appConfig = {}) {
  const locale = normalizeStoredLocale(appConfig?.locale);
  const localeDefaults = getLocaleDefaults(locale);
  const windowConfig = isPlainObject(appConfig?.window) ? appConfig.window : {};

  return {
    name: String(appConfig?.name || defaultConfig.app.name).trim() || defaultConfig.app.name,
    locale,
    tagline: resolveLocalizedDefault(
      appConfig?.tagline,
      localeDefaults.tagline,
      BUILT_IN_TAGLINES
    ),
    onboarding: {
      ...defaultConfig.app.onboarding,
      ...(isPlainObject(appConfig?.onboarding) ? appConfig.onboarding : {}),
      completed: Boolean(appConfig?.onboarding?.completed)
    },
    window: {
      width: normalizeNumber(windowConfig.width, defaultConfig.app.window.width),
      height: normalizeNumber(windowConfig.height, defaultConfig.app.window.height),
      minWidth: normalizeNumber(windowConfig.minWidth, defaultConfig.app.window.minWidth),
      minHeight: normalizeNumber(
        windowConfig.minHeight,
        defaultConfig.app.window.minHeight
      )
    }
  };
}

function normalizeFallbackLlmConfig(fallbackConfig, baseLlmConfig) {
  if (!isPlainObject(fallbackConfig)) {
    return null;
  }

  const provider = normalizeProviderId(
    fallbackConfig.provider || fallbackConfig.mode || baseLlmConfig.provider,
    baseLlmConfig.provider || "mock"
  );
  const providerDefaults = getProviderDefaults(provider) || getProviderDefaults("mock");

  return {
    provider,
    mode: provider,
    baseUrl: String(
      fallbackConfig.baseUrl ||
        baseLlmConfig.baseUrl ||
        providerDefaults?.baseUrl ||
        ""
    ).trim(),
    model: String(
      fallbackConfig.model || baseLlmConfig.model || defaultConfig.llm.model
    ).trim(),
    apiKey: String(
      fallbackConfig.apiKey || baseLlmConfig.apiKey || ""
    ).trim(),
    apiKeyEnv: String(
      fallbackConfig.apiKeyEnv ||
        baseLlmConfig.apiKeyEnv ||
        providerDefaults?.apiKeyEnv ||
        ""
    ).trim(),
    temperature:
      typeof fallbackConfig.temperature === "number"
        ? fallbackConfig.temperature
        : baseLlmConfig.temperature,
    maxTokens: normalizeNumber(fallbackConfig.maxTokens, baseLlmConfig.maxTokens),
    thinkingMode: String(
      fallbackConfig.thinkingMode || baseLlmConfig.thinkingMode || "balanced"
    )
      .trim()
      .toLowerCase(),
    endpointPath: String(
      fallbackConfig.endpointPath || baseLlmConfig.endpointPath || ""
    ).trim(),
    headers: isPlainObject(fallbackConfig.headers)
      ? fallbackConfig.headers
      : { ...baseLlmConfig.headers },
    anthropicVersion: String(
      fallbackConfig.anthropicVersion ||
        baseLlmConfig.anthropicVersion ||
        providerDefaults?.anthropicVersion ||
        "2023-06-01"
    ).trim(),
    thinking: normalizeThinkingConfig(
      isPlainObject(fallbackConfig.thinking)
        ? fallbackConfig.thinking
        : baseLlmConfig.thinking
    )
  };
}

function normalizeLlmConfig(llmConfig = {}) {
  const provider = normalizeProviderId(
    llmConfig.provider || llmConfig.mode,
    "openai-compatible"
  );
  const providerDefaults = getProviderDefaults(provider) || getProviderDefaults("mock");
  const normalizedConfig = {
    ...llmConfig,
    provider,
    mode: provider,
    baseUrl: String(llmConfig.baseUrl || providerDefaults.baseUrl || "").trim(),
    model: String(llmConfig.model || defaultConfig.llm.model).trim(),
    apiKey: String(llmConfig.apiKey || "").trim(),
    apiKeyEnv: String(llmConfig.apiKeyEnv || providerDefaults.apiKeyEnv || "").trim(),
    temperature:
      typeof llmConfig.temperature === "number"
        ? llmConfig.temperature
        : defaultConfig.llm.temperature,
    maxTokens: normalizeNumber(llmConfig.maxTokens, defaultConfig.llm.maxTokens),
    endpointPath: String(llmConfig.endpointPath || "").trim(),
    thinkingMode: String(llmConfig.thinkingMode || "balanced").trim().toLowerCase(),
    anthropicVersion: String(
      llmConfig.anthropicVersion || providerDefaults.anthropicVersion || "2023-06-01"
    ).trim(),
    headers: isPlainObject(llmConfig.headers) ? llmConfig.headers : {},
    thinking: normalizeThinkingConfig(llmConfig.thinking)
  };

  return {
    ...normalizedConfig,
    fallback: normalizeFallbackLlmConfig(llmConfig.fallback, normalizedConfig)
  };
}

function normalizeRuntimeConfig(runtimeConfig = {}) {
  return {
    storageRoot: String(
      runtimeConfig.storageRoot || defaultConfig.runtime.storageRoot
    ).trim() || defaultConfig.runtime.storageRoot,
    cacheRoot: String(
      runtimeConfig.cacheRoot || defaultConfig.runtime.cacheRoot
    ).trim() || defaultConfig.runtime.cacheRoot,
    assetRoot: String(
      runtimeConfig.assetRoot || defaultConfig.runtime.assetRoot
    ).trim() || defaultConfig.runtime.assetRoot,
    recentSummaryLimit: normalizeNumber(
      runtimeConfig.recentSummaryLimit,
      defaultConfig.runtime.recentSummaryLimit
    ),
    summaryIndexLimit: normalizeNumber(
      runtimeConfig.summaryIndexLimit,
      defaultConfig.runtime.summaryIndexLimit
    ),
    sessionMessageLimit: normalizeNumber(
      runtimeConfig.sessionMessageLimit,
      defaultConfig.runtime.sessionMessageLimit
    ),
    recentTranscriptBudget: normalizeNumber(
      runtimeConfig.recentTranscriptBudget,
      defaultConfig.runtime.recentTranscriptBudget
    ),
    relevantMemoryLimit: normalizeNumber(
      runtimeConfig.relevantMemoryLimit,
      defaultConfig.runtime.relevantMemoryLimit
    ),
    behaviorPatternRefreshTurns: normalizeNumber(
      runtimeConfig.behaviorPatternRefreshTurns,
      defaultConfig.runtime.behaviorPatternRefreshTurns
    )
  };
}

function normalizeAsrConfig(asrConfig = {}) {
  const provider = normalizeProviderId(asrConfig.provider, "placeholder");

  return {
    enabled: Boolean(asrConfig.enabled),
    provider,
    apiKeyEnv: String(asrConfig.apiKeyEnv || "").trim(),
    model: String(asrConfig.model || "").trim()
  };
}

function normalizeTtsConfig(ttsConfig = {}, llmConfig = {}, locale = "") {
  const voiceSettings = isPlainObject(ttsConfig.voiceSettings)
    ? ttsConfig.voiceSettings
    : {};
  const audioSettings = isPlainObject(ttsConfig.audioSettings)
    ? ttsConfig.audioSettings
    : {};
  const localeDefaults = getLocaleDefaults(locale);

  return {
    enabled: Boolean(ttsConfig.enabled),
    provider: String(ttsConfig.provider || "minimax-websocket")
      .trim()
      .toLowerCase(),
    apiKey: String(ttsConfig.apiKey || llmConfig.apiKey || "").trim(),
    apiKeyEnv: String(
      ttsConfig.apiKeyEnv || llmConfig.apiKeyEnv || "MINIMAX_API_KEY"
    ).trim(),
    model: String(ttsConfig.model || "speech-2.8-turbo").trim(),
    wsUrl: String(ttsConfig.wsUrl || "wss://api.minimaxi.com/ws/v1/t2a_v2").trim(),
    languageBoost: resolveLocalizedDefault(
      ttsConfig.languageBoost,
      localeDefaults.tts.languageBoost,
      BUILT_IN_TTS_LANGUAGE_BOOSTS
    ),
    voiceId: resolveLocalizedDefault(
      ttsConfig.voiceId,
      localeDefaults.tts.voiceId,
      BUILT_IN_TTS_VOICE_IDS
    ),
    voiceSettings: {
      speed: Number(voiceSettings.speed ?? 1),
      volume: Number(voiceSettings.volume ?? 1),
      pitch: Number(voiceSettings.pitch ?? 0),
      englishNormalization: Boolean(voiceSettings.englishNormalization)
    },
    audioSettings: {
      format: String(audioSettings.format || "mp3").trim().toLowerCase(),
      sampleRate: Number(audioSettings.sampleRate || 32000),
      bitrate: Number(audioSettings.bitrate || 128000),
      channel: Number(audioSettings.channel || 1)
    }
  };
}

function normalizeAvatarConfig(avatarConfig = {}) {
  return {
    defaultPresence: String(
      avatarConfig.defaultPresence || defaultConfig.avatar.defaultPresence
    )
      .trim()
      .toLowerCase(),
    defaultEmotion: String(
      avatarConfig.defaultEmotion || defaultConfig.avatar.defaultEmotion
    )
      .trim()
      .toLowerCase(),
    assetPath: String(avatarConfig.assetPath || "").trim()
  };
}

function normalizeUserConfig(userConfig = {}) {
  return {
    name: String(userConfig?.name || "").trim(),
    location: {
      city: String(
        userConfig?.location?.city || defaultConfig.user.location.city
      ).trim() || defaultConfig.user.location.city
    }
  };
}

function normalizeAudioConfig(audioConfig = {}) {
  const bgmVolume = Number(audioConfig?.bgmVolume);
  const ttsVolume = Number(audioConfig?.ttsVolume);

  return {
    bgmVolume: Number.isFinite(bgmVolume)
      ? Math.max(0, Math.min(100, Math.round(bgmVolume)))
      : defaultConfig.audio.bgmVolume,
    ttsVolume: Number.isFinite(ttsVolume)
      ? Math.max(0, Math.min(100, Math.round(ttsVolume)))
      : defaultConfig.audio.ttsVolume
  };
}

async function readJsoncConfig(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return parse(raw.replace(/^\uFEFF/, "")) || {};
  } catch (error) {
    if (error?.code === "ENOENT") {
      return {};
    }

    throw error;
  }
}

export async function loadConfig(rootDir, options = {}) {
  const configPath = path.join(rootDir, "vela.jsonc");
  const userConfigPath = String(options?.userConfigPath || "").trim();
  const [baseConfig, userConfig] = await Promise.all([
    readJsoncConfig(configPath),
    userConfigPath ? readJsoncConfig(userConfigPath) : Promise.resolve({})
  ]);
  const merged = deepMerge(deepMerge(defaultConfig, baseConfig), userConfig);
  const normalizedApp = normalizeAppConfig(merged.app);
  const normalizedLlm = normalizeLlmConfig(merged.llm);

  return {
    ...merged,
    app: normalizedApp,
    runtime: normalizeRuntimeConfig(merged.runtime),
    user: normalizeUserConfig(merged.user),
    llm: normalizedLlm,
    asr: normalizeAsrConfig(merged.asr),
    tts: normalizeTtsConfig(merged.tts, normalizedLlm, normalizedApp.locale),
    audio: normalizeAudioConfig(merged.audio),
    avatar: normalizeAvatarConfig(merged.avatar)
  };
}
