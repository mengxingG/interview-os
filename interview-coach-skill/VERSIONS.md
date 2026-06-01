# Version Roadmap

每个版本都有清晰的核心命题，而不是功能大杂烩。

---

## v1: 基础版（已发布）

**核心命题**：构建一个覆盖广、标准严、可针对每位候选人自适应的面试辅导系统。

- 16 个命令覆盖完整面试生命周期（从 `kickoff` 到 `reflect`）
- 5 维评分量表（Substance、Structure、Relevance、Credibility、Differentiation），并按职级校准
- 根因分类体系，将失败模式映射到针对性修复动作
- Storybank 管理，包含 STAR 文本、earned secrets、强度评分和快速检索训练
- 叙事身份提炼（跨故事提取 2-3 个核心主题）
- 8 阶段训练进阶与门槛机制
- 全流程 mock 面试，覆盖 behavioral、system design、case study、panel、technical+behavioral 格式
- 5 维角色匹配评估（requirement coverage、seniority alignment、domain relevance、competency overlap、trajectory coherence）
- 面试情报系统可从真实经历中学习（问题模式、有效/无效模式、公司模式）
- 通过 `coaching_state.md` 提供持久化会话状态，并支持会中保存
- 跨流程模块：differentiation、gap-handling、signal-reading、psychological readiness、cultural awareness
- 面向 PM、Engineering、Design、Data Science、Research、Operations、Marketing 的角色专项训练
- 技术型面试辅导边界定义（辅导沟通表现，而非评判领域正确性）

---

## v2: 辅导深度（已发布）

**核心命题**：系统虽广，但部分深度不足。先在核心能力上大幅增强，再扩展表层功能。

### Feature 1: 转录格式支持
候选人无需再手动重排转录文本。系统可自动检测并标准化 8 种转录格式（Otter.ai、Grain、Google Meet、Zoom VTT、Granola、Microsoft Teams、Tactiq、Manual/generic），并包含歧义消解规则与质量信号报告。

**关键文件**：`references/transcript-formats.md`（新增）、`references/transcript-processing.md`（Step 0.5）、`references/commands/analyze.md`（Step 3.5）

### Feature 2: 多格式转录分析
过去所有转录都会被强制按 behavioral 问答对解析。现在系统分流到 5 条格式感知路径：behavioral（Q&A 对）、panel（含跨面试官动态的对话）、system design（阶段式：scoping、approach、deep-dive、tradeoff、adaptation）、technical+behavioral mix（分段模式切换）、case study（候选人驱动阶段）。每种格式都有专属反模式、附加评分维度和 delta 报表区块。

**关键文件**：`references/transcript-processing.md`（Step 2 重构、Step 2.5 扩展、Step 3 评分、Step 4 delta）、`references/commands/analyze.md`（格式感知分发/评分/分诊）、`references/examples.md`（Example 11：system design 分析）

### Feature 3: 更智能的故事映射
过去的故事到问题映射是启发式且逐题进行。现在采用作品集优化引擎，包含 4 级匹配评分（Strong Fit、Workable、Stretch、Gap）、7 步冲突消解、新鲜度/过度使用追踪、earned-secret 感知选择，以及 secondary skill 利用。

**关键文件**：`references/story-mapping-engine.md`（新增）、`references/commands/prep.md`（storybank 健康门槛、扩展输出 schema）、`references/storybank-guide.md`（健康指标）、`references/commands/stories.md`（增强 gap 分析）

### Feature 4: 结果校准闭环
系统过去能检测失准但不会自我修正。现在加入评分漂移检测（练习分是否预测真实结果）、跨维度根因追踪与统一干预（按根因而非按维度设计干预）、情报数据时间衰减、角色训练与核心维度映射、成功模式捕捉，以及结构化“未测量因素”调查。

**关键文件**：`references/calibration-engine.md`（新增）、`references/commands/progress.md`（Steps 5a/5b/5c）、`references/commands/analyze.md`（Step 12a）、`references/commands/feedback.md`（校准触发器）、`references/commands/practice.md`（role-drill 映射）、`references/rubrics-detailed.md`（根因持续性）

### Feature 5: 增强公司情报
公司研究过去缺乏结构。现在提供 3 档深度（Quick Scan、Standard、Deep Dive）、结构化 7 步搜索协议、以及按来源层级（verified、general knowledge、unknown）进行主张验证的协议。

**关键文件**：`references/commands/research.md`（深度分级、搜索协议、验证）、`references/commands/prep.md`（结构化研究步骤）

---

## v3: 全生命周期（已发布）

**核心命题**：v2 让辅导“大脑”更深；v3 让系统更完整——覆盖候选人与就业市场交互的所有关键触点，并强化 23 个命令间的跨命令集成。

