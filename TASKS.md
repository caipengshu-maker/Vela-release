# TASKS.md — Vela

## 项目信息
- 项目名称：Vela
- 当前阶段：M1 收口中（provider 架构整改已落地，待正式报告/closure），M2 准备中
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
先打穿一个最小事实：

**Vela 不是聊天框，而是一个有连续人格、连续记忆、语音入口和轻量在场感的 avatar 伴侣。**

## 当前额外施工约束
- `M1-T1 ~ M1-T5` 作为同一批主线任务，默认在**一个连续施工上下文**内推进，不碎成多个新会话
- 长任务默认派 **CLI 施工位**
- UI 审美明确避开“AI 工具味”，参考**二次元乙游**方向
- 若产出对 OpenClaw 有通用价值的源码，后续应评估是否抽象回馈
- 涉及真实 LLM / provider / thinking / 记忆回灌 / 权限边界的整改，必须走：施工位自测 → 第二视角真实验收 → 主控 closure；并以**真实测试 + 整改报告**作为完成条件

---

## M0 - 定义冻结

### M0-T1 项目定义冻结
- 状态：DONE
- 优先级：P0
- Owner：小新
- 描述：冻结 Vela 一期定位、边界、复杂度红线
- 产物：
  - `M0_FREEZE.md`
  - `PROJECT_PROPOSAL.md`

### M0-T2 主线板 / 任务板落地
- 状态：DONE
- 优先级：P0
- Owner：小新
- 描述：把 M0 冻结转成当前可执行主线
- 产物：
  - `CURRENT-ROUTE.md`
  - `TASKS.md`

---

## M1 - 最小伴侣闭环

### M1-T1 Vela 工程骨架初始化
- 状态：DONE
- 优先级：P0
- Owner：Codex
- 描述：初始化 Electron + Web UI 项目骨架，建立可运行桌面壳
- DoD：
  - [x] 可启动桌面应用
  - [x] 有基础聊天视图
  - [x] 有 avatar / 状态区域占位
  - [x] 有单一主配置文件骨架（如 `vela.jsonc`）

### M1-T2 Vela Core 最小闭环
- 状态：DONE
- 优先级：P0
- Owner：Codex
- 描述：实现最小本地中枢 `Vela Core`
- DoD：
  - [x] 记忆读写入口
  - [x] 人格/会话状态入口
  - [x] 上下文组装入口
  - [x] avatar 状态映射入口
  - [x] 不做复杂 gateway

### M1-T3 记忆文件骨架
- 状态：DONE
- 优先级：P0
- Owner：Codex
- 描述：实现一期最小记忆文件结构与会话摘要写入
- DoD：
  - [x] `profile` 级信息可存
  - [x] `session summary` 可写入本地
  - [x] 可读回最近若干摘要
  - [x] 目录结构简单清晰，不做过度设计

### M1-T4 固定人格种子接入
- 状态：DONE
- 优先级：P0
- Owner：Codex
- 描述：接入一期默认人格种子
- DoD：
  - [x] 有固定人格设定入口
  - [x] 对话中人格不明显漂移
  - [x] 结构允许未来替换人格，但当前只做一个人格

### M1-T5 文本聊天闭环
- 状态：DONE
- 优先级：P0
- Owner：Codex
- 描述：打通文本模式下的最小聊天闭环
- DoD：
  - [x] 能发送消息
  - [x] 能收到主脑回复
  - [x] 回复能带入最近摘要/人格上下文
  - [x] 用户主观感觉不像重开新会话

---

## M2 - 语音闭环

### M2-T1 语音模式按钮
- 状态：TODO
- 优先级：P1
- Owner：Codex
- 描述：实现按钮切换的语音交互模式
- DoD：
  - [ ] 可显式开启/关闭语音模式
  - [ ] 关闭后退回 text-in / text-out
  - [ ] UI 状态明确

### M2-T2 ASR 占位接入
- 状态：TODO
- 优先级：P1
- Owner：Codex
- 描述：先接最低成本可用 ASR 路线
- DoD：
  - [ ] 语音输入可转文本
  - [ ] 不阻塞主线
  - [ ] 后续可替换 provider

### M2-T3 TTS 占位接入
- 状态：TODO
- 优先级：P1
- Owner：Codex
- 描述：先接一期可用 TTS；正式路线保留 MiniMax WebSocket 候选
- DoD：
  - [ ] 回复可播报
  - [ ] speaking 状态可驱动 UI/avatar
  - [ ] provider 可替换

---

## M3 - 轻量在场感闭环

### M3-T1 占位 avatar / 状态 UI
- 状态：TODO
- 优先级：P1
- Owner：Codex
- 描述：在没有正式资产时，先做占位 avatar / 极简状态 UI
- DoD：
  - [ ] neutral / listening / thinking / speaking 状态可见
  - [ ] 至少 1-2 个情绪态可见
  - [ ] 不依赖正式美术资产

### M3-T2 说话状态联动
- 状态：TODO
- 优先级：P1
- Owner：Codex
- 描述：让 TTS / 回复状态驱动 UI 或 avatar 状态
- DoD：
  - [ ] speaking 时有明确反馈
  - [ ] thinking/listening 状态与交互一致
  - [ ] 不做重动作库

---

## M4 - 轻主动与连续性验证

### M4-T1 启动续接旧话题
- 状态：TODO
- 优先级：P1
- Owner：Codex
- 描述：应用启动或回到会话时，能自然延续之前语境
- DoD：
  - [ ] 能基于最近摘要生成自然开场
  - [ ] 不像硬检索数据库

### M4-T2 会话内自然提旧事
- 状态：TODO
- 优先级：P2
- Owner：Codex
- 描述：在会话中最小验证“会主动提起旧事”
- DoD：
  - [ ] 只做轻量相关性召回
  - [ ] 不做系统级推送
  - [ ] 不让用户觉得 creepy

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
1. 把 `M1-T1 ~ M1-T5` 交给 Codex 启动
2. 主控挂好 `SESSION-STATE.md`
3. 施工返回后做主控验收 + 必要时 Claude 复核
