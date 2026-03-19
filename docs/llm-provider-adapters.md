# LLM Provider Adapters v0.1

## Layering

- `src/core/provider.js` is the only entry for Vela Core. It returns one normalized shape: `text`, `thinking`, `blocks`, `usage`, `finishReason`, `providerMeta`.
- `src/core/providers/registry.js` resolves the active adapter by `llm.provider`.
- `src/core/providers/http-client.js` owns HTTP transport and robust `baseUrl + endpointPath` joining.
- `src/core/providers/adapters/*` own vendor-specific request formatting and response parsing.

## Current adapters

- `mock`: local fallback, keeps MVP usable when network or keys are missing.
- `openai-compatible`: `chat/completions` style request and response parsing.
- `anthropic-messages`: Anthropic Messages request shape and block parsing.
- `minimax-messages`: MiniMax anthropic-like variant with separate adapter identity and defaults.

## Why this split

- Core no longer reads vendor payloads directly.
- Thinking and text blocks are normalized once inside adapters, so upper layers do not touch `content[0]`.
- URL joining preserves proxy or vendor base paths instead of resetting to the domain root.
- New providers can extend the registry by implementing the same adapter contract instead of adding more top-level `if/else`.

## Config notes

- `vela.jsonc` stays the single source of truth.
- Switch providers with `llm.provider`.
- Optional knobs kept generic: `baseUrl`, `endpointPath`, `headers`, `anthropicVersion`, `thinking`.
- Legacy `llm.mode` is still accepted as a compatibility alias and normalized into `llm.provider`.
