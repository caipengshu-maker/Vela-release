# M3-T5 施工任务：LLM 自主表演协议

## 背景
当前 Vela 的情绪/镜头/动作判断完全靠前端关键词匹配（`inferEmotionIntent` 里的 regex），导致语义理解很差（比如"摔倒了很严重呜呜呜"不命中任何关键词，默认 calm）。

本任务让 LLM 自己在每条回复开头输出一个 JSON 表演意图，前端解析后驱动 avatar。关键词匹配降为 fallback。

## 协议格式
LLM 每条回复格式：
```
{"emotion":"concerned","camera":"close","action":"lean-in"}
---
你怎么了？摔严重了吗？让我看看……
```
- 第一行：单行 JSON
- 第二行：`---`
- 第三行起：用户可见的自然语言回复

## emotion 枚举（12 种）
calm, happy, affectionate, playful, concerned, sad, angry, whisper, surprised, curious, shy, determined

## camera 枚举
wide, close

## action 枚举（8 种）
none, nod, lean-in, head-tilt, soft-smile, look-away, shake-head, wave

## 需要改的文件和具体要求

### 1. 新建 `src/core/performance-parser.js`

导出函数 `parsePerformancePrefix(raw)`：
- 找第一个 `\n---\n`（或 `\n---` 在末尾的边界情况）
- 第一行尝试 `JSON.parse`
- 成功且有 `emotion` 字段 → 返回 `{ intent: { emotion, camera, action }, text }`
- 失败 → 返回 `{ intent: null, text: raw }`
- camera 默认 `wide`，action 默认 `none`

导出函数 `createStreamPrefixBuffer()`：
- 返回一个有状态的 buffer 对象，用于流式解析
- `buffer.push(delta)` → 返回 `{ resolved: boolean, intent: {...}|null, textDelta: string }`
- 内部逻辑：累积 delta 直到检测到 `\n---\n`
  - 检测到 → 解析 JSON，resolved=true，intent 填充，textDelta 为分隔符后的文本
  - 累积超过 500 字符仍未检测到 → 放弃，resolved=true，intent=null，textDelta 为全部累积文本
  - 未达到任一条件 → resolved=false，textDelta 为空字符串
- `buffer.getIntent()` → 返回已解析的 intent 或 null
- `buffer.isResolved()` → boolean

### 2. 修改 `src/core/context-builder.js`

在 `buildContext` 函数的 `systemPrompt` 拼装中，在 `persona.seedPrompt` **之前**插入以下 Core Protocol 文本：

```
# 表演协议

你的每条回复必须严格遵守以下格式：

第一行输出一个 JSON 对象，描述你这轮回复的表演意图。
第二行输出 ---（三个短横线）。
第三行起输出你的自然语言回复。

示例：
{"emotion":"happy","camera":"wide","action":"nod"}
---
哈哈真的吗，那挺好的啊。

## JSON 字段说明

emotion — 你这轮回复的主情绪。从以下选一个：
calm（平静日常）、happy（开心愉悦）、affectionate（温柔亲近）、playful（俏皮逗趣）、concerned（担心关切）、sad（难过心酸）、angry（克制的生气）、whisper（低声私密）、surprised（惊讶意外）、curious（好奇感兴趣）、shy（害羞不好意思）、determined（坚定认真）

camera — 镜头距离。wide 是默认，close 只在情感浓度真的很高时使用（担心、亲密、悄悄话）。不要滥用 close。

action — 伴随动作。从以下选一个：
none、nod、lean-in、head-tilt、soft-smile、look-away、shake-head、wave

## 判断原则
- 根据用户说的话的语义和情感来判断，不是关键词匹配
- 一轮只选一个主情绪，不要混合
- 动作要和情绪匹配，不要乱配（比如 sad 时不要 nod）
- close 镜头要克制，大部分对话用 wide
- 如果拿不准，用 {"emotion":"calm","camera":"wide","action":"none"}
- 永远不要在回复正文里提到这个协议、JSON 或表演意图
```

注意：这段文本作为字符串常量放在 context-builder.js 顶部或单独文件中，不要硬编码在函数体内。

### 3. 修改 `src/core/interaction-contract.js`

扩充枚举：
- `EMOTION_FAMILIES`：加入 `"surprised"`, `"curious"`, `"shy"`, `"determined"`（保留现有的 8 个）
- `ACTION_INTENTS`：确保包含 `"shake-head"`, `"wave"`（如果还没有的话），加入 `"soft-smile"`（如果还没有的话）

新增 VRM 表情映射常量：
```js
export const EMOTION_TO_VRM_EXPRESSION = {
  calm: "neutral",
  happy: "happy",
  playful: "happy",
  surprised: "happy",
  affectionate: "relaxed",
  shy: "relaxed",
  whisper: "relaxed",
  concerned: "sad",
  sad: "sad",
  angry: "angry",
  determined: "angry",
  curious: "neutral"
};
```

