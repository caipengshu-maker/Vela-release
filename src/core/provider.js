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

const PRIMARY_FAILURE_THRESHOLD = 2;
const PRIMARY_COOLDOWN_MS = 5 * 60 * 60 * 1000;

function getRequestedProviderId(target) {
  if (target?.llm) {
    return target.llm.provider || target.llm.mode || "mock";
  }

  return target?.provider || target?.mode || "mock";
}

function getMockAdapter() {
  return getProviderAdapter("mock");
}

function normalizeAlias(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function guessModelDescriptor(llmConfig, fallback = false) {
  const providerId = String(llmConfig?.provider || llmConfig?.mode || "").trim().toLowerCase();
  const model = String(llmConfig?.model || "").trim();
  const baseUrl = String(llmConfig?.baseUrl || "").trim().toLowerCase();
  const normalizedModel = normalizeAlias(model);

  if (providerId.includes("minimax") || normalizedModel.includes("minimax")) {
    return {
      id: "minimax",
      label: "MiniMax",
      aliases: ["minimax", providerId, normalizedModel, "primary"].filter(Boolean)
    };
  }

  if (
    normalizedModel.includes("k2p5") ||
    normalizedModel.includes("k25") ||
    baseUrl.includes("kimi")
  ) {
    return {
      id: "k2p5",
      label: "K2.5",
      aliases: ["k2p5", "k25", providerId, normalizedModel, "fallback"].filter(Boolean)
    };
  }

  const fallbackId = fallback ? "fallback" : "primary";

  return {
    id: normalizedModel || normalizeAlias(providerId) || fallbackId,
    label: model || providerId || fallbackId,
    aliases: [fallbackId, providerId, normalizedModel].filter(Boolean)
  };
}

export function listAvailableModels(config) {
  const primaryDescriptor = guessModelDescriptor(config.llm, false);
  const models = [
    {
      ...primaryDescriptor,
      kind: "primary",
      config: config.llm
    }
  ];

  if (config.llm?.fallback) {
    models.push({
      ...guessModelDescriptor(config.llm.fallback, true),
      kind: "fallback",
      config: config.llm.fallback
    });
  }

  return models;
}

export function resolveModelSelection(config, selection = "auto") {
  const normalizedSelection = normalizeAlias(selection);

  if (!normalizedSelection || normalizedSelection === "auto") {
    return {
      id: "auto",
      label: "自动",
      kind: "auto",
      config: null
    };
  }

  const models = listAvailableModels(config);
  return (
    models.find((entry) => entry.id === normalizedSelection) ||
    models.find((entry) => entry.aliases.includes(normalizedSelection)) ||
    null
  );
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

function isLocalOpenAiWithoutKey(llmConfig) {
  const providerId = String(
    llmConfig?.provider || llmConfig?.mode || ""
  )
    .trim()
    .toLowerCase();
  const baseUrl = String(llmConfig?.baseUrl || "").trim();

  if (providerId !== "openai-compatible" || !baseUrl) {
    return false;
  }

  try {
    const parsed = new URL(baseUrl);
    const hostname = String(parsed.hostname || "").trim().toLowerCase();
    return ["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(hostname);
  } catch {
    return false;
  }
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

function buildProviderAttempt(config, llmConfig, thinkingMode, route = null) {
  const providerId = getRequestedProviderId(llmConfig);
  const adapter = getProviderAdapter(providerId);
  const attemptConfig = buildAttemptConfig(config, llmConfig);

  return {
    providerId,
    adapter,
    route,
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
    activeRoute = null,
    modelSelection = "auto",
    manualSelection = false,
    fallbackUsed = false,
    fallbackReason = null,
    fallbackChain = [],
    primaryCooldownUntil = null,
    primaryCooldownActive = false
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
      activeProvider: response.providerMeta.adapter,
      activeRouteId: activeRoute?.id || null,
      activeRouteLabel: activeRoute?.label || null,
      modelSelection,
      manualSelection,
      fallbackUsed,
      fallbackReason,
      fallbackChain,
      primaryCooldownUntil,
      primaryCooldownActive
    }
  };
}

function normalizeProviderState(providerState = {}, selectedModel = "auto") {
  return {
    selectedModel:
      String(providerState?.selectedModel || selectedModel || "auto").trim() || "auto",
    primaryFailures: Number.isFinite(Number(providerState?.primaryFailures))
      ? Number(providerState.primaryFailures)
      : 0,
    cooldownUntil: providerState?.cooldownUntil || null,
    lastFailureAt: providerState?.lastFailureAt || null,
    lastErrorReason: providerState?.lastErrorReason || null,
    lastResolved: providerState?.lastResolved || null
  };
}

function isCooldownActive(providerState) {
  const cooldownUntil = Date.parse(providerState?.cooldownUntil || "");
  return Number.isFinite(cooldownUntil) && cooldownUntil > Date.now();
}

function isCircuitBreakerError(error) {
  const reason = String(error?.message || error || "").toLowerCase();

  return (
    reason.includes(" 429 ") ||
    reason.includes("429") ||
    reason.includes("timeout") ||
    reason.includes("timed out") ||
    reason.includes("abort") ||
    reason.includes("unavailable") ||
    reason.includes("overloaded") ||
    reason.includes("temporarily") ||
    reason.includes(" 502 ") ||
    reason.includes(" 503 ") ||
    reason.includes(" 504 ")
  );
}

function isUserCancelledError(error) {
  const reason = String(error?.message || error || "").toLowerCase();
  return reason.includes("llm-request-cancelled");
}

async function persistProviderState(options, providerState) {
  if (typeof options.persistProviderState !== "function") {
    return providerState;
  }

  await options.persistProviderState(providerState);
  return providerState;
}

async function handlePrimaryFailure(options, providerState, error) {
  if (!isCircuitBreakerError(error)) {
    return providerState;
  }

  const failures = Number(providerState.primaryFailures || 0) + 1;
  const nextState = {
    ...providerState,
    primaryFailures: failures,
    lastFailureAt: new Date().toISOString(),
    lastErrorReason: error?.message || String(error || "provider-failed"),
    cooldownUntil:
      failures >= PRIMARY_FAILURE_THRESHOLD
        ? new Date(Date.now() + PRIMARY_COOLDOWN_MS).toISOString()
        : providerState.cooldownUntil
  };

  return persistProviderState(options, nextState);
}

async function clearPrimaryCooldown(options, providerState, responseMeta = null) {
  const nextState = {
    ...providerState,
    primaryFailures: 0,
    cooldownUntil: null,
    lastErrorReason: null,
    lastResolved: responseMeta
      ? {
          ...responseMeta,
          at: new Date().toISOString()
        }
      : providerState.lastResolved
  };

  return persistProviderState(options, nextState);
}

async function updateLastResolved(options, providerState, responseMeta) {
  const nextState = {
    ...providerState,
    lastResolved: {
      ...responseMeta,
      at: new Date().toISOString()
    }
  };

  return persistProviderState(options, nextState);
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

  if (
    !hasApiKey(attempt.config.llm) &&
    !isLocalOpenAiWithoutKey(attempt.config.llm)
  ) {
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
        onEvent: options.onEvent,
        signal: options.signal
      })
    );
  }

  return ensureTextResponse(
    await requestAdapterResponse({
      adapter: attempt.adapter,
      context,
      config: attempt.config,
      requestTuning: attempt.requestTuning,
      fetchImpl: options.fetchImpl,
      signal: options.signal
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
  failures,
  activeRoute,
  providerState,
  modelSelection,
  manualSelection
}) {
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
    thinkingMode,
    activeRoute
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

  const attached = attachResponseMeta(response, {
    requestTuning,
    requestedProvider,
    activeRoute,
    modelSelection,
    manualSelection,
    fallbackUsed: true,
    fallbackReason,
    fallbackChain: failures,
    primaryCooldownUntil: providerState.cooldownUntil,
    primaryCooldownActive: isCooldownActive(providerState)
  });

  await updateLastResolved(options, providerState, attached.providerMeta);
  return attached;
}

function buildRouteAttempts(config, thinkingMode, modelSelection, providerState) {
  const selectedRoute = resolveModelSelection(config, modelSelection);
  const manualSelection = Boolean(selectedRoute && selectedRoute.kind !== "auto");
  const models = listAvailableModels(config);
  const primaryRoute = models.find((entry) => entry.kind === "primary") || null;
  const fallbackRoute = models.find((entry) => entry.kind === "fallback") || null;

  if (manualSelection && selectedRoute) {
    return {
      manualSelection,
      primaryRoute,
      requestedRoute: selectedRoute,
      primaryAttempt:
        selectedRoute.kind === "primary"
          ? buildProviderAttempt(config, selectedRoute.config, thinkingMode, selectedRoute)
          : null,
      fallbackAttempt:
        selectedRoute.kind === "fallback"
          ? buildProviderAttempt(config, selectedRoute.config, thinkingMode, selectedRoute)
          : fallbackRoute
            ? buildProviderAttempt(config, fallbackRoute.config, thinkingMode, fallbackRoute)
            : null
    };
  }

  return {
    manualSelection: false,
    primaryRoute,
    requestedRoute: primaryRoute,
    primaryAttempt: primaryRoute
      ? buildProviderAttempt(config, primaryRoute.config, thinkingMode, primaryRoute)
      : null,
    fallbackAttempt: fallbackRoute
      ? buildProviderAttempt(config, fallbackRoute.config, thinkingMode, fallbackRoute)
      : null
  };
}

async function generateWithFallback(context, config, options = {}, stream = false) {
  const thinkingMode = normalizeThinkingMode(
    options.thinkingMode || config.llm.thinkingMode
  );
  let providerState = normalizeProviderState(
    options.providerState,
    options.modelSelection
  );
  const modelSelection = providerState.selectedModel || options.modelSelection || "auto";
  const routeAttempts = buildRouteAttempts(
    config,
    thinkingMode,
    modelSelection,
    providerState
  );
  const failures = [];
  const autoCooldownActive =
    !routeAttempts.manualSelection && isCooldownActive(providerState);

  if (
    autoCooldownActive &&
    routeAttempts.fallbackAttempt &&
    routeAttempts.requestedRoute?.kind === "primary"
  ) {
    failures.push(buildFailure(routeAttempts.primaryAttempt.providerId, "primary-cooldown-active"));
  }

  if (
    routeAttempts.primaryAttempt &&
    (!autoCooldownActive || routeAttempts.manualSelection)
  ) {
    if (routeAttempts.primaryAttempt.adapter?.id === "mock") {
      const response = await executeAttempt({
        attempt: routeAttempts.primaryAttempt,
        context,
        options,
        stream
      });
      const attached = attachResponseMeta(response, {
        requestTuning: routeAttempts.primaryAttempt.requestTuning,
        requestedProvider: routeAttempts.primaryAttempt.providerId,
        activeRoute: routeAttempts.requestedRoute,
        modelSelection,
        manualSelection: routeAttempts.manualSelection,
        primaryCooldownUntil: providerState.cooldownUntil,
        primaryCooldownActive: autoCooldownActive
      });
      await updateLastResolved(options, providerState, attached.providerMeta);
      return attached;
    }

    if (!routeAttempts.primaryAttempt.adapter) {
      failures.push(
        buildFailure(routeAttempts.primaryAttempt.providerId, "unknown-provider")
      );
    } else {
      try {
        const response = await executeAttempt({
          attempt: routeAttempts.primaryAttempt,
          context,
          options,
          stream
        });
        const attached = attachResponseMeta(response, {
          requestTuning: routeAttempts.primaryAttempt.requestTuning,
          requestedProvider: routeAttempts.primaryAttempt.providerId,
          activeRoute: routeAttempts.requestedRoute,
          modelSelection,
          manualSelection: routeAttempts.manualSelection,
          primaryCooldownUntil: providerState.cooldownUntil,
          primaryCooldownActive: autoCooldownActive
        });

        if (routeAttempts.requestedRoute?.kind === "primary") {
          providerState = await clearPrimaryCooldown(
            options,
            providerState,
            attached.providerMeta
          );
        } else {
          providerState = await updateLastResolved(
            options,
            providerState,
            attached.providerMeta
          );
        }

        return attached;
      } catch (error) {
        if (isUserCancelledError(error)) {
          throw error;
        }

        failures.push(normalizeAttemptError(routeAttempts.primaryAttempt.providerId, error));

        if (routeAttempts.requestedRoute?.kind === "primary") {
          providerState = await handlePrimaryFailure(options, providerState, error);
        }
      }
    }
  }

  if (
    routeAttempts.fallbackAttempt &&
    routeAttempts.fallbackAttempt.providerId !== routeAttempts.primaryAttempt?.providerId
  ) {
    if (!routeAttempts.fallbackAttempt.adapter) {
      failures.push(
        buildFailure(routeAttempts.fallbackAttempt.providerId, "unknown-provider")
      );
    } else {
      try {
        const response = await executeAttempt({
          attempt: routeAttempts.fallbackAttempt,
          context,
          options,
          stream,
          mockFallback: {
            requestedProvider: routeAttempts.primaryAttempt?.providerId || null,
            reason: failures[0]?.reason || null,
            chain: failures
          }
        });
        const fallbackReason = failures[0]?.reason || null;
        const attached = attachResponseMeta(response, {
          requestTuning:
            routeAttempts.fallbackAttempt.requestTuning ||
            routeAttempts.primaryAttempt?.requestTuning ||
            null,
          requestedProvider:
            routeAttempts.primaryAttempt?.providerId ||
            routeAttempts.fallbackAttempt.providerId,
          activeRoute: routeAttempts.fallbackAttempt.route,
          modelSelection,
          manualSelection: routeAttempts.manualSelection,
          fallbackUsed: Boolean(failures.length > 0 || autoCooldownActive),
          fallbackReason,
          fallbackChain: failures,
          primaryCooldownUntil: providerState.cooldownUntil,
          primaryCooldownActive: autoCooldownActive
        });

        providerState = await updateLastResolved(
          options,
          providerState,
          attached.providerMeta
        );
        return attached;
      } catch (error) {
        if (isUserCancelledError(error)) {
          throw error;
        }

        failures.push(normalizeAttemptError(routeAttempts.fallbackAttempt.providerId, error));
      }
    }
  }

  return executeMockFallback({
    context,
    config,
    options,
    stream,
    requestedProvider: routeAttempts.primaryAttempt?.providerId || config.llm.provider,
    requestTuning:
      routeAttempts.primaryAttempt?.requestTuning ||
      routeAttempts.fallbackAttempt?.requestTuning ||
      null,
    failures,
    activeRoute: routeAttempts.fallbackAttempt?.route || routeAttempts.requestedRoute,
    providerState,
    modelSelection,
    manualSelection: routeAttempts.manualSelection
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
