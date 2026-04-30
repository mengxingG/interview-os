/* eslint-disable no-console */
const { Client } = require("@notionhq/client");
const dotenv = require("dotenv");

dotenv.config({ path: ".env.local" });

const notionToken = process.env.NOTION_API_KEY || process.env.NOTION_TOKEN;
const notion = new Client({ auth: notionToken });

const storyDbId = process.env.NOTION_STORIES_DB;

const stories = [
  {
    title: "Pre-Trade AI 合规智能助手（L0+L1 混合决策辅助）",
    situation:
      "花旗 Pre-Trade 场景下，政策/规则的实时变化很大程度依赖 Sales/Traders 人工把控；将政策解析并落入系统控制往往需要 1-2 个月的改造周期，存在明显的\"决策当下 vs 系统落地\"时间差，从而放大交易违规风险。",
    task:
      "作为产品转型负责人，要在\"交易秒级响应\"与\"监管可审计\"之间建立可落地方案，核心任务包括：1) 定义产品边界（辅助决策而非自动阻断）；2) 设计技术路线（L0 规则 + L1 AI/RAG）；3) 协调基建团队与交付团队；4) 设定上线门槛。",
    action:
      "主导 5 个关键产品决策：1) L0+L1 混合架构；2) Assistive 定位，fail-open 策略；3) 语义缓存层降延迟；4) Retrieve-before-Generate + 可追溯解释链；5) Override 反馈飞轮。",
    result:
      "P2 单 desk 试点 4 周，误报率从 20-30% 降至 10-15%，执行采纳率 65-75%（800-1200 笔 RFQ），周度趋势从第 1 周 55% 提升至第 4 周 78%。",
    earnedSecret:
      "金融合规 AI 产品里，真正决定成败的不是\"模型更聪明\"，而是把风险决策拆层：用 L0 保证确定性与速度，用 L1 吸收政策语义变化，再把每一步做成可审计证据链。",
    tags: ["Innovation", "Cross-functional", "Data-driven", "Leadership"],
    strength: 5,
  },
  {
    title: "Vantage Match Engine 推荐流优化",
    situation:
      "Vantage 旧平台中，Sales/Trader 处理 RFQ 时需要在多个模块间反复切换做人工比对，市场波动期决策窗口被严重挤压。",
    task:
      "在不重写底层数据源的约束下，把\"分散信息检索+脑内排序\"改造成\"单页实时推荐+就地操作\"。",
    action:
      "1) 通过 WebSocket 实时推送匹配结果到统一推荐列表；2) 设计就地操作路径；3) 整合多数据来源并通过缓存策略缓解延迟；4) 坚持增加匹配原因可视化而非只给排序结果。",
    result: "RFQ 到报价平均耗时从 5-8 分钟降到 1-2 分钟，推荐列表采用率首月 50%、第二个月 65-70%。",
    earnedSecret:
      "在高频交易工作流里，真正拖慢决策的往往不是模型能力，而是\"人要在多个上下文间切换\"。先把推荐信息和操作入口放到同一决策平面，比新增复杂算法更快释放业务价值。",
    tags: ["Innovation", "Technical"],
    strength: 5,
  },
  {
    title: "AI 合规知识库与法规情报系统",
    situation:
      "花旗合规团队面临法规文档量大（数百份 PDF，跨司法辖区）、格式复杂（金融 PDF 含跨页表格、嵌套结构），合规分析师日常需要人工翻阅法规原文回答业务咨询，响应慢且难以保证引用准确性。同时不同团队对法规数据的访问权限有严格隔离要求。",
    task:
      "作为产品负责人，设计一个面向合规团队的\"法规变化感知 + 可追溯问答\"平台，让合规分析师能快速检索法规条款并获得带原文引用的回答，同时满足数据隔离和审计合规要求。",
    action:
      "主导 4 个关键设计决策：1) 多模态文档解析链路（PyMuPDF→结构化布局分析→Gemini Vision），专门解决金融 PDF 跨页表格抽取问题，这是其他通用解析工具做不好的场景；2) 构建 RBAC 约束的 RAG 问答系统，在检索阶段就做权限过滤（而不是生成后过滤），回答必须强制附带法规原文引用，不允许无来源的回答；3) 设定 Golden Dataset 上线门槛（F1>90%），建立专家复核机制——合规专家定期审核 AI 回答质量，反馈进入标注数据集；4) 设计法规变化监控模块，新法规入库后自动触发关联业务规则的影响评估。",
    result:
      "系统上线后合规分析师的法规查询响应时间显著缩短，回答带原文引用满足审计要求。Golden Dataset 保证了模型更新的质量门槛。RBAC 约束实现了跨团队数据隔离，通过内部安全审查。",
    earnedSecret:
      "在合规 AI 场景中，RAG 系统的核心难题不是\"检索准不准\"，而是\"权限隔离怎么做\"和\"引用怎么强制\"。把约束前置到检索阶段（而非生成后过滤）既降低了泄露风险，也让审计变得可追溯。这个设计思路可以迁移到任何对数据隔离有严格要求的 AI 系统。",
    tags: ["Technical", "Innovation", "Data-driven"],
    strength: 4,
  },
  {
    title: "InterviewOS 全流程 AI 求职教练系统",
    situation:
      "转型 AI PM 的过程中，面临求职全流程的复杂性——求职定位、JD 解码、简历针对性优化、模拟面试训练、面试复盘、薪资谈判每个环节都需要不同的方法论和工具。市场上的面试工具要么只覆盖单一环节（如模拟面试），要么是纯 prompt 没有 UI 交互界面。同时发现两个高质量开源项目各有优势但无法直接使用：一个是纯 prompt 技能包（23 个命令、五维评分体系、8 阶段训练进阶），另一个是全栈面试应用（SM-2 间隔重复、持久化用户画像），但两者架构完全不同（一个是 Claude Code prompt，一个是 FastAPI + React）。",
    task:
      "独立设计并开发一个覆盖求职全生命周期的 AI 教练系统，融合两个开源项目的核心理念，构建一个真正可用的产品——不是 demo，而是自己真实使用来准备面试的工具。",
    action:
      "1) 产品设计决策：不硬合并两个项目的代码，而是提取核心理念重新架构——从 prompt 技能包提取五维评分体系、JD 六维解码、8 阶段训练进阶等 23 个命令的 prompt 逻辑，从全栈应用提取 SM-2 算法和用户画像持久化思路；2) 技术架构选型：Next.js + Vercel AI SDK + DeepSeek/Gemini 双模型路由（快速对话用 DeepSeek，深度分析用 Gemini），Notion API 做数据持久化层，用户可切换三档模型（⚡DeepSeek / 🧠Gemini Flash / 🔮Gemini Pro）；3) 产品流程设计：按求职四阶段组织 15+ 功能模块（备弹药→投简历→备面试→面试后），每个页面有使用指南和 AI 引导；4) 中国化适配：将 LinkedIn 逻辑改造为 BOSS直聘/猎聘等中国招聘平台的话术优化和档案优化；5) 使用 Cursor + Claude Code 独立完成从后端 API、AI prompt 体系、Notion 数据层到前端 15+ 页面的全链路开发。",
    result:
      "系统已部署上线，覆盖求职定位、故事库（含检索训练）、知识训练（SM-2）、面试题库、公司研究、JD 解码、简历优化、求职档案优化、求职话术生成、面试备战 Prep、模拟面试（Mock + 8 阶段 Practice）、回答评分（含转录分析）、面试热身、面试复盘、薪资谈判、成长进度等完整模块。自己用这个系统准备面试，形成了\"产品即证据\"的闭环。",
    earnedSecret:
      "做 AI 产品的核心能力不是\"会调 API\"，而是\"能把分散的能力拼成一个用户真正会用的工作流\"。两个优秀的开源项目各有 800+ star，但直接用都不能解决我的问题——一个没有 UI，一个架构不匹配。产品经理的价值在于判断\"提取什么、舍弃什么、重新组合成什么形态\"，然后用最快的方式交付。这和我在花旗做 CITI COMPLY 的思路一致：不是从零造技术，而是在约束条件下做最优组合决策。",
    tags: ["Innovation", "Technical", "Cross-functional", "Leadership"],
    strength: 5,
  },
  {
    title: "AI Knowledge Learning System 智能学习系统",
    situation:
      "转型 AI PM 需要系统性学习大量新知识（ML 基础、推荐系统、NLP、产品方法论），但传统学习方式效率低——看完就忘，缺乏检验机制，没有针对薄弱环节的强化训练。",
    task: "独立设计并开发一个融合多种学习方法论的 AI 增强学习系统，解决\"学了但没掌握\"的问题。",
    action:
      "1) 设计双模态知识内化系统：PDF/视频入库 → 多模态解析 + 概念拆解 → 费曼复述（用自己的话解释概念）→ AI 面试官加压考核（模拟真实面试追问）→ 盲点进入间隔复习队列；2) 采用 SM-2 间隔重复算法，自动计算每个知识点的下次复习时间，越难的复习越频繁；3) ADHD 友好交互设计，降低学习启动摩擦；4) 学习数据回写 Notion 知识库，形成掌握度画像，支持跨会话复习与长期留存。使用 Cursor 独立完成全栈开发并部署上线。",
    result: "已部署上线并作为个人日常学习系统持续使用。通过间隔复习机制，知识留存率显著提升。掌握度画像帮助精准识别薄弱知识点。",
    earnedSecret:
      "学习系统的关键不是\"让人多学\"，而是\"让人知道自己哪里没学会\"。费曼复述 + AI 追问的组合能暴露出\"以为懂了其实没懂\"的盲区，这比单纯刷题有效得多。间隔重复解决的是\"学了会忘\"的问题，两者结合才形成完整的知识内化闭环。",
    tags: ["Innovation", "Technical"],
    strength: 4,
  },
  {
    title: "AI News Radar 全自动资讯情报系统",
    situation: "转型期需要高效跟踪 AI 行业动态，但信息源分散在十几个平台，手动浏览每天 1-2 小时。",
    task: "开发全自动 AI 资讯情报系统，实现\"高价值信息自动找到我\"。",
    action: "设计 FastAPI + Coze 异构双引擎架构，大模型多维去噪打分，结构化写入 Notion，Next.js 前端渲染。",
    result: "系统持续稳定运行，每日信息获取时间从 1-2 小时压缩到 10 分钟。",
    earnedSecret: "信息产品的价值不在\"抓得多\"，而在\"噪声过滤得准\"。",
    tags: ["Innovation", "Technical"],
    strength: 3,
  },
  {
    title: "大模型基建与应用团队的协作冲突——从互相甩锅到共建问责机制",
    situation:
      "CITI COMPLY 项目依赖内部大模型基建团队提供的 LLM API。但基建团队负责整个部门的大模型基础设施，同时服务多条业务线，我们合规场景的需求排不到优先位置。更严重的是准确率归属不清：当 AI 给出错误合规判断时，基建团队认为是应用侧 prompt 和检索管道问题，应用团队认为是模型对金融术语理解不足，问题在两个团队之间反复推诿。同时我们提出按合规术语做微调也被拒绝，理由是通用基座不能为单一业务线定制。",
    task:
      "在没有直接管理权的情况下，解决三个问题：1) 让基建团队提升需求优先级；2) 建立清晰的问题归属和问责机制，终结甩锅文化；3) 在基建团队拒绝微调的约束下，找到替代方案提升合规场景准确率。",
    action:
      "我推动了 4 个关键动作：1) 缩小需求范围换取优先级提升：不要求完整 API 功能，只要核心推理接口的最小可用版本（3 个 endpoint 而非计划中的 12 个）；2) 建立端到端问题定位协议：分层问责机制先查检索层（应用团队）、再查模型推理层（基建团队）、最后查法规数据时效（数据团队），每层有明确检查标准和 owner；3) 用 RAG 绕过微调需求：在应用层引入 RAG + 领域术语表 + few-shot examples，补偿模型在金融合规术语上的理解短板；4) 用试点数据帮基建团队创造价值：承诺把 P2 数据作为内部 showcase，支持其争取下季度资源。",
    result:
      "基建团队 2 周内完成 MVP API 联调，P2 试点如期启动。分层问责协议实施后，问题定位时间从平均 3-5 天缩短到 1 天内闭环。RAG + 术语表方案让合规场景准确率达到接近微调的效果（Golden Dataset F1>90%），基建团队认可该应用层补偿思路并推广到其他业务线。试点数据也帮助基建团队在 Q4 拿到更多 headcount。",
    earnedSecret:
      "大模型项目中基建团队和应用团队的冲突本质是“谁为结果负责”不清晰。解决方法不是 escalate 或施压，而是三步：第一，缩小需求让对方说“行”的成本降低；第二，建立分层问责让“出了问题怪谁”有据可查；第三，创造共赢激励，用你的结果帮对方证明价值。这个模式可迁移到任何跨团队 AI 项目。",
    tags: ["Conflict", "Cross-functional", "Leadership"],
    strength: 5,
  },
];

