# M2 Blind Review - 2026-03-20

## Executive summary
本轮盲测复验结论是：仓库里已经存在一套较完整的 M2 骨架，包括文本增量输出路径、统一 interaction policy、TTS 路由规则、`idle / listening / thinking / speaking` 状态机、`wide / close` 镜头策略、以及 `fast / balanced / deep` thinking mode 映射；但按当前仓库真实运行态验证，默认 LLM 仍是 `mock`，TTS 仍是 `tts.enabled = false`，ASR 仍是 placeholder，`verify:m2` 也主要是脚本级与本地假 WS 服务器自证，且 `npm run smoke` 在 2026-03-20 实测失败。因此它距离“可进用户体验验收”还有明确硬缺口，不能按 PASS 或准入处理。

## Verdict
**FAIL**

## Checked artifacts
- 文档：
  - `M2_INTERACTION_CONTRACT.md`
  - `CURRENT-ROUTE.md`
  - `TASKS.md`
  - `C:\Users\caipe\.openclaw\workspace\SESSION-STATE.md`
- 代码：
  - `vela.jsonc`
  - `src/App.jsx`
  - `src/audio-stream-player.js`
  - `src/core/vela-core.js`
  - `src/core/interaction-contract.js`
  - `src/core/interaction-policy.js`
  - `src/core/avatar-state.js`
  - `src/core/provider.js`
  - `src/core/providers/http-client.js`
  - `src/core/providers/thinking-mode.js`
  - `src/core/providers/adapters/mock.js`
  - `src/core/asr/provider.js`
  - `src/core/tts/provider.js`
  - `src/core/tts/segmenter.js`
  - `src/core/tts/speech-orchestrator.js`
  - `src/core/tts/providers/minimax-websocket.js`
  - `src/core/tts/providers/placeholder.js`
  - `electron/main.js`
  - `scripts/verify-m2.mjs`
- 运行命令：
  - `npm run verify:m2`
  - `npm run build`
  - `npm run smoke`
  - `echo $env:OPENAI_API_KEY; $env:MINIMAX_API_KEY`
  - 自定义只读运行态脚本：加载 `VelaCore`，读取当前配置并发送一轮消息
  - 自定义只读运行态脚本：`setVoiceMode(false)` 验证回退到 `text-in / text-out`

## Per-criterion findings
1. 文本是否自然流式输出，而不是整段最终一起吐出: **PARTIAL**
   - `src/core/vela-core.js:531`, `:562`, `:654` 明确存在 `assistant-stream-start / delta / complete` 事件链。
   - `src/App.jsx:98` 直接按 `assistant-stream-delta` 增量更新消息，不是等最终整段再刷。
   - 独立运行态脚本在当前配置下观测到 `streamDeltaCount = 12`。
   - 但当前真实配置 `vela.jsonc:22` 仍是 `llm.provider = "mock"`，其“流式”来自 `src/core/providers/adapters/mock.js:96-106` 的定时分片，不是实网 provider 结果，因此只能给 PARTIAL，不能给真实流式 PASS。

2. 是否存在语音模式按钮 / 开关，关闭后是否能回到 `text-in / text-out`: **PASS**
   - `src/App.jsx:633` 调 `window.vela.setVoiceMode(...)`。
   - `src/App.jsx:704` 存在可见 `Voice Mode` 按钮。
   - `src/App.jsx:527` 与 `:531` 明确区分 `text-in / text-out` 和 `text-in / voice-out`。
   - 独立运行态脚本验证 `setVoiceMode(false)` 后，`outputMode = "text"`、`status.phase = "idle"`。
   - 但“打开 voice mode 后是否真的有 voice route”不在本条 PASS 范围内，见第 4、8、9 条。

3. `speaking / listening / thinking` 状态机是否真实存在且切换自洽: **PARTIAL**
   - Canonical states 在 `src/core/interaction-contract.js:1`。
   - `src/core/vela-core.js:513` 用户提交后切到 `thinking`。
   - `src/core/vela-core.js:562` 首个文本 delta 到来时，进入 speaking 路径并同步 avatar / status。
   - `src/core/vela-core.js:160`, `:250`, `:364`, `:385`, `:478` 都围绕 voice mode 决定回到 `listening` 或 `idle`。
   - `scripts/verify-m2.mjs:256-329` 的 `verifyCoreFlow()` 也检查了 `thinking / speaking / listening`。
   - 但当前运行态 TTS 不可用时仍会借 placeholder speech session 进入 `queued / speaking`，这不是“真实音频已开口”，因此状态机存在且大体自洽，但与真实底层音频并未完全同构，只能给 PARTIAL。

