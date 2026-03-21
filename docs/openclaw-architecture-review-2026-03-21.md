# OpenClaw 组织架构与阶段审视报告

日期：2026-03-21  
范围：基于 `docs/ref-anthropic-long-running-agents.md`、OpenClaw workspace 规则文件、`memory/2026-03-20.md`、`memory/2026-03-21.md`、Vela 的 `CURRENT-ROUTE.md` 与 `TASKS.md` 做只读分析。

一句话判断：OpenClaw 已经不是 Anthropic 文里那种“长运行 coding harness”级别，而是在往“有主脑、有岗位池、有记忆分层、有异步调度”的操作系统化 agent 走。好处是组织力明显更强；代价是系统复杂度已经开始逼近它自己的治理上限，尤其是真源分裂、调度脆弱和验收口径不稳三个点。

## 一、Anthropic 文章核心洞察提炼

### 1. 长运行 agent 的核心问题

核心不是“模型会不会写代码”，而是“模型跨多个上下文窗口还能不能持续做对事”。真正的问题有四个：

- 会话失忆。每次新 session 都像第一次接手。
- 容易早早宣布 DONE。
- 容易把环境搞脏，下一轮接不起来。
- 容易把“看起来差不多”误判成“已经验收通过”。

### 2. 两阶段方案

Anthropic 的解法很克制，只分两层：

- `initializer agent`：第一次进入仓库时，不急着施工，先把可持续施工的地基搭好。
- `coding agent`：后续每一轮只做增量推进，然后留下结构化进展。

这套方案的重点不是“多聪明”，而是“下一轮接手成本足够低”。

### 3. 关键机制

- `feature list`：把需求扩成结构化特性清单，最好用 JSON，且默认全部是 failing，防止 agent 自我感动式完工。
- incremental progress：一次只啃一个 feature，做完就提交，不大包大揽。
- `progress file`：用一个持续更新的进展文件桥接上下文窗口。
- git history：提交历史不是装饰，是第二层记忆。
- testing：必须像真实用户那样验证，最好有浏览器自动化，不然“假通过”会非常多。

### 4. 失败模式与对应解法

Anthropic 点得很准：

- 过早宣布胜利：用 feature list 把“还没过的东西”钉死。
- 留下坏环境：每轮先看 progress 和 git，再跑基本验证。
- 功能没测就标完成：只有真实验证后才能把 failing 改成 passing。
- 每轮都先花时间研究怎么启动项目：用 `init.sh` 固化启动路径。

本质上，这不是提示词技巧，而是给 agent 建一套“最小工作记忆 + 最小工程纪律”。

## 二、OpenClaw 当前架构映射

### 总体判断

OpenClaw 对 Anthropic 那套机制，基本都能找到对应物，而且不少地方做得更重。问题不在“有没有”，而在“对应物太多，且分散在多层文档和多类工位里”。

| Anthropic 机制 | OpenClaw 对应实现 | 现状判断 |
| --- | --- | --- |
| progress file | `CURRENT-ROUTE.md` / `TASKS.md` / `SESSION-STATE.md` / daily memory / `MEMORY.md` | 有，而且更强；但不是单文件，真源冲突风险高 |
| initializer prompt | `AGENTS.md` / `SOUL.md` / `USER.md` / `IDENTITY.md` | 有，而且是体系化 prompt stack；但体量更大、职责更容易重叠 |
| git history | 全程 Git 管理 +阶段 closure commit | 强于 Anthropic 的“建议使用”；已经是硬规则 |
| single vs multi-agent | `main` + 固定岗位池 + subagent | 已超出 Anthropic 文章；组织能力强，但调度复杂度也高 |
| session bridging | heartbeat / cron / watchdog / memory maintenance | 比 Anthropic 更完整；但也更依赖纪律与调度质量 |
| feature list | `CURRENT-ROUTE.md` + `TASKS.md` + M0/M1-M4 阶段边界 | 功能上成立；格式上不够硬，仍偏人工维护 |
| testing | 施工位自测 → 第二视角真实验收 → 主控 closure，部分阶段加用户验收 | 治理强；执行不够整齐，出现过 `SKIPPED` |