function asRecord(value) {
  return value && typeof value === "object" ? value : {};
}

function pickFirstExisting(candidates, propertyNames) {
  for (const key of candidates) {
    if (propertyNames.has(key)) {
      return key;
    }
  }
  return "";
}

async function getStoryDbProperties() {
  const db = await notion.databases.retrieve({ database_id: storyDbId });
  const properties = asRecord(db.properties);
  const names = new Set(Object.keys(properties));
  const titleProp = Object.entries(properties).find(([, value]) => asRecord(value).type === "title");
  const titleKey = titleProp ? titleProp[0] : pickFirstExisting(["Title", "Name"], names);
  return { names, titleKey };
}

function readTitleFromPage(page, titleKey) {
  const properties = asRecord(page.properties);
  const titleProp = asRecord(properties[titleKey]);
  const titleBlocks = Array.isArray(titleProp.title) ? titleProp.title : [];
  const text = titleBlocks
    .map((block) => {
      const plain = typeof block?.plain_text === "string" ? block.plain_text : "";
      if (plain) return plain;
      const richText = asRecord(block?.text);
      return typeof richText.content === "string" ? richText.content : "";
    })
    .join("")
    .trim();
  return text;
}

function buildProperties(row, names, titleKey) {
  const situationKey = pickFirstExisting(["Situation", "Context"], names);
  const taskKey = pickFirstExisting(["Task", "Goal"], names);
  const actionKey = pickFirstExisting(["Action", "Actions"], names);
  const resultKey = pickFirstExisting(["Result", "Outcome"], names);
  const earnedKey = pickFirstExisting(["Earned Secret", "Learning"], names);
  const tagsKey = pickFirstExisting(["Tags", "Tag"], names);
  const strengthKey = pickFirstExisting(["Strength", "Rating"], names);
  const useCountKey = pickFirstExisting(["Use Count", "UseCount"], names);

  const properties = {
    [titleKey]: { title: [{ text: { content: row.title } }] },
  };

  if (situationKey) properties[situationKey] = { rich_text: [{ text: { content: row.situation } }] };
  if (taskKey) properties[taskKey] = { rich_text: [{ text: { content: row.task } }] };
  if (actionKey) properties[actionKey] = { rich_text: [{ text: { content: row.action } }] };
  if (resultKey) properties[resultKey] = { rich_text: [{ text: { content: row.result } }] };
  if (earnedKey) properties[earnedKey] = { rich_text: [{ text: { content: row.earnedSecret } }] };
  if (tagsKey) properties[tagsKey] = { multi_select: row.tags.map((tag) => ({ name: tag })) };
  if (strengthKey) properties[strengthKey] = { number: row.strength };
  if (useCountKey) properties[useCountKey] = { number: 0 };

  return properties;
}

