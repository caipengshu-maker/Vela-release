# M2 施工单：管道闭环

## 你是谁
你是 Vela 项目的施工位。Vela 是一个 Electron + React 的本地 avatar 伴侣应用。当前在 main 分支上已有 M1 的完整骨架（文本聊天、记忆、人格、provider 适配器）。

## 本轮目标
把 Vela 从 mock provider 升级到真实 LLM 流式对话，同时补齐状态机、thinking mode 真实映射和基础 model fallback。

## 具体任务

### T1：真实 LLM 流式文本输出
当前 `vela.jsonc` 里 `llm.provider = "mock"`。需要：
1. 把 `vela.jsonc` 的 `llm.provider` 改成 `"openai-compatible"`
2. 确认 `generateReplyStream` 在 OpenAI-compatible SSE 模式下能正确产出 `text-delta` 事件
3. 确认 UI 的 `assistant-stream-delta` 事件链能让文本自然逐字/逐句流出
4. 确认 `assistant-stream-start` → 多个 `assistant-stream-delta` → `assistant-stream-complete` 事件序列完整
5. 如果 `OPENAI_API_KEY` 环境变量不存在，应优雅降级到 mock 并在 UI 显示提示（当前已有此逻辑，确认它工作正常）

注意：不要改 `baseUrl`、`model`、`apiKeyEnv` 的值，保持用户可在 `vela.jsonc` 自行配置。只把 `provider` 从 `"mock"` 改成 `"openai-compatible"`。

### T2：状态机骨架收口
当前 `avatar-state.js` 和 `interaction-policy.js` 里已有 presence 概念（idle/listening/thinking/speaking）。需要：
1. 确认状态机四态切换在以下场景正确：
   - 应用启动 → `idle`（非语音模式）或 `listening`（语音模式）
   - 用户提交消息 → `thinking`
   - 首个 `text-delta` 到达 → `speaking`
   - 流式完成 → `idle`（非语音模式）或 `listening`（语音模式）
2. 确认 UI 的 `phase-strip` 组件正确高亮当前状态
3. 如果当前代码已经满足以上逻辑，只需验证并在自测报告中确认

### T3：三档 thinking mode 真实映射
当前 `thinking-mode.js` 已有 `fast/balanced/deep` 三档和 `resolveRequestTuning`。需要：
1. 确认 `resolveRequestTuning` 的输出（temperature、maxTokens、reasoningEffort）真的被传进 HTTP 请求
2. 检查 `openai-compatible` adapter 的 `buildRequest` 是否正确消费 `requestTuning`
3. 如果 `anthropic-messages` adapter 也需要消费 thinking tuning，确认其映射
4. 在自测中用真实 provider 切换三档，确认行为差异可观测

### T4：基础 model fallback
当前 `provider.js` 在 provider 失败时 fallback 到 mock。这不够——应该先尝试一个备用真实模型。需要：
1. 在 `vela.jsonc` 的 `llm` 下新增 `fallback` 配置项：
   ```jsonc
   "fallback": {
     "provider": "openai-compatible",
     "model": "gpt-4.1-nano",
     "apiKeyEnv": "OPENAI_API_KEY",
     "baseUrl": ""  // 空则复用主 llm.baseUrl
   }
   ```
2. 修改 `provider.js` 的 `generateReply` 和 `generateReplyStream`：
   - 主 provider 失败时，先尝试 fallback provider
   - fallback 也失败时，再降到 mock
   - 每次降级都 console.warn 并在 response 的 `providerMeta` 里标记 `fallbackUsed: true` 和 `fallbackReason`
3. 修改 `config.js` 增加 `fallback` 配置的解析和归一化
4. UI 层：当 `providerMeta.fallbackUsed === true` 时，在消息气泡上显示一个小标记（如"降级回复"），让用户可感知

## 施工约束
- 从 main 新建分支 `feat/m2-pipeline` 开始工作
- 所有改动必须通过 `npm run build` 和 `npm run verify:core`
- 不要动 TTS / ASR / 表情 / 动作 / 镜头相关代码，那些是 M3 的事
- 不要新增 npm 依赖，当前依赖已经够用
- 代码风格保持与现有代码一致（ES modules、无 TypeScript、函数式优先）
- 完成后把分支合入 main 并提交

## 自测清单
完成后请逐项确认：
- [ ] `npm run build` 通过
- [ ] `npm run verify:core` 通过
- [ ] `npm run smoke` 通过（或说明为什么不通过）
- [ ] 有 `OPENAI_API_KEY` 时，文本流式输出正常
- [ ] 无 `OPENAI_API_KEY` 时，优雅降级到 mock
- [ ] 状态机四态切换正确
- [ ] thinking mode 三档切换有可观测差异
- [ ] fallback 配置存在时，主 provider 失败会尝试 fallback
- [ ] fallback 也失败时降到 mock
- [ ] UI 能显示降级标记

## 产出
1. 代码改动（已合入 main）
2. 自测报告写到 `Vela/reports/m2-pipeline-selftest.md`