4. TTS 路由是否按契约: **PARTIAL**
   - 默认 `emotion_mode=auto`: **PASS（代码/脚本级）**
     - `src/core/interaction-contract.js:12` 定义 `auto | force`。
     - `src/core/interaction-policy.js:213` 默认无 force reason 时走 `auto`。
     - `src/core/tts/providers/minimax-websocket.js:47` 写入 `voice_setting.emotion_mode`。
     - `scripts/verify-m2.mjs:142-148`, `:246-252` 有对应断言。
   - force emotion 只在明确 / 约束 / 连续性场景: **PASS（代码/脚本级）**
     - `src/core/interaction-policy.js:199-230` 明确只累积 `constrained / explicit / continuity` 三类 `forceReasons`。
   - `speech-2.8-*` 遇 `whisper / fluent` 安全降到 `speech-2.6-*`: **PASS（代码/脚本级）**
     - `src/core/interaction-contract.js:102-117` 做模型降级。
     - `src/core/tts/providers/minimax-websocket.js:64-76` 用该降级结果生成 task start model。
     - `scripts/verify-m2.mjs:216-240`, `:466-467` 有断言。
   - 默认 `voiceId` 是否仍锁定 `Chinese (Mandarin)_Sweet_Lady`: **PASS**
     - `vela.jsonc:48`
     - `src/core/config.js:155`
     - `scripts/verify-m2.mjs:246-252`
   - 真实 MiniMax WS 是否已按上述契约跑通: **UNVERIFIED**
     - 当前 `vela.jsonc:42` 为 `tts.enabled = false`。
     - 本机环境里 `MINIMAX_API_KEY` 未见输出。
     - `scripts/verify-m2.mjs:345-467` 用的是本地 `WebSocketServer` 假服务，不是真实 MiniMax。
   - 综合判断：路由规则在代码里落了，但真实 provider 链路没有被这轮仓库现状验证到，因此总评 PARTIAL。

5. 文本、TTS、状态、表情/动作、镜头是否存在统一编排骨架，而不是各自乱飞: **PASS**
   - `src/core/vela-core.js:265-295` 先构建 interaction intent。
   - `src/core/interaction-policy.js:306-446` 统一裁决 emotion / action / camera / TTS preset / force reason / hold。
   - `src/core/avatar-state.js:29-57` 用同一个 plan 映射 avatar。
   - `src/core/vela-core.js:569` 同一个 plan 被送入 `speech.pushDelta(...)`。
   - 这是统一骨架，不是文本、表情、镜头、TTS 各自独立乱飞。

6. `wide / close` 镜头切换规则是否成立且有 cooldown / hold 思路: **PASS**
   - `src/core/interaction-contract.js:30-31` 固定 `CAMERA_SWITCH_COOLDOWN_MS = 8000`、`CLOSE_HOLD_MS = 2800`。
   - `src/core/interaction-policy.js:132-143` 用 `lastCameraChangedAt` 做 cooldown。
   - `src/core/interaction-policy.js:431` close 镜头加 hold。
   - `src/App.jsx:495-510` UI 侧在 `cameraHoldMs` 到时后调用 `releaseCloseCamera(...)` 回 `wide`。
   - 这部分规则是成立的；但“是否长期自然”仍缺真人体验验收。

7. 三档 thinking mode `fast / balanced / deep` 是否存在并有 provider 映射策略: **PARTIAL**
   - `src/core/providers/thinking-mode.js:18-35` 定义三档。
   - `src/App.jsx:711` 有可切换 UI。
   - `src/core/providers/thinking-mode.js:45-85` 映射到 `reasoningEffort`、`maxTokens`、`thinking.enabled`、`budgetTokens`。
   - `scripts/verify-m2.mjs:97-109` 用 OpenAI-compatible / Anthropic adapter 做了脚本级断言。
   - 但当前默认 provider 仍是 `mock`，所以实网 provider 映射并未被本轮运行态覆盖，只能给 PARTIAL。

8. 是否存在明显“看起来做了，但其实只是 mock / 假流式 / 假状态同步”的地方: **FAIL**
   - `vela.jsonc:22` 当前默认 LLM 就是 `mock`。
   - `src/core/providers/adapters/mock.js:96-106` 的流式是定时 `wait(...)` 后发 `text-delta`，属于假流式。
   - `vela.jsonc:42` 当前 TTS 关闭；`src/core/tts/provider.js:47-49` 在不可用时退回 `placeholderTtsProvider`。
   - `src/core/tts/providers/placeholder.js:34`, `:48`, `:57`, `:107` 会在没有真实音频 chunk 的前提下仍发 `placeholder / queued / speaking` 状态，属于假状态同步。
   - 我自己的运行态脚本也观测到 `speechStateStatuses` 包含 `placeholder / queued / speaking`，但没有任何 `speech-audio-chunk` 事件。
   - `scripts/verify-m2.mjs:345-467` 的 MiniMax WS 验证是本地假服务器，不是外部真实服务。

9. 当前实现距离“可进用户体验验收”还差哪些硬缺口: **FAIL**
   - 默认运行态仍是 mock LLM，不是真实主脑。
   - 默认运行态仍是 `tts-disabled`，不是真实 voice-out。
   - ASR 仍是 placeholder，`src/core/asr/provider.js:5` 只有 `streamingInput: false`。
   - `npm run smoke` 在 2026-03-20 实测失败，说明打包 Electron 最小可起性也还没过。
   - 因为以上都是面向用户的基础链路问题，所以当前不应进入用户体验验收。