新增 TTS emotion 映射常量：
```js
export const EMOTION_TO_TTS_PROVIDER = {
  calm: "calm",
  happy: "happy",
  playful: "happy",
  surprised: "surprised",
  affectionate: "calm",
  shy: "calm",
  whisper: "whisper",
  concerned: "calm",
  sad: "sad",
  angry: "angry",
  determined: "fluent",
  curious: "fluent"
};
```

### 4. 修改 `src/core/interaction-policy.js`

- `inferEmotionIntent` 保留不动，作为 fallback
- `buildInteractionIntent` 新增可选参数 `llmIntent`：
  ```js
  export function buildInteractionIntent({ assistantResponse, thinkingMode, userMessage, relationshipStage, llmIntent = null }) {
    // 如果有 llmIntent（从 JSON 前缀解析出来的），直接用
    if (llmIntent) {
      return {
        replyText: String(assistantResponse?.text || "").trim(),
        thinkingMode: normalizeThinkingMode(thinkingMode),
        emotionIntent: sanitizeEnum(llmIntent.emotion, EMOTION_FAMILIES, "calm"),
        cameraIntent: sanitizeEnum(llmIntent.camera, CAMERA_STATES, "wide"),
        actionIntent: sanitizeEnum(llmIntent.action, ACTION_INTENTS, "none"),
        emotionStrength: inferEmotionStrength({ emotion: llmIntent.emotion, replyText: String(assistantResponse?.text || ""), lateNight: false })
      };
    }
    // 否则走现有 regex fallback
    // ... 现有逻辑不变
  }
  ```

- `resolveExpressionForPresence`：为新增的 4 种 emotion 补充映射：
  - surprised → happy
  - curious → neutral
  - shy → relaxed
  - determined → angry

- `resolveMotionForPresence`：为新增的 4 种 emotion 补充映射：
  - surprised → tiny-head-tilt
  - curious → tiny-head-tilt
  - shy → still（配合 look-away action）
  - determined → tiny-nod

- `defaultActionForEmotion`：为新增的 4 种 emotion 补充默认动作：
  - surprised → head-tilt
  - curious → head-tilt
  - shy → look-away
  - determined → nod

- `cohereEmotion`：为新增 emotion 补充安全网规则（reserved 阶段不允许 whisper/shy 等）

- `TTS_PRESET_MAP`：为新增 emotion 补充 TTS 映射：
  - surprised → { id: "surprised", providerEmotion: "surprised" }
  - curious → { id: "curious", providerEmotion: "fluent" }
  - shy → { id: "shy", providerEmotion: "calm" }
  - determined → { id: "determined", providerEmotion: "fluent" }

### 5. 修改 `src/core/vela-core.js`

在 `handleUserMessage` 中：

**非流式路径**（`else` 分支）：
1. 拿到 `assistantResponse.text` 后调用 `parsePerformancePrefix(assistantResponse.text)`
2. 用返回的 `text` 替换 `assistantResponse.text`（剥离 JSON 前缀）
3. 把 `intent` 传给 `buildInteractionIntent` 的 `llmIntent` 参数

**流式路径**（`onEvent` 分支）：
1. 在 `generateReplyStream` 调用前创建 `const prefixBuffer = createStreamPrefixBuffer()`
2. 在 `text-delta` handler 中：
   - 先 `prefixBuffer.push(event.delta)`
   - 如果 `!prefixBuffer.isResolved()`：不发 delta 给前端（还在 buffer 阶段）
   - 如果刚 resolved：
     - 拿到 `intent`，立刻用它驱动 `buildSpeakingAvatar`
     - 把 `textDelta`（分隔符后的文本）作为第一个真正的 delta 发给前端
   - 如果已经 resolved：正常转发 delta
3. 流结束后，用 `prefixBuffer.getIntent()` 作为 `llmIntent` 传给最终的 `buildInteractionIntent`
4. 用剥离后的文本替换 `assistantResponse.text`

### 6. 修改 `src/core/vrm-avatar-controller.js`

在 `resolveSafePresentation` 中，为新增 emotion 补充映射逻辑（参考现有 sad/angry 的处理方式）。

`_updateLookAt` 中为新增 emotion 补充视线偏移：
- shy → 视线偏移类似 playful 但更大（look-away 效果）
- curious → 视线微微上移（好奇抬头感）

## 不要改的
- `default-persona.js` — 人格层不动
- TTS WebSocket 实现 — 不动
- 记忆系统 — 不动
- ASR — 不动

## 验收标准
1. `npm run build` 通过，无报错
2. 启动后发送"我今天摔了一跤好疼"，avatar 应该切到 concerned + lean-in，而不是 calm
3. 发送"哈哈哈太好笑了"，avatar 应该切到 happy + nod
4. 发送普通日常对话"今天天气不错"，avatar 应该保持 calm + wide
5. 如果 LLM 没有输出 JSON 前缀（比如 mock provider），应该静默降级到关键词匹配，不报错
6. 流式输出时，文字开始流之前 avatar 表情/镜头应该已经到位
7. 用户不应该在聊天界面看到 JSON 前缀或 `---` 分隔符