async function loadExistingPages(titleKey) {
  const existing = new Map();
  let cursor = undefined;
  do {
    const response = await notion.databases.query({
      database_id: storyDbId,
      page_size: 100,
      start_cursor: cursor,
    });
    for (const page of response.results) {
      const title = readTitleFromPage(page, titleKey);
      if (title) existing.set(title, page.id);
    }
    cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (cursor);
  return existing;
}

async function main() {
  if (!notionToken) {
    throw new Error("Missing NOTION_API_KEY (or NOTION_TOKEN) in environment.");
  }
  if (!storyDbId) {
    throw new Error("Missing NOTION_STORIES_DB in environment.");
  }

  const { names, titleKey } = await getStoryDbProperties();
  if (!titleKey) {
    throw new Error("StoryBank is missing a title property (e.g. Title / Name).");
  }

  const existingPages = await loadExistingPages(titleKey);
  let created = 0;
  let updated = 0;

  for (const row of stories) {
    const properties = buildProperties(row, names, titleKey);
    const existingPageId = existingPages.get(row.title);
    if (existingPageId) {
      await notion.pages.update({
        page_id: existingPageId,
        properties,
      });
      updated += 1;
      console.log(`🔄 Updated story: ${row.title}`);
    } else {
      await notion.pages.create({
        parent: { database_id: storyDbId },
        properties,
      });
      created += 1;
      console.log(`✅ Created story: ${row.title}`);
    }
  }

  console.log(`\nStory sync completed. created=${created}, updated=${updated}, total=${stories.length}`);
}

main().catch((error) => {
  console.error("❌ Story seed failed:", error.message ?? error);
  process.exit(1);
});
