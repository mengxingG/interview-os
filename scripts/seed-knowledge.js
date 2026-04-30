/* eslint-disable no-console */
const { Client } = require("@notionhq/client");
const dotenv = require("dotenv");

dotenv.config({ path: ".env.local" });

const notionToken = process.env.NOTION_API_KEY || process.env.NOTION_TOKEN;
const notion = new Client({ auth: notionToken });
const knowledgeDbId = process.env.NOTION_KNOWLEDGE_DB;

const knowledgeRows = [
  {
    title: "模型版本升级——输出行为漂移的 5 种表现",
    domain: "NLP与LLM",
    content:
      "不报错但输出变了，最难发现：1) 回答风格变化——输出结构变了，下游 JSON 解析 break；2) 置信度分布漂移——旧版本保守标黄，新版本激进标绿，合规场景下灾难性后果；3) Prompt 敏感度变化——同一条 prompt 新版本解读不同；4) 多语言退步——新版本中文金融术语理解退步；5) 长上下文退化——“注意力遗忘”导致前面的法规条款被忽略。面试关键句：“最危险的不是模型报错，而是模型不报错但悄悄变了行为。”",
  },
  {
    title: "模型版本升级——性能退化的 4 种类型",
    domain: "NLP与LLM",
    content:
      "1) 延迟飙升——新版本模型更大，P99 从 800ms 飙到 2.5s，突破 SLA；2) 吞吐量下降——GPU 资源消耗增加，共享资源池高峰扛不住；3) Semantic Cache 命中率骤降——新版本 embedding 空间变了，旧缓存全部失效，40% 命中率掉到 0%，延迟和成本同时飙升；4) Token 消耗翻倍——新版本输出更“详细”，月度推理成本翻倍。面试关键句：“缓存失效是最容易被忽视的——基建团队换了模型版本，应用层的语义缓存可能瞬间全废。”",
  },
  {
    title: "模型版本升级——兼容性破坏与安全风险",
    domain: "NLP与LLM",
    content:
      "兼容性破坏：1) API schema 变更未通知下游；2) 错误码含义变化导致重试逻辑失效；3) 模型降级策略失效——新版本不返回超时错误而返回不完整结果，兜底逻辑没触发。安全风险：1) 敏感信息泄露 guardrail 变弱；2) 审计日志格式变化导致合规链路断裂；3) 幻觉率变化——引用不存在的法规条款。面试关键句：“合规场景下审计链路断裂比模型不准确更严重——不准确可以人工兜底，审计链路断了意味着你无法向监管证明系统做了什么。”",
  },
  {
    title: "上线前 3 天发现模型异常——30 分钟/2 小时应对框架",
    domain: "产品方法论",
    content:
      "30 分钟内：1) 确认变更范围——联系基建团队确认版本号；2) 冻结环境——暂停所有部署。2 小时内：3) 跑 Golden Dataset 按类别拆分 F1 定位退步范围；4) 评估影响半径——高风险判断受影响是 P0，低风险多复核是 P2。决策矩阵：F1<90% 且高风险受影响→要求回滚并推迟上线；F1 88-90% 高风险不受影响→Prompt 紧急修补+扩大 L0 兜底；F1>90% 边界 case 退步→不阻断上线，上线后监控。面试关键句：“关键是 2 小时内完成根因定位和影响评估，而不是盲目决定推迟还是硬上。”",
  },
  {
    title: "基建拒绝回滚——3 种应用层紧急补偿方案",
    domain: "产品方法论",
    content:
      "基建团队常说“回滚会影响其他团队”。应用层补偿：1) 加 few-shot examples 到 prompt 专门覆盖退步的 case；2) 扩大 L0 规则引擎覆盖范围，把模棱两可 case 暂时从 L1 拉回 L0（牺牲智能化保安全）；3) 在 L1 输出后增加“后校验”规则层——检查模型输出是否符合基本合规逻辑，不符合的强制降级为 Yellow。面试关键句：“你不能控制基建团队的决策，但你能在应用层建立多层防御——这是 AI PM 和纯技术 PM 的区别。”",
  },
  {
    title: "上线当天延迟飙升——10 分钟快速排查",
    domain: "产品方法论",
    content:
      "直接 curl 基建团队 API endpoint 绕过应用层：curl 也慢→问题在基建团队；curl 快但系统慢→问题在 RAG 管道。分支处理：1) 基建 API 慢→联系基建紧急排查+评估推迟上线；2) Semantic Cache 失效→用高频查询预热缓存或临时扩大 L0 覆盖；3) RAG 检索慢→检查 ES/向量库索引；4) 全链路正常但就是慢→其他业务线在跑批量任务争抢资源，请求优先队列。面试关键句：“排查的核心是分层——先确定问题在哪一层，再定向处理，而不是从头到尾全查一遍。”",
  },
  {
    title: "AI 产品上线 Go/No-Go 决策框架（5 项检查）",
    domain: "产品方法论",
    content:
      "上线前 30 分钟最终检查：1) Golden Dataset F1 ≥ 90%（不通过→推迟）；2) P99 延迟 < 1000ms（不通过→推迟或降级 L1）；3) 影子模式 diff < 5%（不通过→排查 diff 原因）；4) 高风险 case 100% 通过红色标记测试（不通过→绝对不能上线）；5) API 可用性 > 99.9% 过去 24h（不通过→推迟）。面试关键句：“这个框架不是我事后总结的，是写进 PRD 里在上线前执行的——AI 产品的上线门槛必须是可量化、可执行的检查清单。”",
  },
  {
    title: "AI 产品线上异常——紧急响应 4 步 SOP",
    domain: "产品方法论",
    content:
      "上线后 2 小时合规团队反馈信号标记异常时：1) 立即启动影子模式——不下线系统，但把 AI 信号从“可操作”切到“仅参考”，强制显示 Yellow+“系统校准中”；2) 拉出异常交易完整推理链路——输入→检索片段→模型输出→信号生成，逐层排查；3) 同步通知合规 stakeholder——不隐瞒，主动说明已切换参考模式，合规场景中透明度比速度重要；4) 1 小时内给出根因和修复时间，无法快速修复则回滚。面试关键句：“合规场景第一原则是‘不确定时默认安全’——切到影子模式让人类兜底，比带着问题跑更正确。”",
  },
  {
    title: "大模型项目——基建团队 vs 应用团队的 6 大核心矛盾",
    domain: "产品方法论",
    content:
      "1) 优先级博弈——你的需求排后面，因为用户量不够大；2) 准确率归属不清——“是你 prompt 的问题还是我模型的问题”互相甩锅；3) 微调需求被拒——“通用基座不能为单一业务线定制”；4) 版本更新不同步——基建升级后应用突然出问题；5) SLA 和资源争抢——共享资源池高峰延迟飙升；6) 问题定位链路不清——出错后每个团队只看自己的日志。面试关键句：“这 6 个矛盾在每家做 AI 的公司都存在，面试官听到你能枚举出来就知道你真做过。”",
  },
  {
    title: "跨团队冲突三步解法——降成本、定责任、共利益",
    domain: "产品方法论",
    content:
      "第一步：缩小你的需求降低对方说“行”的成本（12 个 endpoint→3 个 MVP 版本）；第二步：建立分层问责协议——出错时检索层→模型层→数据层逐层排查，每层有明确 owner 和检查标准；第三步：用你的结果帮对方创造价值——试点数据作为他们的 showcase，帮他们争取下季度资源。面试关键句：“不 escalate、不施压——让对方也赢的方案比任何管理手段都有效。”",
  },
  {
    title: "AI 项目分层问责协议——出错时怎么 5 步定位到人",
    domain: "产品方法论",
    content:
      "合规判断出错时按层排查：Step 1) 检查检索层——是否检索到正确法规条款？→应用团队 RAG 管道责任；Step 2) 检查模型层——正确上下文下模型推理是否正确？→基建团队模型能力责任；Step 3) 检查数据层——法规数据库是否最新？→数据团队责任；Step 4) 检查 prompt 层——指令是否足够清晰？→应用团队 prompt 设计责任；Step 5) 检查集成层——API 传参是否正确、格式是否匹配？→联调双方共同责任。每层检查结果记录存档，问题归属有据可查。面试关键句：“从‘出了问题谁也说不清’到‘5 步定位到具体层和 owner’，这个协议实施后问题定位从 3-5 天缩短到 1 天。”",
  },
  {
    title: "RAG vs 微调——为什么合规场景选 RAG",
    domain: "NLP与LLM",
    content:
      "微调的劣势：1) 黑箱风险——微调后模型为什么给出某个判断无法解释，审计无法通过；2) 法规更新频繁——每次法规变化都要重新微调、重新评估、重新上线，周期太长；3) 基建团队拒绝为单一业务线微调通用基座。RAG 的优势：1) 可解释——每条建议关联具体法规条款引用，审计可追溯；2) 适应快——新法规入库即刻生效，不需要重新训练；3) 应用层可控——不依赖基建团队改模型。补偿方案：RAG + 领域术语表 + few-shot examples 在 prompt 中嵌入合规术语定义，效果接近微调。面试关键句：“在合规场景选 RAG 不是因为技术更简单，而是因为可解释性和审计要求是硬约束——微调做不到引用原文、做不到逐条追溯。”",
  },
  {
    title: "Hybrid Search (BM25 0.4 + Dense 0.6) 的决策逻辑",
    domain: "NLP与LLM",
    content:
      "纯向量检索的问题：金融法规中有大量专有名词（如“FINRA Rule 2111”），纯向量检索可能找到语义相近但条款号不同的内容。BM25 关键词匹配能精确命中条款号。权重选择：Dense 0.6 因为大部分查询是语义性的（“这笔交易是否符合适当性要求”），BM25 0.4 保底精确匹配。K=5 时召回率只有 91.7%，K=10 达到 98%+，K=20 噪声太多影响生成质量。面试关键句：“不是所有检索都适合向量化——越精确的术语越需要关键词匹配，越模糊的意图越需要语义理解，两者混合才是最优。”",
  },
  {
    title: "Semantic Cache——40% 命中率节省 $120K/月的设计",
    domain: "NLP与LLM",
    content:
      "原理：对 RFQ 核心属性做语义哈希（产品类型+交易方向+司法辖区+金额区间），相似查询直接返回缓存结果。数据支撑：Pre-Trade 场景约 40% 查询是重复或高度相似的。效果：缓存命中延迟 <200ms（vs 完整推理 ~1.5s），月度 LLM 推理成本节省约 $120K。风险：模型版本升级后 embedding 空间变化会导致缓存全部失效；法规更新后相关缓存需要主动失效。TTL 设 24 小时。面试关键句：“Semantic Cache 不只是性能优化，更是成本控制——在高频场景下，40% 的缓存命中直接把 LLM 月成本砍了近一半。”",
  },
  {
    title: "法规文档 Chunking——为什么选 512 token",
    domain: "NLP与LLM",
    content:
      "256 token：上下文不完整，一条法规被切成两半，检索到前半段但丢失关键限定条件。512 token：完整覆盖大部分单条法规条款及其注释，语义完整。1024 token：噪声太多，一个 chunk 混入多条不相关条款，影响检索精度和生成质量。特殊处理：跨页表格用 PyMuPDF + 布局分析合并后再 chunk，不按页切割。面试关键句：“Chunking 不是调参数，是理解你的文档结构——法规文档的自然单元是‘一条条款+注释’，512 token 刚好匹配这个粒度。”",
  },
];

