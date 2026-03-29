export const DEFAULT_MINIMAX_TTS_VOICE_ID = "Chinese (Mandarin)_Sweet_Lady";

export const LLM_PROVIDER_OPTIONS = [
  {
    id: "openai-compatible",
    label: "OpenAI Compatible",
    badge: null,
    description:
      "OpenAI, Ollama, LM Studio, vLLM, Groq, and any compatible /v1/chat/completions endpoint.",
    tooltip:
      "Use this for OpenAI-style APIs, including local servers such as Ollama or LM Studio.",
    defaults: {
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4.1-mini"
    },
    apiKeyHint: "Ollama/local doesn't need a key."
  },
  {
    id: "anthropic-messages",
    label: "Anthropic",
    badge: null,
    description: "Claude models through the Anthropic Messages API.",
    tooltip: "Use this for Anthropic-hosted Claude models.",
    defaults: {
      baseUrl: "https://api.anthropic.com",
      model: "claude-sonnet-4-20250514"
    },
    apiKeyHint: "Anthropic API key required."
  },
  {
    id: "minimax-messages",
    label: "MiniMax",
    badge: "推荐",
    description: "MiniMax Messages with the app's existing Anthropic-compatible integration.",
    tooltip: "Use this for MiniMax-hosted chat with the built-in MiniMax adapter.",
    defaults: {
      baseUrl: "https://api.minimaxi.com/anthropic",
      model: "MiniMax-M2.7"
    },
    apiKeyHint: "MiniMax API key required."
  }
];

export const TTS_PROVIDER_OPTIONS = [
  {
    id: "minimax-websocket",
    label: "MiniMax Voice",
    badge: "推荐",
    description: "Best quality voice output with MiniMax streaming TTS.",
    tooltip: "High-quality streamed TTS through MiniMax WebSocket voice synthesis."
  },
  {
    id: "webspeech",
    label: "Browser Built-in Voice",
    badge: null,
    description: "Free, zero-config speech powered by the Web Speech API.",
    tooltip: "Uses your browser or system voices through the built-in speech engine."
  },
  {
    id: "off",
    label: "Off",
    badge: null,
    description: "Keep replies in text only.",
    tooltip: "Disable spoken replies and stay in text-only mode."
  }
];

export function getLlmProviderOption(providerId = "openai-compatible") {
  return (
    LLM_PROVIDER_OPTIONS.find((option) => option.id === providerId) ||
    LLM_PROVIDER_OPTIONS[0]
  );
}

export function getTtsProviderOption(providerId = "off") {
  return (
    TTS_PROVIDER_OPTIONS.find((option) => option.id === providerId) ||
    TTS_PROVIDER_OPTIONS[TTS_PROVIDER_OPTIONS.length - 1]
  );
}

export function getLlmProviderDefaults(providerId = "openai-compatible") {
  return getLlmProviderOption(providerId).defaults;
}

export function isLocalBaseUrl(baseUrl) {
  const trimmedBaseUrl = String(baseUrl || "").trim();
  if (!trimmedBaseUrl) {
    return false;
  }

  try {
    const parsed = new URL(trimmedBaseUrl);
    const hostname = String(parsed.hostname || "").trim().toLowerCase();
    return [
      "localhost",
      "127.0.0.1",
      "0.0.0.0",
      "::1"
    ].includes(hostname);
  } catch {
    return false;
  }
}

export function isLocalOpenAiConfig(providerId, baseUrl) {
  return providerId === "openai-compatible" && isLocalBaseUrl(baseUrl);
}

export function isLlmApiKeyRequired(providerId, baseUrl) {
  return !isLocalOpenAiConfig(providerId, baseUrl);
}

export function getTtsModeFromSettings(tts = {}) {
  if (!tts?.enabled) {
    return "off";
  }

  const providerId = String(tts?.provider || "").trim().toLowerCase();
  return providerId === "webspeech" ? "webspeech" : "minimax-websocket";
}

export function summarizeApiKey(value) {
  return String(value || "").trim() ? "Configured" : "Not set";
}
