# Vela Avatar 体验优化方案

> 里程碑代号：**AX**（Avatar eXperience）
> 创建日期：2026-03-24
> Owner：小新（主控）
> 施工位：Codex CLI（复杂逻辑全部走 CLI，不用 subagent）

---

## 现状诊断

### 三大断点
1. **表情系统只用了 10%**：VRM 37 个 blend shapes，当前只用 8 个基础键。`emotion-presets.js` 定义了 12 套精细组合表情（`extra_shy`/`extra_tear`/`mouth_ω`/`face_cheek_puku` 等），但 `EMOTION_PRESETS_V2 = false`，全部没生效。
2. **镜头不跟情绪走**：`normalizeAvatarState()` 强制非 speaking 状态 camera = wide。害羞/亲密等情绪的近景完全无效。
3. **口型只有一个维度**：振幅驱动 mouth_open，没有 viseme（aa/ee/oh 嘴型区分），看着像打哈欠。

---

## AX-L1：开启已有能力（配置层）

| ID | 任务 | 做什么 | 预期效果 |
|---|---|---|---|
| AX-L1-1 | 开启 V2 表情 | `EMOTION_PRESETS_V2 = true` + 确保 raw morph → expressionManager 链路畅通 | 害羞脸红+垂眼、难过泪光+眉毛下垂、开心露虎牙 |
| AX-L1-2 | 放开镜头限制 | 去掉 `normalizeAvatarState()` 里 camera 强制 wide 的逻辑，让 emotion preset 的 cameraHint 生效 | thinking 可远景、affectionate/shy 可近景 |
| AX-L1-3 | Lip sync 增益 | 振幅放大系数 ×1.5~2，lerp 响应加快到 0.4 | 嘴巴动得更明显 |
| AX-L1-4 | 验证 + 修复 | 开启后逐个 emotion 测试，修复可能的 blend shape 名称不匹配 | 12 个 emotion 全部视觉可区分 |

**预计工期**：1-2 天
**施工方式**：Codex CLI `--yolo`

---

## AX-L2：情绪-动画-镜头-语音联动

| ID | 任务 | 做什么 | 预期效果 |
|---|---|---|---|
| AX-L2-1 | 情绪驱动镜头 | emotion preset 的 cameraHint 接入主链路，speaking 和 non-speaking 都生效 | 画面有"导演感" |
| AX-L2-2 | TTS 语速/语调联动 | 根据 emotion 调 MiniMax TTS 的 speed/pitch：happy→快+高、sad→慢+低、whisper→慢+轻 | 声音有情绪 |
| AX-L2-3 | 表情过渡平滑 | emotion 切换从硬切改为 500ms lerp crossfade | 不会突然变脸 |
| AX-L2-4 | 扩展动画库 | 给 shy/nervous/confident/sleepy 补充 Mixamo FBX | 动作更丰富 |
| AX-L2-5 | emotion intensity | LLM performance JSON 加 `intensity` 字段（0-1），控制表情/动作强度 | 微笑 vs 大笑可区分 |

**预计工期**：3-5 天
**施工方式**：Codex CLI
**前置**：AX-L1 验收通过

---

## AX-L3：Lip Sync 升级

| ID | 任务 | 做什么 | 预期效果 |
|---|---|---|---|
| AX-L3-1 | 评估 HeadAudio | 调研 `met4citizen/HeadAudio`，AudioWorklet 从音频流实时检测 viseme，纯浏览器端 | 确认兼容性 + 集成成本 |
| AX-L3-2 | 集成 viseme lip sync | 替换当前振幅驱动，改用 viseme 驱动（aa/ee/oh/ou/闭合） | 嘴型真的跟发音走 |
| AX-L3-3 | Fallback 链 | HeadAudio 不可用时退回振幅模式 | 不降级用户体验 |

**预计工期**：5-7 天
**施工方式**：Codex CLI
**前置**：AX-L1 + AX-L2 验收通过
**备选方案**：如果 MiniMax TTS WebSocket 返回 viseme/phoneme 时间戳，优先用原生数据

---

## AX-L4：长期体验升级（归入 M6-M7）

| ID | 任务 |
|---|---|
| AX-L4-1 | VRM 模型升级（Unity 重新导出，更多 blend shapes + 头发物理） |
| AX-L4-2 | 动作编排系统（LLM tool call 触发特定动作序列） |
| AX-L4-3 | 关系阶段影响表情风格（reserved 克制、close 夸张） |
| AX-L4-4 | 呼吸/心跳微动与情绪联动 |

---

## 执行规则
- 所有 AX 施工走 **Codex CLI `--yolo`**，不用 subagent
- 每层完成后必须用户验收，验收通过才推下一层
- 回退点：每层一个 git tag（`ax-l1-done` / `ax-l2-done` / `ax-l3-done`）
