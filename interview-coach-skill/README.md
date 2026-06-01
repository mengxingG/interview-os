# Interview Coach

一个基于 Claude Code 的面试教练，覆盖完整求职生命周期——从 JD 分析与简历优化，到 mock 面试，再到 offer 后谈判。共 23 个命令，覆盖申请材料、面试准备、练习、分析与薪酬辅导。系统会在五个维度上为你的回答打分，诊断薄弱点背后的根因，构建你在高压场景下可快速检索的故事库，并根据你的个人模式自适应调整辅导策略。这不是泛化题库，而是一个越用越准的自适应系统。

说出 `kickoff`，分享你的简历，2 分钟内即可进入辅导。

---

## 功能说明

**评分与诊断** —— 每个回答都会按 Substance、Structure、Relevance、Credibility、Differentiation 评分，并按你的职级校准。分数会映射到根因（如状态焦虑、叙事囤积、冲突回避），并给出针对性修复，而不是只说“做得更好”。

**自适应辅导** —— 评分后，系统通过决策树识别你的主要瓶颈并分配对应训练。如果你的问题在 Relevance，就做题意解码训练；如果在 Substance，就补充原始素材。系统不会对所有候选人套用同一流程。

**多格式转录分析** —— 可粘贴来自 Otter、Zoom、Grain、Google Meet、Teams、Tactiq、Granola 或其他工具的原始转录。系统会自动识别并标准化格式。分析会按面试类型自适配：行为面试走 Q&A 解析，系统设计走阶段分析（scoping、approach、deep-dive、tradeoff、adaptation），panel 面试跟踪跨面试官动态，混合型面试处理技术与行为段落间的模式切换。每种格式都包含专属反模式检测与附加评分维度。

**Storybank 与组合优化** —— 提供结构化故事管理（完整 STAR 文本、earned secrets、强度评分、快速检索训练）。故事-问题映射采用 4 级匹配评分（Strong Fit、Workable、Stretch、Gap），并进行组合优化：当多个问题竞争同一故事时进行冲突消解，跟踪新鲜度与过度使用，优先使用具备强 earned secret 的故事。系统还会提炼跨故事的 2-3 个叙事身份核心主题，让你的每个回答都强化统一的人设主张。

**练习与 mock** —— 提供 8 阶段训练进阶（约束阶梯、反驳处理、转向训练、panel 模拟、压力测试）以及完整 4-6 题 mock 面试，支持 behavioral、system design、case study、panel、technical+behavioral。每轮都包含面试官视角——你回答时对方实际在想什么。角色专项训练分会映射回核心维度，确保专项训练能进入总体趋势分析。Directness Level 5 下：扩展面试官内心独白、3 轮后挑战注释、可选跳过热身。

**结果校准** —— 系统会跟踪练习分是否真正预测真实面试结果。累计 3 场以上真实面试后，系统会进行评分漂移检测，识别外部反馈与教练评分冲突，并执行再校准。跨维度根因（如“冲突回避”同时影响 Substance 与 Differentiation）会统一处理，而不是拆成多个孤立训练。系统也会从成功中学习，追踪哪些故事、维度与模式与晋级相关。

**角色匹配评估** —— 在五个维度上结构化评估候选人与岗位匹配度（requirement coverage、seniority alignment、domain relevance、competency overlap、trajectory coherence）。区分强匹配、可投资拉伸和长线搏概率角色，帮助候选人把精力投入真正有竞争力的岗位。随着数据积累，被拒模式会暴露仅靠练习无法弥补的目标定位问题。

**增强公司情报** —— 提供三档研究深度（Quick Scan、Standard、Deep Dive）、结构化搜索协议和主张验证机制。每条公司相关主张都映射来源层级（verified、general knowledge、unknown）。在应用公司知识前，prep 简报会先进行定向网络研究，并为每条发现附来源说明。

**面试生命周期** —— 覆盖公司研究、岗位定制 prep 简报（含面试官情报）、当日面后 debrief、结果跟踪（关联练习分与真实结果）、以及 offer 后谈判脚本辅导。

**面试情报** —— 系统会从你的真实面试经历中持续学习。每份转录、debrief 和 recruiter 反馈都会进入个性化知识库：跨公司问题模式、对你个人有效/无效的做法、反馈与结果关联。情报数据具备时间衰减机制——过期数据会被标记，而不会被悄然沿用。