v1 和 v2 主要聚焦于面试本身：准备、练习、评分和面后分析。但候选人在简历、LinkedIn、外联消息、JD 分析、演示环节和薪资沟通上花的时间，往往多于真实面试。v3 将辅导引擎扩展到所有影响求职结果的表面。

### Feature 1: 申请材料命令
新增 3 个命令，覆盖候选人在真正面试前需要构建的材料。

**`resume`** —— 8 维度全局简历优化（ATS 解析、招聘方扫读行为、要点 bullet 质量、职级校准、关键词覆盖、结构、顾虑管理、跨载体一致性）。分 3 档深度。若已存在 storybank，storybank-to-bullet 管道会提取 earned secrets 与量化结果用于 bullet；若提供 JD，会生成针对该申请优化的定制版本。

**`linkedin`** —— 平台原生的 LinkedIn 优化。将 LinkedIn 视为独立赛道（招聘 Boolean 搜索机制、算法分发、分区块影响），而非简历复刻。支持从快速审计到深度优化的 3 档深度，并包含内容策略。

**`pitch`** —— 核心定位陈述：自我呈现的原子单元。利用好奇缺口钩子、earned secret 锚定和 Present-Past-Future 公式，生成各时长版本（10 秒 elevator 到 90 秒面试 TMAY）。会写入 coaching state，并由 `resume`、`linkedin`、`outreach` 复用，实现跨载体一致性。

**关键文件**：`references/commands/resume.md`（新增）、`references/commands/linkedin.md`（新增）、`references/commands/pitch.md`（新增）

### Feature 2: 网络拓展与外联
**`outreach`** —— 覆盖完整网络拓展生命周期：冷启动 LinkedIn 消息、温介绍请求、信息访谈邀约、回复 recruiter、跟进序列、内推请求。支持从快速模板到完整多渠道活动策略的 3 档深度。消息基于候选人的 Positioning Statement 构建，确保每次外联都有差异化。包含平台机制（LinkedIn 300 字连接请求上限、冷邮件最佳长度、InMail 回复率）。

**关键文件**：`references/commands/outreach.md`（新增）

### Feature 3: JD 分析与目标定位
**`decode`** —— 使用 6 个解码镜头分析 JD（重复频率、顺序与强调、required vs. nice-to-have、动词选择、行间信号、缺失内容），并为每条解释提供置信度标签。将抽取出的能力项与候选人画像对照，给出 fit verdict。批量分诊模式可比较 2-5 个 JD 找到候选人的 sweet spot。并提供教学层，让候选人逐步学会自己解码 JD。

**关键文件**：`references/commands/decode.md`（新增）

### Feature 4: 演示轮辅导
**`present`** —— 补齐 presentation-format 面试的准备空白（system design 演示、商业案例、作品集评审、战略展示、技术深潜）。使用 4 种叙事弧框架辅导结构，按时长限制校准内容密度，并通过预测问题与答法策略准备 Q&A。支持 3 档深度。新增对应的演示转录解析路径与格式专属评分维度（Content Density Management、Narrative Arc、Q&A Adaptability、Audience Calibration）。

**关键文件**：`references/commands/present.md`（新增）、`references/transcript-processing.md`（Path F）、`references/rubrics-detailed.md`（presentation 维度）

### Feature 5: 早期流程薪酬辅导
**`salary`** —— 辅导发生在 offer 出现前、但杠杆最高的薪酬节点：recruiter 初筛中的“薪资预期”问题、薪资历史处理、申请表填写策略。引导候选人做薪酬研究、构建区间、并准备分阶段脚本。正式 offer 到来后衔接到 `negotiate`。

**关键文件**：`references/commands/salary.md`（新增）

### Feature 6: 跨流程质量强化
基于系统化审计，对 23 个命令实施了 28 项增强：

