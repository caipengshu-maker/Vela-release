# CURRENT-ROUTE.md

> Vela 当前主线钉板。只回答：现在先做什么，什么别碰。

---

## 当前主线

### M4：让她像个人，不只是在场

M3 已关门（2026-03-21）。M4 Phase A 已关门（2026-03-22）。

**当前方向：体验优先，记忆收窄。**

GPT-5.4 定的 Phase B（context-first continuity 大重构）经 Opus 审核后降级——核心论点没错（长上下文优先、记忆不膨胀），但把配置调参包装成了一整个 Phase，优先级错位。记忆是地基，但用户看到的是房子。

**修正后的 M4 优先级（从高到低）：**

#### Tier 1：快速收尾（小任务，不值得叫 Phase）
- bridge summary（跨会话续接摘要）
- context window 扩展（`sessionMessageLimit` 12→40，prompt slice 6→budget-aware）
- per-turn 摘要改 trigger-based（session 结束 / 长间隔 / 高情感轮次才触发）
- 这三件事合在一起是一个 Codex 任务，不是一个 Phase

#### Tier 2：体验层打磨（M4 主力应该打在这里）
- idle 微动（偶尔摸头发、换重心、视线游走、伸懒腰，15-30s 间隔）
- 手臂自然度（肘部弯曲加大 + 左右不对称 + idle 时轻微摆动）
- UX 打磨（M3 遗留）：
  - 语音模式按钮缩小
  - 消息气泡收窄 + 发送动画
  - "Vela兜底回应""在。"标签清理
  - 节奏按钮降级到次要位置
  - 发送按钮改纸飞机/箭头
  - 输入框拉宽、圆角更大、背景更浅
  - 聊天消息区滑动窗口
  - 全屏交互模式

#### Tier 3：轻主动（体验层站住之后）
- proactive engine（时间间隔 / 事件回忆 / 环境变化 / 模式偏离）
- 频率限制（4h/条，2条/天，关系阶段系数）
- 自发回忆（>7天高情感情节偶尔浮现）

#### Tier 4：联网搜索 + 深度记忆（M4 尾声或 M5）
- 联网搜索接入
- 更丰富的关系演化
- 记忆编辑 UI

---

## 已完成里程碑

### Phase A（已关门，2026-03-22）
- 感知融合（时间 / 天气 / 行为模式 / 记忆 / 关系状态）
- Provider 优雅降级（2 次失败熔断 + 5 小时 cooldown + fallback routing）
- `/model minimax|k2p5|auto` 手动切模型
- UI 重做（SVG 化、输入区重构、fallback/model 轻提示、assistant replay）
- 重复状态面板清理（session turn count 移除、fallback 只在生效时显示）
- 技术验证全通过（`build` / `smoke` / `verify:core` / `verify:providers` / `verify:m2`）

### M3 closure（2026-03-21）
- TTS 流式开口（MiniMax WebSocket MSE）
- VRM 骨骼全链路激活 + 自动轴向探测
- LLM 自主表演协议（结构化 JSON 前缀，12 种 emotion）
- wide/close 镜头（close 对焦脸部中心）
- 用户体验验收通过

### M2 closure（2026-03-20）
- 流式文本 + 状态机 + thinking + 基础 fallback
- k2p5 第二视角真实验收通过

### M1 closure（2026-03-20）
- 连续人格 + 连续记忆 + 初始化流 + 真实 LLM 验证

---

## Git 状态（2026-03-22 对齐）

- 分支：`main`（唯一活跃分支）
- 最新 commit：`fa0e9b4` — m4: phase-a closure
- remote：`origin/main` 已同步
- worktree：clean
- 遗留分支：`feat/m2-pipeline`（历史残留，可清理）
- 共 20 个 commit，从 M0 到 M4 Phase A 全程可追踪

---

## 产品边界（不变）

- 一期 = 纯聊天 avatar 伴侣，不开放助手权限
- 技术路线：hybrid / local-first
- 本地不可让渡：记忆文件、主动机制、关系/人格状态、avatar 控制层
- 配置系统：单一主配置文件
- 审美方向：二次元乙游，不是 AI 工具
- 零新 npm 依赖原则
- 存储走 D 盘

---

## 当前不做（碰了就算跑偏）

- 文件权限 / 桌面整理 / 系统权限 / 编码助手
- 重型主动推送系统
- 复杂关系数值系统
- Live2D / VRM 重资产路线
- 多角色平台
- 成人向主线
- 完整 gateway / 插件平台
- 向量数据库 / embedding 模型
- 重型记忆平台（per-turn 全量摘要、无限扩字段的 episode/facts/user-model）

---

## 一句话钉死

**M4 = 让她像个人。记忆快速收窄，主力打体验层。**
