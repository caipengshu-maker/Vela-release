# M4 整体架构设计

> CTO 出品。三轮施工的全局蓝图 + 各轮 Codex 施工输入。

## 设计原则

1. **不是"她能查到"，是"她自然就知道"**：所有外部感知预注入 context，LLM 自己决定什么时候提
2. **记忆按情感显著性分层**，不按时效分层
3. **零新 npm 依赖**：天气用免费 HTTP API，分词用 bigram，不引入向量库
4. **感知融合在 LLM 调用前完成**：一个 awareness packet，不是运行时多次 tool call

---

## 记忆模型：四层

| 层 | 名称 | 内容 | 存储 |
|----|------|------|------|
| L0 | 即时记忆 | 当前对话最近 6 轮 | 内存（已有） |
| L1 | 情节记忆 | 每轮对话的摘要+情绪+话题 | `memory/episodes/{date}.jsonl` |
| L2 | 认知记忆 | 提炼的事实、偏好、行为模式 | `memory/user-model.json` + `memory/facts.jsonl` |
| L3 | 情感印记 | 情节记忆上的情感权重标签 | 内嵌在 L1 的 `emotionalMoment` 字段 |

检索不是搜索，是**关联触发**：
- 话题关联：当前话题 → 匹配旧情节的 topicLabel
- 情绪共振：当前情绪 → 加权同类情绪旧情节
- 时间衰减：近期权重高，但高情感情节抗衰减
- 自发回忆：>7 天的高情感情节，偶尔主动浮现

---

## 感知融合层

每次 LLM 调用前，组装 awareness packet：

```
┌─────────────────────────────────────────┐
│           Context Fusion Layer          │
├──────────┬──────────┬───────────────────┤
│ 时间感知 │ 环境感知 │ 用户模型 + 模式   │
│ 几点/星期│ 天气/温度│ 偏好/习惯/作息    │
│ 工作日?  │ 下雨?   │ 行为规律          │
├──────────┴──────────┴───────────────────┤
│ 记忆检索（关联触发 top-5 情节）          │
├─────────────────────────────────────────┤
│ 情绪基线（上次情绪 + 当前推测）          │
└─────────────────────────────────────────┘
         ↓ 合并为一段文本（≤800 token）
         ↓ 注入 system prompt Layer 2
```

System prompt 最终结构：
- Layer 0: 表演协议（不变）
- Layer 1: Persona（不变）
- Layer 2: Awareness（感知融合输出）
- Layer 3: 关系状态 + 行为指引

---

## 外部感知 Provider

| Provider | 数据 | 接入 | 成本 |
|----------|------|------|------|
| 时间 | 时刻/星期/节气/节日/距上次聊天 | 内置 | 免费 |
| 天气 | 温度/天气/降雨/湿度 | Open-Meteo API（无需 key） | 免费 |
| 位置 | 用户所在城市 | `vela.jsonc` 配置 | 免费 |
| 搜索 | 热点/知识 | Round 1 搭骨架，Round 2 接入 | 低 |

天气缓存 30 分钟。API 失败静默跳过。

---

## 主动关心引擎

后台定时器（app 打开时每 5 分钟检查一次）：

| 触发类型 | 示例 | 条件 |
|----------|------|------|
| 时间间隔 | "好久没聊了，最近怎么样？" | >24h 无对话 |
| 事件回忆 | "昨天说的会议怎么样了？" | 用户提过未来事件 |
| 环境变化 | "突然降温了，注意保暖" | 天气骤变 |
| 模式偏离 | "今天比平时安静，还好吗？" | 用户通常此时聊天但没来 |

频率限制：
- 每 4 小时最多 1 条主动消息
- 每天最多 2 条
- 关系阶段系数：stranger=禁止, warm=×0.5, close=×1, intimate=×1.5

---

## 三轮施工分解

### Round 0：记忆系统（地基）

**新建文件：**
- `src/core/memory-summarizer.js` — 每轮对话后异步生成摘要+事实提取
- `src/core/memory-retriever.js` — 关联触发检索

