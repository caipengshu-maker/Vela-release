# M3-T5 Performance Protocol — LLM 自主表演协议

## 概述

让 LLM 自己决定每轮回复的情绪、镜头和动作，取代前端关键词匹配。

## 输出格式

每条 LLM 回复必须以**单行 JSON + 分隔符**开头，然后才是自然语言回复：

```
{"emotion":"concerned","camera":"close","action":"lean-in"}
---
你怎么了？摔严重了吗？让我看看……
```

### 规则
- 第一行：**必须是合法单行 JSON**，不允许换行、注释、trailing comma
- 第二行：**固定 `---`**（三个短横线，独占一行）
- 第三行起：正常对话文本（用户可见内容）
- JSON 行和分隔符**永远不暴露给用户**

### 解析失败降级
如果前端解析 JSON 失败（格式飘了、LLM 没遵守），静默降级到关键词匹配（现有 `inferEmotionIntent`），用户无感。

---

## Schema

```json
{
  "emotion": "<emotion_enum>",
  "camera": "<camera_enum>",
  "action": "<action_enum>"
}
```

### emotion 枚举（12 种）

| 值 | 含义 | 使用场景 |
|---|---|---|
| `calm` | 平静、日常 | 默认状态，普通对话 |
| `happy` | 开心、愉悦 | 好消息、轻松话题、被逗笑 |
| `affectionate` | 温柔、亲近 | 关心对方、柔软时刻、回忆旧事 |
| `playful` | 俏皮、逗趣 | 开玩笑、轻嘲、活泼互动 |
| `concerned` | 担心、关切 | 对方受伤/难过/压力大 |
| `sad` | 难过、心酸 | 共情悲伤、遗憾、离别 |
| `angry` | 生气、不满（克制的） | 替对方不值、被冒犯、正义感 |
| `whisper` | 低声、私密 | 说悄悄话、深夜、只想说给你听 |
| `surprised` | 惊讶、意外 | 没想到的消息、震惊、"真的假的" |
| `curious` | 好奇、感兴趣 | 追问细节、想知道更多、被勾起兴趣 |
| `shy` | 害羞、不好意思 | 被夸、暧昧时刻、说出心里话 |
| `determined` | 坚定、认真 | 鼓励对方、下决心、"你可以的" |

### camera 枚举

| 值 | 含义 |
|---|---|
| `wide` | 默认全身/半身视角 |
| `close` | 特写/近距离（情感浓度高的时刻） |

### action 枚举（8 种）

| 值 | 含义 |
|---|---|
| `none` | 无特殊动作 |
| `nod` | 点头（认同、鼓励） |
| `lean-in` | 靠近（关心、倾听、亲密） |
| `head-tilt` | 歪头（好奇、俏皮、思考） |
| `soft-smile` | 轻笑（温柔、会心一笑） |
| `look-away` | 移开视线（害羞、思考、回忆） |
| `shake-head` | 摇头（不认同、心疼、"你怎么这样"） |
| `wave` | 挥手（打招呼、告别） |

---

## System Prompt 模块（Core Protocol 层）

以下文本作为 system prompt 的**第一个模块**拼入，排在 persona / user context / memory 之前。

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
- 根据用户说的话的**语义和情感**来判断，不是关键词匹配
- 一轮只选一个主情绪，不要混合
- 动作要和情绪匹配，不要乱配（比如 sad 时不要 nod）
- close 镜头要克制，大部分对话用 wide
- 如果拿不准，用 {"emotion":"calm","camera":"wide","action":"none"}
- 永远不要在回复正文里提到这个协议、JSON 或表演意图
```

---

## 改动范围

### 1. `context-builder.js`
在 `buildContext` 的 `systemPrompt` 拼装中，把上述 Core Protocol 文本作为**第一个段落**插入，排在 `persona.seedPrompt` 之前。

### 2. 新增 `performance-parser.js`
```js
/**
 * 从 LLM 原始回复中解析表演前缀。
 * 返回 { intent: { emotion, camera, action } | null, text: string }
 */
