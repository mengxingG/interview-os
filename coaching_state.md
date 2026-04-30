# 辅导状态 — AI PM 转型（前端 → AI PM）
最后更新：2026-04-19

## 候选人画像（Profile）
- 目标岗位：AI Product Manager（初创 / 中型公司，AI 产品方向）
- 职级带：中级发展阶段（约 4 年软件经验，目标 PM IC）
- 训练轨道：Quick Prep
- 反馈直接度：4
- 面试时间线：约 1 周内开始面试（此前也提到“2 周内”，按近期窗口处理）
- 时间感知辅导模式：focused（当具体面试 ≤48h 时切换 triage）
- 面试经历：AI PM 方向首次正式求职（尚未开始投递）
- 最大担忧：复合型转型风险——(1) ML 理论深度不足；(2) 缺少大厂 PM 头衔信号；(3) 需将前端经历重构为 AI 产品经历；(4) AI 产品取舍表达框架尚未固定
- 已知面试形式：
- 焦虑画像：unknown
- 职业转型类型：职能转型（前端工程 → 产品管理）+ 行业/场景转型（企业金融工程组织 → AI 产品公司）
- 转型叙事状态：in progress（核心锚点：Pre-Trade 合规智能助手 + 独立 AI 项目）
- 官方头衔证据：离职证明中文头衔为“经理”（全程）
- 官方头衔证据：英文表述为 “Corporate title of officer”

## 简历分析（Resume Analysis）
- 定位优势：Citi 品牌与强监管金融场景；端到端 owner 能力（从 0 到 1 交付）；跨 PM/设计/研发协作；交易工作流中的决策辅助系统落地经验；具备规则+语义推荐的真实产品经验；个人侧有持续上线的 AI 项目闭环
- 可能面试顾虑：简历上 PM 头衔与 PM KPI 证明不足；“AI PM”相关 ML 词汇与评估框架可能被深挖；易被误判为“做了 AI 功能”而非“做了 AI 产品决策”；大厂标签弱；远程/国际化求职叙事需更结果化
- 叙事缺口：前端到 PM 的决策权迁移表达；交付能力到产品发现能力的桥接；结果量化口径需要稳定
- 故事种子：Pre-Trade 合规智能助手；Match Engine 推荐流；遗留系统现代化；跨团队改造；AI News Radar；AI Knowledge Learning System

## 故事库（Storybank）
| ID | Title | Primary Skill | Secondary Skill | Earned Secret | Strength | Use Count | Last Used |
|----|-------|---------------|-----------------|---------------|----------|-----------|-----------|
| S001 | Pre-Trade 债券合规智能助手（L0+L1 混合决策辅助） | Innovation | Collaboration | 高压监管场景的 AI 产品胜负手不是“全自动替代”，而是把确定性规则与语义判断拆层协同：L0 兜底速度与确定性，L1 处理灰区语义，再用可审计链路把建议送到决策瞬间 | 5 | 0 | |
| S002 | Vantage Match Engine 推荐流（跨模块人工比对 → 单页实时决策） | Problem-solving | Customer focus | 金融交易推荐系统的关键不只是“排得快”，而是“让人敢用”：解释性展示先解决信任，再谈算法优化；规则引擎解决排序，语义判断需升级到 AI 能力层 | 5 | 0 | |

### 故事详情（Story Details）
#### S001 — Pre-Trade 债券交易合规管理智能助手（L0+L1）
- **Situation（情境）**：花旗 Pre-Trade 场景下，政策/规则的实时变化很大程度依赖 Sales/Traders 人工把控；将政策解析并落入系统控制往往需要 **1–2 个月** 的改造周期，存在明显的 **“决策当下 vs 系统落地”** 时间差，从而放大交易违规风险。项目定位是 **Sales/Traders 的辅助决策工具**，明确 **不替代** 现有风控体系，而是在交易决策核心现场补齐“即时合规建议”。
- **Task（任务）**：作为产品转型负责人，要在“交易秒级响应”与“监管可审计”之间建立可落地方案，核心任务包括：1) 定义产品边界（辅助决策而非自动阻断）；2) 设计技术路线（L0 规则 + L1 AI/RAG）；3) 协调基建团队与交付团队（模型 API 能力、发布节奏、依赖优先级）；4) 设定上线门槛（延迟、可用性、可解释与审计能力）。
- **Action（行动）**：我主导了 5 个关键产品决策：  
  1) **架构决策：L0+L1 混合，而非纯 AI**。L0 处理黑名单/硬阈值/司法辖区硬规则（目标 <50ms），L1 处理 suitability、fair trading 等灰区语义判断。  
  2) **产品定位决策：Assistive，不做自动裁决**。采用 fail-open 策略：AI 超时或故障时返回 Yellow 供人工复核，避免误阻断导致交易损失。  
  3) **性能决策：引入语义缓存层**。基于 RFQ 核心属性语义哈希 + Redis 24h 缓存，减少重复推理请求，目标将缓存命中请求压到 <200ms。  
  4) **可信决策：Retrieve-before-Generate + 可追溯解释链**。每条建议关联具体监管条款/内部政策引用，并记录输入上下文、检索片段、模型原始输出，满足审计回放。  
  5) **学习闭环：Override 反馈飞轮**。交易员可覆盖 Yellow 但必须填写原因，周度专家复盘进入 Golden Dataset，持续修正误报与漏报模式。  
  同时我推动前端集成策略（嵌入既有 blotter、WebSocket 推送红黄绿信号）与跨团队联调机制，确保不打断 Trader 既有操作路径。
