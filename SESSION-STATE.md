## 当前任务
Vela M5-T4 情绪驱动动画切换

## Owner
Codex CLI（session `briny-kelp`，pid 5860）

## 状态
IN-PROGRESS — Codex 施工中，超时 1 小时

## 上下文
- M5-T1 表情预设系统 DONE（commit `93723c4`）
- M5-T2 关系弧线系统 DONE（commit `3cf43b5` + fix `e16a2b6`）
- M5-T3 语音体验：TTS 流式 + 重播按钮已有，lip sync 精度放后面
- M5-T4：情绪 → Mixamo 动画切换 + P键demo增强 + blend shape 过渡平滑

## Spec
`scripts/codex-m5-t4-emotion-animation-prompt.md`

## 验收步骤
1. build ✅
2. verify:core ✅
3. P 键 demo 模式目视：情绪切换时动画+表情同步变化
4. commit + push

## Blockers
无

## 用户要求
- dev-only 快捷键标记 `// DEV-ONLY` 便于后期清除
- Codex 超时口径放宽到 1 小时
