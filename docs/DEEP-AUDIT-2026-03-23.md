# Vela Deep UX/Logic Audit — 2026-03-23

## P0

### DEEP-01: 关系状态机分裂
- memory-store evaluateRelationship() 会升到 intimate
- relationship.js clampStage() 只认 reserved/warm/close，不认则回退 reserved
- 用户体验：关系莫名降级
- Fix: 统一关系阶段枚举，要么全链路支持 intimate，要么移除 + 迁移

### DEEP-02: TTS 队列卡死
- speech-orchestrator.js dispatchSegment() 失败未收敛
- pendingSegments 永久挂起，语音状态假死
- Fix: try/catch/finally + 失败时 decrement + reset session

### DEEP-03: 记忆静默丢失
- memory-summarizer.js summarizeTurn() 解析错误吞异常返回 null
- 整轮记忆消失
- Fix: 失败分级（raw fallback + 重试 + 计数告警）

## P1

### DEEP-04: 系统提示矛盾
- context-builder.js 首行 JSON 协议 vs "只输出用户可见内容"冲突
- 控制 JSON 可能泄露给用户
- Fix: 双通道输出协议或改 function-call

### DEEP-05: ASR 能力探测假阳性
- asr/provider.js getAsrCapabilities() 不检查真实可用性
- Fix: 同步检测 SpeechRecognition ctor

### DEEP-06: JSONL 坏行静默丢弃
- memory-store.js + memory-retriever.js parseJsonLines()
- Fix: quarantine 文件 + 计数告警

### DEEP-07: fact 去重覆盖降智
- memory-store.js loadFacts() 只按 key 去重，新低质量值覆盖旧高质量值
- Fix: 去重键加 type，按 confidence+createdAt 选优

### DEEP-08: 默认关系阶段不一致
- memory-store defaultRelationship() = warm vs relationship.js clampStage() = reserved
- Fix: 统一默认值

## P2

### DEEP-09: openFollowUps 过期残留
### DEEP-10: 召回缓存无清理策略
### DEEP-11: 错误码自由文本，路由/熔断不够精准

---

## UX Audit (系统级)

### UX-01 (P0): 启动失败无重试
### UX-02 (P0): 小窗口布局裁切
### UX-03 (P1): splash logo 硬编码路径
### UX-04 (P1): splash 不等 bootstrap
### UX-05 (P1): loading 状态空白
### UX-06 (P1): 自动吸底太暴力
### UX-07 (P1): 语音模式不检查 ASR 可用性
### UX-08 (P1): ASR 失败无反馈
### UX-09 (P1): 消息换行被吞
### UX-10 (P2): Onboarding 步骤标签误导
### UX-11 (P2): UI 文案中英混杂
### UX-12 (P2): 图标无文字提示
