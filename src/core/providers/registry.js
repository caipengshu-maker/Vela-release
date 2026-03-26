import { mockAdapter } from "./adapters/mock.js";
import { openAiCompatibleAdapter } from "./adapters/openai-compatible.js";
import { anthropicMessagesAdapter } from "./adapters/anthropic-messages.js";
import { minimaxMessagesAdapter } from "./adapters/minimax-messages.js";

const adapters = new Map(
  [
    mockAdapter,
    openAiCompatibleAdapter,
    anthropicMessagesAdapter,
    minimaxMessagesAdapter
  ].map((adapter) => [adapter.id, adapter])
);

export function getProviderAdapter(providerId = "mock") {
  return adapters.get(providerId) || null;
}

export function getProviderDefaults(providerId = "mock") {
  const adapter = getProviderAdapter(providerId);

  if (!adapter) {
    return null;
  }

  return {
    baseUrl: adapter.defaultBaseUrl || "",
    apiKeyEnv: adapter.defaultApiKeyEnv || "",
    anthropicVersion: adapter.defaultAnthropicVersion || "2023-06-01"
  };
}

export function listProviderAdapters() {
  return Array.from(adapters.values()).map((adapter) => ({
    id: adapter.id,
    label: adapter.label,
    family: adapter.family,
    capabilities: adapter.capabilities
  }));
}
