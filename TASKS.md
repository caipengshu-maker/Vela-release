# TASKS.md - Vela

## 项目信息
- 项目名称：Vela
- 当前阶段：M4 Phase A 已完成并冻结，Phase B 待启动（context-first continuity）
- 项目责任人：小新
- 默认编码施工位：Codex（GPT-5.4 xhigh）
- 最后更新：2026-03-22

## 状态枚举
- TODO
- IN-PROGRESS
- BLOCKED
- IN-REVIEW
- DONE

## 当前总体目标
M4：让她像个人，不只是在场。记忆快速收窄，主力打体验层。

## 当前阶段范围（2026-03-22 Opus 审核后修正）
- Phase A 已关门（记忆地基 + 感知融合 + provider 降级 + UI 重做）
- GPT-5.4 定的 Phase B（context-first 大重构）经 Opus 审核降级为 Tier 1 小任务
- **当前优先级**：Tier 1 记忆收窄 → Tier 2 体验层打磨 → Tier 3 轻主动

## 当前额外施工约束
- 长任务默认派 **CLI 施工位**
- UI 审美明确避开"AI 工具味"，参考**二次元乙游**方向
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
- 状态：DONE
- 优先级：P0
- Owner：小新
- 关闭日期：2026-03-20
- DoD：
  - [x] 把阶段结论正式回填到项目文档
  - [x] 锁定 M1 通过口径
  - [x] 宣布切主线到 M2
- 结论：M1 通过。带连续人格 + 连续记忆 + 初始化流 + 真实 LLM 验证的文本伴侣原型已成立。Provider 架构已收口到可扩展方向。

---

## M2 - 管道闭环（流式文本 + 状态机 + thinking + 基础 fallback）

### M2-T1 流式文本输出
- 状态：DONE
- 优先级：P0
- Owner：Codex
- DoD：
  - [x] 回复自然流式出现，不再整段突然蹦出
  - [x] SSE / streaming 适配已覆盖 OpenAI-compatible 和 Anthropic Messages 两类 provider

### M2-T2 状态机骨架
- 状态：DONE
- 优先级：P0
- Owner：Codex
- DoD：
  - [x] `idle / listening / thinking / speaking` 四态切换正确
  - [x] UI 层消费状态机事件，状态可视

### M2-T3 三档 thinking mode
- 状态：DONE
- 优先级：P1
- Owner：Codex
- DoD：
  - [x] 用户可配置 `fast / balanced / deep`
  - [x] 各 provider 有映射策略
  - [x] 真实测试 + 整改报告齐备

### M2-T4 基础 model fallback
- 状态：DONE
- 优先级：P0
- Owner：Codex
- DoD：
  - [x] 默认模型请求失败 / 额度耗尽时自动尝试 fallback 模型
  - [x] 不直接卡死，用户可感知降级
  - [x] 低级模型风险做用户提示，不做死封

### M2-G1 施工位自测
- 状态：DONE
- 优先级：P0
- Owner：Codex
- DoD：
  - [x] `verify:core` 通过
  - [x] `verify:m2` 通过
  - [x] `smoke` 通过
  - [x] 主线自测已基于真实 MiniMax 文字链路重跑，不再是假绿

### M2-G2 第二视角真实验收
- 状态：DONE
- 优先级：P0
- Owner：k2p5
- DoD：
  - [x] 使用 **真实 MiniMax key / 真实 provider 链路** 完成主脑接入验证（不是 mock，不是假服务）
  - [x] 使用 **k2p5** 作为第二视角完成真实复验
  - [x] 验证通过后形成可审计验收结论，交由主控汇报并决定是否关闭 M2
- 结论：PASS（2026-03-20）。允许主控进入 M2 closure。报告：`reports/m2-k2p5-real-review-2026-03-20.md`

### M2-G3 主控 closure
- 状态：DONE
- 优先级：P0
- Owner：小新
- 关闭日期：2026-03-20
- DoD：
  - [x] 锁定 M2 仅收文字主链路的阶段边界
  - [x] 主控复核真实 MiniMax 接入 / `verify:core` / `verify:m2` / `smoke`
  - [x] 吸收 k2p5 第二视角真实验收结论
  - [x] 对用户输出 closure 汇报并宣布主线切到 M3
- 结论：M2 通过。文字主链路（流式文本 + 状态机 + thinking + 基础 fallback）已在真实 MiniMax 主脑下成立，并通过 k2p5 第二视角真实验收。TTS / ASR / MiniMax WebSocket 语音链路不计入 M2，通过后续统一进入 M3。

---

## M3 - 在场感闭环（语音 + 表情 + 动作 + 镜头）

### M3-T1 语音模式按钮
- 状态：DONE
- 优先级：P1
- Owner：Codex

### M3-T2 TTS 流式开口
- 状态：DONE
- 关闭日期：2026-03-21
- 优先级：P1
- Owner：Codex

### M3-T3 表情 / 动作轻反馈
- 状态：DONE
- 优先级：P1
- Owner：Codex
- 备注：VRM 骨骼全链路激活，4 种 blend shape + 12 种 emotion 多对一映射，动作/镜头补偿差异

### M3-T4 远景 / 近景切换
- 状态：DONE
- 优先级：P1
- Owner：Codex
- 备注：close 镜头已重新对焦到脸部中心（commit `6953a9f`）

