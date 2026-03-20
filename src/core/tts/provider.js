import { placeholderTtsProvider } from "./providers/placeholder.js";
import { minimaxWebSocketTtsProvider } from "./providers/minimax-websocket.js";

const providers = new Map(
  [placeholderTtsProvider, minimaxWebSocketTtsProvider].map((provider) => [
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

export function getTtsCapabilities(config) {
  const requestedProvider = getRequestedProvider(config);
  const apiKeyEnv = config.tts.apiKeyEnv || requestedProvider.defaultApiKeyEnv || "";
  const hasApiKey = apiKeyEnv ? Boolean(process.env[apiKeyEnv]) : true;
  const providerReady =
    requestedProvider.id !== "placeholder" &&
    Boolean(config.tts?.enabled) &&
    (!requestedProvider.requiresApiKey || hasApiKey);

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
        : hasApiKey
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
  const apiKeyEnv =
    config.tts.apiKeyEnv || effectiveProvider.defaultApiKeyEnv || "";

  return effectiveProvider.createSession({
    config,
    apiKey: apiKeyEnv ? process.env[apiKeyEnv] : "",
    onEvent,
    webSocketFactory
  });
}
