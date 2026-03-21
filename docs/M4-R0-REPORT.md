# M4 Round 0 Report

## 本轮改动

- 新增 `src/core/memory-summarizer.js`
  - 对话结束后异步调用当前 LLM provider，生成 episode 摘要与 facts
  - 强制使用稳定参数：`maxTokens=300`、`temperature=0.3`
  - 不走表演协议，失败时只 `console.warn` 并返回 `null`
- 新增 `src/core/memory-retriever.js`
  - 从 `memory/episodes/*.jsonl` 读取长期记忆
  - 中文采用 character bigram，英文采用 lowercase whitespace token
  - 按 topic/emotion/recency/decay 打分，返回 top-5 summary
  - 同一会话内按文件 `mtime + size` 做懒加载缓存
- 扩展 `src/core/memory-store.js`
  - 新增 `appendEpisode`、`appendFact`、`loadFacts`、`autoUpdateProfile`、`loadEpisodes`、`evaluateRelationship`
  - 新增 `memory/user-model.json` 作为结构化偏好/事件聚合层
  - 高置信度 `preference` 回填 `profile.user.preferences`，高置信度 `event` 回填 `profile.user.notes`
  - 每 10 轮可基于 episodes 评估关系阶段，并在阶段变化时尝试用 LLM 生成一句关系备注
- 改造 `src/core/context-builder.js`
  - Layer 0/1 保持不变
  - Layer 2 改为注入：用户画像、关系状态、长期记忆、短期记忆
  - 新增 `relevantMemories` 与 `userFacts` 入参
- 改造 `src/core/vela-core.js`
  - 回复前调用 memory retriever
  - 回复后后台触发 memory summarizer
  - 每 10 轮后台触发 relationship evaluation
  - 记忆链路错误均静默降级，不阻塞主对话

## 存储变化

- `memory/episodes/{date}.jsonl`
  - 每行一个 episode JSON
- `memory/facts.jsonl`
  - append-only，每行一个 fact JSON
- `memory/user-model.json`
  - 结构化聚合的 preferences / notes

## 已知限制

- 检索仍是启发式规则，不做向量化或语义召回。
- 摘要器和关系备注依赖当前 provider 返回可解析文本；若遇到限流或非 JSON 输出，会静默跳过该轮记忆写入。
- 由于摘要生成是异步的，新 episode 通常会在当前轮回复完成后写入，下一轮开始时再参与检索。
- 现有项目原本已有 `reserved / warm / close` 关系体系，本轮将 spec 中的 `stranger` 进阶逻辑适配到现有 `reserved -> warm -> close -> intimate`。
