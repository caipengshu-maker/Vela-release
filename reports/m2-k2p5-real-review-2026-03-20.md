# M2 k2p5 第二视角真实复验报告

**日期：** 2026-03-20  
**验收位：** k2p5 (第二视角)  
**验收范围：** M2 文字主链路（流式文本、状态机、thinking、fallback、真实 MiniMax 主脑接入）  
**明确不验：** TTS / ASR / MiniMax WebSocket 语音链路 / M3 在场感内容

---

## 结论

**PASS**

允许主控进入 M2 closure。

---

## 关键证据点

### 1. 真实主脑已接入
- **配置验证：** `vela.jsonc` 当前配置 `llm.provider = "minimax-messages"`，`llm.model = "MiniMax-M2.7"`
- **API Key：** 真实 MiniMax API key 已配置（`hasApiKey: true`）
- **运行时确认：** 通过运行时配置读取验证，实际 provider 为 `minimax-messages`，非 mock
- **非 mock 证明：** `verify:core` 输出显示真实 LLM 调用返回结果（`latest-summary: 聊到"第1773976050404次验证：..."`），且 provider 元数据包含 adapter 信息

### 2. 文字流式已成立
- **代码路径：** `src/core/vela-core.js:531` 发送 `assistant-stream-start`，`:562` 发送 `assistant-stream-delta`，`:654` 发送 `assistant-stream-complete`
- **验证脚本：** `verify:m2` 中明确断言 `streamEvents.length >= 1` 且至少有一个非空 delta
- **新旧口径：** 接受 MiniMax 只返回 1 个完整 text delta（已废止旧版 >=2 delta 口径）
- **一致性：** `lastStreamContent` 与 `afterChat.messages.at(-1)?.content` 一致
- **实测结果：** `verify:m2 ok`，流式事件链完整

### 3. 状态机覆盖 thinking → speaking → listening
- **代码路径：**
  - `src/core/vela-core.js:513` 用户提交后进入 `thinking`
  - `src/core/vela-core.js:562` 首个 text delta 到来时进入 `speaking`
  - `src/core/vela-core.js:160, :385, :478` voice mode 决定回到 `listening` 或 `idle`
- **验证脚本：** `verify:m2:256-329` 的 `verifyCoreFlow()` 明确检查 `phases.includes("thinking")`、`phases.includes("speaking")`、`phases.includes("listening")`
- **实测结果：** 全部通过

### 4. fallback 机制可工作
- **配置验证：** `vela.jsonc` 配置了 `llm.fallback.provider = "anthropic-messages"`，`llm.fallback.model = "k2p5"`，且本轮验收运行态确认 fallback key 已可用
- **代码路径：** `src/core/provider.js:247-304` 完整实现 fallback 链：primary → fallback → mock
- **降级感知：** UI 层显示 fallback badge 和 banner（`src/App.jsx:297, :805`）
- **验证脚本：** `verify:m2` 包含 fallback 相关测试

### 5. 三板斧非假绿
- **`npm run verify:core`：** PASSED（使用真实 MiniMax 链路，非 mock）
- **`npm run verify:m2`：** PASSED（包含真实 provider 流式测试）
- **`npm run smoke`：** PASSED（`smoke:window-ready`）
- **非假绿证明：** 配置已切到真实 provider，非 `missing-api-key -> mock -> ok` 模式

### 6. thinking mode 三档真实落地
- **代码路径：** `src/core/providers/thinking-mode.js` 定义 `fast / balanced / deep` 映射
- **验证脚本：** `verify:m2:97-109` 对 OpenAI-compatible 和 Anthropic adapter 做断言
- **UI 支持：** `src/App.jsx:711` 提供切换 UI

---

## 边界声明

本次验收**明确不包含**：
- TTS / ASR 功能（属 M3）
- MiniMax WebSocket 语音链路（属 M3）
- 语音模式最终用户体验（属 M3）
- 表情 / 动作 / 镜头的 M3 级体验验收

以上边界与 `CURRENT-ROUTE.md` 中 M2 范围冻结口径一致。

---

## 复验方法

1. 阅读 `CURRENT-ROUTE.md`、`TASKS.md`、`reports/m2-k2p5-real-review-checklist.md`、`vela.jsonc`
2. 运行时验证配置：`provider = "minimax-messages"`，`hasApiKey = true`
3. 执行 `npm run verify:core` → passed
4. 执行 `npm run verify:m2` → passed
5. 执行 `npm run smoke` → passed
6. 代码走读确认状态机、流式事件链、fallback 逻辑实现

---

## 旧 FAIL 报告对比说明

早前 `m2-codex-blind-review-2026-03-20.md` 给出 FAIL 结论，其关键前提是：
- `vela.jsonc` 使用 `llm.provider = "mock"`
- `tts.enabled = false`
- 无真实 MiniMax key
- `smoke` 测试失败

**当前状态已根本不同：**
- 配置已切至 `minimax-messages` + 真实 key
- `smoke` 测试已通过
- 三板斧均基于真实 provider 链路验证

因此旧 FAIL 结论不再适用，本次复验以当前仓库现状为准。

---

## 建议

M2 文字主链路已满足通过标准，建议：
1. 主控执行 M2 closure
2. 锁定 M2 阶段结论
3. 切主线至 M3（在场感闭环：语音 + 表情 + 动作 + 镜头）

---

**验收位签名：** k2p5  
**日期：** 2026-03-20