**改造文件：**
- `src/core/memory-store.js` — 加 fact 读写、profile 自动更新、关系演化
- `src/core/context-builder.js` — 注入检索结果（为 Round 1 融合层做准备）
- `src/core/vela-core.js` — 对话后触发摘要、对话前触发检索

**存储新增：**
- `memory/episodes/{date}.jsonl` — 情节记忆
- `memory/facts.jsonl` — 认知记忆（事实）
- `memory/user-model.json` — 用户模型（从 facts 聚合）

**摘要生成器设计：**
- 触发：每轮对话结束后，异步，不阻塞 UI
- 输入：user message + assistant response + emotion/action
- 输出 JSON：
```json
{
  "id": "uuid",
  "createdAt": "ISO",
  "turnIndex": 42,
  "summary": "用户说今天加班到很晚，语气疲惫。Vela 表达了关心。",
  "facts": [
    { "type": "preference", "key": "work-schedule", "value": "经常加班", "confidence": 0.8 }
  ],
  "emotionalMoment": { "detected": true, "emotion": "concerned", "intensity": 0.7 },
  "topicLabel": "工作压力"
}
```
- Meta-prompt 硬编码，不走表演协议，maxTokens: 300
- 失败静默降级

**检索器设计：**
- 中文 bigram + 英文 whitespace split（零依赖）
- 评分 = topicMatch × 1.0 + emotionMatch × 1.5 + recencyBonus × 2.0（7天内）
- 高情感情节（intensity ≥ 0.7）抗时间衰减：衰减系数 ×0.3
- 返回 top-5

**Profile 自动更新：**
- preference confidence ≥ 0.7 → 追加 profile.user.preferences（上限 30）
- event confidence ≥ 0.8 → 追加 profile.user.notes（上限 50）
- 同 key 去重覆盖

**关系演化：**
- 每 10 轮评估
- stranger→warm: >20 轮
- warm→close: >100 轮 + 最近 10 轮 ≥3 次 emotionalMoment
- close→intimate: >300 轮 + 最近 30 轮 ≥10 次
- 7 天无对话降一级（最低 warm）
- stage 变化时 LLM 生成一句关系描述

**验收标准：**
1. 连续 10 轮后 `episodes/{date}.jsonl` 有摘要、`facts.jsonl` 有事实
2. 新对话中 Vela 能自然引用旧内容
3. profile.user.preferences 自动增长
4. `npm run build` 通过
5. 零新 npm 依赖

---

### Round 1：感知融合 + 外部感知 + UI

**新建文件：**
- `src/core/context-providers/time-provider.js` — 时间/日期/节日/距上次聊天
- `src/core/context-providers/weather-provider.js` — Open-Meteo 天气
- `src/core/context-fusion.js` — 合并所有感知流为 awareness packet
- `src/core/behavior-patterns.js` — 从情节记忆提炼行为规律

**改造文件：**
- `src/core/context-builder.js` — 用 context-fusion 输出替换硬编码拼装
- `src/core/vela-core.js` — 对话前调用 fusion layer
- `src/App.jsx` — UI 大改
- `src/styles.css` — UI 大改
- `vela.jsonc` — 加 `user.location.city`

**time-provider：**
- 返回：hour, dayOfWeek, isWorkday, timeOfDayLabel（凌晨/早上/上午/中午/下午/傍晚/晚上/深夜）, season, daysSinceLastChat
- 中国法定节假日硬编码（2026年）
- 节气识别（可选，加分项）

**weather-provider：**
- API: Open-Meteo（`https://api.open-meteo.com/v1/forecast`）
- 输入：城市名 → 经纬度（内置中国主要城市映射表，不调 geocoding API）
- 缓存 30 分钟
- 返回：temperature, condition, isRaining, humidity, windSpeed
- 失败返回 null，fusion 层跳过

**behavior-patterns：**
- 每 20 轮更新一次
- 提炼：聊天时间分布、高频话题、情绪触发模式、作息规律
- 存储：`memory/patterns.json`
- 简单频率统计，不用 ML

**context-fusion：**
- 合并所有 provider 输出 + 记忆检索 + 用户模型
- Token 预算管理：总注入 ≤ 800 token
- 优先级：时间 > 天气（仅异常时） > 用户模型 > 相关记忆 > 行为模式
- 输出：格式化文本块

