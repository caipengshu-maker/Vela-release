import assert from "node:assert/strict";
import { buildProviderUrl } from "../src/core/providers/shared.js";
import { openAiCompatibleAdapter } from "../src/core/providers/adapters/openai-compatible.js";
import { anthropicMessagesAdapter } from "../src/core/providers/adapters/anthropic-messages.js";
import { minimaxMessagesAdapter } from "../src/core/providers/adapters/minimax-messages.js";

function verifyUrlJoining() {
  assert.equal(
    buildProviderUrl("https://api.openai.com/v1", "/chat/completions"),
    "https://api.openai.com/v1/chat/completions"
  );

  assert.equal(
    buildProviderUrl("https://proxy.example.com/vendors/openai/v1/", "chat/completions"),
    "https://proxy.example.com/vendors/openai/v1/chat/completions"
  );

  assert.equal(
    buildProviderUrl("https://api.minimaxi.com/anthropic", "v1/messages"),
    "https://api.minimaxi.com/anthropic/v1/messages"
  );
}

function verifyOpenAiNormalization() {
  const response = openAiCompatibleAdapter.parseResponse({
    payload: {
      id: "chatcmpl_test",
      model: "gpt-test",
      choices: [
        {
          finish_reason: "stop",
          message: {
            content: [
              {
                type: "reasoning",
                reasoning: "先判断上下文。"
              },
              {
                type: "text",
                text: "这是正文。"
              }
            ],
            reasoning_details: [
              {
                type: "reasoning.text",
                text: "再补一段思考。"
              }
            ]
          }
        }
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 6,
        total_tokens: 16
      }
    },
    responseHeaders: new Headers({
      "x-request-id": "req_openai_test"
    }),
    endpoint: "https://api.openai.com/v1/chat/completions",
    config: {
      llm: {
        model: "gpt-test"
      }
    }
  });

  assert.equal(response.text, "这是正文。");
  assert.equal(response.thinking, "先判断上下文。\n\n再补一段思考。");
  assert.equal(response.usage.totalTokens, 16);
  assert.equal(response.finishReason, "stop");
  assert.equal(response.providerMeta.adapter, "openai-compatible");
}

function verifyAnthropicNormalization() {
  const config = {
    llm: {
      model: "claude-test",
      maxTokens: 256,
      temperature: 0.7,
      endpointPath: "",
      anthropicVersion: "2023-06-01",
      thinking: {
        enabled: true,
        budgetTokens: 1024
      }
    }
  };
  const context = {
    systemPrompt: "保持稳定人格",
    messages: [
      {
        role: "user",
        content: "你好",
        blocks: [
          {
            type: "text",
            text: "你好"
          }
        ]
      }
    ]
  };

  const request = anthropicMessagesAdapter.buildRequest({ context, config });
  assert.equal(request.body.system, "保持稳定人格");
  assert.deepEqual(request.body.messages[0].content, [
    {
      type: "text",
      text: "你好"
    }
  ]);
  assert.deepEqual(request.body.thinking, {
    type: "enabled",
    budget_tokens: 1024
  });
  assert.equal(request.body.max_tokens, 1024);

  const response = anthropicMessagesAdapter.parseResponse({
    payload: {
      id: "msg_test",
      model: "claude-test",
      stop_reason: "end_turn",
      content: [
        {
          type: "thinking",
          thinking: "先接住情绪。"
        },
        {
          type: "text",
          text: "我在。你可以继续说。"
        }
      ],
      usage: {
        input_tokens: 12,
        output_tokens: 9
      }
    },
    responseHeaders: new Headers({
      "request-id": "req_anthropic_test"
    }),
    endpoint: "https://api.anthropic.com/v1/messages",
    config
  });

  assert.equal(response.text, "我在。你可以继续说。");
  assert.equal(response.thinking, "先接住情绪。");
  assert.equal(response.usage.totalTokens, 21);
  assert.equal(response.providerMeta.requestId, "req_anthropic_test");
}

function verifyMiniMaxVariant() {
  const response = minimaxMessagesAdapter.parseResponse({
    payload: {
      id: "msg_minimax_test",
      model: "MiniMax-M2.7",
      stop_reason: "end_turn",
      content: [
        {
          type: "thinking",
          thinking: "先整理关系上下文。"
        },
        {
          type: "text",
          text: "我记得你上次提过这件事。"
        }
      ],
      usage: {
        input_tokens: 20,
        output_tokens: 11
      }
    },
    responseHeaders: new Headers({
      "request-id": "req_minimax_test"
    }),
    endpoint: "https://api.minimaxi.com/anthropic/v1/messages",
    config: {
      llm: {
        model: "MiniMax-M2.7"
      }
    }
  });

  assert.equal(response.text, "我记得你上次提过这件事。");
  assert.equal(response.thinking, "先整理关系上下文。");
  assert.equal(response.providerMeta.family, "anthropic-like");
  assert.equal(response.providerMeta.adapter, "minimax-messages");
}

verifyUrlJoining();
verifyOpenAiNormalization();
verifyAnthropicNormalization();
verifyMiniMaxVariant();

console.log("verify:providers ok");
