export type StorySeed = {
  id: string;
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  earnedSecret: string;
  deployFor: string;
  tradeoff: string;
  tags: string[];
  strength: number;
};

export const userProfile = {
  profile: {
    targetRole: "AI Product Manager（初创 / 中型公司，AI 产品方向）",
    levelBand: "中级发展阶段（约 4 年软件经验，目标 PM IC）",
    trainingTrack: "Quick Prep",
    feedbackDirectness: 4,
    interviewTimeline: "约 1 周内开始面试（此前也提到“2 周内”，按近期窗口处理）",
    coachingMode: "focused",
    interviewExperience: "AI PM 方向首次正式求职（尚未开始投递）",
    maxConcern:
      "复合型转型风险——(1) ML 理论深度不足；(2) 缺少大厂 PM 头衔信号；(3) 需将前端经历重构为 AI 产品经历；(4) AI 产品取舍表达框架尚未固定",
    knownInterviewFormats: [] as string[],
    anxietyProfile: "unknown",
    transitionType:
      "职能转型（前端工程 → 产品管理）+ 行业/场景转型（企业金融工程组织 → AI 产品公司）",
    transitionNarrativeStatus: "in progress",
    officialTitleEvidence: ["离职证明中文头衔为“经理”（全程）", "英文表述为 “Corporate title of officer”"],
  },
  resumeAnalysis: {
    positioningAdvantages:
      "Citi 品牌与强监管金融场景；端到端 owner 能力（从 0 到 1 交付）；跨 PM/设计/研发协作；交易工作流中的决策辅助系统落地经验；具备规则+语义推荐的真实产品经验；个人侧有持续上线的 AI 项目闭环",
    interviewConcerns:
      "简历上 PM 头衔与 PM KPI 证明不足；“AI PM”相关 ML 词汇与评估框架可能被深挖；易被误判为“做了 AI 功能”而非“做了 AI 产品决策”；大厂标签弱；远程/国际化求职叙事需更结果化",
    narrativeGaps: "前端到 PM 的决策权迁移表达；交付能力到产品发现能力的桥接；结果量化口径需要稳定",
    storySeeds:
      "Pre-Trade 合规智能助手；Match Engine 推荐流；遗留系统现代化；跨团队改造；AI News Radar；AI Knowledge Learning System",
  },
  positioningStatement: {
    date: "2026-04-19",
    depth: "Standard",
    coreStatement:
      "我的核心优势是把 AI 从“技术能力”变成“业务结果”。在花旗 Pre-Trade 场景，我先把 Trader 的跨模块人工比对改造成实时推荐流，让 RFQ 到报价从 5–8 分钟降到 1–2 分钟、推荐采纳率从 50% 提升到 65%–70%；随后推动 AI 合规智能助手，把合规风险从 T+1 后置发现前移到交易点击前识别，误报区间从 20–30% 降到 10–15%，同时维持交易可用性。我现在面向 AI PM 岗位，聚焦用 AI 驱动降本增效、风险下降和决策效率提升，而不只是交付一个模型功能。",
    hook10s: "我做 AI 产品最看重的不是模型有多新，而是它是否真正改变业务指标。",
    keyDifferentiators:
      "同时踩过三层现场：遗留高压交易系统改造、实时推荐产品化、受监管 AI 决策系统落地，能把技术可行性、业务时效和合规可审计性放进同一产品决策框架。",
    earnedSecretAnchor:
      "在高风险实时场景里，AI 产品成败通常不取决于模型参数，而取决于是否把“解释性+操作路径+审计证据”做成一体化产品；先解决信任与采用，再放大智能能力。",
    targetAudience:
      "招聘 AI Product Manager 的创业公司/中型公司（尤其是复杂工作流、高风险约束、高频决策场景）",
  },
  drillProgression: {
    currentStage: 3,
    passedStages: ["Stage 1（Ladder）", "Stage 2（Pushback）"],
    retrainQueue: [
      "A/B 错误分类措辞需更严谨（避免将“Trader 未执行”直接等同高风险）",
      "在多层追问下维持 45-60 秒高密度表达",
    ],
  },
  targetRole: "AI Product Manager（初创 / 中型公司，AI 产品方向）",
  levelBand: "中级发展阶段（约 4 年软件经验，目标 PM IC）",
  trainingTrack: "Quick Prep",
  maxConcern:
    "复合型转型风险——(1) ML 理论深度不足；(2) 缺少大厂 PM 头衔信号；(3) 需将前端经历重构为 AI 产品经历；(4) AI 产品取舍表达框架尚未固定",
  transitionNarrativeStatus: "in progress",
  officialTitleEvidence: ["离职证明中文头衔为“经理”（全程）", "英文表述为 “Corporate title of officer”"],
  positioningAdvantages:
    "Citi 品牌与强监管金融场景；端到端 owner 能力（从 0 到 1 交付）；跨 PM/设计/研发协作；交易工作流中的决策辅助系统落地经验；具备规则+语义推荐的真实产品经验；个人侧有持续上线的 AI 项目闭环",
  interviewConcerns:
    "简历上 PM 头衔与 PM KPI 证明不足；“AI PM”相关 ML 词汇与评估框架可能被深挖；易被误判为“做了 AI 功能”而非“做了 AI 产品决策”；大厂标签弱；远程/国际化求职叙事需更结果化",
  narrativeGaps: "前端到 PM 的决策权迁移表达；交付能力到产品发现能力的桥接；结果量化口径需要稳定",
  drillProgress: {
    currentStage: 3,
    passedStages: ["Stage 1（Ladder）", "Stage 2（Pushback）"],
  },
  interviewRedLines: [
    "避免把“Trader 未执行”直接等同高风险",
    "在多层追问下不能丢失 45-60 秒高密度表达",
    "避免把 AI 能力说成黑箱自动替代，必须强调 Assistive + 可审计",
  ],
  resumeStrategy: "传统开发背景压缩到 1-2 行，AI 产品经历 >80%",
  positioning: {
    fullStatement:
      "我的核心优势是把 AI 从“技术能力”变成“业务结果”。在花旗 Pre-Trade 场景，我先把 Trader 的跨模块人工比对改造成实时推荐流，让 RFQ 到报价从 5–8 分钟降到 1–2 分钟、推荐采纳率从 50% 提升到 65%–70%；随后推动 AI 合规智能助手，把合规风险从 T+1 后置发现前移到交易点击前识别，误报区间从 20–30% 降到 10–15%，同时维持交易可用性。我现在面向 AI PM 岗位，聚焦用 AI 驱动降本增效、风险下降和决策效率提升，而不只是交付一个模型功能。",
    hook10s: "我做 AI 产品最看重的不是模型有多新，而是它是否真正改变业务指标。",
    differentiators:
      "同时踩过三层现场：遗留高压交易系统改造、实时推荐产品化、受监管 AI 决策系统落地，能把技术可行性、业务时效和合规可审计性放进同一产品决策框架。",
    earnedSecretAnchor:
      "在高风险实时场景里，AI 产品成败通常不取决于模型参数，而取决于是否把“解释性+操作路径+审计证据”做成一体化产品；先解决信任与采用，再放大智能能力。",
    audience: "招聘 AI Product Manager 的创业公司/中型公司（复杂工作流、高风险约束、高频决策场景）",
  },
  scoreHistory: [
    {
      date: "2026-04-19",
      context: "practice ladder S001",
      scores: { substance: 5, structure: 5, relevance: 5, credibility: 4.7, differentiation: 5 },
    },
    {
      date: "2026-04-19",
      context: "practice pushback S001",
      scores: { substance: 5, structure: 4.5, relevance: 5, credibility: 5, differentiation: 4.5 },
    },
  ],
  coachingNotes: [
    "沟通语言偏好：中文。",
    "系统演进主线：Vantage 遗留系统 → 现代化重构 → AI 合规系统。",
    "个人 AI 项目持续运行。",
  ],
} as const;