- **Result（结果）**：分为“已观察结果”与“目标指标”两层表达：  
  - **已观察结果（中等/低置信度）**：根据团队复盘与合规反馈，误报率约从 **20–30%** 下降到 **10–15%** 区间；无效复核时间明显下降。  
  - **业务采纳结果（试点统计）**：P2 单 desk 试点前 4 周，执行采纳率约 **65–75%**（样本约 **800–1200** 笔触发 AI 信号的 RFQ）；周度趋势从第 1 周约 **55%** 提升至第 4 周约 **78%**，显示信任建立后采纳提升。  
  - **采纳率解释框架**：剩余 25–35% 未采纳并非“系统失效”，主要由两类构成：1) Trader 基于实时业务判断执行 override；2) 试点早期信任形成期的观望行为。  
  - **目标与工程门槛（来自 PRD）**：P99 端到端 <1000ms；缓存命中 <200ms；可用性 >99.99%；Recall@10 >98%；Golden Dataset F1>90% 才允许模型更新；影子模式 2+ 周且 diff<5% 才放量。  
  - **采纳率口径已明确**：以“**执行采纳率**（收到建议后按建议执行或调整交易的比例）”作为核心业务采纳指标，数据来自试点期系统日志统计。  
  - **行为证据链**：前端内置用户反馈模块（helpful 反馈 + override reason 必填），可用于关联“建议被采纳/被覆盖”的行为数据与主观反馈，支持后续质量迭代与可信复盘。  
  - **当前缺口（可选增强）**：若后续可补“采纳后的风险事件下降/处理时长下降”链路，可进一步增强业务闭环证明。  
- **Earned Secret（可迁移洞察）**：金融合规 AI 产品里，真正决定成败的不是“模型更聪明”，而是**把风险决策拆层**：用 L0 保证确定性与速度，用 L1 吸收政策语义变化，再把每一步做成可审计证据链。这样既不牺牲交易可用性，也能把监管风险前移到“点击之前”。
- **Deploy for（用于哪些问题）**：AI PM 系统取舍（速度/准确/可解释）、build-vs-buy、人机协同边界、风险控制产品化、跨团队依赖治理，以及“如何让 AI 在高监管场景可上线”。
- **Version history**：2026-04-19 — 初稿：基于候选人中文叙述整理为 STAR；待补充量化结果与个人“拍板时刻”（含与简历职级的口径一致性）。2026-04-19 — 补充低置信度结果区间（误报率 20–30% → 10–15%）与定性证据（合规团队复核负担下降）；待补业务采纳率口径。2026-04-19 — 基于 PRD 细化 5 个关键产品决策、上线门槛与审计机制，故事强度提升至 4。2026-04-19 — 补充执行采纳率（65–75%，P2 前 4 周，800–1200 RFQ）及周度爬升（55%→78%）与解释框架，故事强度提升至 5。

#### S002 — Vantage Match Engine / Recommendations（旧平台场景）
- **Situation（情境）**：在 Vantage 旧平台（C#/.Net/WPF）中，Sales/Trader 在 Pre-Sales 阶段处理多笔 RFQ 时，需要在 Inquiries、Order、Color、BWIC、Trade History、Client Holdings 等多个模块间反复切换，结合 ElasticSearch/关系库数据做人工比对与优先级判断。市场波动期 RFQ 密集，老系统卡顿与跨模块跳转进一步挤压决策窗口。
- **Task（任务）**：在不重写底层数据源的约束下，提升 Trader 对多笔 RFQ 的处理效率与推荐可用性：把“分散信息检索+脑内排序”的流程改造成“单页实时推荐+就地操作”，降低 RFQ 到报价的决策时延。
- **Action（行动）**：我负责 Match Engine / Recommendations 前端实现与交互产品化：  
  1) 将后端匹配结果（基于时间优先、价格、数量等规则加权）通过 WebSocket 实时推送到统一推荐列表；  
  2) 设计“就地操作”路径，支持 Trader 直接从推荐列表触发后续动作，减少回跳原始模块；  
  3) 在旧平台约束下整合多数据来源（ElasticSearch、REST API 等），并通过缓存策略（Guava Cache）缓解响应延迟；  
  4) 与多团队协同对齐数据字段、刷新机制与异常回退，确保高峰期推荐流稳定可用。  