**会话连续性** —— 通过持久化 `coaching_state.md` 跟踪你的 storybank、分数、模式、训练进度、interview loops、interview intelligence 与 calibration state。几周后也能无缝续接。保存自动进行。

**Challenge protocol（Directness Level 5）** —— 在最高直接度设置下，教练会通过五个镜头主动挑战你：Assumption Audit、Blind Spot Scan、Pre-Mortem、Devil's Advocate、Strengthening Path。新增或改进故事后会被 red-team；转录会被 challenge；练习第 3 轮起加入轮换挑战注释；progress 报告含 Hard Truth；hype 在面试前含 pre-mortem；拒信会被挖掘杠杆点。系统也会检测回避模式——如果你持续绕开弱项，会直接指出。每个挑战都以可执行修复收尾。Level 1-4 不受影响。

**引导式流程** —— 每个命令后，教练会基于你的 coaching state 推荐具体下一步，而非通用菜单。当你说“帮我准备 Google 面试”之类的话，系统会检测多步骤意图，并自然带你走完整序列（research、prep、concerns、hype）。会话开始问候也会给出当前杠杆最高的建议。

**LinkedIn 优化** —— 按区块审计你的 LinkedIn，并对齐平台实际机制：recruiter 布尔搜索逻辑、算法分发、区块影响。支持从快速审计到深度优化的 3 档深度，含内容策略。不是“把简历复制到 LinkedIn”，而是平台原生优化。

**简历优化** —— 面向真正影响结果的全维度审计：ATS 解析与排序、招聘方扫读行为、bullet 质量、职级校准、关键词覆盖、结构、顾虑管理、跨载体一致性。支持 3 档深度，从快速审计到深度优化（含完整 bullet 重写流程）。若已存在 storybank，系统会提取其中量化结果与 earned secrets 注入简历 bullet。若有 JD，则会产出针对该申请的定制版本。这不是语法检查，而是把简历作为求职资产进行战略级重构。

**核心定位** —— 构建自我呈现的原子单元：positioning statement。系统通过 curiosity gap 原则、earned secret 锚定、Present-Past-Future 公式，生成多时长版本（10 秒 elevator、30 秒 networking、60 秒 recruiter call、90 秒 interview TMAY）以及 LinkedIn summary hook。positioning statement 会保存到 coaching state，并被 resume、linkedin、outreach 复用以保持跨载体一致性。支持从 quick draft 到 deep positioning 的 3 档深度。

**外联消息辅导** —— 覆盖完整外联生命周期：冷启动 LinkedIn 消息、温介绍请求、信息访谈请求、recruiter 回复、跟进序列、内推请求。支持从快速模板到完整网络活动策略的 3 档深度。消息基于候选人的 Positioning Statement 构建，避免泛化模板化。系统理解平台机制（LinkedIn 连接请求 300 字上限、冷邮件最佳 75-125 词、InMail 回复率）并据此给出辅导。包含消息质量量表、跟进节奏指导，以及“内推占 30-50% 录用但仅来自 7% 申请者”的研究背景。

**JD 解码与批量分诊** —— 用六个解码镜头分析 JD（重复频率、顺序与强调、required vs. nice-to-have、动词选择、行间信号、缺失内容），并为每条解释标注置信度。将抽取能力项与候选人画像映射得出 fit verdict。针对所有不确定解读生成可向 recruiter 追问的问题。批量分诊可比较 2-5 份 JD，定位市场验证的 sweet spot，并推荐申请资源分配。系统还包含教学层，帮助候选人逐步学会自行解码 JD。

**演示轮辅导** —— 补齐 presentation-format 面试准备缺口（系统设计演示、商业案例、作品集评审、策略陈述、技术深潜）。通过四种叙事弧框架优化结构，按时限校准内容密度（约 130-150 词/分钟），并通过预测问题与答题策略准备 Q&A。支持从快速结构梳理到深度准备（含讲稿审阅与约束版）。

**早期流程薪酬辅导** —— 聚焦薪酬环节中杠杆最高的时刻：recruiter 初筛“你的薪资预期是多少？”、薪资历史处理、申请表策略。引导候选人进行薪酬研究（不虚构数据）、构建可防守区间，并提供分阶段脚本与反压备选。覆盖 offer 前完整薪酬时间线，并在正式 offer 到来后衔接到 `negotiate`。支持从 30 秒快答脚本到完整职业转型薪酬定位的 3 档深度。

