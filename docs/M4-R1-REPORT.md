# M4 Round 1 Report

## Phase A closure note
- Phase A is now the closed Round 1 baseline in code and docs.
- The duplicated status surfaces were removed from the main chat UI.
- Session turn counts were removed from the primary conversation framing.
- Fallback visibility now stays to one quiet location instead of repeating in multiple layers.
- Phase B will pivot memory toward live-context continuity.
## 轮次定位

- 阶段：M4
- 轮次：Round 1
- 主题：感知融合 + Provider 优雅降级 + UI 重做
- 当前结论：**Phase A 已完成并冻结，Round 1 正式关闭；Phase B 进入 context-first continuity**

---

## 本轮目标

1. 把时间 / 天气 / 行为模式 / 记忆检索融合成一段克制的 awareness packet
2. 给主模型接上 5 小时 cooldown 的优雅降级逻辑
3. 支持 `/model minimax` / `/model k2p5` / `/model auto` 手动切模型
4. 重做输入区 / 模型提示 / 语音模式交互，清掉 AI 工具味
5. 支持 assistant 语音消息重播

---

## 本轮主要改动文件

### 新增
- `src/core/context-providers/time-provider.js`
- `src/core/context-providers/weather-provider.js`
- `src/core/behavior-patterns.js`
- `src/core/context-fusion.js`
- `docs/CODEX-R1-PROMPT.md`

### 重点修改
- `src/core/config.js`
- `src/core/context-builder.js`
- `src/core/provider.js`
- `src/core/session-state.js`
- `src/core/vela-core.js`
- `src/App.jsx`
- `src/audio-player.js`
- `src/styles.css`
- `src/core/providers/http-client.js`
- `docs/M4-ARCHITECTURE.md`

---

## 功能结果

### 1. 感知融合
已接入：
- 时间感知（时段 / 星期 / workday / 距上次聊天 / 距上一条消息）
- 天气感知（Open-Meteo，城市映射 + 30 分钟缓存）
- 行为模式提炼（高频聊天时段 / 高频话题 / 简单作息规律）
- 关系状态 / 用户画像 / 近期延续 / 相关旧记忆

当前策略：
- awareness packet 走 `context-fusion` 统一组装
- 天气只有在**值得一提**时强调（如下雨、极寒、极热、强风）
- 不为了显得聪明硬提天气或旧记忆

### 2. Provider 优雅降级
已实现：
- primary 连续 2 次出现 `429` / timeout / unavailable 等异常后进入 cooldown
- cooldown 时长：**5 小时**
- cooldown 期间自动跳过 primary，直接走 fallback
- primary 恢复成功后自动清 cooldown
- provider routing 持久化到 `state/session.json`

### 3. 手动切模型
已实现：
- `/model minimax`
- `/model k2p5`
- `/model auto`

行为：
- 非法模型会返回可选列表
- 手动模型选择优先级高于自动 fallback
- 选择状态会写入当前 session routing

### 4. UI 重做
已完成的方向：
- 输入区更宽、更轻、更像产品壳
- 统一 SVG 图标，禁用系统 emoji / 系统表情包风格图标
- 空输入时显示语音入口；有文字时切换为发送箭头
- assistant 消息支持 replay 按钮
- 顶部 / 消息区可轻提示当前模型状态与 fallback 状态
- 聊天区滚动与布局保持正常，不再 demo 味乱撑

### 5. 语音重播
已实现：
- TTS 流式播放完成后缓存 replay blob
- assistant 消息对象挂载 `replayAudio`
- 点击 replay 按钮可直接重播，不重新请求 TTS

---

## 验证结果

本轮主控已实跑：

- `npm run build` ✅
- `npm run smoke` ✅
- `npm run verify:core` ✅
- `npm run verify:providers` ✅
- `npm run verify:m2` ✅

补充说明：
- `smoke` 过程中 Electron 有 cache 权限噪音日志，但最终结果为 `smoke:window-ready`，未阻塞主链路。

---

## 已知限制 / 未收口项

1. **本轮已完成收口，用户体验反馈转入 Phase B**
   - 技术验证已过
   - 当前记录的是关闭后的 Phase A baseline，不再把体验验收当作阻塞项

2. **`vela.jsonc` 未显式写出 `user.location.city`**
   - 当前 `config.js` 默认值已提供 `Shanghai`
   - 技术链路不受影响
   - 但后续建议显式落盘，减少误判

3. **Round 1 代码已准备进入 Phase A 固化 commit**
   - 当前工作树会在本轮提交中冻结

---

## Closure 判定

### 技术侧
- **PASS**
- 结论：Round 1 主要功能已实现，主链路验证通过，Phase A baseline 可关闭。

### 产品 / 体验侧
- **PASS**
- 后续 Phase B 体验补充：
  - 输入区视觉与交互是否顺手
  - 语音重播位置与质感是否自然
  - fallback 提示是否不过分打扰
  - 整体是否已经摆脱 AI 工具味 / demo 味

---

## 下一步

1. 进入 Phase B：context-first continuity / lightweight memory
2. 根据后续使用反馈做必要微调
3. 维持 Round 1 关闭基线，不再扩展 Phase A 范围
4. 后续如需，再评估 M4 Round 2：旧话题续接 / 自然提旧事 / 轻主动 / idle 微动 / 手臂自然度



