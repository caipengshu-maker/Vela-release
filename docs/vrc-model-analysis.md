# VRC vs VRM Model Analysis Report — Eku ver1.1

**日期**: 2026-03-22
**分析方法**: Codex CLI FBX binary parser + VRM GLB parser
**源数据**: `C:\Users\caipe\AppData\Local\Temp\vela_fbx_analysis.json`

---

## 文件清单

| 文件 | 路径 |
|------|------|
| VRC 主体 FBX | `D:\BaiduNetdiskDownload\EKU\ver1.1\FBX\Eku.fbx` |
| VRC 服装 FBX | `D:\BaiduNetdiskDownload\EKU\ver1.1\AsteriaLycee_forEku_v1_1_0\PC\FBX\AsteriaLycee_Eku.fbx` |
| VRM (同源) | `D:\BaiduNetdiskDownload\EKU\ver1.1\Eku_PC_v1_1_1\Eku_PC_v1_1_1\VRM\Eku_VRM_v1_0_0.vrm` |

> VRM 文件和我们当前在用的 `D:\Vela\assets\avatars\eku\Eku_VRM_v1_0_0.vrm` 是同一个。

---

## 核心对比

| 维度 | VRM (当前使用) | FBX (VRC 源) | 服装 FBX |
|------|---------------|-------------|---------|
| 骨骼总数 | 53 (humanoid) / ~252 nodes | **222** | 107 |
| Blend Shapes | 37 | **739** | 3 |
| 手指骨骼 | 30 根 | 30 根 | — |
| 头发动态骨骼 | 0 | **~80+ 根** | — |
| 面部额外骨骼 | 0 | Cheek.L/R 等 | — |
| 饰品骨骼 | 0 | 蝴蝶结/领带/裙子等 | — |
| 格式 | VRM 0.0 (GLB) | FBX 7400 | FBX 7400 |

---

## 骨骼差异详解

### VRC FBX 独有的骨骼类别（VRM 中缺失）

1. **头发物理骨骼 (~80根)**
   - 前发: FrontHair_A/B/C/D × 4节
   - 侧发: SideHair_A/B.L/R × 3-5节, SideHair_EX × 4节
   - 后发: BackHair_A/B/C.L/R × 4节
   - 呆毛: Ahoge_1/2/3 × 3节
   - 单马尾: OneSideUp × 3节
   - 用途: VRC 里靠 Dynamic Bones / PhysBones 驱动物理摆动

2. **饰品骨骼 (~30根)**
   - 发饰: Acc_Hair_Tie × 多节
   - 耳朵: Ear_Root.R / Ear.R × 3节
   - 领带/裙子等: 未详细展开但包含在 222 根中

3. **面部骨骼**
   - Cheek.L / Cheek.R (及 .001 子骨骼)
   - VRM 只靠 blend shapes 做表情, 没有面部骨骼

### 手指骨骼（两者相同）

| 手指 | VRM | FBX |
|------|-----|-----|
| 左手 Index | LeftIndexProximal/Intermediate/Distal | Index Proximal.L / Intermediate.L / Distal.L |
| 左手 Thumb | LeftThumbProximal/Intermediate/Distal | Thumb Proximal.L / Intermediate.L / Distal.L |
| (其余同理) | 完全一致 | 完全一致 |

**结论: 手指骨骼数量和层级完全相同, 手指不自然是代码问题, 不是模型问题。**

---

## Blend Shapes 差异

- **VRC FBX: 739 个** — 包含极其丰富的面部表情、口型、眼神、腮红、流泪、牙齿等变形
- **VRM: 37 个** — 只保留了基本口型(A/I/U/E/O)、基本表情(Joy/Angry/Sorrow/Fun)、眨眼、视线
- **差距约 20 倍**, VRM 导出时大量 blend shapes 被裁剪

---

## 迁移可行性

### 路径

1. **Blender 导入 FBX → UniVRM 插件导出 VRM 1.0**
   - 最成熟的路径
   - 需要 Blender 3.x + cats-blender-plugin + UniVRM
   - 可选择性保留头发骨骼 (转为 VRM SpringBone)
   - 可保留更多 blend shapes
   - 估计工时: 4-8 小时 (含调试)

2. **Unity 导入 FBX → UniVRM 导出**
   - 需要 Unity 2019-2022 + UniVRM package
   - 更适合保留 VRC 的 PhysBones 设置并转为 VRM SpringBone
   - 估计工时: 2-4 小时

3. **直接在 three.js 加载 FBX (FBXLoader)**
   - 技术上可行, three.js 有 FBXLoader
   - 但失去 VRM 的标准化人形骨骼映射、表情映射、LookAt 等
   - 需要自己实现所有这些, 工作量大
   - 不推荐

### 收益评估

| 收益 | 影响 | 优先级 |
|------|------|--------|
| 头发物理摆动 | 高 — 显著提升"活物"感 | 中期 |
| 更丰富的表情 | 高 — 739 vs 37 个 blend shapes | 中期 |
| 面部骨骼 | 低 — 当前 blend shapes 够用 | 低 |
| 饰品物理 | 中 — 视觉锦上添花 | 低 |

### 风险

- VRM 导出可能丢失部分 VRC 特有的 shader 效果
- SpringBone 参数需要重新调试
- 模型大小可能显著增加 (更多骨骼/blend shapes)
- 需要验证 @pixiv/three-vrm 对 VRM 1.0 SpringBone 的支持程度

---

## 建议

1. **短期 (M4)**: 不迁移。手指问题是代码 bug (curl 旋转轴不对), 修代码优先。
2. **中期 (M5-M6)**: 用 Unity 路径导出增强版 VRM, 重点保留头发 SpringBone + 更多 blend shapes。
3. **长期**: 如果要做多服装/多姿态, 考虑直接加载 FBX + 自建骨骼映射层。

---

*分析数据由 Codex CLI FBX parser 生成, 存于 `C:\Users\caipe\AppData\Local\Temp\vela_fbx_analysis.json` (143KB)*
