import {
  appendBlock,
  buildNormalizedResponse,
  extractText
} from "../shared.js";

function normalizeFinishReason(reason) {
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

function toAnthropicContent(message) {
  if (Array.isArray(message.blocks) && message.blocks.length > 0) {
    const content = [];

    for (const block of message.blocks) {
      if (block.type === "text" && block.text) {
        content.push({
          type: "text",
          text: block.text
        });
      }

      if (block.type === "thinking" && block.text) {
        content.push({
          type: "thinking",
          thinking: block.text
        });
      }
    }

    if (content.length > 0) {
      return content;
    }
  }

  const text = extractText(message.content);
  return text
    ? [
        {
          type: "text",
          text
        }
      ]
    : [];
}

function buildThinkingConfig(config) {
  if (!config.llm.thinking.enabled) {
    return null;
  }

  const budgetTokens = Math.max(
    1024,
    Number(config.llm.thinking.budgetTokens || config.llm.maxTokens || 512)
  );

  return {
    type: "enabled",
    budget_tokens: budgetTokens
  };
}

function normalizeContentBlocks(content, blocks) {
  if (!Array.isArray(content)) {
    appendBlock(blocks, "text", content);
    return;
  }

  for (const block of content) {
    if (!block || typeof block !== "object") {
      continue;
    }

    if (block.type === "text") {
      appendBlock(blocks, "text", block.text, { rawType: block.type });
      continue;
    }

    if (block.type === "thinking") {
      appendBlock(
        blocks,
        "thinking",
        block.thinking || block.text,
        { rawType: block.type }
      );
      continue;
    }

    if (String(block.type || "").includes("thinking")) {
      appendBlock(blocks, "thinking", block, { rawType: block.type });
      continue;
    }

    appendBlock(blocks, "text", block, { rawType: block.type || "unknown" });
  }
}

export function buildAnthropicMessagesRequest({ context, config, adapter }) {
  const thinking = buildThinkingConfig(config);
  const body = {
    model: config.llm.model,
    max_tokens: thinking
      ? Math.max(config.llm.maxTokens, thinking.budget_tokens)
      : config.llm.maxTokens,
    system: context.systemPrompt,
    messages: context.messages.map((message) => ({
      role: message.role,
      content: toAnthropicContent(message)
    }))
  };

  if (config.llm.temperature !== undefined && config.llm.temperature !== null) {
    body.temperature = config.llm.temperature;
  }

  if (thinking) {
    body.thinking = thinking;
  }

  return {
    endpointPath: config.llm.endpointPath || adapter.defaultEndpointPath,
    body
  };
}

export function parseAnthropicMessagesResponse({
  payload,
  responseHeaders,
  endpoint,
  config,
  adapter
}) {
  const blocks = [];
  normalizeContentBlocks(payload.content, blocks);

  return buildNormalizedResponse({
    adapter,
    payload,
    endpoint,
    responseHeaders,
    blocks,
    usage: {
      inputTokens: payload.usage?.input_tokens,
      outputTokens: payload.usage?.output_tokens
    },
    finishReason: normalizeFinishReason(payload.stop_reason),
    rawFinishReason: payload.stop_reason ?? null,
    model: payload.model || config.llm.model
  });
}

export const anthropicMessagesAdapter = {
  id: "anthropic-messages",
  label: "Anthropic Messages",
  family: "anthropic-messages",
  defaultBaseUrl: "https://api.anthropic.com",
  defaultApiKeyEnv: "ANTHROPIC_API_KEY",
  defaultAnthropicVersion: "2023-06-01",
  defaultEndpointPath: "v1/messages",
  capabilities: {
    chatCompletions: false,
    messagesApi: true,
    separateSystemPrompt: true,
    supportsTextBlocks: true,
    supportsThinkingBlocks: true
  },
  buildHeaders({ apiKey, config }) {
    return {
      "x-api-key": apiKey,
      "anthropic-version": config.llm.anthropicVersion
    };
  },
  buildRequest({ context, config }) {
    return buildAnthropicMessagesRequest({
      context,
      config,
      adapter: this
    });
  },
  parseResponse({ payload, responseHeaders, endpoint, config }) {
    return parseAnthropicMessagesResponse({
      payload,
      responseHeaders,
      endpoint,
      config,
      adapter: this
    });
  }
};
