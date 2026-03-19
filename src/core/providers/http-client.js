import { buildProviderUrl } from "./shared.js";

function mergeHeaders(...headerSets) {
  const headers = {};

  for (const headerSet of headerSets) {
    if (!headerSet || typeof headerSet !== "object") {
      continue;
    }

    for (const [key, value] of Object.entries(headerSet)) {
      if (value === null || value === undefined || value === "") {
        continue;
      }

      headers[key] = Array.isArray(value) ? value.join(",") : String(value);
    }
  }

  return headers;
}

export async function requestAdapterResponse({
  adapter,
  context,
  config,
  fetchImpl = globalThis.fetch
}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("Global fetch is not available in this runtime");
  }

  const apiKey = process.env[config.llm.apiKeyEnv];
  const request = adapter.buildRequest({ context, config });
  const endpoint = buildProviderUrl(
    config.llm.baseUrl || adapter.defaultBaseUrl,
    request.endpointPath || adapter.defaultEndpointPath
  );
  const headers = mergeHeaders(
    {
      "Content-Type": "application/json"
    },
    adapter.buildHeaders({ apiKey, config }),
    config.llm.headers
  );

  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(request.body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM request failed: ${response.status} ${errorText}`);
  }

  const payload = await response.json();
  return adapter.parseResponse({
    payload,
    responseHeaders: response.headers,
    config,
    endpoint
  });
}
