import {
  requestAdapterResponse,
  requestAdapterStream
} from "./providers/http-client.js";
import { buildProviderUrl } from "./providers/shared.js";
import { getProviderAdapter } from "./providers/registry.js";
import {
  normalizeThinkingMode,
  resolveRequestTuning
} from "./providers/thinking-mode.js";

function getRequestedProviderId(target) {
  if (target?.llm) {
    return target.llm.provider || target.llm.mode || "mock";
  }

  return target?.provider || target?.mode || "mock";
}

function getMockAdapter() {
  return getProviderAdapter("mock");
}

function resolveApiKey(llmConfig) {
  if (llmConfig.apiKey) {
    return llmConfig.apiKey;
  }

  if (llmConfig.apiKeyEnv) {
    return process.env[llmConfig.apiKeyEnv] || "";
  }

  return "";
}

function hasApiKey(llmConfig) {
  return Boolean(resolveApiKey(llmConfig));
}

function ensureTextResponse(response) {
  if (response.text) {
    return response;
  }

  throw new Error("Provider response did not contain any normalized text blocks");
}

function buildAttemptConfig(config, llmConfig) {
  return {
    ...config,
    llm: llmConfig
  };
}

function buildProviderAttempt(config, llmConfig, thinkingMode) {
  const providerId = getRequestedProviderId(llmConfig);
  const adapter = getProviderAdapter(providerId);
  const attemptConfig = buildAttemptConfig(config, llmConfig);

  return {
    providerId,
    adapter,
    config: attemptConfig,
    requestTuning: adapter
      ? resolveRequestTuning({
          adapter,
          config: attemptConfig,
          thinkingMode
        })
      : null
  };
}

function buildFailure(providerId, reason) {
  return {
    providerId,
    reason: String(reason || "provider-failed")
  };
}

function normalizeAttemptError(providerId, error) {
  return buildFailure(providerId, error?.message || error);
}

function formatFallbackReason(failures = []) {
  return failures.map((failure) => `${failure.providerId}: ${failure.reason}`).join("; ");
}

function attachResponseMeta(
  response,
  {
    requestTuning = null,
    requestedProvider = null,
    fallbackUsed = false,
    fallbackReason = null,
    fallbackChain = []
  } = {}
) {
  if (!response?.providerMeta) {
    return response;
  }

  return {
    ...response,
    providerMeta: {
      ...response.providerMeta,
      requestTuning,
      requestedProvider,
      fallbackUsed,
      fallbackReason,
      fallbackChain
    }
  };
}

async function executeAttempt({
  attempt,
  context,
  options,
  stream = false,
  mockFallback = null
}) {
  if (!attempt.adapter) {
    throw new Error("unknown-provider");
  }

  if (attempt.adapter.id === "mock") {
    const response = stream
      ? await attempt.adapter.generateStream({
          context,
          config: attempt.config,
          onEvent: options.onEvent,
          fallback: mockFallback
        })
      : attempt.adapter.generate({
          context,
          config: attempt.config,
          fallback: mockFallback
        });

    return ensureTextResponse(response);
  }

  if (!hasApiKey(attempt.config.llm)) {
    throw new Error("missing-api-key");
  }

  if (stream) {
    return ensureTextResponse(
      await requestAdapterStream({
        adapter: attempt.adapter,
        context,
        config: attempt.config,
        requestTuning: attempt.requestTuning,
        fetchImpl: options.fetchImpl,
        onEvent: options.onEvent
      })
    );
  }

  return ensureTextResponse(
    await requestAdapterResponse({
      adapter: attempt.adapter,
      context,
      config: attempt.config,
      requestTuning: attempt.requestTuning,
      fetchImpl: options.fetchImpl
    })
  );
}

