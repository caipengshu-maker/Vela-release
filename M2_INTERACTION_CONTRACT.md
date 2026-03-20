# M2_INTERACTION_CONTRACT.md

## 目标

M2 只解决一件事：**让 Vela 从“会聊”变成“像在场”。**

这一阶段不追求复杂世界观，不追求重资产演出，不追求完整模型路由体系。
这一阶段只钉死四件事：
- 主脑能建议什么
- 策略层真正放行什么
- TTS / 画面 / 表情 / 动作怎么协同
- `fast / balanced / deep` 三档怎么落地

---

## 一句话架构

**LLM 只输出高层意图；策略层做最后裁决；TTS / UI / 表情 / 动作 / 镜头统一消费裁决后的状态。**

`LLM -> interaction intent -> policy layer -> text / TTS / expression / motion / camera`

---

## 冻结决策（这版拍板后不再来回漂）

1. **M2 不新增“策略层大模型”。**
   - 策略层先用 **deterministic rules + mixed emotion routing + cooldown + state machine** 实现。
   - 理由：M2 先保稳定、低延迟、易验收；别把体验层问题升级成第二主脑问题。
   - 如果后面证明 deterministic policy 不够，再放到 **M3/M4** 评估，不在 M2 开新坑。

2. **情绪白名单不再过窄，但也不搞成大情绪宇宙。**
   - M2 允许的高层情绪家族扩到：
     - `calm`
     - `happy`
     - `affectionate`
     - `playful`
     - `concerned`
     - `sad`
     - `angry`
     - `whisper`
   - 这已经覆盖“喜怒哀乐 + 亲密/玩笑/低语”主场景。
   - `fearful / disgusted / shocked / manic` 不进 M2。

3. **镜头维持两态：`wide / close`。**
   - 不做复杂分镜，不做镜头脚本系统。
   - 默认 `wide`，只在合适场景切 `close`。

4. **动作 / 表情坚持“轻、稳、少”。**
   - 不做大动作库，不做夸张演出。
   - M2 只做轻反馈，不做角色秀。

5. **状态机是 M2 的硬骨架。**
   - 最终统一状态：`idle / listening / thinking / speaking`
   - UI、文本流式、TTS、表情、动作、镜头都要围着这套状态机转。

6. **旧的 `spike/m2-expression-wip` 只能当参考，不是实现真源。**
   - 重新开 M2 连续施工单时，必须以本契约为真源，不允许沿着旧 WIP 继续瞎长。

---

## M2 范围

### 要做
1. 文本自然流式输出
2. 语音模式按钮
3. TTS 流式开口
4. `speaking / listening / thinking` 状态同步
5. 表情 / 动作轻反馈
6. `wide / close` 镜头切换（轻量版）
7. 三档 thinking mode：`fast / balanced / deep`

### 不做
- M3 的 `default model + fallback`
- 模型能力提示 / 风险提示
- M4 的主动机制与关系深化
- 重资产 Live2D / VRM 演出
- 复杂镜头语法
- 多镜头脚本系统
- 第二个策略大模型

---

## 主脑输出契约（高层意图层）

主脑不能直接裸控 TTS 参数，也不能直接乱切表情/镜头。
主脑只能给 **高层建议**。

### 必填字段
- `replyText`
- `thinkingMode`: `fast | balanced | deep`

### 可选字段
- `emotionIntent`:
  - `calm`
  - `happy`
  - `affectionate`
  - `playful`
  - `concerned`
  - `sad`
  - `angry`
  - `whisper`
- `cameraIntent`:
  - `wide`
  - `close`
- `actionIntent`:
  - `none`
  - `nod`
  - `lean-in`
  - `soft-smile`
  - `head-tilt`
  - `listen-settle`
- `emotionStrength`:
  - `light`
  - `normal`

### 明确禁止
- 主脑直接给 TTS 原始参数（速度/音高/音色数值）
- 主脑直接发底层 provider 脏参数
- 主脑直接发连续镜头脚本
- 主脑一轮里塞多种互相打架的情绪

---

## 策略层（真正拍板的人）

### 输入
策略层至少要看这些输入：
- 主脑高层意图
- 当前 UI 状态（`idle / listening / thinking / speaking`）
- 当前是否开启语音模式
- 当前 provider / TTS 能力
- 当前关系状态（`reserved / warm / close / hurt_but_connected`）
- 当前本地时间 / 时间段
- 距离上次互动的时间 gap
- 最近一轮情绪 / 镜头 / 动作历史
- cooldown 状态