**差异化** —— earned secrets 与 spiky POV 是一等公民维度，不是附属项。系统会把你从“合格”推向“可记住”。

**自我认知** —— 跟踪你的自评与教练实评分之间的差距。系统知道你是 over-rater 还是 under-rater，并据此调整辅导方式。

---

## 快速开始

### Option 1: Claude Code（推荐）

1. 克隆仓库：

```bash
git clone https://github.com/noamseg/interview-coach-skill.git
cd interview-coach-skill
```

或 [下载 ZIP](https://github.com/noamseg/interview-coach-skill/archive/refs/heads/main.zip) 后解压。

2. 通过重命名技能文件激活教练：

```bash
mv SKILL.md CLAUDE.md
```

3. 在 Claude Code 中打开该目录并输入 `kickoff`。

需要任意付费 Claude 方案。也可在 Claude Code（terminal）、Cursor，或任何具备文件系统访问能力的环境中运行。

### Option 2: OpenAI Codex

1. 克隆仓库：

```bash
git clone https://github.com/noamseg/interview-coach-skill.git
cd interview-coach-skill
```

或 [下载 ZIP](https://github.com/noamseg/interview-coach-skill/archive/refs/heads/main.zip) 后解压。

2. 通过重命名技能文件激活教练：

```bash
mv SKILL.md AGENTS.md
```

3. 在 Codex 中打开该目录并输入 `kickoff`。

需要任意付费 ChatGPT 方案。

---

对两种方式，教练都会询问你的简历、目标岗位和时间线，然后建立画像、评估起点并给出优先行动计划。所有内容会自动保存到 `coaching_state.md`，下次可从上次进度继续。

---

## Commands

### Getting Started

| Command | Purpose | Typical Output |
|---|---|---|
| `kickoff` | 搭建画像、轨道与偏好设置 | Kickoff 总结 + 时间感知行动计划 |

### Interview Round Prep

| Command | Purpose | Typical Output |
|---|---|---|
| `research [company]` | 公司研究 + 结构化匹配评估（3 档深度） | 公司快照、文化信号、匹配评估、经主张验证的发现 |
| `decode` | JD 分析 + 批量分诊（3 档深度，6 镜头） | 带置信度的解码、能力提取、匹配评估、recruiter 验证问题、批量比较、教学层 |
| `prep [company]` | 生成岗位定制 prep 简报（格式感知、文化感知、角色匹配） | 格式指导、文化判断、角色匹配、面试官情报、能力项、预测问题、故事映射 |
| `concerns` | 预判面试官顾虑 | 顾虑-反制-证据映射 |
| `questions` | 生成反向提问 | 5 个定制、非泛化问题 |
| `present` | 演示轮辅导（3 档深度） | 叙事弧选择、内容结构化、时间校准、开场/收尾优化、Q&A 准备、约束版 |

### Application Materials

| Command | Purpose | Typical Output |
|---|---|---|
| `linkedin` | LinkedIn 优化（3 档深度） | 分区块审计、区块重写、内容策略 |
| `resume` | 简历优化（3 档深度，有 JD 时可定制） | ATS 审计、分区块评估、bullet 重写、职级校准、关键词分析、storybank-to-bullet 管道 |
| `pitch` | 核心定位陈述 + 场景变体 | 核心陈述、约束阶梯、场景化版本、定位一致性检查 |
| `outreach` | 外联辅导（3 档深度，9 类消息） | 消息框架、草稿评审+重写、跟进序列、多渠道活动策略 |

### Pre-Conversation

| Command | Purpose | Typical Output |
|---|---|---|
| `salary` | 前/中期薪酬辅导（3 档深度） | 薪酬研究指导、区间构建、分阶段脚本、总包教育、薪资历史处理 |
| `hype` | 面前信心与心理热身。Level 5 下含 pre-mortem 失败预防 | 60 秒高光回放 + 3x3 清单 + 聚焦提示 + 失误恢复手册 |

### Practice and Simulation

| Command | Purpose | Typical Output |
|---|---|---|
| `practice` | 执行训练轮（含进阶门槛）。Level 5 下含 challenge 注释、扩展面试官解读、可选跳过热身 | 每轮 debrief + 自评偏差 + 定向调整 |
| `mock [format]` | 全流程模拟面试（4-6 题）——behavioral screen、deep behavioral、panel、bar raiser、system design/case study、technical+behavioral mix | 全局弧线反馈、信号解读注释、能量轨迹 |
| `stories` | 构建/管理 storybank + 快速检索训练。Level 5 下故事会通过 5 个挑战镜头进行 red-team | 故事表 + earned secrets + 缺口分析 + 检索训练 |

### Analysis, Tracking, and Post-Interview

| Command | Purpose | Typical Output |
|---|---|---|
| `analyze` | 用格式感知解析、分诊式辅导和面试官内心独白分析转录。Level 5 下包含结构化 challenge | 自动识别格式、按单元评分（Q&A/phases/exchanges）、格式专属维度、决策树 + interview delta |
| `debrief` | 面后快速采集（当天） | 回忆问题、面试官信号、使用故事、coaching state 更新 |
| `progress` | 趋势、自我校准、结果跟踪、评分校准。Level 5 下包含 Hard Truth 区块 | 自评偏差 + 结果相关性 + 评分漂移检测 + 根因追踪 + 教练 meta-check |
| `feedback` | 记录 recruiter 反馈、结果、修正、上下文或教练 meta-feedback。Level 5 下拒信会做结构化杠杆提取 | 状态更新 + 下一步建议 |
| `thankyou` | 面后跟进文案 | Thank-you note + 变体 |
| `negotiate` | offer 后谈判辅导 | offer 分析 + 策略 + 脚本 + 精准话术 |
| `reflect` | 搜索后复盘 + 归档 | 旅程弧线、突破点、可迁移能力、归档状态 |
| `help` | 显示命令菜单（上下文感知） | 完整命令清单 + 基于 coaching state 的推荐下一步 |

---

## 快速工作流示例

### 1) 初始设置

```text
kickoff
```

期望输出：

- 轨道选择（`Quick Prep` 或 `Full System`）
- 画像快照（优势信号与顾虑区域）
- 面试就绪度评估
- 时间感知行动计划（按你的面试时间线调整）

### 2) 公司研究（在决定深入 prep 前）

```text
research Notion
```

期望输出：

- 公司快照（阶段、规模、文化信号——按来源层级完成主张验证）
- 与你画像的匹配评估
- “如果你决定申请”下一步建议

对高优先级目标，可说明需要 deep dive：“Do a deep dive on Notion”——在标准研究基础上额外获取员工帖子、产品评价、竞品分析、管理层画像。

### 3) 面试前准备

```text
prep Stripe
```

然后提供：

- Job description
- 角色/职级
- 可选：面试官 LinkedIn URL（用于逐位面试官情报）

期望输出：

- `Interview Format`（含格式专属辅导边界）
- `Company Culture Read`
- `Interviewer Intelligence`（若提供 profile 链接——按面试官给出视角、关注点、破冰钩子、故事建议）
- `What They Optimize For`
- `Your Best Positioning`
- `Likely Concerns + Counters`
- `Predicted Questions (7-10)`
- `Story Mapping`
- `Questions To Ask Them`
- `Day-Of Cheat Sheet`

### 4) 面试刚结束

```text
debrief
```

在细节仍清晰时快速采集——有无转录都可。你将得到：

- 回忆问题与重建回答
- 观察到的面试官信号（参与度、怀疑、兴趣）
- 使用故事（自动更新 storybank 的 `Last Used` 日期）
- 为下一次会话更新 coaching state

### 5) 转录分析

```text
analyze
```

然后粘贴任意工具的原始转录文本（Otter、Zoom、Grain、Teams 等）。系统会自动识别并标准化。

期望输出：

- 格式识别与标准化
- 按单元评分区块（behavioral 用 Q#，system design 阶段用 P#，panel 交互用 E#）
- `Scorecard`
- `Triage Decision`（基于你的真实模式的数据驱动辅导路径）
- `What Is Working`
- `Top 3 Gaps To Close`
- `Storybank Changes`
- `Priority Move (Next 72 Hours)`

### 6) 训练练习

```text
practice
```

训练项（按进阶顺序——达到门槛再推进）：

- `practice ladder` — 约束训练（30s、60s、90s、3min）
- `practice pushback` — 处理质疑与打断
- `practice pivot` — 问题偏离准备时的重定向
- `practice gap` — 应对“我没有这个例子”时刻
- `practice role` — 角色专项高强度审视
- `practice panel` — 多面试官人格场景
- `practice stress` — 高压模拟
- `practice technical` — aloud thinking、clarification-seeking、tradeoff articulation（仅适用于 system design / case study / mixed）

独立项（不受门槛约束）：

- `practice retrieval` — 时间压力下的高频故事匹配

每轮期望输出：

- `Round Debrief`
- `What Worked`
- `Gaps`
- `Scorecard`（5 维）
- `Self-Assessment Delta`
- `Next Round Adjustment`

### 7) 完整 mock 面试

```text
mock behavioral Stripe
```

执行完整 4-6 题面试模拟。格式支持：behavioral screen、deep behavioral、panel、bar raiser、system design/case study、technical+behavioral mix。全局反馈覆盖：

- 总体印象与 hiring signal
- 全弧线能量轨迹与节奏
- 故事多样性与选用质量
- 信号读取（你是否根据面试官线索完成适配）
- 单题评分 + 仅在整场会话层面可见的整体模式

### 8) 申请前先解码 JD

```text
decode
```

然后粘贴 JD。你将得到：

- 带置信度标签（HIGH/MEDIUM/LOW）的能力提取
- 6 镜头分析（重复频率、顺序、required vs. nice-to-have、动词选择、行间信号、缺失内容）
- 与你画像的匹配评估（Strong Fit / Investable Stretch / Long-Shot Stretch / Weak Fit）
- 针对不确定解读的 recruiter 验证问题
- 帮你学会自行解码 JD 的教学层

多个 JD 场景：粘贴 2-5 份可获得批量分诊、排名、市场验证 sweet spot 与资源分配建议。

### 9) 构建定位陈述

```text
pitch
```

你将得到：

- 以你最强 earned secret 为锚点的核心定位陈述
- 场景变体：10 秒 elevator、30 秒 networking、60 秒 recruiter、90 秒 interview TMAY
- 简历、LinkedIn 与面试叙事之间的定位一致性检查

### 10) 外联消息辅导

```text
outreach
```

然后指定消息类型（cold LinkedIn、warm intro、recruiter reply 等）与目标。你将得到：

- 草稿评审（若你带草稿）或引导式构建
- 在平台约束内重写消息（LinkedIn 连接请求 300 字）
- 带时间点的跟进序列
- 从 storybank 抽取的 earned secret hooks

### 11) offer 后谈判

```text
negotiate
```

然后提供 offer 细节、竞品 offer 与理想结果。你将得到：

- 市场位置分析
- 含优先级排序的谈判策略
- 会话可直接使用的精准脚本
- 应对反压的备选话术

---

## 轨道

### Quick Prep

适用于面试时间线较短。

- 公司研究
- Prep 简报
- 聚焦式转录分析
- 立即可执行下一步

### Full System

适用于多周周期的系统化求职。

- Storybank 管理（含快速检索训练与组合优化故事映射）
- 多格式转录分析（behavioral、system design、panel、mixed）+ 决策树分诊
- 模式与趋势跟踪 + 自评校准
- 差异化辅导嵌入所有工作流
- 完整 mock 面试模拟（behavioral、system design、case study、panel、technical+behavioral mix）
- 含门槛的训练进阶（8 阶段 + 独立 retrieval）
- 面后 debrief 与快速采集
- 结果跟踪（练习与真实结果关联）+ 评分校准（漂移检测、再校准）
- 面试情报：从真实面试学习问题模式、有效/无效做法与公司特征，并对陈旧数据做时间衰减
- 跨公司轮次的 interview loop 感知
- offer 后谈判辅导
- 搜索结束后的复盘与归档

在 `kickoff` 时选择，后续可切换。

---

## 仓库结构

```text
interview-coach-skill/
├── SKILL.md                            # 核心技能文件 — 重命名为 CLAUDE.md 后激活
├── README.md                           # 本文件
├── LICENSE                             # MIT License
├── coaching_state.md                   # 首次 kickoff 创建（持久化记忆，自动保存）
└── references/
    ├── commands/                       # 各命令工作流（按需加载）
    │   ├── kickoff.md
    │   ├── research.md
    │   ├── prep.md
    │   ├── analyze.md
    │   ├── debrief.md
    │   ├── practice.md
    │   ├── mock.md
    │   ├── stories.md
    │   ├── concerns.md
    │   ├── questions.md
    │   ├── linkedin.md
    │   ├── resume.md
    │   ├── pitch.md
    │   ├── outreach.md
    │   ├── decode.md
    │   ├── present.md
    │   ├── salary.md
    │   ├── hype.md
    │   ├── thankyou.md
    │   ├── progress.md
    │   ├── negotiate.md
    │   ├── feedback.md
    │   ├── reflect.md
    │   └── help.md
    ├── cross-cutting.md                # 共享模块：gap-handling、signal-reading、differentiation、cultural awareness、psychological readiness、cross-command dependencies
    ├── rubrics-detailed.md             # 评分锚点、根因、职级校准
    ├── role-drills.md                  # 角色专项训练 + 面试官原型
    ├── differentiation.md              # Earned secrets、spiky POV、高压清晰表达
    ├── transcript-processing.md        # 分步转录分析指南（格式感知解析）
    ├── transcript-formats.md           # 格式识别 + 各格式标准化（Otter、Zoom、Grain 等）
    ├── storybank-guide.md              # 故事管理 + 快速检索训练
    ├── story-mapping-engine.md         # 含匹配评分的组合优化故事映射
    ├── calibration-engine.md           # 评分漂移检测、根因追踪、成功模式
    ├── challenge-protocol.md           # 五镜头挑战框架（仅 Level 5）：assumption audit、blind spot scan、pre-mortem、devil's advocate、strengthening path
    └── examples.md                     # 完整示例：评分回答、分诊、重写、system design 分析
```

---

## 获得最佳结果的建议

1. 分享真实简历（不要只给高层摘要）。
2. 运行 `prep` 时提供完整 JD；若已知面试格式也一并提供。
3. `analyze` 请尽量使用真实转录。输入越完整，分诊越准确。
4. 用 `stories` 维护活的 storybank，并为每个故事提炼 earned secret。
5. 每周跑一次 `progress` —— 它追踪的不仅是分数，还有自评准确度。
6. 真实面试后及时记录结果。系统会关联练习分与真实结果。
7. 收到 recruiter 回复（好或坏）就运行 `feedback` 记录，系统会持续从真实经历中学习。
8. 重要面试前跑 `mock`。单项训练提升技能，mock 验证全弧线表现。
9. 真实面试当天使用 `debrief` —— 趁信号仍新鲜完成采集。
10. 申请前先跑 `decode` —— 解码 JD 语言、评估匹配、判断是否值得投入时间。可用批量分诊同时比较多个 JD。
11. 首次 recruiter 通话前先跑 `salary` —— recruiter screen 才是薪酬杠杆最高的时刻，而不是 offer 谈判阶段。
12. 演示轮前先跑 `present` —— 在打开 PowerPoint 之前就完成结构与 Q&A 预备。

---

## FAQ

**这和直接问 ChatGPT 面试问题有什么不同？**  
通用 LLM 面试建议通常不管你的个人模式都会给相似答案。这个系统会在五个维度上给你评分、跟踪时间趋势、定位弱点根因、构建带检索训练的 storybank，并根据数据揭示的模式动态调整辅导。它记得你之前会话，知道你在某家公司已用过哪些故事，并会在当前方法无效时切换策略。这是“教材”和“教练”的区别。

**只能用于技术岗位吗？**  
不是。核心工作流与岗位无关；角色训练覆盖 PM、Engineering、Design、Data Science、Research、Operations、Marketing。

**为什么反馈这么直接？**  
该技能刻意采用高坦诚、证据驱动风格。默认是先肯定优势，再提出改进，并在批评前鼓励自我反思。你可在 kickoff 设定反馈直接度（1-5）。Level 5 会开启 Challenge Protocol：故事会被 red-team、progress 含 Hard Truth、拒信会做杠杆提取、回避模式会被直接指出。Level 1-4 更柔和——标准一致，表达更缓。

**如何跨多次会话工作？**  
技能会写入 `coaching_state.md`，跟踪 storybank、分数、模式、训练进度、面试结果、interview loops 等信息。每次会话开始都会读取该文件并从上次状态继续。每个关键工作流后自动保存，而不只在会话结束时保存。

---

## 贡献

欢迎通过 issue 或 PR 提交：

- 复现步骤
- 当前行为
- 预期行为
- 建议修复（可选）

---

## 致谢

由 [Noam Segal](https://www.linkedin.com/in/noamsegal/) 创建。

---

## License

MIT
