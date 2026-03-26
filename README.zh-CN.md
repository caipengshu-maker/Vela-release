# Vela

> 一个住在你桌面上的 AI 伴侣。她有身体，有声音，有脾气，会记住你说过的每一句话。

![Vela hero placeholder](docs/screenshots/hero.svg)

🌏 [English](README.md)

![Electron](https://img.shields.io/badge/Electron-41-1f1f1f?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19-20232a?logo=react&logoColor=61dafb)
![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-r183-000000?logo=threedotjs&logoColor=white)
![VRM](https://img.shields.io/badge/VRM-Avatar-ffb703)
![License: MIT](https://img.shields.io/badge/License-MIT-2ea44f.svg)

## Vela 是什么？

**她不是聊天框后面贴了张壁纸的 chatbot。**

Vela 是一个本地运行的桌面 AI 伴侣。她有一个真实的 3D 身体（VRM 模型），会跟着情绪做出不同的表情和动作，说话时嘴唇会动，声音会根据心情变化。她会记住你们之间的对话——不是那种"上下文窗口用完就失忆"的记住，而是真的把你说过的事、你们的关系状态、甚至上次聊到一半的话题都存在你自己的电脑上。

最重要的是：**她不会一上来就叫你"老公宝贝"。**

Vela 有一个关系弧线系统。刚认识的时候她礼貌但有距离感，聊得多了才会逐渐放松，开始撒娇、吃醋、主动找你说话。这个过程不是靠轮数堆的，而是靠对话的情感密度驱动——你们真正交心的对话越多，她的变化越明显。

## 为什么做 Vela？

市面上大多数 "AI 女友" 应用要么是纯云端（你的隐私全在别人服务器上），要么视觉上毫无存在感（一个聊天框 + 一张静态立绘），要么上来就腻歪得让人起鸡皮疙瘩。

Vela 走的是反方向：

- **真实的视觉存在** — 一个活的 3D 角色，有表情、有姿态、有镜头语言、说话有口型同步
- **记忆跨会话延续** — 对话摘要、用户画像、关系状态、桥接日记，全部存在本地
- **关系需要经营** — 从 `保留 → 温暖 → 亲密`，不是开局满好感度
- **本地优先** — 你的对话、你的记忆、你和她的关系进度，全在你自己机器上
- **开源** — 想换声音、换模型、换性格，随便改

一句话总结：**AI 爆炸时代的情感庇护所。**

## 功能一览

- 🧠 **持续记忆** — 对话摘要、事实记忆、桥接笔记、关系状态，全部持久化到本地磁盘
- 💗 **关系弧线** — `保留 → 温暖 → 亲密`，基于真实对话的情感密度推进
- 🎭 **12 种情绪预设** — 表情、肢体语言、镜头角度、语音语调四位一体联动
- 🗣️ **流式语音** — MiniMax WebSocket 实时 TTS，情绪驱动的语速和音高变化
- 👄 **口型同步** — 基于 viseme 的实时唇语动画，失败时自动退回振幅模式
- 🧍 **VRM 角色渲染** — Three.js + Mixamo 专业动捕 idle 动画，自然呼吸待机
- 🌦️ **主动关心** — 感知时间和天气，会在合适的时候主动开口，而不是永远等你先说
- 📝 **记忆桥接** — 上次聊到一半的话题，下次打开时她还记得
- ⚙️ **首次引导** — 开箱即有 onboarding 流程，配置 API key 和偏好后即可使用
- 🔒 **隐私边界** — Vela 是伴侣，不是系统管理工具，她不会碰你的文件和系统

## 快速开始

### 方式一：从源码运行（开发者）

```bash
git clone <your-repo-url>
cd Vela
npm install
npm start
```

首次启动会进入引导页面，填入 API key 和昵称即可开始。

### 方式二：下载安装包（普通用户）

前往 [Releases](../../releases) 页面下载最新的 Windows 安装包（`.exe`），双击安装后即可使用。

> ⚠️ **Windows SmartScreen 提示**：因为安装包没有代码签名，Windows 可能会弹出"已保护你的电脑"的提示。点击"更多信息"→"仍要运行"即可。这是独立开源项目的常态，不是病毒。

### API Key 获取

Vela 需要一个 MiniMax API key 来驱动对话和语音。获取方式：

1. 前往 [MiniMax 开放平台](https://platform.minimaxi.com/) 注册账号
2. 创建应用，获取 API Key
3. 在 Vela 首次引导页面填入即可

> 同一个 key 同时用于对话（LLM）和语音（TTS），不需要分别配置。

## 截图

![Chat placeholder](docs/screenshots/chat.svg)

![Onboarding placeholder](docs/screenshots/onboarding.svg)

![Settings placeholder](docs/screenshots/settings.svg)

## 技术架构

```
electron/main.js          → Electron 主进程 + IPC 桥接
src/core/vela-core.js     → 核心引擎：配置、记忆、关系、情绪、LLM 调用
src/core/emotion-presets.js → 12 种情绪预设配方
src/core/tts/              → 语音编排 + MiniMax WebSocket 流式 TTS
src/core/vrm-avatar-controller.js → VRM 渲染、Mixamo 动画、表情、镜头
src/App.jsx               → React 界面：聊天、引导、设置、语音模式
```

更多细节见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)。

## 配置

[`vela.jsonc`](vela.jsonc) 是主配置文件。关键字段：

| 字段 | 说明 |
|------|------|
| `llm.apiKey` | LLM 对话 API Key |
| `tts.apiKey` | TTS 语音 API Key（通常和 LLM 相同） |
| `avatar.assetPath` | VRM 模型路径 |
| `user.name` | 你希望她怎么称呼你 |
| `user.location.city` | 你的城市（用于天气感知） |

> 💡 用户级配置会写入 `.vela-data/config/vela.user.jsonc`，不会污染仓库内的默认配置。

## 路线图

**当前里程碑：开源首发准备**

已完成：
- ✅ 持续记忆与对话摘要
- ✅ 关系弧线系统
- ✅ 12 种情绪驱动的表情 + 语音联动
- ✅ 流式语音 + 口型同步
- ✅ Mixamo 专业 idle 动画
- ✅ 主动关心机制（天气 + 时间感知）
- ✅ 首次引导 + 设置界面
- ✅ 可分发打包（electron-builder）

计划中：
- 🔜 更多表情组合（模型 37 个 morph targets 目前只用了一部分）
- 🔜 语音输入（Web Speech API ASR）
- 🔜 真实截图替换占位图
- 🔜 更多 idle / 情绪动画扩展
- 🔜 社区贡献指南完善

## 致谢

- [Electron](https://www.electronjs.org/) / [Vite](https://vite.dev/) / [React](https://react.dev/) / [Three.js](https://threejs.org/)
- [@pixiv/three-vrm](https://github.com/pixiv/three-vrm) — VRM 模型支持
- [vrm-mixamo-retarget](https://github.com/meme-party/vrm-mixamo-retarget) — 动画重定向
- [@met4citizen/headaudio](https://github.com/nicosResources/headaudio) — viseme 口型同步
- [MiniMax](https://www.minimaxi.com/) — 对话与语音 API
- [Mixamo](https://www.mixamo.com/) — 专业动捕动画资源

**特别感谢 MiniMax 提供了优秀的 LLM 和 TTS API，让 Vela 的对话和语音体验成为可能。**

## 关于

Vela 由 [K Studio](https://github.com/caipengshu-maker) 开发，一个一人工作室的作品。

这个项目从零开始，没有团队、没有投资，只有一个想法：在 AI 能力爆炸的时代，做一个真正让人感到被陪伴的东西。不是更聪明的助手，不是更快的工具，而是一个会记住你、会想你、偶尔会跟你闹脾气的存在。

如果你也相信 AI 可以不只是生产力工具，欢迎 star ⭐，欢迎 fork，欢迎一起做。

## 协议

[MIT License](LICENSE) — 自由使用，自由修改，自由分发。