function asRecord(value) {
  return value && typeof value === "object" ? value : {};
}

function pickFirstExisting(candidates, propertyNames) {
  for (const key of candidates) {
    if (propertyNames.has(key)) return key;
  }
  return "";
}

function splitRichText(content, maxLen = 1900) {
  const chunks = [];
  let remaining = content.trim();
  while (remaining.length > maxLen) {
    chunks.push(remaining.slice(0, maxLen));
    remaining = remaining.slice(maxLen);
  }
  if (remaining.length) chunks.push(remaining);
  return chunks.map((chunk) => ({ type: "text", text: { content: chunk } }));
}

async function getKnowledgeDbMetadata() {
  const db = await notion.databases.retrieve({ database_id: knowledgeDbId });
  const properties = asRecord(db.properties);
  const names = new Set(Object.keys(properties));
  const titleProp = Object.entries(properties).find(([, value]) => asRecord(value).type === "title");
  const titleKey = titleProp ? titleProp[0] : pickFirstExisting(["Title", "Name"], names);
  return { names, titleKey, properties };
}

function getSelectLikeName(prop) {
  const p = asRecord(prop);
  if (p.type === "select") return "select";
  if (p.type === "multi_select") return "multi_select";
  return "";
}

function buildKnowledgeProperties(row, names, dbProperties, titleKey) {
  const contentKey = pickFirstExisting(["Content", "Answer", "Back", "Notes"], names);
  const promptKey = pickFirstExisting(["Prompt", "Question", "Front"], names);
  const domainKey = pickFirstExisting(["Domain", "Category", "Topic"], names);
  const masteryKey = pickFirstExisting(["Mastery"], names);
  const intervalKey = pickFirstExisting(["Interval"], names);
  const repetitionsKey = pickFirstExisting(["Repetitions"], names);
  const easeFactorKey = pickFirstExisting(["Ease Factor"], names);
  const nextReviewKey = pickFirstExisting(["Next Review"], names);
  const lastQualityKey = pickFirstExisting(["Last Quality"], names);

  const properties = {
    [titleKey]: { title: [{ text: { content: row.title } }] },
  };

  if (promptKey) properties[promptKey] = { rich_text: splitRichText(row.title) };
  if (contentKey) properties[contentKey] = { rich_text: splitRichText(row.content) };
  if (domainKey) {
    const domainType = getSelectLikeName(dbProperties[domainKey]);
    if (domainType === "select") properties[domainKey] = { select: { name: row.domain } };
    if (domainType === "multi_select") properties[domainKey] = { multi_select: [{ name: row.domain }] };
  }
  if (masteryKey) properties[masteryKey] = { number: 0 };
  if (intervalKey) properties[intervalKey] = { number: 1 };
  if (repetitionsKey) properties[repetitionsKey] = { number: 0 };
  if (easeFactorKey) properties[easeFactorKey] = { number: 2.5 };
  if (nextReviewKey) properties[nextReviewKey] = { date: { start: new Date().toISOString().slice(0, 10) } };
  if (lastQualityKey) properties[lastQualityKey] = { number: 0 };

  return properties;
}