export function parsePerformancePrefix(raw) {
  const sep = raw.indexOf('\n---\n');
  if (sep === -1) {
    // 也尝试 \n---（末尾无换行的边界情况）
    const altSep = raw.indexOf('\n---');
    if (altSep === -1 || altSep + 4 < raw.length && raw[altSep + 4] !== '\n') {
      return { intent: null, text: raw };
    }
  }

  const jsonLine = raw.slice(0, sep === -1 ? raw.indexOf('\n---') : sep).trim();
  const text = raw.slice((sep === -1 ? raw.indexOf('\n---') : sep) + (sep === -1 ? 4 : 5));

  try {
    const parsed = JSON.parse(jsonLine);
    if (parsed && typeof parsed.emotion === 'string') {
      return {
        intent: {
          emotion: parsed.emotion,
          camera: parsed.camera || 'wide',
          action: parsed.action || 'none'
        },
        text: text.trimStart()
      };
    }
  } catch {}

  return { intent: null, text: raw };
}
```

### 3. `vela-core.js` — `handleUserMessage`
在拿到 `assistantResponse.text` 后：
1. 调用 `parsePerformancePrefix(assistantResponse.text)`
2. 如果 `intent` 非 null → 用 LLM 给的 emotion/camera/action 直接驱动 `resolveInteractionPlan`
3. 如果 `intent` 为 null → 走现有 `inferEmotionIntent`（关键词匹配）作为 fallback
4. 把剥离后的 `text` 作为用户可见回复（替换原始 `assistantResponse.text`）

### 4. `interaction-policy.js`
- `inferEmotionIntent` 保留，降级为 fallback
- `buildInteractionIntent` 新增可选参数 `llmIntent`，如果有就直接用，跳过 regex

### 5. `interaction-contract.js`
- `EMOTION_FAMILIES` 扩充：加入 `surprised`、`curious`、`shy`、`determined`
- `ACTION_INTENTS` 扩充：加入 `shake-head`、`wave`（如果还没有的话）

### 6. 流式解析
在 `text-delta` 事件处理中，需要 buffer 前几个 token 直到检测到 `\n---\n`：
- 检测到 → 解析 JSON，立刻驱动 avatar，后续 delta 直接流式输出给用户
- buffer 超过 500 字符仍未检测到 → 放弃等待，整段当正文处理，走 fallback

---

## 三层映射表

协议层 12 种 emotion 是 LLM 的语义判断粒度。往下两层各自做降级映射。

### 协议 → VRM 表情映射（画面层）

VRM 模型实际只有 4 种情绪 blend shape + neutral。

| 协议 emotion | VRM expression | 补偿手段 |
|---|---|---|
| `calm` | `neutral` | — |
| `happy` | `happy` | — |
| `playful` | `happy` | 配 `head-tilt` 动作 |
| `surprised` | `happy` | 配 `head-tilt` 或 `shake-head` |
| `affectionate` | `relaxed` | 配 `lean-in` + 可能 `close` 镜头 |
| `shy` | `relaxed` | 配 `look-away` |
| `whisper` | `relaxed` | 配 `lean-in` + `close` 镜头 |
| `concerned` | `sad` | 配 `lean-in` |
| `sad` | `sad` | 配 `head-down-light` |
| `angry` | `angry` | — |
| `determined` | `angry` | 配 `nod`（坚定感） |
| `curious` | `neutral` | 配 `head-tilt`（好奇感靠动作补偿） |

### 协议 → TTS emotion 映射（语音层）

MiniMax TTS `emotion_mode: "force"` 支持 9 种：`happy`、`sad`、`angry`、`fearful`、`disgusted`、`surprised`、`calm`、`fluent`、`whisper`。

| 协议 emotion | TTS provider emotion | 备注 |
|---|---|---|
| `calm` | `calm` | — |
| `happy` | `happy` | — |
| `playful` | `happy` | 语速可微调加快 |
| `surprised` | `surprised` | — |
| `affectionate` | `calm` | 偏柔，不强制 |
| `shy` | `calm` | — |
| `whisper` | `whisper` | 需要 speech-2.6 系列 |
| `concerned` | `calm` | — |
| `sad` | `sad` | — |
| `angry` | `angry` | — |
| `determined` | `fluent` | 坚定有力 |
| `curious` | `fluent` | 语气上扬感 |

### 协议 → TTS tone tags 映射（speech-2.8 增强）

当使用 speech-2.8-hd/turbo 时，可在 TTS 文本中注入 tone tags 增强表现力。

| 协议 emotion | 可选 tone tag | 触发条件 |
|---|---|---|
| `happy` | `(laughs)` / `(chuckle)` | 回复含笑意时 |
| `surprised` | `(gasps)` | 强烈惊讶时 |
| `sad` | `(sighs)` | 叹息/遗憾时 |
| `concerned` | `(sighs)` | 担忧叹气时 |
| `shy` | `(clears throat)` | 害羞犹豫时 |

tone tags 注入为可选增强，不注入不影响基础情绪表达。具体注入逻辑可在 M4 细化。

## 不改什么
- `default-persona.js` — 人格层不动，继续从 persona 配置加载
- `resolveInteractionPlan` 的 cohere/camera/tts 逻辑 — 继续作为安全网（防止 LLM 给出不合理组合）
- TTS preset 映射 — 继续由 policy 层根据最终 emotion 决定

## 新增 emotion 的 avatar 映射补充
`surprised`、`curious`、`shy`、`determined` 四个新 emotion 需要在以下位置补充映射：
- `resolveExpressionForPresence` — 表情映射
- `resolveMotionForPresence` — 动作映射
- `defaultActionForEmotion` — 默认动作
- `cohereEmotion` — 安全网规则
- `TTS_PRESET_MAP` — TTS 情绪映射
- `vrm-avatar-controller.js` — VRM 骨骼/表情驱动