### 1. 记忆系统 vs progress file

Anthropic 用一个 `claude-progress.txt` 做跨 session 桥。OpenClaw 不是一个桥，而是五层：

- `CURRENT-ROUTE.md` / `TASKS.md`：项目当前主线与阶段板。
- `SESSION-STATE.md`：活任务 scratchpad。
- `memory/YYYY-MM-DD.md`：当天与近期原始过程。
- `MEMORY.md`：长期规则、组织约束、偏好、架构结论。
- `AGENTS.md` 明确了读取顺序：项目内 route/status docs -> `SESSION-STATE.md` -> recent daily memory -> `MEMORY.md`。

判断：

- 这套分层比 Anthropic 的单 progress file 更成熟，因为它区分了“活状态”和“长期宪法”。
- 但它也明显更脆。Anthropic 的问题是信息少；OpenClaw 的问题是信息面太多。
- 2026-03-21 已经出现高优先级约束：不要再新增平行规划 md，只能回填现有真源文件。这说明系统已经感受到真源膨胀压力，不是理论风险，是现实风险。

### 2. `AGENTS.md` / `SOUL.md` / `USER.md` vs initializer agent prompt

Anthropic 的 initializer 更像“为这个仓库生成一次开场白”。OpenClaw 的这组三件套不是开场白，而是长期操作系统：

- `AGENTS.md`：会话启动、记忆分层、真源优先级、调度、heartbeat、dispatch contract。
- `SOUL.md`：行为气质和边界。
- `USER.md`：用户偏好、调度偏好、验收偏好、风险偏好。

判断：

- 这比 Anthropic 的 initializer 更强，因为它把“怎么做事”沉淀成了长期制度，而不是一次性 prompt。
- 但它也更重，容易变成“制度文件堆叠”。一旦职责边界不严，就会从 initializer 演化成 prompt 迷宫。

### 3. Git 管理 vs Anthropic 的 git history

Anthropic 把 git 当第二记忆层。OpenClaw 已把 Git 变成硬规矩：

- 用户明确要求开发阶段全程 Git 管理，过程要可追踪、可回滚、可 review。
- Vela 的 M1/M2/M3 closure 都能在 commit 历史上看到清晰节点。
- 阶段推进与 `CURRENT-ROUTE.md` / `TASKS.md` 回填经常绑定到同一轮收口里。

判断：

- 这一项 OpenClaw 已经做得比 Anthropic 更强。
- 但组织判断和调度决策仍有不少只写进 memory，不一定能从 git log 直接复盘。这意味着 git 还没完全承担“组织历史”的角色，更多承担“代码历史”的角色。

### 4. 多工位调度 vs single / multi-agent

Anthropic 对单 agent 还是多 agent 还在开放讨论。OpenClaw 已经明确选边：

- `main` 是唯一对外主脑。
- 后台是固定岗位池。
- 2026-03-20 进一步收紧为“单对外主脑 + 后台固定岗位池”。
- 同时强制区分 `seat / model / toolline / surface`，避免把岗位、模型、工具线和聊天表面混成一锅。

判断：

- 这是 OpenClaw 最大的组织升级点。它不再把 agent 当单体，而是当组织。
- 但也是当前最大的复杂度来源。2026-03-20 还在专门纠偏 seat/model/toolline/surface 混淆，说明这套组织口径刚定稳，还没经过长周期压测。

### 5. Heartbeat / Cron vs session bridging

Anthropic 主要解决“下一轮 session 怎么接上”。OpenClaw 则把“异步闭环”也纳入系统：

- `AGENTS.md` 明确 heartbeat vs cron 的分工。
- heartbeat 还承担 memory maintenance。
- 异步派单要求主动同步进展，必要时挂 watchdog。
- 用户明确偏好低频 heartbeat，减少主控上下文污染。

判断：

