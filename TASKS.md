# TASKS.md - Vela

## 项目信息
- 项目名称：Vela
- 当前阶段：M5.5 产品补全
- 项目责任人：小新
- 默认编码施工位：Codex（GPT-5.4 xhigh）
- 最后更新：2026-03-23

## 状态枚举
- TODO / IN-PROGRESS / BLOCKED / IN-REVIEW / DONE

---

## M5.5 - 产品补全（当前阶段）

### Phase 1：核心能力补全

#### M5.5-T1 ASR 语音识别接入
- 状态：DONE — commit `0e1fc43`
- 优先级：P0
- Owner：Codex
- 验收：双模态 composer + Web Speech ASR + 模型切换

### Phase 2：首次体验质感

#### M5.5-T10 开屏动画（K Studio Splash）
- 状态：DONE — commit `1489bfe`
- 优先级：P0
- Owner：Codex
- 验收：fade-in → hold 2.5s → fade-out，IPC 加载 D 盘 logo

#### M5.5-T5 UI 打磨（M3/M4 遗留）
- 状态：DONE — commit `ef4b980`
- 优先级：P1
- Owner：Codex
- 完成项：语音按钮 32px / 气泡收窄+动画 / 标签清理 / 纸飞机发送按钮 / 输入框优化 / 消息自动吸底

### Phase 3：视觉氛围

#### M5.5-T11 Avatar 场景背景
- 状态：DONE — commit `b98f0bc`
- 优先级：P1
- Owner：Codex
- 完成项：日/夜背景自动切换（6:00-17:59 / 18:00-5:59），5 分钟刷新，1s crossfade

#### M5.5-T12 环境 BGM
- 状态：DONE — commit `cc25f2d`
- 优先级：P1
- Owner：Codex
- 完成项：bgm-controller.js（Web Audio API）/ 日夜切换 / TTS ducking / 音量按钮 / 占位 mp3

### Phase 4：安全网

#### M5.5-T3 错误处理 UI
- 状态：DONE — commit `bf45497`
- 优先级：P0
- Owner：Codex + 主控补刀
- 完成项：LLM 失败 banner + 重试 / TTS 提示 / ASR 提示 / 启动失败全屏

#### M5.5-T2 设置界面
- 状态：DONE — commit `5969796`（与 T4 合并）
- 优先级：P0
- Owner：Codex
- 完成项：模态弹窗 / BGM 音量滑块 / TTS 音量滑块 / 用户昵称输入

#### M5.5-T4 首次体验引导
- 状态：DONE — commit `5969796`（与 T2 合并）
- 优先级：P0
- Owner：Codex
- 完成项：三步引导 / MiniMax API Key / 语音开关 / 资费警告 / 高级配置引导到 vela.jsonc

### Phase 5：持久化 + 沉浸

#### M5.5-T7 启动桥接摘要（日记体）
- 状态：IN-PROGRESS
- 优先级：P1
- Owner：Codex
- 说明：启动时独立调 LLM 生成 Vela 视角的日记体回忆，不污染主对话上下文

#### M5.5-T6 全屏沉浸模式
- 状态：TODO
- 优先级：P1
- Owner：Codex

### Phase 6：清理 + 打磨

#### M5.5-C1 P 键 demo 剥离
- 状态：TODO
- 优先级：P1

#### M5.5-C2 summarizer 修复
- 状态：TODO
- 优先级：P2

#### M5.5-T8 窗口状态记忆
- 状态：TODO
- 优先级：P2

#### M5.5-T9 Lip Sync
- 状态：TODO
- 优先级：P2

### Phase 7：体验打磨（新增 2026-03-23）

#### M5.5-P1 关窗告别微表情
- 状态：TODO
- 优先级：P2
- 说明：关 app 时 Vela 挥手/微表情 0.5s，不直接黑屏

#### M5.5-P2 思考状态动画联动
- 状态：TODO
- 优先级：P2
- 说明：思考中切到 Mixamo Thinking 动画 + 表情微变

#### M5.5-P3 消息时间戳
- 状态：TODO
- 优先级：P2
- 说明：淡色相对时间（刚刚 / 3分钟前 / 昨天）

#### M5.5-P4 关系阶段视觉暗示
- 状态：TODO
- 优先级：P2
- 说明：reserved→warm→close 界面暖色调微变 + 背景粒子密度

#### M5.5-P5 空聊天氛围文案
- 状态：TODO
- 优先级：P2
- 说明：主动问候未触发时显示静态占位文案

---

## M5 - 体验深化（已收口 2026-03-22）

### M5-T1 表情-动画-镜头预设系统
- 状态：DONE
- 产物：commit `93723c4`
- 12 情绪 × blend shape 配方 + 动画绑定 + 镜头偏好 + 骨骼 overlay

### M5-T2 关系弧线系统
- 状态：DONE
- 产物：commit `3cf43b5` + fix `e16a2b6`
- reserved→warm→close 三阶段 + 退阶机制 + 持久化

### M5-T4 情绪驱动动画切换
- 状态：DONE
- 产物：commit `32aba10` + `04e2952`
- 11 个 Mixamo FBX，情绪变化 crossfade 切换

---

## M4 - 让她像个人（已收口 2026-03-22）

### M4-T5 记忆收窄三件套
- 状态：DONE — commit `f38e2fe`

### M4-T6 idle 微动 + 手臂自然度
- 状态：DONE — commit `6265162`

### M4-T6b 手指 curl + VRM 骨骼深度分析
- 状态：DONE — commit `3c01fea`

### M4-T6c Mixamo 动画系统
- 状态：DONE — commit `79b4fb1` + `3b79b94`

### M4-T7 UX 清理
- 状态：DONE — commit `a90f9c7`

### M4-T8 轻主动机制
- 状态：DONE — commit `99f1229`

### M4 收口清理
- 状态：DONE — commit `a466890`

---

## M3 - 在场感闭环（已收口 2026-03-21）
- T1 语音模式按钮 DONE
- T2 TTS 流式开口 DONE
- T3 表情/动作轻反馈 DONE
- T4 远景/近景切换 DONE
- T5 LLM 自主表演协议 DONE

## M2 - 管道闭环（已收口 2026-03-20）
- T1 流式文本 DONE
- T2 状态机 DONE
- T3 三档 thinking DONE
- T4 基础 fallback DONE

## M1 - 最小伴侣闭环（已收口 2026-03-20）
- T1-T6 全部 DONE

## M0 - 定义冻结（已收口）
- T1-T2 全部 DONE

---

## 当前不做
- 文件权限 / 桌面整理 / 系统权限 / 编码助手
- 重型主动推送 / 复杂关系数值 / 重型记忆平台
- Live2D 重资产路线 / 多角色平台 / 成人向主线
- 完整 gateway / 插件平台 / 向量数据库
