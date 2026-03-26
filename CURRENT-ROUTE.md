# Vela Current Route

## 仓库真源

| 定位 | 路径 | Remote | 用途 |
|---|---|---|---|
| **开发主线** | `C:\Users\caipe\.openclaw\workspace\Vela` | `caipengshu-maker/Vela` (private) | 所有开发在这 |
| 发布副本 | `D:\Vela-opensource` | `caipengshu-maker/Vela-release` (public) | 只在发版时推净版，平时不碰 |

## Active Milestone: M8 — 让 Vela 活在更多人手里

### 核心目标
降低用户门槛 + 扩大可用性 + 建立传播点。v0.1.0 已开源，但当前绑定固定 avatar，陌生用户留存率受限。

### 已完成里程碑
- M1 基础骨架 ✅
- M2 LLM 接入 ✅
- M3 声画同步 ✅
- M4 体验打磨（记忆/动画/手指/主动机制）✅
- M5 体验深化（表情V2/关系弧线/lip sync/情绪联动）✅
- M5.5 产品补全（ASR/开屏/背景/BGM/设置/onboarding）✅
- M6 Electron 打包 ✅
- M7 开源首发 ✅ (`v0.1.0`, 2026-03-26)
- M8-T1 多 LLM/TTS 提供商 ✅ (`2f1915f`, 2026-03-26)

### M8 进行中

#### T1.5: 体验修补 🔄
- [x] Settings 滚动修复 (`7391844`)
- [x] Onboarding 版本检测 — Codex 运行中
- [ ] i18n 双语系统（onboarding 第 0 步选语言 → 全局 `t('key')` → locale 文件 → TTS voice 联动）
- [ ] TTS 声音试听（Settings 列出可用声音 → 点击试听 → 保存 voiceId）

#### T3: 门面打磨（1天）
- [ ] 真实截图替换 SVG 占位（hero / chat / onboarding / settings）
- [ ] 从 public repo 完整陌生机冒烟（clone → install → dev → onboarding → 对话）
- [ ] README 补 GIF 演示或视频链接
- [ ] 确认 .gitignore 无遗漏
- [ ] 修复冒烟中发现的任何阻塞问题

#### T2: 自定义 avatar（3-5天）— 传播点
- [ ] 用户可拖入任意 VRM 文件替换默认 avatar
- [ ] 自动检测骨骼 / morph targets / 兼容性
- [ ] Morph 映射 graceful fallback（缺失的表情退回安全默认）
- [ ] Viseme 映射 graceful fallback（缺失的嘴型退回振幅模式）
- [ ] 设置界面增加 avatar 管理入口
- [ ] 首次体验保持默认 Eku 不变，自定义为可选

### 施工顺序
T1.5（2-3天）→ T3（1天）→ T2（3-5天）

### 不做（M8 明确砍掉）
- ❌ macOS / Linux 移植（用户基数不够）
- ❌ 插件系统（太早）
- ❌ 多角色切换（先让一个角色体验到位）
- ❌ 移动端（归 M9+）

### 架构决策
- LLM 和 TTS 完全解耦，用户可独立选择
- Provider adapter 模式已有，扩展不改架构
- 自定义 avatar 走 graceful degradation，不要求所有 VRM 都完美适配
