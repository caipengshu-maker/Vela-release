import {
  buildNormalizedResponse,
  buildProviderUrl,
  extractText
} from "./shared.js";

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

function normalizeOpenAiFinishReason(reason) {
  switch (reason) {
    case "stop":
      return "stop";
    case "length":
      return "length";
    case "tool_calls":
    case "function_call":
      return "tool_use";
    case "content_filter":
      return "content_filter";
    default:
      return "unknown";
  }
}

function normalizeAnthropicFinishReason(reason) {
  switch (reason) {
    case "end_turn":
    case "stop_sequence":
      return "stop";
    case "max_tokens":
      return "length";
    case "tool_use":
      return "tool_use";
    default:
      return "unknown";
  }
}

async function createRequest({
  adapter,
  context,
  config,
  requestTuning,
  fetchImpl,
  stream = false
}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("Global fetch is not available in this runtime");
  }

  const apiKey = config.llm.apiKey || process.env[config.llm.apiKeyEnv];
  const request = adapter.buildRequest({
    context,
    config,
    stream,
    requestTuning
  });
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

  return {
    response,
    endpoint
  };
}

function applyOpenAiDeltaPart(part, state, onEvent) {
  if (typeof part === "string") {
    state.text += part;
    onEvent?.({
      type: "text-delta",
      delta: part,
      text: state.text
    });
    return;
  }

  if (!part || typeof part !== "object") {
    return;
  }

  const type = String(part.type || "").toLowerCase();
  const thinkingText =
    type.includes("reasoning") || type.includes("thinking")
      ? extractText(
          part.thinking ||
            part.reasoning ||
            part.reasoning_content ||
            part.text ||
            part.content
        )
      : "";

  if (thinkingText) {
    state.thinking += thinkingText;
    onEvent?.({
      type: "thinking-delta",
      delta: thinkingText,
      thinking: state.thinking
    });
    return;
  }

  const textDelta = extractText(
    part.text || part.output_text || part.content || part.refusal
  );

  if (textDelta) {
    state.text += textDelta;
    onEvent?.({
      type: "text-delta",
      delta: textDelta,
      text: state.text
    });
  }
}

function buildOpenAiBlocks(state) {
  const blocks = [];

  if (state.thinking) {
    blocks.push({
      type: "thinking",
      text: state.thinking
    });
  }

  if (state.text) {
    blocks.push({
      type: "text",
      text: state.text
    });
  }

  return blocks;
}

function ensureAnthropicBlock(state, index, contentBlock = {}) {
  if (!state.blocksByIndex.has(index)) {
    const rawType = String(contentBlock.type || "text");
    const type = rawType.includes("thinking") ? "thinking" : "text";
    state.blocksByIndex.set(index, {
      index,
      type,
      rawType,
      text: ""
    });
  }

  return state.blocksByIndex.get(index);
}

function emitAnthropicDelta(entry, deltaText, onEvent) {
  if (!deltaText) {
    return;
  }

  entry.text += deltaText;
  onEvent?.({
    type: entry.type === "thinking" ? "thinking-delta" : "text-delta",
    delta: deltaText,
    [entry.type === "thinking" ? "thinking" : "text"]: entry.text,
    index: entry.index
  });
}

async function readSseStream(stream, onEvent) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

    let separatorMatch = buffer.match(/\r?\n\r?\n/);

    while (separatorMatch && separatorMatch.index !== undefined) {
      const separatorIndex = separatorMatch.index;
      const rawEvent = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + separatorMatch[0].length);

      const lines = rawEvent.split(/\r?\n/);
      let eventName = "message";
      const dataLines = [];

      for (const line of lines) {
        if (!line || line.startsWith(":")) {
          continue;
        }

        if (line.startsWith("event:")) {
          eventName = line.slice(6).trim();
          continue;
        }

        if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).trimStart());
        }
      }

      if (dataLines.length > 0) {
        await onEvent({
          event: eventName,
          data: dataLines.join("\n")
        });
      }

      separatorMatch = buffer.match(/\r?\n\r?\n/);
    }

    if (done) {
      break;
    }
  }

  if (!buffer.trim()) {
    return;
  }

  const lines = buffer.split(/\r?\n/);
  let eventName = "message";
  const dataLines = [];

  for (const line of lines) {
    if (!line || line.startsWith(":")) {
      continue;
    }

    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim();
      continue;
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (dataLines.length > 0) {
    await onEvent({
      event: eventName,
      data: dataLines.join("\n")
    });
  }
}

