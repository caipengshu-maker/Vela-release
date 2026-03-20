# M3 Minimal Presence Spec

> 目的：把 `EKU` VRM 从“能加载的站尸”推进到“可控的最小在场体”。
> 状态：implementation-ready
> 范围：**只做最小表现层接入**，不碰 TTS 主链，不扩成人格/关系系统。

---

## 1. 本轮目标

本轮只解决一件事：

**让 Vela 内出现一个可控、稳定、不抽风的 VRM avatar 壳。**

验收关键词：
- 能显示
- 不崩材质
- 能轻微活起来
- 状态 / 表情 / 镜头不打架

不是本轮目标：
- 语音联动闭环
- ASR
- 大幅动作
- 完整 idle 动画系统
- 复杂情绪系统
- 商用准备

---

## 2. 当前资产结论（已验证事实）

资产：`D:\BaiduNetdiskDownload\EKU\VRM\Eku_VRM_v1_0_0.vrm`

已验证：
- 真加载成功
- VRM 0.0 / glTF 2.0
- 53 根 humanoid bones
- 17 组表情：
  - `neutral`
  - `aa / ih / ou / ee / oh`
  - `blink / blinkLeft / blinkRight`
  - `happy / angry / sad / relaxed`
  - `lookUp / lookDown / lookLeft / lookRight`
- MToon ShaderMaterial + outline
- 许可证：`commercialUssageName = Disallow`，`Redistribution_Prohibited`

结论：
- **技术上可用于 M3 最小接入**
- **商业上当前不可直接商用**

---

## 3. M3 最小接入边界

### 3.1 必做

1. **VRM 基础显示**
   - 在 Vela 左侧 avatar 面板渲染真实 VRM，不再只是 CSS silhouette
   - 默认站姿可见，镜头默认 `wide`

2. **最小状态驱动**
   - `idle`
   - `listening`
   - `thinking`
   - `speaking`

3. **最小表情驱动**
   - `calm -> neutral / relaxed`
   - `happy -> happy`
   - `concerned -> relaxed + 轻微 look-at`
   - `sad -> sad`
   - `angry -> angry`
   - `playful -> happy + tiny head tilt`

4. **最小动作感**
   - 自动眨眼
   - 轻微呼吸/头部微动（幅度极小）
   - `listening` 时轻微 settle
   - `thinking` 时轻微 head drop / still
   - `speaking` 时允许极轻嘴型驱动（若简单可做）或先只做 speaking 状态表现

5. **镜头两态**
   - `wide`
   - `close`
   - 仅按现有策略层规则切换，不新增第三种镜头

### 3.2 不做

- 不接完整 body 动画系统
- 不做手势库
- 不做走路/转身
- 不做复杂物理调参 UI
- 不做 Live2D / VRC 双路线兼容
- 不把语音/TTS 强塞进本轮 closure

---

## 4. 裁决顺序（必须锁死）

表现层永远按这个顺序消费：

1. **状态机**：`idle / listening / thinking / speaking`
2. **emotion plan**
3. **camera plan**
4. **action / expression**

硬规则：
- 不允许 provider 原始流直接驱动动作
- 不允许 TTS 反向决定主情绪
- 不允许动作层覆盖状态机主状态
- 不允许为了“更生动”破坏一致性

一句话：

**先不崩，再生动。**

---

## 5. 预设映射（最小版）

### 5.1 状态 → 基础体态

- `idle`
  - camera: `wide`
  - expression: `neutral`
  - motion: `still`

- `listening`
  - camera: `wide`
  - expression: `relaxed`
  - motion: `listen-settle`

- `thinking`
  - camera: `wide`
  - expression: `neutral`
  - motion: `tiny-head-drop`

- `speaking`
  - camera: 吃策略层 `wide / close`
  - expression: 吃情绪映射
  - motion: `soft-speaking`

### 5.2 emotion → expression / motion

- `calm`
  - expression: `neutral`
  - motion: `still`

- `happy`
  - expression: `happy`
  - motion: `tiny-nod`

- `affectionate`
  - expression: `relaxed`
  - motion: `soft-lean`

- `playful`
  - expression: `happy`
  - motion: `tiny-head-tilt`

- `concerned`
  - expression: `relaxed`
  - motion: `soft-lean`

- `sad`
  - expression: `sad`
  - motion: `head-down-light`

- `angry`
  - expression: `angry`
  - motion: `still`

- `whisper`
  - expression: `relaxed`
  - motion: `soft-lean`
  - camera: 优先 `close`

---

## 6. 技术实现建议

### 6.1 路线

使用：
- `three`
- `@pixiv/three-vrm`

在 Electron renderer 内做一个独立 `VrmAvatarPanel` / `AvatarCanvas` 组件。

### 6.2 资产放置

不要继续直接硬读 `D:\BaiduNetdiskDownload\...`

建议：
- 在 `D:/Vela/assets/avatars/eku/` 下建立运行时资产位
- 先复制一份当前验证通过的 `Eku_VRM_v1_0_0.vrm`
- Vela 配置里追加 avatar asset path（若当前没配就加最小字段）

原因：
- 运行时资产不能长期绑百度网盘下载目录
- 便于后续换模 / 多角色 / 打包策略

### 6.3 组件职责

- `interaction-policy.js`
  - 继续负责 plan，不负责 three 渲染

- `avatar-state.js`
  - 继续负责 UI-facing avatar state

- 新 `vrm-avatar-controller`（可新文件）
  - 负责：
    - load VRM
    - update expressions
    - update lookAt / head micro motion
    - camera distance switch
    - blink loop

- `App.jsx`
  - 只做 state → avatar panel props 传递
  - 不内嵌复杂 three 逻辑

---

## 7. 最小验收标准

### G1 技术可用
- [ ] Vela 内真实显示 EKU VRM
- [ ] 无明显贴图丢失 / 黑模 / 崩材质
- [ ] `wide / close` 可切
- [ ] 状态切换时不报错

### G2 一致性可用
- [ ] `thinking` 不会笑脸乱跳
- [ ] `sad` 不会配开心表情
- [ ] `angry` 不会配歪头卖萌
- [ ] `listening / speaking` 至少肉眼可区分

### G3 观感过线
- [ ] 不再是纯站尸
- [ ] 但也没有抽搐感 / 过度表演感
- [ ] 可以作为后续 TTS 联动的稳定壳

---

## 8. 派工提示（给 Codex）

> 任务：在不改 M1-M4 路线定义的前提下，为 Vela 实现 M3 最小 VRM 表现层接入。使用已验证可加载的 `Eku_VRM_v1_0_0.vrm`，目标是让 avatar 面板从 CSS silhouette 升级为真实 three-vrm 渲染，并完成最小状态/表情/镜头联动：`idle / listening / thinking / speaking` + `wide / close` + 基础 emotion → expression/motion 映射。不要接 TTS 主链，不要做大动作系统，不要让 provider 原始流或 TTS 层直接驱动动作/镜头主逻辑。先求稳定一致，再求更丰富表现。

---

## 9. 一句话钉死

**这一轮不是做“会演戏的她”，是先做“不会出戏的她”。**