- 这比 Anthropic 更完整，因为它不只桥接上下文，还桥接时间。
- 风险是：Anthropic 的桥接靠固定文件，OpenClaw 的桥接很大一部分靠调度纪律。纪律一松，就会出现异步失联、heartbeat 噪音或 watchdog 漏挂。

### 6. `TASKS.md` / `CURRENT-ROUTE.md` vs feature list

这两份文件是 OpenClaw 最接近 Anthropic feature list 的东西：

- `CURRENT-ROUTE.md` 负责主线、阶段边界、什么别碰。
- `TASKS.md` 负责阶段任务、DoD、验收关口、当前下一步。

判断：

- 作用上是成立的，而且比单 feature list 更有项目管理味道。
- 但 Anthropic 特别强调 JSON 这种不容易被模型随手改坏的结构化格式。OpenClaw 目前还是 Markdown，强依赖人工维护。
- 证据已经出现：`CURRENT-ROUTE.md` 已切到 M4，但 `TASKS.md` 头部元信息仍写着“当前阶段：M1 收口中”“最后更新：2026-03-19”。这不是小瑕疵，这是“真源文件内部自相矛盾”的信号。

### 7. 验收流程 vs testing

Anthropic 的 testing 核心是“别信模型嘴，信真实测试”。OpenClaw 在治理上更进一步：

- 施工位自测。
- 第二视角真实验收。
- 主控 closure。
- M3 还加了用户人耳/人眼体验验收。

判断：

- 设计上强于 Anthropic，因为它把“测试”升级成“分层验收”。
- 但执行上并不完全稳定。`TASKS.md` 里 `M3-G2` 技术二验状态是 `SKIPPED`，理由是 key 额度窗口限制；最后靠用户体验验收和主控 closure 关门。
- 这说明 OpenClaw 已经知道 testing 重要，但还没把“什么情况下可以跳过、什么情况下绝不能跳过”做成硬门禁。

## 三、OpenClaw 的优势

### 1. 比 Anthropic 做得更好的地方

- OpenClaw 已经把“长运行 agent”从单个 harness 升级成“主脑 + 岗位池 + 调度规则 + 记忆分层”的组织系统。
- 它不只关心代码施工，还关心 owner、closure、watchdog、异步同步、quiet hours、主控职责边界。
- 它把 `MEMORY.md` 明确成“宪法”，把项目路由文档明确成“作战板”，这比一个 progress file 更接近真实工程组织。
- 它有明确的多层验收链：施工位、第二视角、主控、必要时用户体验。这一点比 Anthropic 的“测试”更接近产品级交付。

### 2. Anthropic 没提，但 OpenClaw 已经解决的问题

- seat / model / toolline / surface 的分层问题。Anthropic 文章还停留在 agent 层，OpenClaw 已经开始治理“组织名词污染”。
- 异步任务闭环问题。Anthropic 更多是 session 内推进，OpenClaw 已经有 watchdog、heartbeat、cron 的机制分工。
- 组织反熵规则。比如“如无必要，勿增实体”“共享 workspace 避免第二真源”“文档/路径迁移要全链更新”，这些都是 Anthropic 文里没展开但在真实系统里很关键的治理层能力。
- 主控角色定位。OpenClaw 已明确主控更像 CTO / 总控，而不是默认施工位，这对长期扩张很重要。

## 四、OpenClaw 的差距与风险

### 1. 还没做好的关键机制

- 没有一个真正短小、单点、结构化、机器友好的项目 progress artifact。现在是多文件协同，不是单文件桥接。
- 没有 Anthropic 那种稳定的“每轮开工 checklist”：读 git / 读进展 / 启环境 / 跑基础验证 / 发现坏环境先修。
- feature list 仍偏 Markdown 管理，缺少结构化状态字段，容易出现口径漂移。
- testing / 验收规则还不够硬，至少在 M3 上出现了 `SKIPPED`。

### 2. 当前架构的潜在风险点

