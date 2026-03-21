# M4 Round 0 — 记忆系统施工 Spec

> 给 Codex 的施工输入。主控出品，不是讨论稿。

## 现状

已有骨架（M1 产物）：
- `memory-store.js`：profile / relationship / summary-index 三个 JSON 文件读写
- `context-builder.js`：把 profile + relationship + 最近 3 条 summary 拼进 system prompt
- `local-store.js`：文件级 JSON/JSONL 存储
- `session-state.js`：会话状态持久化
- 存储根目录：`D:/Vela/data/memory/`

**缺什么：**
- 对话结束时没有自动摘要（turn log 只是原始 JSONL，没有 LLM 总结）
- 用户偏好 / 重要事实没有从对话中自动提取
- 记忆检索只有"最近 N 条"，没有相关性匹配
- profile.user.preferences / notes 从不自动更新
- relationship.stage / note 从不随交互演化
- 没有"她记得你说过什么"的能力

## 目标

让 Vela 具备：
1. **对话摘要**：每轮对话结束（或每 N 轮）自动用 LLM 生成摘要
2. **事实提取**：从对话中提取用户偏好、重要事件、情感节点
3. **记忆检索**：生成回复前，按相关性拉取记忆片段注入上下文
4. **Profile 自动更新**：提取到的偏好/事实自动写入 profile
5. **关系演化**：基于交互频率、情感浓度、共享时刻，自动调整 relationship

## 架构设计

### 1. 摘要生成器 `memory-summarizer.js`（新建）

触发时机：每轮对话结束后（用户发送 → Vela 回复 → 该轮结束）异步执行，不阻塞 UI。

输入：当前轮的 user message + assistant response + 当前 emotion/action。

输出（一个 JSON 对象）：
```json
{
  "id": "uuid",
  "createdAt": "ISO",
  "turnIndex": 42,
  "summary": "用户说今天加班到很晚，语气疲惫。Vela 表达了关心。",
  "facts": [
    { "type": "preference", "key": "work-schedule", "value": "经常加班", "confidence": 0.8 },
    { "type": "event", "key": "2026-03-21", "value": "加班到很晚", "confidence": 0.9 }
  ],
  "emotionalMoment": {
    "detected": true,
    "emotion": "concerned",
    "intensity": 0.7,
    "note": "用户表达疲惫，Vela 主动关心"
  },
  "topicLabel": "工作压力"
}
```

实现方式：用当前配置的 LLM（同一个 provider）发一个 meta-prompt，要求输出上述 JSON。prompt 模板硬编码在 `memory-summarizer.js` 里，不走表演协议。

token 预算：输入 ~500 token（一轮对话），输出 ~200 token。用 `maxTokens: 300` 限制。

错误处理：摘要失败不影响主对话，静默降级（只写原始 turn log，不写摘要）。

### 2. 事实存储 `memory/facts.jsonl`（新文件）

每行一个 fact JSON，append-only：
```jsonl
{"type":"preference","key":"work-schedule","value":"经常加班","confidence":0.8,"source":"turn-42","createdAt":"ISO"}
{"type":"event","key":"2026-03-21","value":"加班到很晚","confidence":0.9,"source":"turn-42","createdAt":"ISO"}
```

去重规则：同一个 `key`，新 fact 覆盖旧 fact（保留最新）。读取时在内存中做 dedup。

### 3. Profile 自动更新

摘要生成后，如果 `facts` 中有 `type: "preference"` 且 `confidence >= 0.7`：
- 自动追加到 `profile.user.preferences`（去重）
- 如果是 `type: "event"` 且 `confidence >= 0.8`，追加到 `profile.user.notes`

上限：preferences 最多 30 条，notes 最多 50 条。超出时淘汰最旧的。

### 4. 记忆检索 `memory-retriever.js`（新建）

生成回复前调用，返回与当前用户输入最相关的记忆片段。

V1 检索策略（不用 embedding，纯本地）：
1. **时间衰减**：最近 7 天的摘要权重 ×2
2. **关键词匹配**：用户当前输入分词后，与摘要 `summary` + `topicLabel` 做简单匹配
3. **情感节点加权**：`emotionalMoment.detected === true` 的摘要权重 ×1.5
4. 返回 top-5 条摘要，拼成文本注入 context

分词方案：中文按字符 bigram 切分 + 标点过滤（不引入外部分词库，保持零依赖）。英文按空格 split + lowercase。

### 5. Context 注入改造

改造 `context-builder.js`：
- 现有的 `recentSummaries`（最近 N 条）保留，作为"短期记忆"
- 新增 `relevantMemories`（检索结果）作为"长期记忆"
- 新增 `userFacts`（从 facts.jsonl 读取的高置信度事实）作为"用户画像"

System prompt 结构变为：
```
Layer 0: 表演协议（不变）
Layer 1: Persona（不变）
Layer 2: Context
  - 用户画像（自动提取的偏好/事实）
  - 关系状态
  - 长期记忆（检索命中的旧摘要）
  - 短期记忆（最近 3 轮摘要）
```

### 6. 关系演化

在 `memory-store.js` 中新增 `evaluateRelationship()` 方法：

触发：每 10 轮对话执行一次（不是每轮）。

输入：最近 10 轮的 emotionalMoment 统计 + 总对话轮数 + 时间跨度。

演化规则（硬编码，不用 LLM）：
- `stranger` → `warm`：累计 > 20 轮
- `warm` → `close`：累计 > 100 轮 且 最近 10 轮中 emotionalMoment >= 3 次
- `close` → `intimate`：累计 > 300 轮 且 最近 30 轮中 emotionalMoment >= 10 次
- 降级：连续 7 天无对话，降一级（最低不低于 `warm`）

stage 变化时自动更新 `relationship.note`（用 LLM 生成一句话描述当前关系状态）。

### 7. 会话结束摘要

新增 `generateSessionSummary()`：当检测到用户长时间未输入（> 30 分钟）或主动关闭窗口时，对整个会话生成一段总结摘要，写入 `memory/sessions/{date}.jsonl`。

这个总结比单轮摘要更宏观：概括这次聊天的主题、情绪走向、关键事件。

## 文件变更清单

| 文件 | 操作 |
|------|------|
| `src/core/memory-summarizer.js` | 新建 |
| `src/core/memory-retriever.js` | 新建 |
| `src/core/memory-store.js` | 改造（加 fact 读写、profile 自动更新、关系演化） |
| `src/core/context-builder.js` | 改造（注入检索结果 + 用户画像） |
| `src/core/vela-core.js` | 改造（对话结束后触发摘要、检索注入对话前） |
| `src/core/session-state.js` | 小改（加会话结束检测） |

## 不做

- 不引入 embedding 模型或向量数据库（V1 用关键词 + 时间衰减）
- 不引入外部分词库（中文 bigram 够用）
- 不做跨设备同步
- 不做记忆编辑 UI（后续再说）
- 不改表演协议
- 不改 TTS / ASR / avatar 层

## 验收标准

1. 连续对话 10 轮后，`memory/facts.jsonl` 中有自动提取的事实
2. 关闭窗口或 30 分钟无输入后，`memory/sessions/{date}.jsonl` 中有会话总结
3. 新对话开始时，Vela 能在回复中自然引用之前聊过的内容（不是机械复述）
4. `profile.user.preferences` 在多轮对话后自动增长
5. `npm run build` 通过
6. 不引入任何新的 npm 依赖