export function buildUserContextForPrompt() {
  return `
Candidate Profile:
- Role: ${userProfile.profile.targetRole}
- Level: ${userProfile.profile.levelBand}
- Track: ${userProfile.profile.trainingTrack}
- Max concern: ${userProfile.profile.maxConcern}
- Transition: ${userProfile.profile.transitionType}
- Narrative status: ${userProfile.profile.transitionNarrativeStatus}

Positioning Statement:
- Core: ${userProfile.positioningStatement.coreStatement}
- Hook(10s): ${userProfile.positioningStatement.hook10s}
- Differentiator: ${userProfile.positioningStatement.keyDifferentiators}
- Earned Secret Anchor: ${userProfile.positioningStatement.earnedSecretAnchor}

Resume Analysis:
- Advantages: ${userProfile.resumeAnalysis.positioningAdvantages}
- Interview concerns: ${userProfile.resumeAnalysis.interviewConcerns}
- Narrative gaps: ${userProfile.resumeAnalysis.narrativeGaps}

Drill Progression:
- Current stage: ${userProfile.drillProgression.currentStage}
- Passed: ${userProfile.drillProgression.passedStages.join(", ")}

Coaching Notes:
${userProfile.coachingNotes.map((n) => `- ${n}`).join("\n")}

Interview Red Lines:
${userProfile.interviewRedLines.map((n) => `- ${n}`).join("\n")}
`.trim();
}