## Evidence
- 文档状态冲突：
  - `TASKS.md` 中 M2 任务仍整体是 `TODO`。
  - `SESSION-STATE.md` 却声称“已有 M2 主实现待盲测复验”。
  - 这意味着“已完成”不能直接采信，只能按代码和运行态重判。

- 当前运行配置不是实网 M2：
  - `vela.jsonc:22` -> `llm.provider = "mock"`
  - `vela.jsonc:42` -> `tts.enabled = false`
  - `vela.jsonc:48` -> `voiceId = "Chinese (Mandarin)_Sweet_Lady"`

- 文本流式路径确实存在：
  - `src/core/vela-core.js:531` -> `assistant-stream-start`
  - `src/core/vela-core.js:562` -> `assistant-stream-delta`
  - `src/core/vela-core.js:654` -> `assistant-stream-complete`
  - `src/App.jsx:98` -> 直接消费 `assistant-stream-delta`

- 但当前流式不是实网 provider 验收：
  - `src/core/providers/adapters/mock.js:96-106` 通过 `wait(...)` 人工切 chunk。
  - 我自己的运行态脚本输出：

```json
{
  "llmProvider": "mock",
  "ttsEnabled": false,
  "streamDeltaCount": 12
}
```

- 当前 voice route 是 placeholder，不是真实音频：
  - `src/core/tts/provider.js:47-49` -> 不可用时退回 `placeholderTtsProvider`
  - `src/core/tts/providers/placeholder.js:34` -> `status: "placeholder"`
  - `src/core/tts/providers/placeholder.js:48` -> `status: "queued"`
  - `src/core/tts/providers/placeholder.js:57` -> `status: "speaking"`
  - `src/core/tts/providers/placeholder.js:107` -> `streamAudio: false`
  - 我自己的运行态脚本输出：

```json
{
  "resultVoiceMode": {
    "enabled": true,
    "available": false,
    "outputMode": "text-voice-pending",
    "reason": "tts-disabled"
  },
  "speechStateStatuses": [
    "placeholder",
    "placeholder",
    "queued",
    "speaking"
  ]
}
```

- 语音模式关闭后确实能回退到 text-only：

```json
{
  "voiceMode": {
    "enabled": false,
    "outputMode": "text",
    "reason": "tts-disabled"
  },
  "status": {
    "phase": "idle"
  }
}
```

- TTS 契约规则在代码里存在：
  - `src/core/interaction-policy.js:199-230` -> `constrained / explicit / continuity`
  - `src/core/tts/providers/minimax-websocket.js:47` -> `emotion_mode`
  - `src/core/interaction-contract.js:102-117` -> `speech-2.8-*` 对 `whisper/fluent` 降到 `speech-2.6-*`
  - `scripts/verify-m2.mjs:216-240` -> 对降级做脚本断言

- 但 live MiniMax 仍未验证：
  - 环境变量检查命令没有看到 `OPENAI_API_KEY` 或 `MINIMAX_API_KEY` 输出。
  - `scripts/verify-m2.mjs:345-467` 使用 `WebSocketServer` 本地模拟服务，不是外部真实 MiniMax。

- 构建与最小运行验证：

```text
$ npm run verify:m2
verify:m2 ok

$ npm run build
vite v8.0.0 build ... ✓ built

$ npm run smoke
smoke:load-failed -6 ERR_FILE_NOT_FOUND
```

## Hard gaps before user acceptance
- 把默认 LLM 仍保持在 `mock`，会让“自然流式输出”和“thinking mode provider 映射”只停留在假链路，不能进用户验收。
- 把 TTS 保持在 `tts-disabled`，会让 voice mode 变成“按钮存在但真实 voice-out 不存在”，只能算 UI 开关，不算 M2 voice route 成立。
- placeholder TTS 继续发 `speaking` 状态，会让 UI 看起来像她“已经开口”，但其实没有真实音频；这会污染 speaking/listening/thinking 的真实性判断。
- ASR 仍是 placeholder，voice mode 目前只是 `text-in / voice-out` 的未完成半链路，不足以代表完整语音模式体验。
- `npm run smoke` 失败说明 Electron 产物最基本的冷启动验收都还没过，不能把问题留到用户体验验收阶段再发现。
- 文档层面对 M2 是否“已施工完成”仍不一致，会持续误导后续验收口径。

## Minimal next-step recommendation
最小下一步不要继续堆功能，而是先做一次 **M2 真链路收口**：把 `vela.jsonc` 从 `llm.provider = mock`、`tts.enabled = false` 切到一条可实际启动的真实 provider 路径，修掉 `npm run smoke` 的打包冷启动失败，然后只重跑三项复验：`npm run smoke`、一轮真实 LLM 流式文本、以及一轮真实 MiniMax WS `emotion_mode=auto/force` 与 `speech-2.8 -> 2.6` 降级验证。三项都过后，再谈用户体验验收。
