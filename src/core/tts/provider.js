import { placeholderTtsProvider } from "./providers/placeholder.js";
import { minimaxWebSocketTtsProvider } from "./providers/minimax-websocket.js";
import { webSpeechTtsProvider } from "./providers/webspeech.js";

const providers = new Map(
  [placeholderTtsProvider, minimaxWebSocketTtsProvider, webSpeechTtsProvider].map((provider) => [
    provider.id,
    provider
  ])
);

function getRequestedProvider(config) {
  const requestedProvider = String(config.tts?.provider || "placeholder")
    .trim()
    .toLowerCase();
  return providers.get(requestedProvider) || placeholderTtsProvider;
}

function resolveApiKey(config, provider) {
  const directApiKey = String(config.tts?.apiKey || "").trim();
  if (directApiKey) {
    return directApiKey;
  }

  const apiKeyEnv =
    config.tts?.apiKeyEnv || provider.defaultApiKeyEnv || "";

  if (!apiKeyEnv) {
    return "";
  }

  return process.env[apiKeyEnv] || "";
}

export function getTtsCapabilities(config) {
  const requestedProvider = getRequestedProvider(config);
  const hasApiKey = Boolean(resolveApiKey(config, requestedProvider));
  const keySatisfied = !requestedProvider.requiresApiKey || hasApiKey;
  const providerReady =
    requestedProvider.id !== "placeholder" &&
    Boolean(config.tts?.enabled) &&
    keySatisfied;

  return {
    id: requestedProvider.id,
    label: requestedProvider.label,
    available: providerReady,
    configured: Boolean(config.tts?.enabled),
    hasApiKey,
    reason: !config.tts?.enabled
      ? "tts-disabled"
      : requestedProvider.id === "placeholder"
        ? "placeholder-route"
        : keySatisfied
          ? null
          : "missing-api-key",
    capabilities: requestedProvider.capabilities
  };
}

export function createTtsSession({ config, onEvent, webSocketFactory }) {
  const requestedProvider = getRequestedProvider(config);
  const capabilities = getTtsCapabilities(config);
  const effectiveProvider = capabilities.available
    ? requestedProvider
    : placeholderTtsProvider;

  return effectiveProvider.createSession({
    config,
    apiKey: resolveApiKey(config, effectiveProvider),
    onEvent,
    webSocketFactory
  });
}