async function streamOpenAiCompatible({
  adapter,
  response,
  endpoint,
  config,
  onEvent
}) {
  const state = {
    text: "",
    thinking: "",
    usage: {},
    rawUsage: null,
    finishReason: "unknown",
    rawFinishReason: null,
    model: null
  };

  await readSseStream(response.body, async ({ data }) => {
    if (data === "[DONE]") {
      return;
    }

    const payload = JSON.parse(data);
    state.model = payload.model || state.model;

    if (payload.usage) {
      state.rawUsage = payload.usage;
      state.usage = {
        inputTokens: payload.usage.prompt_tokens,
        outputTokens: payload.usage.completion_tokens,
        totalTokens: payload.usage.total_tokens
      };
    }

    for (const choice of payload.choices || []) {
      const delta = choice.delta || {};

      if (typeof delta.content === "string") {
        state.text += delta.content;
        onEvent?.({
          type: "text-delta",
          delta: delta.content,
          text: state.text
        });
      } else if (Array.isArray(delta.content)) {
        for (const part of delta.content) {
          applyOpenAiDeltaPart(part, state, onEvent);
        }
      }

      const reasoningDelta =
        extractText(delta.reasoning_content) || extractText(delta.reasoning);

      if (reasoningDelta) {
        state.thinking += reasoningDelta;
        onEvent?.({
          type: "thinking-delta",
          delta: reasoningDelta,
          thinking: state.thinking
        });
      }

      if (choice.finish_reason) {
        state.rawFinishReason = choice.finish_reason;
        state.finishReason = normalizeOpenAiFinishReason(choice.finish_reason);
      }
    }
  });

  return buildNormalizedResponse({
    adapter,
    payload: {
      model: state.model,
      usage: state.rawUsage
    },
    endpoint,
    responseHeaders: response.headers,
    blocks: buildOpenAiBlocks(state),
    usage: state.usage,
    finishReason: state.finishReason,
    rawFinishReason: state.rawFinishReason,
    model: state.model || config.llm.model
  });
}

async function streamAnthropicMessages({
  adapter,
  response,
  endpoint,
  config,
  onEvent
}) {
  const state = {
    blocksByIndex: new Map(),
    usage: {},
    rawUsage: null,
    finishReason: "unknown",
    rawFinishReason: null,
    model: null
  };

  await readSseStream(response.body, async ({ event, data }) => {
    const payload = JSON.parse(data);

    if (event === "error") {
      throw new Error(payload.error?.message || "Anthropic stream failed");
    }

    if (event === "message_start") {
      state.model = payload.message?.model || payload.model || state.model;
      if (payload.message?.usage) {
        state.rawUsage = payload.message.usage;
        state.usage = {
          inputTokens: payload.message.usage.input_tokens,
          outputTokens: payload.message.usage.output_tokens
        };
      }
      return;
    }

    if (event === "content_block_start") {
      const entry = ensureAnthropicBlock(state, payload.index, payload.content_block);
      const initialText =
        entry.type === "thinking"
          ? extractText(payload.content_block?.thinking || payload.content_block?.text)
          : extractText(payload.content_block?.text);
      emitAnthropicDelta(entry, initialText, onEvent);
      return;
    }

    if (event === "content_block_delta") {
      const delta = payload.delta || {};
      const entry = ensureAnthropicBlock(state, payload.index, {
        type: delta.type?.includes("thinking") ? "thinking" : "text"
      });

      let deltaText = "";

      if (delta.type === "text_delta") {
        deltaText = delta.text || "";
      } else if (delta.type === "thinking_delta") {
        deltaText = delta.thinking || delta.text || "";
      } else {
        deltaText = extractText(delta.text || delta.thinking || delta);
      }

      emitAnthropicDelta(entry, deltaText, onEvent);
      return;
    }

    if (event === "message_delta") {
      state.rawFinishReason = payload.delta?.stop_reason || state.rawFinishReason;
      state.finishReason = normalizeAnthropicFinishReason(
        payload.delta?.stop_reason || state.rawFinishReason
      );

      if (payload.usage) {
        state.rawUsage = payload.usage;
        state.usage = {
          inputTokens: payload.usage.input_tokens ?? state.usage.inputTokens,
          outputTokens: payload.usage.output_tokens ?? state.usage.outputTokens
        };
      }
      return;
    }

    if (event === "message_stop" && state.finishReason === "unknown") {
      state.finishReason = "stop";
    }
  });

  const blocks = Array.from(state.blocksByIndex.values())
    .sort((left, right) => left.index - right.index)
    .filter((block) => block.text)
    .map(({ index, ...block }) => block);

  return buildNormalizedResponse({
    adapter,
    payload: {
      model: state.model,
      usage: state.rawUsage
    },
    endpoint,
    responseHeaders: response.headers,
    blocks,
    usage: state.usage,
    finishReason: state.finishReason,
    rawFinishReason: state.rawFinishReason,
    model: state.model || config.llm.model
  });
}

export async function requestAdapterResponse({
  adapter,
  context,
  config,
  fetchImpl = globalThis.fetch,
  requestTuning = null
}) {
  const { response, endpoint } = await createRequest({
    adapter,
    context,
    config,
    requestTuning,
    fetchImpl,
    stream: false
  });
  const payload = await response.json();

  return adapter.parseResponse({
    payload,
    responseHeaders: response.headers,
    config,
    endpoint
  });
}

export async function requestAdapterStream({
  adapter,
  context,
  config,
  fetchImpl = globalThis.fetch,
  requestTuning = null,
  onEvent
}) {
  const { response, endpoint } = await createRequest({
    adapter,
    context,
    config,
    requestTuning,
    fetchImpl,
    stream: true
  });

  if (!response.body) {
    throw new Error("LLM streaming body is not available");
  }

  if (adapter.streamFormat === "openai-chat-sse") {
    return streamOpenAiCompatible({
      adapter,
      response,
      endpoint,
      config,
      onEvent
    });
  }

  if (adapter.streamFormat === "anthropic-messages-sse") {
    return streamAnthropicMessages({
      adapter,
      response,
      endpoint,
      config,
      onEvent
    });
  }

  throw new Error(`Adapter "${adapter.id}" does not support streaming`);
}
