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
把文本管道从"整段蹦出"升级为自然流式，同时打通基础 provider 稳定性，为后续语音和在场感奠基。

## 当前阶段范围冻结（2026-03-20 追加钉板）
- **M2 只做文字链路闭环**：流式文本、状态机、thinking、基础 fallback
- **TTS / ASR / MiniMax WebSocket 语音链路不属于 M2 通过条件**，统一放到 M3
- M2 仍要求真实 MiniMax 主脑接入与 k2p5 第二视角复验，但验收对象限定为**文字主链路**

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
- 状态：TODO
- 优先级：P1
- Owner：Codex
- DoD：
  - [ ] 可显式开启/关闭语音模式
  - [ ] 关闭后退回 `text-in / text-out`
  - [ ] UI 状态明确

### M3-T2 TTS 流式开口
- 状态：TODO
- 优先级：P1
- Owner：Codex
- DoD：
  - [ ] 语音输出流式开口，不等整段文本生成完才说话
  - [ ] 正式路线优先 MiniMax WebSocket
  - [ ] 默认 `emotion_mode=auto`；只有明确/约束/连续性场景才 force emotion
  - [ ] `speech-2.8-*` 遇 `whisper / fluent` 可安全降到 `speech-2.6-*`
  - [ ] 默认 `voiceId` 锁定 `Chinese (Mandarin)_Sweet_Lady`

### M3-T3 表情 / 动作轻反馈
- 状态：TODO
- 优先级：P1
- Owner：Codex
- DoD：
  - [ ] speaking / listening / thinking 状态驱动表情切换
  - [ ] 轻动作反馈自然
  - [ ] 情绪与表情/动作不出现明显错配
  - [ ] 主界面状态表达不再像技术 phase/debug 标签，而是更自然的人话/在场提示

### M3-T4 远景 / 近景切换
- 状态：TODO
- 优先级：P1
- Owner：Codex
- DoD：
  - [ ] 支持 `wide / close` 两态
  - [ ] 默认 wide，情绪/亲密时切 close
  - [ ] avatar 舞台成为主视觉，镜头变化肉眼可感知，不再像卡片插图

### M3-T5 状态同步收口
- 状态：TODO
- 优先级：P1
- Owner：Codex
- DoD：
  - [ ] TTS 播放状态、表情、动作、镜头与状态机完全联动
  - [ ] 无明显延迟或错位
  - [ ] UI 工具味显著下降，主界面优先表达“她在场”，不是系统控制台

### M3-G1 施工位自测
- 状态：TODO
- 优先级：P0
- Owner：Codex
- DoD：
  - [ ] `build` 通过
  - [ ] `smoke` 通过
  - [ ] Electron 真窗可见 EKU VRM
  - [ ] `idle / listening / thinking / speaking` 有最小可见差异
  - [ ] `wide / close` 可切且不抽风
  - [ ] 本轮 UI 整改未跑偏到 M4

### M3-G2 第二视角真实验收（技术）
- 状态：TODO
- 优先级：P0
- Owner：k2p5

### M3-G3 用户体验验收（人耳/人眼）
- 状态：TODO
- 优先级：P0
- Owner：舒彩鹏

### M3-G4 主控 closure
- 状态：TODO
- 优先级：P0
- Owner：小新

---

## M4 - 关系深化与轻主动

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

### M4-T4 provider 稳定性收尾
- 状态：TODO
- 优先级：P1
- Owner：Codex
- DoD：
  - [ ] OpenAI-compatible / Anthropic / MiniMax 三类长期稳定
  - [ ] 模型能力标签 / 提示完善
  - [ ] 关键异常不把系统打死

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
1. 主控按已补充的 M3 收口口径派第一轮连续施工：先稳运行面，再收 avatar 舞台 / 状态表达 / `wide-close` / 轻表情动作
2. Codex 完成 M3-G1 自测（`build` / `smoke` / 真窗 / 状态差异 / 镜头）
3. k2p5 做 M3-G2 技术二验
4. 舒彩鹏做 M3-G3 人眼/人耳体验验收
5. 小新做 M3-G4 closure
