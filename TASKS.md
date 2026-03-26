# Vela Tasks — M8

## T1.5: 体验修补 🔄
Priority: P0 | Est: 2-3 days | Owner: main + Codex CLI

### Bug Fixes
- [x] Settings 滚动修复 — `grid-template-rows: auto 1fr auto` + `min-height:0`（`7391844`）
- [x] Onboarding 版本检测 — `CONFIG_SCHEMA_VERSION` + `hasCompletedCurrentOnboarding()`（Codex 运行中）

### i18n 双语系统
- [ ] Onboarding 增加第 0 步：语言选择（中文 / English）
- [ ] 所有 UI 硬编码字符串外置到 `locales/zh-CN.json` + `locales/en.json`
- [ ] 轻量 i18n 函数 `t('key')` 全局替换
- [ ] 语言选择保存到 config `app.language`，全局生效
- [ ] TTS 联动：选英语自动切英语 voice，选中文保持甜妹线

### TTS 声音试听
- [ ] 设置页列出可用声音（MiniMax 声音列表 / Web Speech API getVoices()）
- [ ] 点击试听：调 MiniMax 同步 HTTP TTS 或 Web Speech API 播放样本
- [ ] 用户选中后保存 voiceId

## T3: 门面打磨 ⏳
Priority: P1 | Est: 1 day | Owner: TBD

- [ ] 真实截图替换 docs/screenshots/ 下 SVG 占位
- [ ] 从 public repo 做完整陌生机冒烟
- [ ] README 补 GIF 演示或短视频链接
- [ ] 修复冒烟中发现的阻塞问题
- [ ] 同步更新到 public repo + patch release

## T2: 自定义 Avatar ⏳
Priority: P2 | Est: 3-5 days | Owner: TBD

### 核心功能
- [ ] 设置界面增加 "更换 Avatar" 入口
- [ ] 支持拖入 / 文件选择器导入 .vrm 文件
- [ ] 导入后复制到 `.vela-data/avatars/` 持久化
- [ ] Config 记录用户选择的 avatar 路径

### 兼容性检测与 Fallback
- [ ] 加载时自动检测：humanoid bones / morph targets / VRM 版本
- [ ] Morph 审计：列出匹配的 / 缺失的 emotion preset morphs
- [ ] 缺失 morph → 退回安全表情（calm only）
- [ ] 缺失 viseme morph → 退回振幅 lip sync
- [ ] Mixamo 动画 retarget 兼容性检测
- [ ] 不兼容时给用户可读提示，不 crash

### 默认体验不变
- [ ] 首次安装仍使用 Eku VRM
- [ ] 自定义 avatar 为可选进阶功能

---

## T1: 多 LLM + TTS 提供商支持 ✅
Completed: 2026-03-26 | Commit: `2f1915f`

16 个文件，+2355 / -766。新增 WebSpeech TTS provider / 多 provider onboarding + settings。

---

## 已完成里程碑归档

<details>
<summary>M1-M7 已完成（点击展开）</summary>

- M1 基础骨架 ✅
- M2 LLM 接入 ✅
- M3 声画同步 ✅
- M4 体验打磨 ✅ (commit a466890)
- M5 体验深化 ✅ (AX-L1/L2/L3 + P3)
- M5.5 产品补全 ✅ (ASR/开屏/背景/BGM/设置/onboarding)
- M6 Electron 打包 ✅ (Vela-0.1.0-Setup.exe)
- M7 开源首发 ✅ (v0.1.0, 2026-03-26)

</details>
