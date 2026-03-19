import { requestAdapterResponse } from "./providers/http-client.js";
import { buildProviderUrl } from "./providers/shared.js";
import { getProviderAdapter } from "./providers/registry.js";

function getRequestedProviderId(config) {
  return config.llm.provider || config.llm.mode || "mock";
}

function getMockAdapter() {
  return getProviderAdapter("mock");
}

function hasApiKey(config) {
  return Boolean(config.llm.apiKeyEnv && process.env[config.llm.apiKeyEnv]);
}

function ensureTextResponse(response) {
  if (response.text) {
    return response;
  }

  throw new Error("Provider response did not contain any normalized text blocks");
}

export async function generateReply(context, config, options = {}) {
  const providerId = getRequestedProviderId(config);
  const adapter = getProviderAdapter(providerId);
  const mockAdapter = getMockAdapter();

  if (!adapter) {
    console.warn(`Unknown LLM provider "${providerId}", falling back to mock.`);
    return mockAdapter.generate({
      context,
      config,
      fallback: {
        requestedProvider: providerId,
        reason: "unknown-provider"
      }
    });
  }

  if (adapter.id === "mock") {
    return adapter.generate({ context, config });
  }

  if (!hasApiKey(config)) {
    return mockAdapter.generate({
      context,
      config,
      fallback: {
        requestedProvider: providerId,
        reason: "missing-api-key"
      }
    });
  }

  try {
    return ensureTextResponse(
      await requestAdapterResponse({
        adapter,
        context,
        config,
        fetchImpl: options.fetchImpl
      })
    );
  } catch (error) {
    console.warn(`LLM provider "${providerId}" failed, falling back to mock:`, error.message);
    return mockAdapter.generate({
      context,
      config,
      fallback: {
        requestedProvider: providerId,
        reason: error.message
      }
    });
  }
}

export function getProviderCapabilities(config) {
  const providerId = getRequestedProviderId(config);
  const adapter = getProviderAdapter(providerId) || getMockAdapter();
  return adapter.capabilities;
}

export { buildProviderUrl };
