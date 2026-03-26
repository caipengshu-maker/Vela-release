import {
  appendBlock,
  buildNormalizedResponse,
  extractText
} from "../shared.js";

function normalizeFinishReason(reason) {
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

function normalizeContentPart(part, blocks) {
  if (typeof part === "string") {
    appendBlock(blocks, "text", part);
    return;
  }

  if (!part || typeof part !== "object") {
    return;
  }

  const type = String(part.type || "").toLowerCase();

  if (
    type === "thinking" ||
    type === "reasoning" ||
    type === "reasoning_text" ||
    type === "reasoning_content"
  ) {
    appendBlock(
      blocks,
      "thinking",
      extractText(part.thinking) ||
        extractText(part.reasoning) ||
        extractText(part.text) ||
        extractText(part.content)
    );
    return;
  }

  if (type === "text" || type === "output_text" || type === "refusal") {
    appendBlock(
      blocks,
      "text",
      extractText(part.text) ||
        extractText(part.output_text) ||
        extractText(part.content) ||
        extractText(part.refusal)
    );
    return;
  }

  const extractedThinking =
    extractText(part.thinking) ||
    extractText(part.reasoning) ||
    extractText(part.reasoning_content);

  if (extractedThinking) {
    appendBlock(blocks, "thinking", extractedThinking);
    return;
  }

  appendBlock(blocks, "text", extractText(part));
}

export const openAiCompatibleAdapter = {
  id: "openai-compatible",
  label: "OpenAI-compatible",
  family: "openai-compatible",
  defaultBaseUrl: "https://api.openai.com/v1",
  defaultApiKeyEnv: "OPENAI_API_KEY",
  defaultEndpointPath: "chat/completions",
  streamFormat: "openai-chat-sse",
  capabilities: {
    chatCompletions: true,
    messagesApi: false,
    separateSystemPrompt: false,
    supportsTextBlocks: true,
    supportsThinkingBlocks: true,
    supportsStreamingText: true
  },
  buildHeaders({ apiKey }) {
    return {
      Authorization: `Bearer ${apiKey}`
    };
  },
  buildRequest({ context, config, stream = false, requestTuning = null }) {
    const maxTokens = requestTuning?.maxTokens || config.llm.maxTokens;
    const body = {
      model: config.llm.model,
      max_tokens: maxTokens,
      messages: [
        {
          role: "system",
          content: context.systemPrompt
        },
        ...context.messages.map((message) => ({
          role: message.role,
          content: message.content
        }))
      ]
    };

    const temperature = requestTuning?.temperature ?? config.llm.temperature;

    if (temperature !== undefined && temperature !== null) {
      body.temperature = temperature;
    }

    if (requestTuning?.reasoningEffort) {
      body.reasoning_effort = requestTuning.reasoningEffort;
    }

    if (stream) {
      body.stream = true;
      body.stream_options = {
        include_usage: true
      };
    }

    return {
      endpointPath: config.llm.endpointPath || this.defaultEndpointPath,
      body
    };
  },
  parseResponse({ payload, responseHeaders, endpoint, config }) {
    const choice = payload.choices?.[0] || {};
    const message = choice.message || {};
    const blocks = [];

    if (Array.isArray(message.content)) {
      for (const part of message.content) {
        normalizeContentPart(part, blocks);
      }
    } else {
      appendBlock(blocks, "text", message.content || choice.text);
    }

    appendBlock(blocks, "thinking", message.reasoning_content);

    for (const detail of message.reasoning_details || []) {
      appendBlock(blocks, "thinking", detail);
    }

    return buildNormalizedResponse({
      adapter: this,
      payload,
      endpoint,
      responseHeaders,
      blocks,
      usage: {
        inputTokens: payload.usage?.prompt_tokens,
        outputTokens: payload.usage?.completion_tokens,
        totalTokens: payload.usage?.total_tokens
      },
      finishReason: normalizeFinishReason(choice.finish_reason),
      rawFinishReason: choice.finish_reason ?? null,
      model: payload.model || config.llm.model
    });
  }
};
