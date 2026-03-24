# CURRENT-ROUTE.md

> Vela 当前主线钉板。只回答：现在先做什么，什么别碰。

---

## 当前主线

### AX：Avatar eXperience 体验优化

M5.5 已收口（2026-03-24）。在 M6 打包前插入 **AX 体验优化**，专门解决 avatar 交互的疏离感。

**核心目标：从"能动"变成"像活的"。**

**详细方案**：`docs/AX-AVATAR-EXPERIENCE-PLAN.md`

**执行顺序（已锁定）：**

1. **AX-L1 开启已有能力**（配置层，1-2 天）
   - 开启 V2 表情系统
   - 放开镜头限制
   - Lip sync 增益
   - 全量验证 + 修复
2. **AX-L2 情绪联动**（3-5 天）
   - 情绪驱动镜头
   - TTS 语速/语调联动
   - 表情过渡平滑
   - 扩展动画库
   - emotion intensity
3. **AX-L3 Lip Sync 升级**（5-7 天）
   - HeadAudio viseme 集成
   - Fallback 链
4. **AX-L4 长期升级**（归入 M6-M7）

**施工规则**：全部走 Codex CLI `--yolo`，不用 subagent。

---

### M5.5：产品补全（已收口 2026-03-24）

M5 已收口（2026-03-22）。M6（Electron Builder 打包）延后。
在 M5 和 M6 之间插入 **M5.5 产品补全**，专门清理产品层缺口 + 提升首次体验质感。

**核心目标：从 demo 变成产品。**

**施工顺序（已锁定）：**

1. **T1 ASR 语音识别接入** — 解除断腿，语音交互闭环
2. **T10 开屏动画（K Studio Splash）** — 首次体验门面
3. **T5 UI 打磨** — M3/M4 遗留 UI 问题集合清理
4. **T11 Avatar 场景背景** — 视觉冲击最大的一刀（日/夜切换 + 轻粒子点缀）
5. **T12 环境 BGM** — 配合背景，体验翻倍
6. **T3 错误处理 UI** — 防止用户懵逼
7. **T2 设置界面 + T4 首次体验引导** — 连做
8. **T7 聊天记录持久化**
9. **T6 全屏沉浸模式**
10. **C1 P键剥离 + C2 summarizer 修复**
11. **T8 窗口状态记忆**
12. **T9 Lip Sync**

**图片资产生成方案：** Gemini 3.1 Pro Preview（lemonapi）生图 — K Studio logo 高清版 + avatar 场景背景插画。

---

## 已完成里程碑

### M5 closure（2026-03-22）
- T1 表情-动画-镜头预设系统（12 情绪 × blend shape 配方 + 动画绑定 + 镜头偏好 + 骨骼 overlay）
- T2 关系弧线系统（reserved→warm→close 三阶段 + 退阶机制 + 持久化）
- T4 情绪驱动动画切换（11 个 Mixamo FBX，情绪变化 crossfade 切换）
- 最终 commit：`04e2952`

### M4 closure（2026-03-22）
- T5 记忆收窄三件套
- T6b 手指 curl + idle 微动
- T6c Mixamo 动画系统（6→11 FBX，替换手写四元数）
- T7 UX 清理（chat header 删除 / 空状态标签 / grid 修复）
- T8 轻主动机制（动态定位 + 天气触发 + 随机问候 + 每日上限 3 次）
- docs 清理 + 分支清理
- 最终 commit：`a466890`

### M3 closure（2026-03-21）
- TTS 流式开口（MiniMax WebSocket MSE）
- VRM 骨骼全链路激活 + 自动轴向探测
- LLM 自主表演协议（结构化 JSON 前缀，12 种 emotion）
- wide/close 镜头（close 对焦脸部中心）

### M2 closure（2026-03-20）
- 流式文本 + 状态机 + thinking + 基础 fallback

### M1 closure（2026-03-20）
- 连续人格 + 连续记忆 + 初始化流 + 真实 LLM 验证

---

## 产品边界（不变）

- 一期 = 纯聊天 avatar 伴侣，不开放助手权限
- 技术路线：hybrid / local-first
- 本地不可让渡：记忆文件、主动机制、关系/人格状态、avatar 控制层
- 配置系统：单一主配置文件
- 审美方向：二次元乙游，不是 AI 工具
- 存储走 D 盘（大文件禁 C 盘）

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
- 重型记忆平台

---

## 一句话钉死

**M5.5 = 从 demo 变产品。已收口。下一站 AX 体验优化。**
