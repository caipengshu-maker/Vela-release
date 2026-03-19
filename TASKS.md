# TASKS.md — Vela

## 项目信息
- 项目名称：Vela
- 当前阶段：M1 收口中
- 项目责任人：小新
- 默认编码施工位：Codex（GPT-5.4 xhigh）
- 最后更新：2026-03-19

## 状态枚举
- TODO
- IN-PROGRESS
- BLOCKED
- IN-REVIEW
- DONE

## 当前总体目标
先把一个最小事实做实：

**Vela 不是聊天框，而是一个有连续人格、连续记忆、真实主脑、并开始具备伴侣感的 avatar 伴侣原型。**

## 当前额外施工约束
- `M1-T1 ~ M1-T6` 默认在**一个连续施工上下文**内推进，不碎成多个新会话
- 长任务默认派 **CLI 施工位**
- UI 审美明确避开“AI 工具味”，参考**二次元乙游**方向
- 若产出对 OpenClaw 有通用价值的源码，后续应评估是否抽象回馈
- 涉及真实 LLM / provider / thinking / 记忆回灌 / 权限边界的整改，必须走：施工位自测 → 第二视角真实验收 → 主控 closure
- 完成标准必须包含：**真实测试 + 整改报告**

---

## M0 - 定义冻结

### M0-T1 项目定义冻结
- 状态：DONE
- 优先级：P0
- Owner：小新
- 产物：`M0_FREEZE.md`、`PROJECT_PROPOSAL.md`

### M0-T2 主线板 / 任务板落地
- 状态：DONE
- 优先级：P0
- Owner：小新
- 产物：`CURRENT-ROUTE.md`、`TASKS.md`

---

## M1 - 最小伴侣闭环（当前收口阶段）

### M1-T1 工程骨架初始化
- 状态：DONE
- 优先级：P0
- Owner：Codex

### M1-T2 `Vela Core` 最小闭环
- 状态：DONE
- 优先级：P0
- Owner：Codex

### M1-T3 记忆文件骨架
- 状态：DONE
- 优先级：P0
- Owner：Codex

### M1-T4 固定人格种子接入
- 状态：DONE
- 优先级：P0
- Owner：Codex

### M1-T5 文本聊天闭环
- 状态：DONE
- 优先级：P0
- Owner：Codex

### M1-T6 Provider 架构整改
- 状态：DONE
- 优先级：P0
- Owner：Codex
- DoD：
  - [x] 支持 OpenAI-compatible / Anthropic Messages / MiniMax anthropic-like 三类适配
  - [x] Core 不再直接依赖厂商返回格式
  - [x] `thinking` / `text` / `usage` / `finishReason` / `providerMeta` 已归一化
  - [x] `verify:providers` / `verify:core` / `build` / `smoke` 全部通过
  - [x] `docs/llm-provider-adapters.md` 已落地

### M1-G1 施工位自测包
- 状态：DONE
- 优先级：P0
- Owner：Codex
- DoD：
  - [x] 代码整改完成
  - [x] 自测结果可复核
  - [x] 关键验证命令已跑

### M1-G2 第二视角真实验收
- 状态：DONE
- 优先级：P0
- Owner：MiniMax
- DoD：
  - [x] 隔离副本 + 真 key + 真 `MiniMax-M2.7` 验证已完成
  - [x] M1 真实 LLM 体验已验收，不是只靠 mock
  - [x] 已形成验收结论

### M1-G3 主控 closure
- 状态：IN-PROGRESS
- 优先级：P0
- Owner：小新
- DoD：
  - [ ] 把阶段结论正式回填到项目文档
  - [ ] 锁定 M1 通过口径
  - [ ] 宣布切主线到 M2

---

## M2 - 表达与在场感闭环

### M2-T1 语音模式按钮
- 状态：TODO
- 优先级：P1
- Owner：Codex
- DoD：
  - [ ] 可显式开启/关闭语音模式
  - [ ] 关闭后退回 `text-in / text-out`
  - [ ] UI 状态明确

### M2-T2 流式文本输出
- 状态：TODO
- 优先级：P1
- Owner：Codex
- DoD：
  - [ ] 回复自然流式出现
  - [ ] 不再整段突然蹦出

### M2-T3 TTS / 语音开口
- 状态：TODO
- 优先级：P1
- Owner：Codex
- DoD：
  - [ ] 语音输出尽量流式开口
  - [ ] 不等待整段文本完全生成后才开始说话
  - [ ] 正式 TTS 路线优先考虑 MiniMax WebSocket 候选

### M2-T4 在场感与状态同步
- 状态：TODO
- 优先级：P1
- Owner：Codex
- DoD：
  - [ ] speaking / listening / thinking 状态同步
  - [ ] 表情反馈自然
  - [ ] 轻动作反馈自然

### M2-T5 远景 / 近景切换
- 状态：TODO
- 优先级：P1
- Owner：Codex
- DoD：
  - [ ] 支持场景远景 / 近景切换
  - [ ] 主脑可判断当前是否该切近景

### M2-T6 三档 thinking mode
- 状态：TODO
- 优先级：P1
- Owner：Codex
- DoD：
  - [ ] 用户可配置 `fast / balanced / deep`
  - [ ] 各 provider 有映射策略
  - [ ] 真实测试 + 整改报告齐备

---

## M3 - 模型路由与稳定性闭环

### M3-T1 default model + fallback
- 状态：TODO
- 优先级：P1
- Owner：Codex
- DoD：
  - [ ] 默认模型额度耗尽时不直接卡死
  - [ ] 有 fallback 机制

### M3-T2 模型能力提示
- 状态：TODO
- 优先级：P1
- Owner：Codex
- DoD：
  - [ ] 不同模型能力有标签 / 提示
  - [ ] 低级模型风险做用户提示，不做死封

### M3-T3 provider 稳定性策略
- 状态：TODO
- 优先级：P1
- Owner：Codex
- DoD：
  - [ ] OpenAI-compatible / Anthropic / MiniMax 三类长期可用
  - [ ] 关键异常不直接把系统打死

---

## M4 - 轻主动与关系深化

### M4-T1 启动续接旧话题
- 状态：TODO
- 优先级：P1
- Owner：Codex

### M4-T2 会话内自然提旧事
- 状态：TODO
- 优先级：P1
- Owner：Codex

### M4-T3 轻主动节奏
- 状态：TODO
- 优先级：P2
- Owner：Codex
- DoD：
  - [ ] 主动不骚扰
  - [ ] 节奏可控

---

## 当前不做
- 文件权限
- 桌面整理
- 系统权限
- 编码助手能力
- 完整关系数值系统
- Live2D / VRM 重资产路线
- 成人向主线
- 完整 gateway / 平台化

---

## 当前下一步
1. 正式收 M1（主控 closure）
2. 开 M2 连续施工单
3. M2 完成后按同样规则做第二视角真实验收
