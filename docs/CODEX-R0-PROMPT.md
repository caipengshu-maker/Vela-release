你是 Vela 项目的施工位。本轮任务：实现 M4 Round 0 记忆系统。

## 必读文件（先全部读完再动手）

1. `docs/M4-ARCHITECTURE.md` — 整体架构 spec，重点看 "Round 0：记忆系统" 部分
2. `src/core/memory-store.js` — 现有记忆存储
3. `src/core/context-builder.js` — 现有上下文构建
4. `src/core/vela-core.js` — 核心调度
5. `src/core/session-state.js` — 会话状态
6. `src/core/local-store.js` — 文件存储层
7. `src/core/provider.js` — LLM 调用接口
8. `vela.jsonc` — 配置文件

## 任务清单

### 1. 新建 `src/core/memory-summarizer.js`

每轮对话结束后异步调用 LLM 生成摘要 + 事实提取。

- 输入：user message + assistant response + 当前 emotion/action
- 用当前配置的 LLM provider 发一个 meta-prompt（硬编码在此文件中）
- meta-prompt 要求 LLM 输出 JSON：{ id, createdAt, turnIndex, summary, facts[], emotionalMoment, topicLabel }
- maxTokens: 300，temperature: 0.3（摘要要稳定）
- 不走表演协议（不加 PERFORMANCE_PROTOCOL_PROMPT）
- 失败时静默降级：console.warn + 返回 null，不影响主对话
- 摘要写入 `memory/episodes/{date}.jsonl`（一行一个 JSON）
- facts 写入 `memory/facts.jsonl`（append-only，一行一个）
- 高置信度 fact（preference confidence >= 0.7）自动追加到 profile.user.preferences（去重，上限 30）
- 高置信度 event（confidence >= 0.8）自动追加到 profile.user.notes（去重，上限 50）

### 2. 新建 `src/core/memory-retriever.js`

生成回复前调用，返回与当前用户输入最相关的记忆片段。

- 读取 `memory/episodes/` 下所有 .jsonl 文件
- 中文分词：character bigram（"你好吗" → ["你好", "好吗"]）+ 标点过滤
- 英文分词：whitespace split + toLowerCase
- 评分公式：
  - topicMatch: 用户输入 bigrams 与 episode summary+topicLabel bigrams 的交集比例 × 1.0
  - emotionMatch: 如果当前推测情绪与 episode emotionalMoment.emotion 相同 × 1.5
  - recencyBonus: 7 天内的 episode × 2.0
  - emotionalResistance: emotionalMoment.intensity >= 0.7 的 episode 时间衰减系数 × 0.3（即衰减更慢）
- 返回 top-5 episodes 的 summary 文本数组
- 性能：episodes 文件可能很多，做好懒加载和缓存（同一会话内缓存已读文件）

### 3. 改造 `src/core/memory-store.js`

在现有基础上新增：

- `appendEpisode(episode)` — 写入 episodes/{date}.jsonl
- `appendFact(fact)` — 写入 facts.jsonl
- `loadFacts()` — 读取 facts.jsonl，按 key 去重（保留最新）
- `autoUpdateProfile(facts)` — 高置信度 fact 自动回填 profile
- `evaluateRelationship(episodes)` — 每 10 轮评估关系演化
  - stranger→warm: >20 轮
  - warm→close: >100 轮 + 最近 10 轮 ≥3 次 emotionalMoment
  - close→intimate: >300 轮 + 最近 30 轮 ≥10 次 emotionalMoment
  - 7 天无对话降一级（最低 warm）
  - stage 变化时用 LLM 生成一句关系描述更新 relationship.note

### 4. 改造 `src/core/context-builder.js`

- 新增 `relevantMemories` 参数（来自 memory-retriever）
- 新增 `userFacts` 参数（来自 facts.jsonl 高置信度事实）
- System prompt Layer 2 改为：
  - 用户画像（自动提取的偏好/事实，从 userFacts 格式化）
  - 关系状态（不变）
  - 长期记忆（检索命中的旧摘要，从 relevantMemories 格式化）
  - 短期记忆（最近 3 轮摘要，不变）
- 保持 Layer 0（表演协议）和 Layer 1（Persona）不变

### 5. 改造 `src/core/vela-core.js`

- 对话前：调用 memory-retriever 获取相关记忆，传给 context-builder
- 对话后：异步调用 memory-summarizer 生成摘要
- 每 10 轮触发一次 relationship evaluation
- 摘要/检索失败不阻塞主对话

## 约束

- 零新 npm 依赖
- 所有新文件用 ES module（import/export）
- 存储路径通过 config.runtime.storageRoot 获取（当前 D:/Vela/data/）
- 错误处理：所有记忆相关操作失败时静默降级，console.warn，不 throw
- 不改表演协议、不改 TTS/ASR/avatar 层
- 不改 UI 层（App.jsx / styles.css）

## 完成后验证

1. `npm run build` 必须通过
2. 如果有现有测试（verify:core 等），必须通过
3. 在 `docs/` 下写一个简短的 `M4-R0-REPORT.md` 说明改了什么、新增了什么、已知限制

## 重要

- 先读完所有必读文件再开始写代码
- 不要猜测现有代码结构，以实际文件内容为准
- 如果发现 spec 与现有代码有冲突，以现有代码架构为准做适配，不要硬改现有接口
