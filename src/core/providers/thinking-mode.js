import { resolveLocale } from "../config.js";

const DEFAULT_THINKING_MODE = "balanced";
const thinkingModes = new Set(["fast", "balanced", "deep"]);

const THINKING_MODE_COPY = {
  "zh-CN": {
    fast: "更快落句，少展开。",
    balanced: "速度和细度取中。",
    deep: "更稳，更肯花推理预算。"
  },
  en: {
    fast: "Quicker replies, less elaboration.",
    balanced: "A middle ground between speed and depth.",
    deep: "More deliberate, willing to spend reasoning budget."
  }
};

function clampInteger(value, fallback) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0
    ? Math.round(numericValue)
    : fallback;
}

export function normalizeThinkingMode(value) {
  const normalizedValue = String(value || DEFAULT_THINKING_MODE).trim().toLowerCase();
  return thinkingModes.has(normalizedValue)
    ? normalizedValue
    : DEFAULT_THINKING_MODE;
}

export function listThinkingModes(locale = "zh-CN") {
  const copy = THINKING_MODE_COPY[resolveLocale(locale)];

  return [
    {
      id: "fast",
      label: "Fast",
      summary: copy.fast
    },
    {
      id: "balanced",
      label: "Balanced",
      summary: copy.balanced
    },
    {
      id: "deep",
      label: "Deep",
      summary: copy.deep
    }
  ];
}

export function resolveRequestTuning({ adapter, config, thinkingMode }) {
  const mode = normalizeThinkingMode(thinkingMode || config.llm.thinkingMode);
  const supportsThinking = Boolean(adapter.capabilities?.supportsThinkingBlocks);
  const baseMaxTokens = clampInteger(config.llm.maxTokens, 260);
  const baseBudgetTokens = clampInteger(config.llm.thinking?.budgetTokens, 512);
  const baseTemperature =
    typeof config.llm.temperature === "number" ? config.llm.temperature : null;

  const presetMap = {
    fast: {
      temperature:
        baseTemperature === null ? 0.78 : Math.min(Math.max(baseTemperature, 0.45), 0.78),
      maxTokens: Math.max(160, Math.round(baseMaxTokens * 0.8)),
      reasoningEffort: "low",
      thinking: {
        enabled: false,
        budgetTokens: 0
      }
    },
    balanced: {
      temperature: baseTemperature,
      maxTokens: baseMaxTokens,
      reasoningEffort: "medium",
      thinking: {
        enabled: supportsThinking && Boolean(config.llm.thinking?.enabled),
        budgetTokens: supportsThinking ? Math.max(512, baseBudgetTokens) : 0
      }
    },
    deep: {
      temperature:
        baseTemperature === null ? 0.7 : Math.min(Math.max(baseTemperature, 0.35), 0.72),
      maxTokens: Math.max(baseMaxTokens, Math.round(baseMaxTokens * 1.28)),
      reasoningEffort: "high",
      thinking: {
        enabled: supportsThinking,
        budgetTokens: supportsThinking ? Math.max(1024, baseBudgetTokens * 2) : 0
      }
    }
  };

  const preset = presetMap[mode] || presetMap[DEFAULT_THINKING_MODE];

  return {
    mode,
    temperature: preset.temperature,
    maxTokens: preset.maxTokens,
    reasoningEffort: preset.reasoningEffort,
    thinking: preset.thinking
  };
}