- 主脑过重。OpenClaw 设计上强调主控少下场，但实际上大量组织判断、路由修正、真源收敛、验收吸收仍集中在 `main`。
- 外围工具链不稳。`acpx`、Codex CLI 上游、provider 配额、不同执行面的怪癖都在吃系统韧性。
- 文档体系有自然膨胀倾向。2026-03-21 已明确禁止再随手新建平行规划 md，说明系统已经感受到“治理文档比项目本身长得还快”的危险。

### 3. 记忆系统的真源冲突风险

OpenClaw 已经意识到这个问题，并且制定了真源优先级，但风险依然高：

- `CURRENT-ROUTE.md` / `TASKS.md` 是项目真源。
- `SESSION-STATE.md` 是活任务真源。
- daily memory 记录真实过程。
- `MEMORY.md` 记录长期制度。

这四层只要有一层更新不及时，就会打架。现在已经有两条证据：

- `TASKS.md` 头部元信息滞后。
- 2026-03-21 专门要求不要再新增平行规划文档。

所以问题不是“会不会冲突”，而是“冲突已经开始出现，只是当前还可人工收束”。

### 4. 调度策略的脆弱点

- OpenClaw 现在依赖路由判断正确。判断错一次，可能不是单次返工，而是把错误口径写进 memory 和 route docs。
- 多工位提升了吞吐，也放大了交接损耗。每多一个 seat，多一层 owner/状态/真源同步成本。
- 当上游不稳时，岗位职责会回流到 `main`。2026-03-20 已出现 `Opus` 不稳、职责由 `main` 代行；2026-03-21 又出现 Codex CLI 429/503 中断。说明岗位池现在还没稳到“岗位失效时组织不抖”。

## 五、阶段审视：M0-M3 回顾

### M0：定义冻结

核心交付物：

- `M0_FREEZE.md`
- `PROJECT_PROPOSAL.md`
- `CURRENT-ROUTE.md`
- `TASKS.md`

关键决策：

- 一期先做纯聊天 companion，不做万能助手。
- hybrid / local-first。
- 不做完整 gateway，只做 Vela Core。
- 先砍复杂度，再谈能力。

被证明是对的：

- 砍 scope 这件事完全正确。后面 M1-M3 能关门，前提就是 M0 先把坑堵住了。
- “不要把伴侣产品做成工具箱”这个判断，到 M3 仍然是对的。

需要修正的：

- 初版阶段切分不够稳，后续出现了 M1-M4 里程碑重排，说明最初的阶段边界仍偏粗。

### M1：最小伴侣闭环

核心交付物：

- 工程骨架
- Vela Core 最小闭环
- 记忆文件骨架
- 固定人格种子
- 文本聊天闭环
- provider 架构整改
- 真实 LLM 验收

关键决策：

- 一期先证明“连续人格 + 连续记忆 + 文本闭环”。
- provider 要先抽象好，不然后面全是返工。
- 不能用 mock 冒充通过。

被证明是对的：

- M1 先打文本伴侣闭环是对的，后面所有阶段都站在它上面。
- provider 先收口也是对的，不然后面 M2/M3 会更乱。

需要修正的：

- `OpenClaw config -> Vela 运行态` 的 key 注入断链问题，说明配置接入边界在 M1/M2 交界处考虑得不够严。

### M2：管道闭环

核心交付物：

- 流式文本输出
- 状态机骨架
- thinking mode
- 基础 fallback
- 真实 MiniMax 主脑验证
- `k2p5` 第二视角真实复验

关键决策：

- 把 M2 收紧为“文字主链路”，把语音和表现层后移到 M3。
- 把 fallback 提前到 M2，而不是等到 M3。
- 不开“第二策略层大模型”新坑。

被证明是对的：

- 这是一次正确的阶段切分修正。M2 如果继续混语音和表现层，后面只会更乱。
- 真实 provider 验证中暴露出的单 delta、mock 假阳性等问题，反过来证明“真实验收优先于脚本自嗨”这个决策是对的。

需要修正的：

- M2 一度出现 route、状态、运行态不一致，差点把“没真通”误判成“可 closure”。
- 这说明 OpenClaw 现有真源体系在工程压力下还会漏同步。

### M3：在场感闭环

