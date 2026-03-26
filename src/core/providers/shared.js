function toNumberOrNull(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

export function buildProviderUrl(baseUrl, endpointPath = "") {
  const url = new URL(baseUrl);
  const basePath = url.pathname || "/";
  const normalizedBasePath = basePath.endsWith("/")
    ? basePath
    : `${basePath}/`;
  const normalizedEndpointPath = String(endpointPath || "")
    .trim()
    .replace(/^\/+/, "");

  url.pathname = normalizedEndpointPath
    ? `${normalizedBasePath}${normalizedEndpointPath}`.replace(/\/{2,}/g, "/")
    : normalizedBasePath;

  return url.toString();
}

export function extractText(value) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value.map(extractText).filter(Boolean).join("\n\n").trim();
  }

  if (value && typeof value === "object") {
    const candidateKeys = [
      "text",
      "thinking",
      "reasoning",
      "reasoning_content",
      "content",
      "value",
      "output_text",
      "refusal"
    ];

    for (const key of candidateKeys) {
      const text = extractText(value[key]);
      if (text) {
        return text;
      }
    }
  }

  return "";
}

export function appendBlock(blocks, type, value, extra = {}) {
  const text = extractText(value);

  if (!text && !extra.allowEmpty) {
    return;
  }

  blocks.push({
    type,
    text,
    ...extra
  });
}

export function collectBlockText(blocks, type) {
  return blocks
    .filter((block) => block.type === type && block.text)
    .map((block) => block.text)
    .join("\n\n")
    .trim();
}

export function normalizeUsage(usage = {}) {
  const inputTokens = toNumberOrNull(usage.inputTokens);
  const outputTokens = toNumberOrNull(usage.outputTokens);
  let totalTokens = toNumberOrNull(usage.totalTokens);

  if (totalTokens === null && inputTokens !== null && outputTokens !== null) {
    totalTokens = inputTokens + outputTokens;
  }

  return {
    inputTokens,
    outputTokens,
    totalTokens
  };
}

function getHeader(headers, name) {
  if (!headers || typeof headers.get !== "function") {
    return null;
  }

  return headers.get(name);
}

export function buildNormalizedResponse({
  adapter,
  payload,
  endpoint,
  responseHeaders,
  blocks,
  usage,
  finishReason,
  rawFinishReason = null,
  model = null,
  extraProviderMeta = {}
}) {
  return {
    text: collectBlockText(blocks, "text"),
    thinking: collectBlockText(blocks, "thinking"),
    blocks,
    usage: normalizeUsage(usage),
    finishReason: finishReason || "unknown",
    providerMeta: {
      adapter: adapter.id,
      family: adapter.family,
      label: adapter.label,
      capabilities: adapter.capabilities,
      model: model || payload?.model || null,
      endpoint,
      requestId:
        getHeader(responseHeaders, "request-id") ||
        getHeader(responseHeaders, "x-request-id") ||
        payload?.id ||
        null,
      messageId: payload?.id || null,
      rawFinishReason,
      rawUsage: payload?.usage || null,
      ...extraProviderMeta
    }
  };
}