### M3-T5 状态同步收口
- 状态：DONE
- 关闭日期：2026-03-21
- 优先级：P1
- Owner：Codex
- 备注：LLM 自主表演协议（结构化 JSON 前缀），12 种 emotion，流式前缀 buffer，关键词匹配降为 fallback（commit `a9192c9`）

### M3-G1 施工位自测
- 状态：DONE
- 优先级：P0
- Owner：Codex
- 备注：`vite build` 通过、`verify:core` 通过、parser 单元测试通过

### M3-G2 第二视角真实验收（技术）
- 状态：SKIPPED
- 优先级：P0
- Owner：k2p5
- 备注：MiniMax key 额度窗口限制，本轮跳过独立技术二验；M3 核心改动为前端协议层，不涉及 provider 链路变更

### M3-G3 用户体验验收（人耳/人眼）
- 状态：DONE
- 关闭日期：2026-03-21
- 优先级：P0
- Owner：舒彩鹏
- 备注：用户确认 close 镜头切换正常、情绪切换可感知；UI 遗留问题已记录归入 M4

### M3-G4 主控 closure
- 状态：DONE
- 关闭日期：2026-03-21
- 优先级：P0
- Owner：小新
- 结论：M3 通过。在场感闭环已成立：TTS 流式开口 + VRM 骨骼全链路 + LLM 自主表演协议 + 12 种 emotion + wide/close 镜头。UI 遗留归 M4。

### M3 遗留（归入 M4）
- 语音模式按钮占据过大空间
- 消息气泡过宽，LLM 文本回复没有发送动画
- "Vela兜底回应""在。"标签/按钮割裂
- 三个节奏按钮位置太靠前太突出
- "交给她"按钮措辞奇怪，建议改成"发送"/纸飞机图标
- 输入框可以再拉宽、圆角更大、背景更浅
- 聊天消息区需要滑动窗口
- 手臂姿态仍偏僵（"像军人"）
- idle 四肢微动（偶尔摸头发、换重心等）
- 全屏交互模式

---

## M4 - 让她像个人

### Tier 1：记忆收窄（小任务合并）

#### M4-T5 记忆收窄三件套
- 状态：TODO
- 优先级：P0
- Owner：Codex
- DoD：
  - [ ] `sessionMessageLimit` 12→40，prompt slice 改 budget-aware（不再硬编码 slice(-6)）
  - [ ] per-turn 摘要改 trigger-based（session 结束 / 长间隔 / 高情感轮次）
  - [ ] bridge summary：新会话开始时注入上次会话的紧凑摘要
  - [ ] `npm run build` / `smoke` / `verify:core` 通过
  - [ ] 零新 npm 依赖

### Tier 2：体验层打磨

#### M4-T6 idle 微动 + 手臂自然度
- 状态：TODO
- 优先级：P1
- Owner：Codex
- DoD：
  - [ ] 预设微动作循环（摸头发、换重心、视线游走、伸懒腰），15-30s 随机间隔
  - [ ] 用户输入时中断微动，回到 attentive 姿态
  - [ ] 肘部弯曲加大 + 左右不对称 + idle 时轻微摆动
  - [ ] 不再"站军姿"
  - [ ] `npm run build` 通过

#### M4-T7 UX 打磨（M3 遗留清理）
- 状态：TODO
- 优先级：P1
- Owner：Codex
- DoD：
  - [ ] 语音模式按钮缩小
  - [ ] 消息气泡收窄 + 新消息发送动画（fade-in + slide-up）
  - [ ] "Vela兜底回应""在。"标签清理
  - [ ] 节奏按钮降级到次要位置
  - [ ] 发送按钮改纸飞机/箭头图标
  - [ ] 输入框拉宽、圆角更大、背景更浅
  - [ ] 聊天消息区滑动窗口（DOM 保留最近 50 条）
  - [ ] `npm run build` 通过

#### M4-T8 全屏交互模式
- 状态：TODO
- 优先级：P2
- Owner：Codex
- DoD：
  - [ ] 支持全屏沉浸式聊天
  - [ ] avatar 占据更大画面
  - [ ] `npm run build` 通过

### Tier 3：轻主动

#### M4-T9 proactive engine
- 状态：TODO
- 优先级：P2
- Owner：Codex
- DoD：
  - [ ] 四种触发器（时间间隔 / 事件回忆 / 环境变化 / 模式偏离）
  - [ ] 频率限制（4h/条，2条/天，关系阶段系数）
  - [ ] 主动消息作为 Vela 发起的消息出现在聊天区
  - [ ] `npm run build` 通过

### 已完成

#### M4-T1 启动续接旧话题
- 状态：DONE
- 优先级：P1
- Owner：Codex

#### M4-T2 会话内自然提旧事
- 状态：DONE
- 优先级：P1
- Owner：Codex

#### M4-T4 provider 稳定性收尾
- 状态：DONE
- 优先级：P1
- Owner：Codex

#### M4-R1 感知融合 + Provider 优雅降级 + UI 重做
- 状态：DONE
- 关闭日期：2026-03-22
- 优先级：P0
- Owner：Codex / 小新

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
1. Tier 1：派 Codex 做记忆收窄三件套（bridge summary + context window 扩展 + trigger-based 摘要）
2. Tier 2：idle 微动 + 手臂自然度 + UX 打磨（M3 遗留清理）
3. 用户体验验收（Tier 1 + Tier 2 合并验收）
4. Tier 3：轻主动 proactive engine