### 职责
1. **过滤**：不允许超出白名单
2. **裁强度**：把主脑的情绪建议压到可控强度
3. **做一致性检查**：避免“难过配开心脸”“生气配软笑”这种出戏
4. **做场景约束**：根据时间、关系、语音开关、cooldown 决定放不放
5. **做路由**：把高层意图裁成 `emotion_mode=auto` 或必要时的 force emotion，再统一映射到表情 / 动作 / 镜头
6. **回退**：遇到非法值或能力不支持时安全回落

### 核心规则
- **非法值回退**：回 `calm + wide + none`
- **高强度禁入**：M2 不允许歇斯底里、尖叫式演出
- **晚间更克制**：深夜默认更轻、更稳，不搞情绪过载
- **长时间未互动后的情绪调制**：可以更低沉、更在意，但不能 guilt-trip 用户
- **关系约束**：
  - `close` 更容易放行 `affectionate / whisper / close`
  - `reserved` 更克制，不轻易给 `whisper / close / lean-in`
- **时间意识只做调味，不做主动机制**：M2 可用时间/距离感调制表达，但不新增主动触发逻辑

### 明确结论
**M2 的策略层不是第二主脑，而是规则裁判 + 混合路由器。**

---

## 情绪 / 表情 / 动作一致性规则

### 情绪家族 → 表情 / 动作大方向
- `calm`：中性、稳
- `happy`：轻笑、轻点头
- `affectionate`：更柔和，可轻近景，可轻前倾
- `playful`：轻嘴硬/轻逗趣，可轻歪头
- `concerned`：更专注、更柔和，允许轻前倾或歪头
- `sad`：更慢、更轻，不配开心笑
- `angry`：只允许低强度、克制版，不做暴怒演出
- `whisper`：只在受限场景生效，不是常态语气

### 一致性硬规则
- `sad` / `angry` 不能配 `soft-smile`
- `angry` 不配 `playful`
- `whisper` 不能在高外放、非亲密场景乱开
- 一轮回复只保留 **一个主情绪**
- 一次回复最多 **一个主动作**，避免小动作连击像抽搐

---

## 状态机（M2 硬骨架）

### Canonical states
- `idle`
- `listening`
- `thinking`
- `speaking`

### 切换规则
- 用户开始语音输入 / 打开语音采集：`listening`
- 用户提交文本或语音结束：`thinking`
- 首个可见 assistant 输出开始：`speaking`
- 回复结束后：
  - 若仍在语音模式并等待下一轮输入，回 `listening`
  - 否则回 `idle`

### 原则
- **thinking** 和 **speaking** 要区分清楚，别混成一个状态
- 文本流式已经开始时，UI 不该还挂在 `thinking`
- TTS 已经开始出声时，UI 必须在 `speaking`
- 用户打断（barge-in）时，应优先停 TTS 并回到输入态

---

## 文本流式输出规则

### 目标
- 用户不能看到“长时间没动静，然后整段突然蹦出”
- 要像她正在把话接出来

### 规则
- 允许 text delta 增量渲染
- 不暴露底层思维链
- 伪流式不算流式：如果 provider 有增量，UI 就不能攒到最后一起吐
- `thinking` 和 `speaking` 的视觉反馈必须可区分
- 如果 TTS 开启，文本流式与 TTS 开口要协同，不允许音画严重脱节

---

## TTS 规则

### 当前正式路线
- **优先：MiniMax WebSocket TTS**
- 但代码结构必须保留其他 provider 入口，不堵死后路

### M2 对 TTS 的要求
1. 尽量流式开口
2. 不等待全文生成结束才开始播报
3. 音频开口与 `speaking` 状态同步
4. 默认走 `emotion_mode=auto`，允许 provider 按文本自动推断情绪
5. 只有明确 / 约束 / 连续性场景才 force emotion，不是常态全量映射
6. 文本、语音、表情、镜头要尽量同步，不要各演各的

