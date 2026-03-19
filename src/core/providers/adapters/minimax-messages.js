import {
  buildAnthropicMessagesRequest,
  parseAnthropicMessagesResponse
} from "./anthropic-messages.js";

export const minimaxMessagesAdapter = {
  id: "minimax-messages",
  label: "MiniMax Messages",
  family: "anthropic-like",
  defaultBaseUrl: "https://api.minimaxi.com/anthropic",
  defaultApiKeyEnv: "MINIMAX_API_KEY",
  defaultAnthropicVersion: "2023-06-01",
  defaultEndpointPath: "v1/messages",
  capabilities: {
    chatCompletions: false,
    messagesApi: true,
    separateSystemPrompt: true,
    supportsTextBlocks: true,
    supportsThinkingBlocks: true,
    anthropicCompatible: true
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