export const storySeeds: StorySeed[] = [
  {
    id: "S001",
    title: "Pre-Trade AI 合规智能助手（L0+L1 混合决策辅助）",
    situation:
      "花旗 Pre-Trade 场景下，政策/规则的实时变化很大程度依赖 Sales/Traders 人工把控；将政策解析并落入系统控制往往需要 1-2 个月的改造周期，存在明显的“决策当下 vs 系统落地”时间差，从而放大交易违规风险。",
    task:
      "作为产品转型负责人，要在“交易秒级响应”与“监管可审计”之间建立可落地方案，核心任务包括：定义产品边界（辅助决策而非自动阻断）、设计技术路线（L0 规则 + L1 AI/RAG）、协调基建团队与交付团队、设定上线门槛。",
    action:
      "主导 5 个关键产品决策：L0+L1 混合架构、Assistive 定位与 fail-open 策略、语义缓存层降延迟、Retrieve-before-Generate + 可追溯解释链、Override 反馈飞轮。",
    result:
      "P2 单 desk 试点 4 周，误报率从 20-30% 降至 10-15%，执行采纳率 65-75%（800-1200 笔 RFQ），周度趋势从第 1 周 55% 提升至第 4 周 78%。",
    earnedSecret:
      "金融合规 AI 产品里，真正决定成败的不是“模型更聪明”，而是把风险决策拆层：用 L0 保证确定性与速度，用 L1 吸收政策语义变化，再把每一步做成可审计证据链。",
    deployFor:
      "高监管 AI 场景中的产品边界定义、跨团队推进、可解释与可审计设计、影响力型 leadership 证明。",
    tradeoff:
      "坚持 Assistive + fail-open 而非自动阻断，以交易可用性换取审慎落地，并通过可解释链与反馈闭环持续控风险。",
    tags: ["Innovation", "Cross-functional", "Data-driven", "Leadership"],
    strength: 5,
  },
  {
    id: "S002",
    title: "Vantage Match Engine 推荐流优化",
    situation:
      "Vantage 旧平台中，Sales/Trader 处理 RFQ 时需要在多个模块间反复切换做人工比对，市场波动期决策窗口被严重挤压。",
    task:
      "在不重写底层数据源的约束下，把“分散信息检索+脑内排序”改造成“单页实时推荐+就地操作”。",
    action:
      "通过 WebSocket 实时推送匹配结果到统一推荐列表，设计就地操作路径，整合多数据来源并通过缓存策略缓解延迟，并坚持增加匹配原因可视化而非只给排序结果。",
    result:
      "RFQ 到报价平均耗时从 5-8 分钟降到 1-2 分钟，推荐列表采用率首月 50%、第二个月 65-70%。",
    earnedSecret:
      "在高频交易工作流里，真正拖慢决策的往往不是模型能力，而是“人要在多个上下文间切换”。先把推荐信息和操作入口放到同一决策平面，比新增复杂算法更快释放业务价值。",
    deployFor:
      "遗留系统约束下的产品改造、可解释推荐设计、效率指标提升故事。",
    tradeoff:
      "坚持“匹配原因可视化”而非黑箱排序，短期增加实现复杂度，但显著提升采纳率并为后续 AI 语义升级奠定信任基础。",
    tags: ["Innovation", "Technical"],
    strength: 5,
  },
  {
    id: "S003",
    title: "AI 合规知识库与法规情报系统",
    situation:
      "花旗合规团队面临法规文档量大、格式复杂，合规分析师需要人工翻阅法规原文回答业务咨询，响应慢且引用准确性难保证；同时不同团队对法规数据访问权限有严格隔离要求。",
    task:
      "设计一个“法规变化感知 + 可追溯问答”平台，让分析师快速检索法规条款并获得带原文引用的回答，同时满足数据隔离与审计合规。",
    action:
      "主导多模态文档解析链路，构建 RBAC 约束的 RAG 问答系统并将权限过滤前置到检索阶段，设定 Golden Dataset 上线门槛（F1>90%）与专家复核机制，并设计法规变化监控模块。",
    result:
      "系统上线后法规查询响应显著缩短，回答带原文引用满足审计要求，RBAC 约束实现跨团队数据隔离并通过内部安全审查。",
    earnedSecret:
      "在合规 AI 场景里，核心难题不是“检索准不准”，而是“权限隔离怎么做”和“引用怎么强制”。把约束前置到检索阶段，能同时降低泄露风险并提升可审计性。",
    deployFor: "RAG 产品化、权限隔离、安全合规、知识系统可信度设计。",
    tradeoff: "牺牲部分通用性与开发速度，换取审计可追溯与高风险场景可用性。",
    tags: ["Technical", "Innovation", "Data-driven"],
    strength: 4,
  },
  {
    id: "S004",
    title: "InterviewOS 全流程 AI 求职教练系统",
    situation:
      "求职全流程复杂，市面工具往往只覆盖单点；同时两个高质量开源项目各有优势但架构不兼容，无法直接落地为可用产品。",
    task:
      "独立设计并开发一个覆盖求职全生命周期的 AI 教练系统，融合两个开源项目核心理念，做成可真实使用而非 demo 的产品。",
    action:
      "提取并重构 23 个命令的 prompt 逻辑，结合 SM-2 与用户画像持久化思路，采用 Next.js + Vercel AI SDK + DeepSeek/Gemini + Notion API 架构，落地四阶段 15+ 功能模块并完成中国化适配。",
    result:
      "系统已部署上线并持续用于个人面试准备，覆盖定位、故事库、知识训练、题库、研究、JD 解码、Prep、Mock、Evaluate、Debrief、薪资谈判、成长进度等完整闭环。",
    earnedSecret:
      "AI 产品能力不在于“会调 API”，而在于把分散能力拼成用户真的会用的工作流；在约束条件下做组合决策，比从零造轮子更能体现产品价值。",
    deployFor: "0-1 产品能力、系统化产品思维、自驱型 leadership、跨功能整合。",
    tradeoff: "不硬合并现有代码，转而提炼核心理念重构，短期开发量更大但长期可维护性和可扩展性更好。",
    tags: ["Innovation", "Technical", "Cross-functional", "Leadership"],
    strength: 5,
  },
  {
    id: "S005",
    title: "AI Knowledge Learning System 智能学习系统",
    situation:
      "转型 AI PM 需要学习大量新知识，但传统学习方式“看完就忘”，缺乏检验机制和针对薄弱点的强化训练。",
    task:
      "独立设计并开发一个融合多种学习方法论的 AI 增强学习系统，解决“学了但没掌握”的问题。",
    action:
      "设计双模态知识内化流程（输入→解析→费曼复述→AI追问→盲点回流），采用 SM-2 间隔重复算法安排复习节奏，支持学习数据回写形成掌握度画像。",
    result:
      "系统已部署并持续使用，通过间隔复习和追问机制提升知识留存率，并可稳定识别个人薄弱知识点。",
    earnedSecret:
      "学习系统关键不在“让人多学”，而在“让人知道自己哪里没学会”；费曼复述 + AI 追问暴露盲区，间隔重复对抗遗忘，两者结合才形成闭环。",
    deployFor: "学习系统设计、知识内化方法论、长期成长机制。",
    tradeoff: "增加流程复杂度换取长期留存与可追踪进步。",
    tags: ["Innovation", "Technical"],
    strength: 4,
  },
  {
    id: "S006",
    title: "AI News Radar 全自动资讯情报系统",
    situation:
      "转型期需要高效跟踪 AI 行业动态，但信息源分散在十几个平台，手动浏览每天需要 1-2 小时。",
    task: "开发全自动 AI 资讯情报系统，实现“高价值信息自动找到我”。",
    action: "设计 FastAPI + Coze 异构双引擎架构，大模型多维去噪打分，结构化写入 Notion，并通过 Next.js 前端渲染。",
    result: "系统持续稳定运行，每日信息获取时间从 1-2 小时压缩到约 10 分钟。",
    earnedSecret: "信息产品的价值不在“抓得多”，而在“噪声过滤得准”。",
    deployFor: "信息系统自动化、信噪比优化、轻量产品化验证。",
    tradeoff: "优先做筛选质量而非覆盖广度，先解决“有效信息”再追求“全量信息”。",
    tags: ["Innovation", "Technical"],
    strength: 3,
  },
  {
    id: "S007",
    title: "大模型基建与应用团队的协作冲突——从互相甩锅到共建问责机制",
    situation:
      "CITI COMPLY 项目依赖内部大模型基建团队提供 LLM API，但基建团队服务多条业务线，合规场景优先级偏后；同时准确率归属不清，模型误判时基建与应用团队反复推诿，且微调需求被以“通用基座不可为单业务线定制”拒绝。",
    task:
      "在没有直接管理权的情况下，提升需求优先级、建立清晰问责机制终结甩锅文化，并在无法微调的约束下提升合规场景准确率。",
    action:
      "推动四个动作：缩小需求范围拿到 MVP API 排期；建立端到端分层问责协议（检索层/推理层/数据层各自 owner）；以 RAG + 术语表 + few-shot 在应用层补偿模型领域理解；用试点数据作为基建团队内部 showcase，形成共赢激励。",
    result:
      "基建团队 2 周内完成 MVP API 联调，P2 试点如期启动；问题定位由 3-5 天缩短到 1 天内闭环；应用层补偿方案在合规场景达到接近微调效果（Golden Dataset F1>90%），并被推广到其他业务线。",
    earnedSecret:
      "大模型项目跨团队冲突本质是“谁为结果负责”不清晰。有效解法是三步：先降对方配合成本，再建分层问责链路，最后设计共赢激励。",
    deployFor: "跨团队冲突、无管理权影响力、AI 项目协作与问责机制设计。",
    tradeoff: "放弃“全面定制”转向“应用层补偿 + 协作机制”，以可落地速度换取短期最优解。",
    tags: ["Conflict", "Cross-functional", "Leadership"],
    strength: 5,
  },
];