### MiniMax 混合情绪路由冻结规则
- 默认：`voice_setting.emotion_mode = auto`
- auto 路径允许省略 `emotion`
- force emotion 只在以下场景允许：
  - 明确：例如 `whisper` 这类显式低语需求
  - 约束：策略层因关系 / 时间 / 能力把情绪压回可控值
  - 连续性：上一轮已经 force，且当前轮需要延续同一主情绪
- `speech-2.8-*` 不支持 `whisper / fluent`
- `whisper / fluent` 只允许 `speech-2.6-*`
- force 路径落在不支持模型上时，优先安全降到对应 `speech-2.6-*`
- 如果降级后仍不安全，再回退到 `calm`
- M2 当前默认 `voiceId` 锁定为 `Chinese (Mandarin)_Sweet_Lady`

### MiniMax WebSocket 适配冻结方案

#### M2 真正要解决的不是“接口能不能连通”
而是这 5 个编排坑：
1. **首包延迟**：如果等全文再发，流式体验直接死
2. **分段策略**：切太碎会卡顿、爆请求；切太大又像非流式
3. **状态同步**：TTS 开口、UI speaking、表情、镜头不能错拍
4. **打断处理**：用户一插话，音频必须可停，不然就是抢话
5. **格式适配**：服务端回的是流式音频 chunk，客户端必须稳定解码、排队、播放

#### 推荐适配架构
`LLM text delta -> segmenter -> TTS queue -> MiniMax WS adapter -> audio chunk decoder/player`

#### 适配器职责
- 管理一个长连 WebSocket session
- 负责 `task_start`
- 增量发送 `task_continue`
- 接收流式音频 chunk
- 解码后喂给本地播放器队列
- 负责 stop / interrupt / reconnect / timeout

#### 文本分段规则（M2 建议冻结）
- **不要 token 到一个字就发一次**
- 采用 **短句/子句级分段**：
  - 命中标点（`，。！？；：`）优先切
  - 或累计到一定长度再切（例如 12-24 个汉字）
  - 避免极短碎片连续灌给 TTS
- 首段以“尽快开口”为目标，后续段以“稳定连播”为目标

#### 播放与状态同步规则
- 收到首个可播放音频 chunk -> UI 切 `speaking`
- 若文本已开始流式但 TTS 还未开口，可短暂保留 `thinking -> speaking` 过渡
- TTS 播放结束 -> 回 `idle` 或 `listening`
- 若用户打断：
  - 立刻停播
  - 清空当前 TTS queue
  - 关闭或复位当前 task
  - 状态回输入态

#### 能力降级规则（M2 范围内允许）
- 如果 WebSocket 流式开口不稳定：
  - 先降级为**分段准流式**，不是直接整段 blocking TTS
- 如果当前走 auto 路由：
  - 允许省略 `emotion`，不强塞 provider 情绪字段
- 如果当前 force 的 `whisper / fluent` 落在 `speech-2.8-*`：
  - 自动降到对应 `speech-2.6-*`
- 如果 force emotion 降级后仍不被 provider 支持：
  - 回退到 `calm`

### TTS 预设 / 路由原则
M2 不做“语音调参台”，只做少量稳定预设。
这些 preset 是策略语义，不代表每轮都要把 provider emotion 显式塞出去。

建议至少有：
- `calm`
- `happy`
- `affectionate`
- `concerned`
- `sad`
- `angry_soft`
- `whisper`

### preset 映射原则
- `happy`：略轻快，但不夹过头
- `affectionate`：更柔、更近
- `concerned`：更慢、更稳
- `sad`：更低能量，不拖成丧气 ASMR
- `angry_soft`：更硬一点，但绝不吼叫
- `whisper`：只有能力支持且场景允许才放

### 明确禁区
- 默认禁用花哨 `sound_effects`
- 不把 M2 做成“调 pitch / speed / timbre 参数实验场”
- 不允许因为 TTS 追求情绪效果而把节奏拖死

### Codex 参考文档（必须带上）
- MiniMax 同步 TTS WebSocket 文档（LLM 友好本地副本）：
  - `C:\Users\caipe\Desktop\同步语音合成WebSocket.txt`
- MiniMax 在线指南（仅作辅参）：
  - `https://platform.minimax.io/docs/guides/speech-t2a-websocket`
- 施工要求：Codex 在实现 MiniMax WS 适配器前，先按本地 txt 文档核对：
  - `task_start`
  - `task_continue`
  - 流式音频 chunk 读取
  - `is_final`
  - `task_finish`