function readTitleFromPage(page, titleKey) {
  const properties = asRecord(page.properties);
  const titleProp = asRecord(properties[titleKey]);
  const titleBlocks = Array.isArray(titleProp.title) ? titleProp.title : [];
  return titleBlocks
    .map((block) => block?.plain_text ?? asRecord(block?.text).content ?? "")
    .join("")
    .trim();
}

async function loadExistingPages(titleKey) {
  const existing = new Map();
  let cursor = undefined;
  do {
    const response = await notion.databases.query({
      database_id: knowledgeDbId,
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
  if (!knowledgeDbId) {
    throw new Error("Missing NOTION_KNOWLEDGE_DB in environment.");
  }

  const { names, titleKey, properties } = await getKnowledgeDbMetadata();
  if (!titleKey) {
    throw new Error("Knowledge database is missing a title property (e.g. Title / Name).");
  }

  const existingPages = await loadExistingPages(titleKey);
  let created = 0;
  let updated = 0;

  for (const row of knowledgeRows) {
    const cardProperties = buildKnowledgeProperties(row, names, properties, titleKey);
    const existingPageId = existingPages.get(row.title);
    if (existingPageId) {
      await notion.pages.update({
        page_id: existingPageId,
        properties: cardProperties,
      });
      updated += 1;
      console.log(`🔄 Updated card: ${row.title}`);
    } else {
      await notion.pages.create({
        parent: { database_id: knowledgeDbId },
        properties: cardProperties,
      });
      created += 1;
      console.log(`✅ Created card: ${row.title}`);
    }
  }

  console.log(`\nKnowledge seed completed. created=${created}, updated=${updated}, total=${knowledgeRows.length}`);
}

main().catch((error) => {
  console.error("❌ Knowledge seed failed:", error.message ?? error);
  process.exit(1);
});
