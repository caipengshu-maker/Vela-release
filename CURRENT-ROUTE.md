# CURRENT-ROUTE.md

> Vela 当前主线钉板。只回答：现在先做什么，什么别碰。

---

## 当前主线

### M5.5 + AX 已全部收口（2026-03-25）

所有 M5.5 产品补全项 + AX 体验优化项均已完成或确认无需修复。

**M5.5 完成清单：**
- T1 ASR ✅ · T10 开屏 ✅ · T5 UI 打磨 ✅
- T11 场景背景 ✅ · T12 BGM ✅
- T3 错误处理 ✅ · T2 设置界面 ✅ · T4 首次引导 ✅
- T7 桥接摘要 ✅ · T6 全屏沉浸 ✅
- T8 窗口状态 ✅ · T9 Lip Sync ✅
- C2 summarizer ✅（已有 raw fallback，不需要额外修）
- P1 告别微表情 ✅ · P2 思考动画联动 ✅

**AX 完成清单：**
- L1 V2 表情 + 镜头 + morph audit ✅
- L2 情绪联动（TTS + 表情过渡 + 动画扩展 + intensity）✅
- L3 HeadAudio viseme lip sync ✅

### 剩余尾单（不阻塞主线推进）

| 项 | 状态 | 备注 |
|---|---|---|
| C1 P键 demo 剥离 | TODO | vrm-avatar-stage.jsx 里的 P 键 toggle，发布前必须删 |
| P3 消息时间戳 | TODO | P2，体验打磨 |
| P4 关系阶段视觉暗示 | TODO | P2，体验打磨 |
| P5 空聊天氛围文案 | TODO | P2，体验打磨 |
| DEEP-01 relationship intimate 枚举 | TODO | memory-store.js 的 evaluateRelationship 仍可产出 intimate，relationship.js 不认 |
| BGM 音乐源 | BLOCKED | 等用户定路线 |

---

## 下一站：M6 产品化打包

- Electron Builder 打包
- 首次体验打磨
- 稳定性加固
- 发布流程

---

## 已完成里程碑

### AX closure（2026-03-25）
- L1 V2 表情 + 镜头 + morph audit（`976cda8` `761bbbb`）
- L2 情绪联动 TTS/表情/动画/intensity（`b160ed6` `2b52177` `9d335c7`）
- L2 补充：P3 体验层四件套（`c4c6350` `39cb4ee` `4634576`）
- L3 HeadAudio viseme lip sync（`d925664`）

### M5.5 closure（2026-03-24 施工，2026-03-25 确认收口）
- Phase 1-7 全部完成（详见 TASKS.md）

### M5 closure（2026-03-22）
- 表情-动画-镜头预设 / 关系弧线 / 情绪驱动动画

### M4 closure（2026-03-22）
- 记忆收窄 / 手指动画 / Mixamo 系统 / UX 清理 / 轻主动机制

### M3 closure（2026-03-21）
- TTS 流式 / VRM 骨骼 / LLM 表演协议 / 镜头切换

### M2 closure（2026-03-20）
- 流式文本 / 状态机 / thinking / fallback

### M1 closure（2026-03-20）
- 连续人格 + 连续记忆

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
- 重型主动推送系统 / 复杂关系数值 / 重型记忆平台
- Live2D 重资产路线 / 多角色平台 / 成人向主线
- 完整 gateway / 插件平台 / 向量数据库

---

## 一句话钉死

**M5.5 + AX 全部收口。下一站 M6 产品化打包。**