- 但实现口径仍以本契约为真源；接口文档解决“接口怎么通”，本契约解决“Vela 体验该怎么落”。

---

## 语音模式规则

### 交互壳
- 按钮切换“语音交互模式”
- 关闭时退回 `text-in / text-out`

### M2 最低成立标准
进入语音模式后，至少稳定表现：
- `listening`
- `thinking`
- `speaking`

### 边界
- ASR 先占位，不阻塞 M2 主体验推进
- M2 先把 TTS 开口、状态同步、情绪预设和 UI 联动打通

---

## 镜头规则（轻量版）

### 仅允许两态
- `wide`
- `close`

### 默认规则
- 默认 `wide`
- 满足以下类场景时，允许切 `close`：
  - 安慰
  - 亲密
  - 轻声/低语
  - 用户明显在讲更私密或更重要的话
  - 情绪聚焦点需要更近

### 限制
- 镜头切换必须有 cooldown
- `close` 不是常驻默认态
- 一次回复里不要来回抖镜头
- 回复结束后，允许在短 hold 后回 `wide`

### 默认建议值
- camera switch cooldown：`8s`
- close hold：`2-4s`

> 这是默认实现建议值，后续可调，但没有明确理由别乱改。

---

## 动作 / 表情规则

### 第一版动作白名单
- `none`
- `nod`
- `lean-in`
- `soft-smile`
- `head-tilt`
- `listen-settle`

### 原则
- 轻、稳、少
- 每次回复最多一个主动作
- 不高频抖动
- 不做夸张演出
- 表情与动作必须服从主情绪，不允许互相打架

---

## 三档 thinking mode

### 用户层只暴露
- `fast`
- `balanced`
- `deep`

### 系统层负责映射
- OpenAI-compatible -> reasoning effort / 对应深度档
- Anthropic / MiniMax anthropic-like -> thinking 开关 / budget / 等价策略
- 不支持的 provider -> **先做安全降级映射 + 记录日志**

### 当前边界
- 用户不接触底层 provider 脏参数
- 用户可理解的是三档语义，不是各家厂商字段
- 用户侧能力提示属于 **M3**，M2 先把基础映射做通

---

## M2 成功标准

M2 通过至少要满足：
1. 文本回复自然流式输出
2. 语音模式按钮可用
3. TTS 尽量流式开口
4. `speaking / listening / thinking` 状态与 UI / TTS 同步
5. 表情和轻动作反馈存在且不出戏
6. `wide / close` 切换成立且不乱跳
7. `fast / balanced / deep` 三档存在、可切、已映射
8. 默认 TTS 情绪路由走 `emotion_mode=auto`
9. force emotion 只出现在明确 / 约束 / 连续性场景
10. `speech-2.8-*` 遇 `whisper / fluent` 可安全降到 `speech-2.6-*`
11. 当前默认 `voiceId` 仍为 `Chinese (Mandarin)_Sweet_Lady`
12. 情绪、动作、镜头不出现明显错配

---

## 验收规则

### 施工位（Codex）
先做实现 + 自测。

### 第二视角（MiniMax）
只做 **技术向真实验收**，不假装代替人耳体验：
- MiniMax WS 真接口是否打通
- `task_start / task_continue / task_continued / is_final / task_finish` 是否走对
- 分段策略、队列、打断、状态同步是否自洽
- `auto / force` 两条情绪路由是否都按规则生效
- `whisper / fluent` / 模型能力降级是否按规则生效
- `Chinese (Mandarin)_Sweet_Lady` 默认路径是否保持不漂移
- thinking 三档映射是否真实落地
- 代码、日志、录屏、音频产物、自测报告是否一致

### 人耳 / 人眼体验验收（用户）
用户只验体验本身：
- 开口是否够快
- 说话是否够顺
- 打断是否生效
- 情绪是否出戏
- 表情 / 动作 / 镜头 / 语音是否整体像在场

### 主控（小新）
负责汇总 Codex 自测 + MiniMax 技术验收 + 用户体验验收，最后做 closure，不兼任人耳真实体验执行位。

---

## 一句话钉死

**M2 不是在给 Vela 叠功能，而是在冻结“主脑建议什么、系统真正放什么、整套表达怎么不翻车”。**
