# SESSION-STATE

## 当前任务
M8-T1.5 快修收口（UI 截边 / BGM 音量 / TTS 稳定性 / memory summarizer）

## Owner
main + Codex CLI（按需）

## 状态
IN-PROGRESS

## 最新决策
- 单一开发真源锁定：`C:\Users\caipe\.openclaw\workspace\Vela`
- `D:\Vela-opensource` 只作 public release 副本，不再作为开发主线
- 已完成：CURRENT-ROUTE.md / TASKS.md 收敛；settings modal scroll 修复；onboarding version detection 修复

## 当前待修
1. 语音模式按钮贴底边，影响观感
2. 全屏模式底部介绍文案被截
3. BGM 音量调节无效
4. MiniMax WebSocket TTS 报 `invalid params, invalid message format`，导致时断时续
5. memory summarizer 报 `did not return JSON`

## 下一步 1-3 actions
1. 定位 App.jsx / styles.css 中底部布局与全屏布局问题
2. 定位 BGM volume 数据流与实时预览/持久化链路
3. 定位 MiniMax task start payload 与 summarizer JSON 解析逻辑

## Waiting on
无

## Blockers
暂无；若 MiniMax 协议细节不明，再补调研