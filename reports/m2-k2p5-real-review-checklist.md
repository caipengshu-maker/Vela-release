# M2 k2p5 第二视角真实复验清单

日期：2026-03-20
阶段：M2（仅文字链路）
角色：k2p5 = 第二视角真实验收位

## 复验目标
确认 Vela 的 M2 **文字主链路** 在真实 MiniMax 主脑下已成立，并且可以进入主控 closure 评估。

## 本轮明确不验
- TTS / ASR
- MiniMax WebSocket 语音链路
- 语音模式最终体验
- 表情 / 动作 / 镜头的 M3 级体验验收

## 必验点
1. **真实主脑**
   - 实际运行 provider 必须是 `minimax-messages`
   - 不能是 mock
   - 不能是 fallback 代打

2. **真实流式文本**
   - 存在真实 `assistant-stream-delta`
   - 不要求必须 >= 2 个 delta
   - 允许真实 provider 只回 1 个完整 delta
   - 最终 stream content 必须与 assistant 最终内容一致

3. **状态机成立**
   - 至少覆盖 `thinking -> speaking -> listening`
   - 状态切换自洽，不是死状态或乱跳

4. **fallback 机制成立**
   - 主脑失败时能切到 `k2p5`
   - 用户可感知降级，而不是直接卡死

5. **三板斧一致**
   - `npm run verify:core` 通过
   - `npm run verify:m2` 通过
   - `npm run smoke` 通过
   - 且不能依赖 `missing-api-key -> mock -> ok` 这种假绿

## 当前已知事实（供复验参考）
- Vela 已临时支持从 `vela.jsonc` 直接读取 `llm.apiKey` / `llm.fallback.apiKey`
- 当前 `vela.jsonc` 已临时接入真实 MiniMax / k2p5 key
- 已确认：
  - `verify:core` 通过
  - `verify:m2` 通过
  - `smoke` 通过
- 已确认真实 MiniMax 可能只返回 1 个完整 text delta，因此旧版“>=2 delta”口径已废止

## 输出要求
复验结论必须明确给出：
- PASS / FAIL
- 证据点
- 若 FAIL，指出是代码问题、测试问题、还是验收口径问题
- 若 PASS，明确说明是否允许主控进入 M2 closure