- 在 `kickoff` 中加入**职业转型识别**（5 种类型）及搜索中期画像更新协议
- 在 `hype` 中加入**焦虑画像个性化**（5 类画像）与格式专属热身
- 在 `debrief` 中加入**信号解读指南**（8 类信号）与定位表现检查
- 在 `negotiate` 中加入**offer 比较归一化**（7 个组件）
- 在 `help` 中加入**诊断路由器**（9 种问题到命令映射）
- 在 `research` 中加入**陈旧性检测**（3 个时间阈值）
- 在 `mock` 中加入**重做机制**与进阶阶段校准
- 在 `feedback` 中加入 recruiter 反馈的**引导式提取提示**
- 新增 **12 个跨命令集成点**（如 prep 消费 decode 输出、concerns 使用 Outcome Log、questions 使用 intelligence 数据、stories 消费叙事身份等）
- 新增 **3 个 schema 字段**（Anxiety profile、Career transition、Transition narrative status）并提供向后兼容迁移规则
- 将 **Gap-Handling Module** 集成到 `practice`、`mock`、`stories` —— 依据 storybank 分数给出 gap 应对模式
- 将**差异化能力**扩展到非面试场景 —— earned secrets 应用于 resume bullets、LinkedIn 区块、pitch hooks、outreach 消息
- 新增**演示轮评分与解析** —— 4 个格式专属评分维度、转录解析路径、演示面试反模式检测
- 将 **Level 5 Challenge Protocol** 扩展到所有新增命令 + `mock`
- **Format Discovery 去重** —— 在 `prep` 中发现一次，保存到 Interview Loops，并由 `mock`、`hype`、`practice` 复用
- 在 `examples.md` 新增 **7 个完整示例**，用于校准 decode、resume、pitch、linkedin、outreach、present、salary 输出质量

### Feature 7: Schema 与迁移加固
修复 4 项 schema 迁移缺口，确保旧版 `coaching_state.md` 可完整升级：
- 缺失 `Known interview formats` Profile 字段
- 迁移检查中缺失 `Interview Intelligence` 区块
- `Signal` → `Hire Signal` 列名重命名的向后兼容
- Interview Loops 的单条字段（Status、Round formats、Fit verdict 等）

**关键文件**：`SKILL.md`（schema 迁移规则）、`references/commands/kickoff.md`（新用户 Interview Intelligence）

---

## v4: 交互模型（规划中）

**核心命题**：既然辅导大脑已足够强大且完整，下一步要改变的是候选人与它交互的方式。

### Voice Mode for Practice/Mock
严格限定在 `practice`、`mock` 与 `hype` 热身场景。候选人说、系统听，并同时评分表达与内容（填充词、语速、信心、犹豫措辞）。不会替代 `prep` 或 `progress` 的文本输出——这些仍需结构化结果。但语音会让练习和 mock 的真实感显著提升。

### Session Replay
在 mock 或练习后，允许候选人回放对话并查看内联教练注释。“这里你在切入重点前犹豫了 8 秒。更紧凑的版本应该是这样。”

### Lightweight Companion UI
不是替代 Claude Code，而是一个只读仪表板，用于可视化 `coaching_state.md`：分数趋势、storybank 覆盖热图、interview loop 状态、训练进度。可以把它理解为无需执行命令即可一眼查看的 `progress`。实现上可为读取 markdown 文件的本地轻量 web 服务。

### Calendar Awareness
连接 Google Calendar / Outlook。面试前 24 小时自动触发 `hype`；面试前一周若尚未执行 `prep` 则提醒。v1 已有时间感知辅导，但依赖候选人主动汇报时间线。

### Collaborative Storybank Building
允许朋友或导师审阅 storybank 并留下评论。仍然保持文件化，但增加轻量评审协议。多数候选人是单独写故事；第二双眼睛能发现教练未必看得到的盲区。

---

## v5: 平台化（规划中）

**核心命题**：辅导引擎已被验证，下一步是让从不接触 CLI 的人也能使用它。

### Full Web App
用后端、鉴权、数据库替代 `coaching_state.md`，为所有命令提供真实 UI。skill 文件将成为 API 产品的系统提示词。参考架构已经足够模块化可迁移——每个命令文件可映射为一个 API endpoint。

### Coaching Marketplace
让有经验的面试官或职业教练可自定义量表、补充公司专属情报，并提供专项辅导轨道（例如带内情校准评分的“FAANG PM prep”）。现有跨流程模块架构已支持此能力——新模块可插入而无需重写命令。

### Team/Org Mode
企业可用它来辅导内部候选人准备晋升答辩，或让招聘团队用它训练面试官（视角反转——辅导“提问者”）。仍是同样 5 个维度，只是观察镜头不同。

### Anonymized Intelligence Network
当用户规模足够时，系统可输出跨候选人的聚合模式：“拿到 Stripe offer 的候选人，Differentiation 往往 4+；被 Amazon 拒绝的候选人，最常失败在 Structure。”不共享个体数据，只输出可提升整体准备质量的聚合信号。

---

## Version Tension

v3 是 v2 之后自然且必要的一步——它在不要求架构变更的前提下，把辅导引擎扩展到了求职中所有关键触点。系统现在已完整：23 个命令从简历覆盖到复盘，并通过跨命令集成让整体效果大于各部分之和。

v4 很令人兴奋，但成本高（语音、UI、集成）。v5 则是另一家公司级别的事情。当前风险在于：在 v3 尚未证明“全生命周期辅导”比“仅面试辅导”更能提升候选人结果之前，就过早平台化。
