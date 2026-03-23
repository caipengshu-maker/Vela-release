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
- 状态：TODO
- 优先级：P0
- Owner：待定
- 验收：语音按钮 → 识别 → 文字填入 → 发送

### Phase 2：首次体验质感

#### M5.5-T10 开屏动画（K Studio Splash）
- 状态：TODO
- 优先级：P0
- Owner：待定
- 说明：K Studio logo（Gemini 生图）fade in → hold 2-3s → fade out → 主界面
- 验收：Electron 启动有品牌感开屏

#### M5.5-T5 UI 打磨（M3/M4 遗留）
- 状态：TODO
- 优先级：P1
- Owner：Codex
- 子项：语音按钮缩小 / 气泡收窄+动画 / 标签清理 / 纸飞机按钮 / 输入框优化 / 消息滑动窗口

### Phase 3：视觉氛围

#### M5.5-T11 Avatar 场景背景
- 状态：TODO
- 优先级：P1
- Owner：待定
- 说明：静态插画背景（日/夜切换）+ 轻粒子点缀，Gemini 生图

#### M5.5-T12 环境 BGM
- 状态：TODO
- 优先级：P1
- Owner：待定
- 说明：轻氛围 BGM + 音量控制 + TTS ducking + 日/夜切换

### Phase 4：安全网

#### M5.5-T3 错误处理 UI
- 状态：TODO
- 优先级：P0
- Owner：Codex

#### M5.5-T2 设置界面
- 状态：TODO
- 优先级：P0
- Owner：Codex

#### M5.5-T4 首次体验引导
- 状态：TODO
- 优先级：P0
- Owner：Codex
- 依赖：T2

### Phase 5：持久化 + 沉浸

#### M5.5-T7 聊天记录持久化
- 状态：TODO
- 优先级：P1
- Owner：Codex

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