核心交付物：

- 语音模式按钮
- MiniMax WebSocket TTS 流式开口
- VRM 表情 / 动作轻反馈
- wide / close 镜头切换
- LLM 自主表演协议
- 用户人耳/人眼体验验收

关键决策：

- M3 不是做“能动的 demo”，而是做“在场感”。
- 把用户体验验收独立出来，不只看技术验收。
- 把最初的 inline tag 方案否掉，改为结构化前缀 JSON + 分隔符协议。

被证明是对的：

- “在场感”作为独立阶段非常对。否则语音、表情、镜头会一直沦为挂件。
- 结构化前缀 JSON 明显比 inline tag 更稳，这是一次正确纠偏。
- M3 最终能在 2026-03-21 关门，说明这条阶段设计是有效的。

需要修正的：

- `M3-G2` 技术二验被 `SKIPPED`，说明验收门还不够硬。
- M3 的 UI 遗留项较多，说明“表现层闭环”和“产品壳收口”的界面还不够锋利。

## 六、建议：下一步优化方向

| 优先级 | 建议 | 影响范围 | 实施难度 | 预期收益 |
| --- | --- | --- | --- | --- |
| P0 | 不新增新文件，直接把 `CURRENT-ROUTE.md` 和 `TASKS.md` 的头部改成机器可校验的结构化块，至少包含 `current_phase`、`last_updated`、`active_owner`、`next_step` | 全项目真源 | 低到中 | 立刻降低真源漂移，补上 Anthropic feature list / progress file 的“硬结构”优势 |
| P0 | 固化“开工前 checklist”：读 route、读 `SESSION-STATE.md`、看最近 git log、启动环境、跑最小 smoke；发现坏环境先修再开发 | 所有长任务 | 低 | 把当前依赖经验的 session bridging 变成可执行纪律 |
| P0 | 把验收门按变更类型写死：涉及 provider / memory / prompt 协议 / 权限边界时，`第二视角真实验收` 不得 `SKIPPED`；额度不够就记 `BLOCKED`，不要软过 | 验收体系 | 中 | 直接减少“带风险 closure” |
| P1 | 收紧记忆写入职责：项目进展只回填 `CURRENT-ROUTE.md` / `TASKS.md` / `SESSION-STATE.md`；daily memory 只记过程事实；`MEMORY.md` 只留制度和长期约束 | OpenClaw 全局记忆 | 低 | 降低多真源互相抢职责 |
| P1 | 给 dispatch 和 closure 加统一模板字段，并要求每次异步外包都留下 owner / verify / blocker / rollback / next step | 调度与审计 | 低到中 | 减少岗位交接损耗，让多 seat 协作更可审计 |
| P1 | 补“真实 E2E 基线烟测”到阶段入口和 closure，而不是只在出问题时补跑 | 施工与验收 | 中 | 让测试从补救动作变成默认动作 |
| P2 | 继续去混淆 `seat / model / toolline / surface`，并把旧命名彻底清理出提示词、memory、dispatch 模板和文档 | 组织口径 | 中 | 降低调度误判和术语污染 |
| P2 | 把“最小续跑 prompt + watchdog”标准化成中断恢复模板，专门应对 Codex CLI 429/503、provider 限额、长任务中断 | 异步调度 | 中 | 提升长运行任务恢复力，减少黑箱返工 |

## 结论

Anthropic 给的是一套“让单个 coding agent 跨 session 不失忆”的最小方法论。OpenClaw 现在已经走到下一层了：它在做的不是单 agent harness，而是 agent 组织系统。

这条路方向没错，而且很多点已经领先于 Anthropic 文章里的默认方案，尤其是岗位分工、验收链路、异步闭环和记忆分层。

但代价也已经摆在桌上：OpenClaw 不再主要输给“模型不够强”，而是开始输给“系统自我复杂化”。下一步最重要的，不是再加新层，而是把现有真源、验收门和调度恢复机制压硬。压不硬，后面每多一个 seat、每多一条链路、每多一种记忆，就多一个出血点。