**UI 改造（xAI 参考）：**
- 输入区：
  - 宽输入框，大圆角（16px+），浅灰背景
  - Placeholder 口语化
  - 发送按钮上下文切换：空 → 语音图标；有文字 → ↑ 箭头
  - 删除"交给她"
  - 语音模式集成到发送按钮区域
- Thinking mode 按钮：
  - 移到次要位置（输入框上方小 chip 或设置菜单内）
- 消息气泡：
  - 收窄 max-width
  - 新消息发送动画（fade-in + slight slide-up）
- 聊天区：
  - 滑动窗口（DOM 中保留最近 50 条，旧消息滚动时懒加载）
  - 自动滚到底部
- 清理：
  - 删除"Vela兜底回应""在。"kicker
  - 删除所有残留 debug 文本

**验收标准：**
1. 用户说"我去上班了" + 当天下雨 → Vela 自然提醒带伞
2. 天气 API 挂掉时不影响正常对话
3. UI 输入区符合 xAI 参考风格
4. M3 遗留 UI 问题全部关闭
5. `npm run build` 通过
6. 零新 npm 依赖

---

### Round 2：主动关心 + 关系体验 + 动画

**新建文件：**
- `src/core/proactive-engine.js` — 主动关心定时器

**改造文件：**
- `src/core/vela-core.js` — 启动主动引擎
- `src/core/vrm-avatar-controller.js` — idle 微动
- `src/core/interaction-contract.js` — 新增 idle 动作枚举
- `src/core/memory-store.js` — sharedMoments 自动填充

**proactive-engine：**
- 后台 interval（5 分钟检查一次）
- 四种触发器（时间间隔/事件回忆/环境变化/模式偏离）
- 频率限制：4h/条，2条/天，关系阶段系数
- 消息生成：用 LLM + 专用 proactive prompt（不走表演协议）
- UI：主动消息作为 Vela 发起的消息出现在聊天区

**自发回忆：**
- 检索器标记"回忆机会"：>7 天 + 高情感 + 话题相关
- 在 context 中加 hint："你可以自然地提起这件旧事"
- LLM 自己决定是否提

**idle 微动（vrm-avatar-controller）：**
- 预设微动作循环：
  - 偶尔摸头发（手臂抬起 → 头部附近 → 放下）
  - 重心转移（髋部微摆）
  - 视线游走（眼球偏移 → 回正）
  - 轻叹气 / 伸懒腰
  - 眨眼节奏变化
- 随机选择，15-30 秒间隔
- 用户输入时中断，回到 attentive 姿态

**手臂自然度：**
- 肘部弯曲加大 + 左右不对称
- idle 时手臂轻微摆动
- 不再"站军姿"

**关系体验增强：**
- sharedMoments 从高情感情节自动填充
- 关系阶段影响：persona 温度、主动频率、记忆引用深度、镜头默认距离
- 续接旧话题：检索器在新会话开始时主动拉取上次未完话题

**provider 优雅降级（从 Round 2 提前到 Round 1）：**
- 熔断器（circuit breaker）：连续 2 次 429/超时后标记 provider 冷却，冷却期（5min）内直接跳到 fallback，冷却后试探恢复
- 用户手动切模型：聊天框 `/model <name>` 命令 或 UI 小标签点击切换
- 降级时轻提示："当前使用备用模型"（不是大红报错）
- fallback 时用户可感知提示
- 重试逻辑优化

**验收标准：**
1. app 打开放置 >1 小时，Vela 主动发起一条自然的关心消息
2. 新会话开始时，Vela 偶尔主动提起上次聊过的事
3. idle 状态下 avatar 有可见微动（不是石像）
4. 手臂姿态自然，不再"军姿"
5. `npm run build` 通过
6. 零新 npm 依赖

---

## 全局约束

- 所有新模块失败时静默降级，不影响主对话链路
- 不引入任何新 npm 依赖
- 不改表演协议格式
- 不改 TTS/ASR 层
- 存储全部走 `D:/Vela/data/`
- 每轮施工后必须 `npm run build` 通过
