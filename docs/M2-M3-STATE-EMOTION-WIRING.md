# M2-M3 State / Emotion / Rendering Wiring

> 目的：这是 **Opus 已定 M1-M4 执行路线** 的解释型参考文件，不是改路线文件。
> 用途：给主控、Codex、后续施工位统一理解边界，避免把 M2 / M3 的职责重新搅混。
> 状态：reference-only，可作为后续派活 prompt 的背景附件。

---

## 0. 冻结前提（不要乱改）

M1-M4 路线已由 **Opus** 规划并冻结：

- **M1** = 最小伴侣闭环
- **M2** = 管道闭环（文字主链路）
- **M3** = 在场感闭环（语音 + 表情 + 动作 + 镜头）
- **M4** = 关系深化与轻主动

本文件只解释：
- 每阶段各负责什么
- 状态 / 情绪 / 表现层如何接线
- 哪些东西现在能做，哪些必须后移

本文件 **不是** 改路线提案。

---

## 1. M1-M4 总图（职责边界）

```text
M1  最小伴侣闭环
│
├─ 工程骨架
├─ Vela Core 最小中枢
├─ 记忆文件骨架
├─ 人格种子
├─ 文本聊天闭环
└─ Provider 架构初步收口

=> 结果：她活了，不再是空壳聊天框


M2  管道闭环（文字主链路）
│
├─ 流式文本输出
├─ 状态机：idle / listening / thinking / speaking
├─ thinking 三档
├─ 基础 fallback
└─ 轻量情绪裁决骨架（供产品层统一使用）

=> 结果：她能稳定地把“文字”说出来


M3  在场感闭环
│
├─ 语音模式按钮
├─ TTS 流式开口
├─ 表情 / 动作轻反馈
├─ 镜头（wide / close）
└─ 声音 / 表情 / 动作 / 镜头 与状态机联动

=> 结果：她开始像真的在场


M4  关系深化与轻主动
│
├─ 续接旧话题
├─ 自然提旧事
├─ 轻主动节奏
└─ 稳定性 / 异常兜底 / 能力标签收尾

=> 结果：她开始像你熟悉的那个人
```

---

## 2. M2 和 M3 的分工（不要混）

### M2 负责什么
M2 只负责把 **文字主链路** 打通：

- 模型回复以流式文本进入系统
- 系统有统一状态机
- thinking mode 能稳定调度
- provider 挂了可以 fallback
- 情绪 / 镜头 / 动作 / TTS preset 允许先有 **裁决骨架**，但不要求真实表现闭环

### M2 不负责什么
以下内容不算 M2 closure：

- 真正的 TTS 开口体验
- ASR 输入链
- MiniMax WebSocket 语音链路
- 表情 / 动作 / 镜头与语音的真实联动
- 完整“在场感”体验验收

这些统一归 **M3**。

### M3 负责什么
M3 负责把 M2 已经算好的东西 **真正表现出来**：

- 语音开口
- 画面切换
- 镜头 close / wide
- 表情和动作
- 状态同步与节奏自然度

一句话：

- **M2 = 内部管道和裁决层**
- **M3 = 对用户可感知的表现层**

---

## 3. 状态 / 情绪 / 表现层接线图

```text
[User Message]
      │
      ▼
┌──────────────────────┐
│  LLM Provider Layer  │   ← MiniMax / fallback / future providers
└──────────────────────┘
      │
      ▼
┌──────────────────────┐
│  Unified Stream Bus  │   ← assistant-stream-start/delta/complete
└──────────────────────┘
      │
      ├──────────────► Text UI
      │
      ▼
┌──────────────────────┐
│   State Machine      │   ← idle / listening / thinking / speaking
└──────────────────────┘
      │
      ▼
┌──────────────────────┐
│ Emotion / Policy     │   ← emotion/action/camera/tts preset plan
│ Resolution Layer     │
└──────────────────────┘
      │
      ├──────────────► M2: avatar label / caption / UI state
      │
      ├──────────────► M3: TTS emotion + open-mouth timing
      │
      ├──────────────► M3: expression / action
      │
      └──────────────► M3: camera (wide / close)
```

核心原则：

1. **Provider 原始流 ≠ 产品事件流**
2. **产品事件流 ≠ 表现层**
3. **先统一裁决，再让声音/画面消费**

不要让：
- Provider 自己直接控制镜头
- 文本流直接控制动作
- TTS 层自己反推情绪主逻辑

主裁决必须先在策略层收口。

---