- **Result（结果）**：  
  - **决策时延**：RFQ 到报价平均耗时约从 **5–8 分钟** 降到 **1–2 分钟**；  
  - **功能采纳**：推荐列表直接操作采用率首月约 **50%**，第二个月稳定在 **65–70%**；  
  - **统计范围**：Credit desk，上线后约 2 个月观察期，日均约 **100–150** 笔需要匹配推荐的 RFQ。  
- **Earned Secret（可迁移洞察）**：在高频交易工作流里，真正拖慢决策的往往不是模型能力，而是“人要在多个上下文间切换”。先把推荐信息和操作入口放到同一决策平面，往往比新增复杂算法更快释放业务价值。
- **Deploy for（用于哪些问题）**：你如何提升效率、在遗留系统约束下做产品化改造、如何做实时推荐 UI、如何推动多团队落地、以及“你做的是前端还是产品决策”这类边界追问。
- **关键 tradeoff（Differentiation 证据）**：我坚持在推荐列表中增加“**匹配原因可视化**”（why this recommendation）而不是只给排序结果。团队最初偏向“先上可用列表”，我判断在交易场景里黑箱推荐会被谨慎用户低采纳，必须先建立可解释信任。上线后采纳率随信任建立从首月约 50% 提升到第二个月 65–70%。更关键的是，这次实践让我看到规则引擎的边界：它擅长结构化排序，不擅长“适配性/合规性”这类语义判断，这直接促成后续 S001 用 RAG+LLM 处理语义灰区。
- **Version history**：2026-04-19 — 初版：基于候选人补充的系统演进背景与量化数据完成 STAR；待补“最关键一次 tradeoff 决策”细节以提升 Differentiation。2026-04-19 — 增补 tradeoff：解释性展示 vs 黑箱排序，并补充其对 S001 架构演进的因果驱动，故事强度提升至 5。


## 评分历史（Score History）
### 历史摘要（超过 15 行时归档）

### 最近评分（Recent Scores）
| Date | Type | Context | Sub | Str | Rel | Cred | Diff | Hire Signal | Self-Δ |
|------|------|---------|-----|-----|-----|------|------|-------------|--------|
| 2026-04-19 | practice | ladder — S001「AI 如何改变业务指标」(30s/60s/90s) | 5 | 5 | 5 | 4.7 | 5 |  | under（候选人均分约 4.8，教练均分约 4.9） |
| 2026-04-19 | practice | pushback — S001「区间数据可信度与差异率定义」(2 轮计分) | 5 | 4.5 | 5 | 5 | 4.5 |  | accurate（候选人均分约 4.9，教练均分约 4.8） |

## Outcome Log
| Date | Company | Role | Round | Result | Notes |
|------|---------|------|-------|--------|-------|

## 面试情报（Interview Intelligence）

### Question Bank
| Date | Company | Role | Round Type | Question | Competency | Score | Outcome |

### 有效模式（对该候选人有效）

### 无效模式（持续无效）

### Recruiter/Interviewer Feedback
| Date | Company | Source | Feedback | Linked Dimension |

### 公司模式（来自真实经历）

### 历史情报摘要

## 训练进度（Drill Progression）
- 当前阶段：3
- 已通过关卡：Stage 1（Ladder）与 Stage 2（Pushback）
- 复训队列：1）A/B 错误分类措辞需更严谨（避免将“Trader 未执行”直接等同高风险）；2）在多层追问下维持 45-60 秒高密度表达

## 面试循环（Interview Loops，进行中）

## 当前辅导策略（Active Coaching Strategy）
- 主要瓶颈：
- 当前方法：
- 选择理由：
- 触发转向条件：
- 已识别根因：
- 自评倾向：
- 历史方法：

## 校准状态（Calibration State）

### 校准状态
- 当前校准：uncalibrated
- 上次校准检查：never
- 可用数据点：0

### Scoring Drift Log
| Date | Dimension | Direction | Evidence | Adjustment |

### Calibration Adjustments
| Date | Trigger | What Changed | Rationale |

### Cross-Dimension Root Causes (active)
| Root Cause | Affected Dimensions | First Detected | Status | Treatment |

### Unmeasured Factor Investigations
| Date | Trigger | Hypothesis | Investigation | Finding | Action |

## LinkedIn 分析（LinkedIn Analysis）
- Date:
- Depth:
- Overall:
- Recruiter discoverability:
- Credibility on visit:
- Differentiation:
- Top fixes pending:
- Positioning gaps:

## 简历优化（Resume Optimization）
- Date: 2026-04-19
- Depth: Standard
- Overall: Strong
- ATS compatibility: ATS-Ready
- Recruiter scan: Strong
- Bullet quality: Strong
- Seniority calibration: Aligned
- Keyword coverage: Moderate
- 待办修复：1）传统开发背景压缩到 1-2 行，仅作上下文；2）确保 AI 产品经历占简历主体（>80%），统一“产品定位 → 核心设计 → 结果”结构；3）按 JD 生成关键词定制版本（B2B AI PM / Fintech AI PM）
- JD-targeted: no
- 跨载体缺口：LinkedIn headline/about 尚未同步“业务结果优先”定位与头衔格式

## 定位陈述（Positioning Statement）
- Date: 2026-04-19
- 深度：Standard
- 核心陈述：我的核心优势是把 AI 从“技术能力”变成“业务结果”。在花旗 Pre-Trade 场景，我先把 Trader 的跨模块人工比对改造成实时推荐流，让 RFQ 到报价从 5–8 分钟降到 1–2 分钟、推荐采纳率从 50% 提升到 65%–70%；随后推动 AI 合规智能助手，把合规风险从 T+1 后置发现前移到交易点击前识别，误报区间从 20–30% 降到 10–15%，同时维持交易可用性。我现在面向 AI PM 岗位，聚焦用 AI 驱动降本增效、风险下降和决策效率提升，而不只是交付一个模型功能。
- 10 秒钩子：我做 AI 产品最看重的不是模型有多新，而是它是否真正改变业务指标。
- 关键差异点：同时踩过三层现场：遗留高压交易系统改造、实时推荐产品化、受监管 AI 决策系统落地，能把技术可行性、业务时效和合规可审计性放进同一产品决策框架。
- Earned Secret 锚点：在高风险实时场景里，AI 产品成败通常不取决于模型参数，而取决于是否把“解释性+操作路径+审计证据”做成一体化产品；先解决信任与采用，再放大智能能力。
- 目标受众：招聘 AI Product Manager 的创业公司/中型公司（尤其是复杂工作流、高风险约束、高频决策场景）
- 变体状态：Completed（TMAY、networking、recruiter call、career fair、LinkedIn summary hook）
- 一致性状态：与故事库主线（S001/S002）及“业务结果优先”偏好一致；缺口是 LinkedIn 尚未完成同步

## 外联策略（Outreach Strategy）
- Date:
- Depth:
- Positioning source:
- Message types coached:
- Targets contacted:
- Channel strategy:
- Follow-up status:
- LinkedIn profile flagged:
- Key hooks identified:

## 薪酬策略（Comp Strategy）
- Date:
- Depth:
- Target range:
- Range basis:
- Research completeness:
- Stage coached:
- Jurisdiction notes:
- Scripts provided:
- Key principle:

## 元反馈日志（Meta-Check Log）
| Session | Candidate Feedback | Adjustment Made |
|---------|-------------------|-----------------|

## 会话日志（Session Log）
### 历史摘要（超过 15 行时归档）

### 最近会话
| Date | Commands Run | Key Outcomes |
|------|-------------|--------------|
| 2026-04-19 | kickoff | 完成基础建档：Quick Prep、AI PM 目标、时间窗口与核心担忧 |
| 2026-04-19 | stories（S001/S002） | 完成两条核心故事构建与强化，均达到高可用强度 |
| 2026-04-19 | pitch | 形成“业务结果优先”的定位陈述及多场景话术 |
| 2026-04-19 | resume（CN 多轮） | 完成中文简历重构，确立“开发背景最小化、AI 产品经历占主导”策略 |
| 2026-04-19 | practice（ladder + pushback） | 完成热身与计分轮，训练阶段推进到 Stage 3（Pivot） |

## 辅导备注（Coaching Notes）
- 2026-04-19：沟通语言偏好已确定为中文。
- 2026-04-19：候选人具备正式“经理”头衔证据；对外头衔可用 `Manager | AI Product Transformation Lead`，并需与可验证产物/指标绑定叙述。
- 2026-04-19：S001 量化优先口径已固定为误报率与执行采纳率；采纳率定义为“收到建议后按建议执行/调整交易的比例”，并有 UI 反馈链路支持。
- 2026-04-19：系统演进主线已明确（Vantage 遗留系统 → 现代化重构 → AI 合规系统），可作为核心转型叙事。
- 2026-04-19：简历策略已明确：传统开发经历仅保留上下文，AI 产品经历为主体（>80%）。
- 2026-04-19：练习表现：结构与差异化强；在 pushback 场景下证据层级清晰，自评与教练评分趋于一致。
- 2026-04-19：个人 AI 项目持续运行，可作为“持续构建能力”证明。