async function executeMockFallback({
  context,
  config,
  options,
  stream,
  requestedProvider,
  requestTuning,
  failures
}) {
  const mockAdapter = getMockAdapter();
  const thinkingMode = normalizeThinkingMode(
    options.thinkingMode || config.llm.thinkingMode
  );
  const mockAttempt = buildProviderAttempt(
    config,
    {
      ...config.llm,
      provider: "mock",
      mode: "mock"
    },
    thinkingMode
  );
  const fallbackReason = formatFallbackReason(failures);
  const response = await executeAttempt({
    attempt: mockAttempt,
    context,
    options,
    stream,
    mockFallback: {
      requestedProvider,
      reason: fallbackReason,
      chain: failures
    }
  });

  return attachResponseMeta(response, {
    requestTuning,
    requestedProvider,
    fallbackUsed: true,
    fallbackReason,
    fallbackChain: failures
  });
}

async function generateWithFallback(context, config, options = {}, stream = false) {
  const thinkingMode = normalizeThinkingMode(
    options.thinkingMode || config.llm.thinkingMode
  );
  const primaryAttempt = buildProviderAttempt(config, config.llm, thinkingMode);

  if (primaryAttempt.adapter?.id === "mock") {
    const response = await executeAttempt({
      attempt: primaryAttempt,
      context,
      options,
      stream
    });

    return attachResponseMeta(response, {
      requestTuning: primaryAttempt.requestTuning,
      requestedProvider: primaryAttempt.providerId
    });
  }

  const failures = [];

  if (!primaryAttempt.adapter) {
    failures.push(buildFailure(primaryAttempt.providerId, "unknown-provider"));
  } else {
    try {
      const response = await executeAttempt({
        attempt: primaryAttempt,
        context,
        options,
        stream
      });

      return attachResponseMeta(response, {
        requestTuning: primaryAttempt.requestTuning,
        requestedProvider: primaryAttempt.providerId
      });
    } catch (error) {
      failures.push(normalizeAttemptError(primaryAttempt.providerId, error));
    }
  }

  const primaryFailure = failures[0];
  const fallbackConfig = config.llm.fallback;

  if (fallbackConfig) {
    const fallbackAttempt = buildProviderAttempt(config, fallbackConfig, thinkingMode);

    if (!fallbackAttempt.adapter) {
      const fallbackFailure = buildFailure(
        fallbackAttempt.providerId,
        "unknown-provider"
      );
      failures.push(fallbackFailure);
      console.warn(
        `LLM provider "${primaryAttempt.providerId}" failed and fallback provider "${fallbackAttempt.providerId}" is unknown, falling back to mock:`,
        primaryFailure.reason
      );
    } else {
      console.warn(
        `LLM provider "${primaryAttempt.providerId}" failed, attempting fallback provider "${fallbackAttempt.providerId}":`,
        primaryFailure.reason
      );

      try {
        const response = await executeAttempt({
          attempt: fallbackAttempt,
          context,
          options,
          stream,
          mockFallback: {
            requestedProvider: primaryAttempt.providerId,
            reason: primaryFailure.reason,
            chain: failures
          }
        });

        return attachResponseMeta(response, {
          requestTuning: fallbackAttempt.requestTuning || primaryAttempt.requestTuning,
          requestedProvider: primaryAttempt.providerId,
          fallbackUsed: true,
          fallbackReason: primaryFailure.reason,
          fallbackChain: failures
        });
      } catch (error) {
        const fallbackFailure = normalizeAttemptError(fallbackAttempt.providerId, error);
        failures.push(fallbackFailure);
        console.warn(
          `Fallback LLM provider "${fallbackAttempt.providerId}" failed, falling back to mock:`,
          fallbackFailure.reason
        );
      }
    }
  } else {
    console.warn(
      `LLM provider "${primaryAttempt.providerId}" failed, falling back to mock:`,
      primaryFailure.reason
    );
  }

  return executeMockFallback({
    context,
    config,
    options,
    stream,
    requestedProvider: primaryAttempt.providerId,
    requestTuning: primaryAttempt.requestTuning,
    failures
  });
}

export async function generateReply(context, config, options = {}) {
  return generateWithFallback(context, config, options, false);
}

export async function generateReplyStream(context, config, options = {}) {
  return generateWithFallback(context, config, options, true);
}

export function getProviderCapabilities(config) {
  const providerId = getRequestedProviderId(config);
  const adapter = getProviderAdapter(providerId) || getMockAdapter();
  return adapter.capabilities;
}

export { buildProviderUrl };