## 4. thinking 状态在 M2 的定位

### M2 已做
`thinking` 在 M2 已经成立。

它的定位不是“复杂心理活动模拟”，而是：

- 一个**可观察的产品状态**
- 处于 `listening` 和 `speaking` 之间的中间态
- 用于让 UI / 后续表现层知道“她正在想，不是卡住了”

### 当前识别方式
M2 里，`thinking` 主要由 **请求生命周期** 驱动：

- 用户消息提交后，进入 `thinking`
- 一旦收到真实文本 delta，切到 `speaking`
- 收尾后回 `listening` / `idle`

### M3 不重做 thinking
M3 不会重新定义 thinking 本体。
M3 只会把它表现得更自然：

- thinking 时的表情
- thinking 时的镜头
- thinking 时的呼吸 / 动作
- thinking -> speaking 的自然过渡

---

## 5. 情绪判定：M2 骨架 vs M3 表现

### M2 已做：轻量情绪裁决骨架
当前策略层允许从这些输入推导情绪意图：

- `userMessage`
- `replyText`
- `relationshipStage`
- 时间 / gap / continuity 等上下文

当前情绪家族（示意）：

- calm
- happy
- affectionate
- playful
- concerned
- sad
- angry
- whisper

M2 的职责是：

- 给出一个统一的 `emotionIntent`
- 让 action / camera / tts preset 有同一个裁决源
- 避免文本、动作、镜头各自乱飞

### M3 才做：情绪表现闭环
M3 要把 M2 裁决出来的情绪，真正投射到：

- TTS 情绪参数
- 表情资源
- 动作反馈
- 镜头距离
- 声画同步节奏

### 记住一句

- **M2 有情绪裁决骨架**
- **M3 做情绪表现闭环**

---

## 6. 为什么不能只“直接吃接口流式返回”

如果只是普通聊天框，直接把 provider 的流式文本塞给 UI，通常够用。

但 Vela 不是普通聊天框。Vela 后面还要接：

- 状态机
- 表情
- 动作
- 镜头
- TTS
- fallback
- 关系与主动机制

所以中间必须有一层：

```text
Provider raw stream
    ↓
Unified product events
    ↓
State / policy / rendering consumers
```

这样做的好处：

1. **换 provider 不用重写前端和表现层**
2. **状态机有统一信号源**
3. **后续 TTS / 镜头 / 动作有稳定挂载点**
4. **fallback 不会把 UI 和表现层搞炸**

因此：

- 这不是为了炫技而复杂化
- 这是为了让 M3 / M4 能长出来而不崩

真正该砍掉的，不是这个中间层；
该砍掉的是 **把 M3 内容过早混进 M2** 的坏节奏。

---

## 7. 给 Codex / 施工位的硬规则

### 施工时绝对不要做的事
- 不要改 M1-M4 路线定义
- 不要把 M3 的语音 / 表现层验收重新塞回 M2
- 不要让 provider 原始事件直接控制动作 / 镜头 / TTS 主逻辑
- 不要让 TTS 层自己决定主情绪
- 不要再次引入“mock 绿了所以算过”的假绿逻辑

### 施工时应该默认遵守
- M2 只收文字主链路
- M3 才收在场感表现层
- 所有 provider 输入先归一化成统一产品事件
- 所有表情 / 动作 / 镜头 / TTS 先吃策略层 plan，再表现

---

## 8. 未来派活时可直接引用的摘要

### 给 Codex 的一句话摘要

> 不要改 Opus 已定的 M1-M4 路线。M2 只收文字主链路（streaming text + state machine + thinking + fallback）；M3 才收 TTS / 表情 / 动作 / 镜头。在实现上，provider 原始流必须先归一化为统一产品事件，再由状态机与策略层产出 plan，最后给表现层消费；不要让 provider/TTS 直接驱动镜头或动作主逻辑。

### 给主控的最短复述

- M1：她活了
- M2：她能稳定地用文字说话了
- M3：她开始像真的在场
- M4：她开始像你熟悉的那个人

---

## 9. 当前文件关系

与本文件相关的真源：

- `CURRENT-ROUTE.md` — 当前主线与阶段边界
- `TASKS.md` — 任务板与 closure 记录
- `SESSION-STATE.md` — 当前活任务 scratchpad
- `reports/m2-k2p5-real-review-2026-03-20.md` — M2 第二视角真实验收

本文件角色：

- **解释型参考资产**
- 供后续派活、对齐口径、避免职责漂移
- 不替代上述真源
