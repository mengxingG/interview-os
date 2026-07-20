import { Client } from "@notionhq/client";
import { normalizeQuestionBankCategory } from "@/lib/question-bank-categories";

// 初始化 Notion 客户端（v2）
const notion = new Client({
  auth: process.env.NOTION_API_KEY,
  timeoutMs: 30000,
});

export async function updateNotionPageProperties(pageId: string, properties: Record<string, unknown>) {
  return notion.pages.update({
    page_id: pageId,
    properties: properties as never,
  });
}

export async function archiveNotionPage(pageId: string) {
  return notion.pages.update({
    page_id: pageId,
    archived: true,
  });
}

// 获取环境变量中的数据库 ID
const dbs = {
  stories: process.env.NOTION_STORIES_DB!,
  jd: process.env.NOTION_JD_DB!,
  interview: process.env.NOTION_INTERVIEW_DB!,
  knowledge: process.env.NOTION_KNOWLEDGE_DB!,
  resume: process.env.NOTION_RESUME_DB || process.env.NOYION_RESUME_DB || "",
  coachingSession: process.env.NOTION_COACHING_SESSION_DB || "",
  questionBank:
    process.env.NOTION_QUESTION_DB ||
    process.env.NOTION_QUESTIONS_DB ||
    process.env.NOTION_QUESTION_BANK_DB ||
    "",
  jobs: process.env.NOTION_JOBS_DB || "",
};

const storyPropertyCache = new Map<string, Set<string>>();
const jdPropertyCache = new Map<string, Set<string>>();
const jdPropertyDefCache = new Map<string, Record<string, { type?: string }>>();
const interviewPropertyCache = new Map<string, Set<string>>();
const resumePropertyCache = new Map<string, Set<string>>();
const resumePropertyDefCache = new Map<string, Record<string, { type?: string }>>();
const coachingPropertyCache = new Map<string, Set<string>>();
const coachingPropertyDefCache = new Map<string, Record<string, { type?: string }>>();
const questionPropertyCache = new Map<string, Set<string>>();
const questionPropertyDefCache = new Map<string, Record<string, { type?: string }>>();
const knowledgePropertyCache = new Map<string, Set<string>>();

function ensureQuestionDbId() {
  if (!dbs.questionBank) {
    throw new Error(
      "Missing Question DB env: set NOTION_QUESTION_DB (legacy: NOTION_QUESTIONS_DB/NOTION_QUESTION_BANK_DB)",
    );
  }
}

async function getStoryPropertyNames() {
  if (storyPropertyCache.has(dbs.stories)) {
    return storyPropertyCache.get(dbs.stories)!;
  }
  const db = await notion.databases.retrieve({ database_id: dbs.stories });
  const properties =
    db && typeof db === "object" && "properties" in db
      ? (db.properties as Record<string, unknown>)
      : {};
  const names = new Set(Object.keys(properties));
  storyPropertyCache.set(dbs.stories, names);
  return names;
}

function pickFirstExisting(candidates: string[], available: Set<string>) {
  return candidates.find((name) => available.has(name));
}

async function getJDPropertyNames() {
  if (jdPropertyCache.has(dbs.jd)) {
    return jdPropertyCache.get(dbs.jd)!;
  }
  const db = await notion.databases.retrieve({ database_id: dbs.jd });
  const properties =
    db && typeof db === "object" && "properties" in db
      ? (db.properties as Record<string, unknown>)
      : {};
  const names = new Set(Object.keys(properties));
  jdPropertyCache.set(dbs.jd, names);
  return names;
}

async function getJDPropertyDefs() {
  if (jdPropertyDefCache.has(dbs.jd)) {
    return jdPropertyDefCache.get(dbs.jd)!;
  }
  const db = await notion.databases.retrieve({ database_id: dbs.jd });
  const properties =
    db && typeof db === "object" && "properties" in db
      ? (db.properties as Record<string, { type?: string }>)
      : {};
  jdPropertyDefCache.set(dbs.jd, properties);
  return properties;
}

async function getInterviewPropertyNames() {
  if (interviewPropertyCache.has(dbs.interview)) {
    return interviewPropertyCache.get(dbs.interview)!;
  }
  const db = await notion.databases.retrieve({ database_id: dbs.interview });
  const properties =
    db && typeof db === "object" && "properties" in db
      ? (db.properties as Record<string, unknown>)
      : {};
  const names = new Set(Object.keys(properties));
  interviewPropertyCache.set(dbs.interview, names);
  return names;
}

async function getResumePropertyNames() {
  if (!dbs.resume) {
    throw new Error("Missing Resume DB env: set NOTION_RESUME_DB (or legacy NOYION_RESUME_DB)");
  }
  if (resumePropertyCache.has(dbs.resume)) {
    return resumePropertyCache.get(dbs.resume)!;
  }
  const db = await notion.databases.retrieve({ database_id: dbs.resume });
  const properties =
    db && typeof db === "object" && "properties" in db
      ? (db.properties as Record<string, unknown>)
      : {};
  const names = new Set(Object.keys(properties));
  resumePropertyCache.set(dbs.resume, names);
  return names;
}

async function getResumePropertyDefs() {
  if (!dbs.resume) {
    throw new Error("Missing Resume DB env: set NOTION_RESUME_DB (or legacy NOYION_RESUME_DB)");
  }
  if (resumePropertyDefCache.has(dbs.resume)) {
    return resumePropertyDefCache.get(dbs.resume)!;
  }
  const db = await notion.databases.retrieve({ database_id: dbs.resume });
  const properties =
    db && typeof db === "object" && "properties" in db
      ? (db.properties as Record<string, { type?: string }>)
      : {};
  resumePropertyDefCache.set(dbs.resume, properties);
  return properties;
}

async function getCoachingPropertyNames() {
  if (!dbs.coachingSession) {
    throw new Error("Missing Coaching Session DB env: set NOTION_COACHING_SESSION_DB");
  }
  if (coachingPropertyCache.has(dbs.coachingSession)) {
    return coachingPropertyCache.get(dbs.coachingSession)!;
  }
  const db = await notion.databases.retrieve({ database_id: dbs.coachingSession });
  const properties =
    db && typeof db === "object" && "properties" in db
      ? (db.properties as Record<string, unknown>)
      : {};
  const names = new Set(Object.keys(properties));
  coachingPropertyCache.set(dbs.coachingSession, names);
  return names;
}

async function getCoachingPropertyDefs() {
  if (!dbs.coachingSession) {
    throw new Error("Missing Coaching Session DB env: set NOTION_COACHING_SESSION_DB");
  }
  if (coachingPropertyDefCache.has(dbs.coachingSession)) {
    return coachingPropertyDefCache.get(dbs.coachingSession)!;
  }
  const db = await notion.databases.retrieve({ database_id: dbs.coachingSession });
  const properties =
    db && typeof db === "object" && "properties" in db
      ? (db.properties as Record<string, { type?: string }>)
      : {};
  coachingPropertyDefCache.set(dbs.coachingSession, properties);
  return properties;
}

async function getQuestionPropertyNames() {
  ensureQuestionDbId();
  if (questionPropertyCache.has(dbs.questionBank)) {
    return questionPropertyCache.get(dbs.questionBank)!;
  }
  const defs = await getQuestionPropertyDefs();
  const names = new Set(Object.keys(defs));
  questionPropertyCache.set(dbs.questionBank, names);
  return names;
}

async function getQuestionPropertyDefs() {
  ensureQuestionDbId();
  if (questionPropertyDefCache.has(dbs.questionBank)) {
    return questionPropertyDefCache.get(dbs.questionBank)!;
  }
  const db = await notion.databases.retrieve({ database_id: dbs.questionBank });
  const properties =
    db && typeof db === "object" && "properties" in db
      ? (db.properties as Record<string, { type?: string }>)
      : {};
  questionPropertyDefCache.set(dbs.questionBank, properties);
  return properties;
}

/** 按 Notion 字段真实类型写入 select / multi_select（Category 已改为 multi_select） */
function writeSelectLikeValue(
  defs: Record<string, { type?: string }>,
  key: string,
  value: string,
): Record<string, unknown> {
  const type = defs[key]?.type;
  const name = String(value ?? "").trim();
  if (!name) return {};
  if (type === "multi_select" || key === "Category" || /categor|分类/i.test(key)) {
    return { multi_select: [{ name }] };
  }
  return { select: { name } };
}

async function getKnowledgePropertyNames() {
  if (knowledgePropertyCache.has(dbs.knowledge)) {
    return knowledgePropertyCache.get(dbs.knowledge)!;
  }
  const db = await notion.databases.retrieve({ database_id: dbs.knowledge });
  const properties =
    db && typeof db === "object" && "properties" in db
      ? (db.properties as Record<string, unknown>)
      : {};
  const names = new Set(Object.keys(properties));
  knowledgePropertyCache.set(dbs.knowledge, names);
  return names;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function readRichText(properties: Record<string, unknown>, key: string) {
  const prop = asRecord(properties[key]);
  const rich = Array.isArray(prop.rich_text) ? prop.rich_text : [];
  return rich
    .map((item) =>
      item !== null && typeof item === "object" && "plain_text" in item
        ? String((item as { plain_text?: unknown }).plain_text ?? "")
        : "",
    )
    .join("")
    .trim();
}

function readTitle(properties: Record<string, unknown>, key: string) {
  const prop = asRecord(properties[key]);
  const title = Array.isArray(prop.title) ? prop.title : [];
  return title
    .map((item) =>
      item !== null && typeof item === "object" && "plain_text" in item
        ? String((item as { plain_text?: unknown }).plain_text ?? "")
        : "",
    )
    .join("")
    .trim();
}

function readSelect(properties: Record<string, unknown>, key: string, fallback = "") {
  const prop = asRecord(properties[key]);
  const select = asRecord(prop.select);
  if (typeof select.name === "string" && select.name.trim()) return select.name;
  // Category 等字段可能已改成 multi_select：取首个选项作为主分类
  const multi = Array.isArray(prop.multi_select) ? prop.multi_select : [];
  for (const item of multi) {
    if (item !== null && typeof item === "object" && "name" in item) {
      const name = String((item as { name?: unknown }).name ?? "").trim();
      if (name) return name;
    }
  }
  return fallback;
}

function readNumber(properties: Record<string, unknown>, key: string, fallback = 0) {
  const prop = asRecord(properties[key]);
  return typeof prop.number === "number" ? prop.number : fallback;
}

function readDate(properties: Record<string, unknown>, key: string, fallback = "") {
  const prop = asRecord(properties[key]);
  const date = asRecord(prop.date);
  return typeof date.start === "string" ? date.start : fallback;
}

function readCheckbox(properties: Record<string, unknown>, key: string, fallback = false) {
  const prop = asRecord(properties[key]);
  return typeof prop.checkbox === "boolean" ? prop.checkbox : fallback;
}

function readMultiSelect(properties: Record<string, unknown>, key: string) {
  const prop = asRecord(properties[key]);
  const list = Array.isArray(prop.multi_select) ? prop.multi_select : [];
  return list
    .map((item) =>
      item !== null && typeof item === "object" && "name" in item
        ? String((item as { name?: unknown }).name ?? "")
        : "",
    )
    .filter(Boolean);
}

function readRelation(properties: Record<string, unknown>, key: string) {
  const prop = asRecord(properties[key]);
  const list = Array.isArray(prop.relation) ? prop.relation : [];
  return list
    .map((item) =>
      item !== null && typeof item === "object" && "id" in item
        ? { id: String((item as { id?: unknown }).id ?? "") }
        : null,
    )
    .filter((item): item is { id: string } => Boolean(item?.id));
}

function toRichTextBlocks(text: string, chunkSize = 1800, maxBlocks = 50) {
  const safe = String(text ?? "");
  if (!safe) return [] as Array<{ text: { content: string } }>;
  const blocks: Array<{ text: { content: string } }> = [];
  for (let i = 0; i < safe.length && blocks.length < maxBlocks; i += chunkSize) {
    blocks.push({ text: { content: safe.slice(i, i + chunkSize) } });
  }
  return blocks;
}

function createNotionRichText(text: string) {
  if (!text) return [] as Array<{ text: { content: string } }>;
  const MAX_LENGTH = 1999;
  const chunks: Array<{ text: { content: string } }> = [];
  for (let i = 0; i < text.length; i += MAX_LENGTH) {
    chunks.push({
      text: { content: text.substring(i, i + MAX_LENGTH) },
    });
  }
  return chunks;
}

const NOTION_PROPERTY_SOFT_LIMIT = 1900;

function truncateForNotionProperty(text: string) {
  const safe = String(text ?? "").trim();
  if (!safe) return "";
  if (safe.length <= NOTION_PROPERTY_SOFT_LIMIT) return safe;
  return `${safe.slice(0, NOTION_PROPERTY_SOFT_LIMIT)}...（完整内容请在页面正文查看）`;
}

async function appendTextBlocksToPage(pageId: string, title: string, text: string) {
  const content = String(text ?? "").trim();
  if (!content) return;
  const children: Array<Record<string, unknown>> = [
    {
      object: "block",
      type: "heading_3",
      heading_3: { rich_text: [{ type: "text", text: { content: title } }] },
    },
  ];
  for (const chunk of toRichTextBlocks(content, 1800, 120)) {
    children.push({
      object: "block",
      type: "paragraph",
      paragraph: { rich_text: [{ type: "text", text: { content: chunk.text.content } }] },
    });
  }
  const batchSize = 80;
  for (let i = 0; i < children.length; i += batchSize) {
    await notion.blocks.children.append({
      block_id: pageId,
      children: children.slice(i, i + batchSize) as never,
    });
  }
}

export async function appendStoryDefenseRecord(data: {
  storyPageId: string;
  storyTitle: string;
  persona: "technical" | "execution" | "behavioral";
  qaPairs: Array<{ question: string; answer: string }>;
  createdAt?: string;
}) {
  const createdAt = data.createdAt ?? new Date().toISOString();
  const stamp = new Date(createdAt);
  const dateText = Number.isNaN(stamp.getTime())
    ? createdAt.slice(0, 10)
    : `${stamp.getFullYear()}/${String(stamp.getMonth() + 1).padStart(2, "0")}/${String(stamp.getDate()).padStart(2, "0")}`;
  const personaLabel =
    data.persona === "technical"
      ? "Technical"
      : data.persona === "execution"
        ? "Execution"
        : "Behavioral";
  const children: Array<Record<string, unknown>> = [
    {
      object: "block",
      type: "divider",
      divider: {},
    },
    {
      object: "block",
      type: "heading_3",
      heading_3: {
        rich_text: [
          {
            type: "text",
            text: { content: `--- ${dateText} 压力面拷问记录 ---` },
          },
        ],
      },
    },
    {
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [
          {
            type: "text",
            text: { content: `故事：${data.storyTitle}｜考官人设：${personaLabel}` },
          },
        ],
      },
    },
  ];

  data.qaPairs.forEach((pair, idx) => {
    const qTitle = `Q${idx + 1}. ${pair.question}`.trim();
    for (const chunk of toRichTextBlocks(qTitle, 1800, 20)) {
      children.push({
        object: "block",
        type: "heading_3",
        heading_3: { rich_text: [{ type: "text", text: { content: chunk.text.content } }] },
      });
    }
    for (const chunk of toRichTextBlocks(pair.answer, 1800, 40)) {
      children.push({
        object: "block",
        type: "quote",
        quote: { rich_text: [{ type: "text", text: { content: chunk.text.content } }] },
      });
    }
  });

  const batchSize = 80;
  for (let i = 0; i < children.length; i += batchSize) {
    await notion.blocks.children.append({
      block_id: data.storyPageId,
      children: children.slice(i, i + batchSize) as never,
    });
  }
}

function getHeading2Text(block: Record<string, unknown>) {
  const type = typeof block.type === "string" ? block.type : "";
  if (type !== "heading_2") return "";
  const heading = asRecord((block as Record<string, unknown>)[type]);
  const rich = Array.isArray(heading.rich_text) ? (heading.rich_text as unknown[]) : [];
  const text = rich
    .map((item) => {
      if (item && typeof item === "object" && "plain_text" in item) {
        return String((item as { plain_text?: unknown }).plain_text ?? "");
      }
      if (item && typeof item === "object" && "text" in item) {
        const t = item as { text?: { content?: unknown } };
        return typeof t.text?.content === "string" ? t.text.content : "";
      }
      return "";
    })
    .join("");
  return text.trim();
}

function toRichTextForBlocks(text: string) {
  return toRichTextBlocks(text, 1800, 50).map((chunk) => ({
    type: "text" as const,
    text: { content: chunk.text.content },
  }));
}

export async function syncStoryOptimizationStructured(data: {
  pageId: string;
  standardText?: string;
  ninetySecText?: string;
  customText?: string;
  defenseFaqPairs: Array<{
    questionText: string;
    questionTitle: string;
    answerText: string;
    answerContent: string;
  }>;
}) {
  const standardHeading2 = "## ✨ AI 优化后的 STAR 版本";
  const ninetyHeading2 = "## ⏱️ 90秒口述备战版";
  const customHeading2 = "## 🎯 岗位深度定制版";

  const standardContent = String(data.standardText ?? "").trim();
  const ninetyContent = String(data.ninetySecText ?? "").trim();
  const customContent = String(data.customText ?? "").trim();
  const hasDefense = Array.isArray(data.defenseFaqPairs) && data.defenseFaqPairs.length > 0;
  if (!data.pageId || (!standardContent && !ninetyContent && !customContent && !hasDefense)) return;

  function getToggleTitle(block: Record<string, unknown>) {
    const type = typeof block.type === "string" ? block.type : "";
    if (type !== "toggle") return "";
    const toggle = asRecord((block as Record<string, unknown>)[type]);
    const rich = Array.isArray(toggle.rich_text) ? (toggle.rich_text as unknown[]) : [];
    const text = rich
      .map((item) => {
        if (item && typeof item === "object" && "plain_text" in item) {
          return String((item as { plain_text?: unknown }).plain_text ?? "");
        }
        if (item && typeof item === "object" && "text" in item) {
          const t = item as { text?: { content?: unknown } };
          return typeof t.text?.content === "string" ? t.text.content : "";
        }
        return "";
      })
      .join("");
    return text.trim();
  }

  // 1) List existing blocks once, then delete the sections we are about to re-add.
  const existingBlocks: Array<{ id: string; type: string; headingText: string; toggleTitle: string }> = [];
  let cursor: string | undefined = undefined;
  do {
    const response = await notion.blocks.children.list({
      block_id: data.pageId,
      start_cursor: cursor,
      page_size: 100,
    });

    for (const block of response.results) {
      const b = block as Record<string, unknown>;
      const t = typeof b.type === "string" ? b.type : "";
      existingBlocks.push({
        id: typeof b.id === "string" ? b.id : "",
        type: t,
        headingText: getHeading2Text(b),
        toggleTitle: getToggleTitle(b),
      });
    }
    cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (cursor);

  const idsToDelete = new Set<string>();

  const deleteRangeByHeading2 = (heading2Text: string) => {
    const startIdx = existingBlocks.findIndex(
      (b) => b.type === "heading_2" && b.headingText === heading2Text,
    );
    if (startIdx < 0) return;
    const nextHeading2Idx = existingBlocks.findIndex((b, idx) => idx > startIdx && b.type === "heading_2");
    const endExclusive = nextHeading2Idx >= 0 ? nextHeading2Idx : existingBlocks.length;
    for (const b of existingBlocks.slice(startIdx, endExclusive)) {
      if (b.id) idsToDelete.add(b.id);
    }
  };

  if (standardContent) deleteRangeByHeading2(standardHeading2);
  if (ninetyContent) deleteRangeByHeading2(ninetyHeading2);
  if (customContent) deleteRangeByHeading2(customHeading2);
  if (hasDefense) {
    for (const b of existingBlocks) {
      if (b.type === "toggle" && b.toggleTitle.startsWith("🔴 追问：") && b.id) {
        idsToDelete.add(b.id);
      }
    }
  }

  for (const blockId of Array.from(idsToDelete).filter(Boolean)) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await notion.blocks.delete({ block_id: blockId });
    } catch {
      // best-effort deletion
    }
  }

  // 2) Append structured optimized content + defense Q&A toggles (only for extracted modules).
  const children: Array<Record<string, unknown>> = [];

  if (standardContent) {
    children.push({
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: [{ type: "text", text: { content: standardHeading2 } }],
      },
    });
    children.push({
      object: "block",
      type: "quote",
      quote: { rich_text: toRichTextForBlocks(standardContent) },
    });
  }

  if (ninetyContent) {
    children.push({
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: [{ type: "text", text: { content: ninetyHeading2 } }],
      },
    });
    children.push({
      object: "block",
      type: "callout",
      callout: {
        rich_text: toRichTextForBlocks(ninetyContent),
        icon: { emoji: "🔵" },
      },
    });
  }

  if (customContent) {
    children.push({
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: [{ type: "text", text: { content: customHeading2 } }],
      },
    });
    children.push({
      object: "block",
      type: "quote",
      quote: { rich_text: toRichTextForBlocks(customContent) },
    });
  }

  if (hasDefense) {
    for (const pair of data.defenseFaqPairs) {
      const qText = String(pair.questionText ?? "").trim();
      const qTitle = String(pair.questionTitle ?? "").trim();
      const aText = String(pair.answerText ?? "").trim();
      const aContent = String(pair.answerContent ?? "").trim();

      const toggleTitle = `🔴 追问：${qText}${qTitle ? ` (${qTitle})` : ""}`;
      const toggleBody = `🟢 防御：${aText}${aContent ? ` (${aContent})` : ""}`;

      children.push({
        object: "block",
        type: "toggle",
        toggle: {
          rich_text: [{ type: "text", text: { content: toggleTitle } }],
          children: [
            {
              object: "block",
              type: "quote",
              quote: { rich_text: toRichTextForBlocks(toggleBody) },
            },
          ],
        },
      });
    }
  }

  const batchSize = 80;
  for (let i = 0; i < children.length; i += batchSize) {
    // eslint-disable-next-line no-await-in-loop
    await notion.blocks.children.append({
      block_id: data.pageId,
      children: children.slice(i, i + batchSize) as never,
    });
  }
}

export type QuestionRow = {
  id: string;
  title: string;
  category: string;
  source: string;
  company: string;
  role: string;
  /** Notion Round/轮次；无该字段时为空，按公司看会归入未标注轮次 */
  round: string;
  difficulty: string;
  myAnswer: string;
  aiFeedback: string;
  bestStory: string;
  tags: string[];
  practiceCount: number;
  lastScore: number;
  lastPracticed: string;
  status: string;
  knowledge: Array<{ id: string }>;
};

function isEmptyQuestionRow(row: QuestionRow) {
  const noTitle = row.title.trim().length === 0;
  const noCoreText =
    row.company.trim().length === 0 &&
    row.role.trim().length === 0 &&
    row.myAnswer.trim().length === 0 &&
    row.aiFeedback.trim().length === 0 &&
    row.bestStory.trim().length === 0;
  const noTags = row.tags.length === 0;
  const untouchedMeta =
    row.practiceCount === 0 &&
    row.lastScore === 0 &&
    row.lastPracticed.trim().length === 0 &&
    row.status === "未练习";
  return noTitle && noCoreText && noTags && untouchedMeta;
}

export async function getQuestions(filters?: {
  category?: string;
  source?: string;
  company?: string;
  status?: string;
  tags?: string[];
  q?: string;
}) {
  ensureQuestionDbId();
  const response = await notion.databases.query({
    database_id: dbs.questionBank,
  });
  const rows: QuestionRow[] = response.results.map((item) => {
    const record = asRecord(item);
    const properties = asRecord(record.properties);
    const titleKey = Object.keys(properties).find((key) => asRecord(properties[key]).type === "title") ?? "Title";
    const categoryKey = Object.keys(properties).find((key) => key.toLowerCase().includes("category")) ?? "Category";
    const sourceKey = Object.keys(properties).find((key) => key.toLowerCase().includes("source")) ?? "Source";
    const companyKey = Object.keys(properties).find((key) => key.toLowerCase().includes("company")) ?? "Company";
    const roleKey = Object.keys(properties).find((key) => key.toLowerCase().includes("role")) ?? "Role";
    const roundKey =
      Object.keys(properties).find((key) => {
        const lower = key.toLowerCase();
        return lower === "round" || lower.includes("轮次") || lower === "面试轮次";
      }) ?? "";
    const difficultyKey = Object.keys(properties).find((key) => key.toLowerCase().includes("difficulty")) ?? "Difficulty";
    const myAnswerKey = Object.keys(properties).find((key) => key.toLowerCase().includes("my answer")) ?? "My Answer";
    const aiFeedbackKey = Object.keys(properties).find((key) => key.toLowerCase().includes("ai feedback")) ?? "AI Feedback";
    const bestStoryKey = Object.keys(properties).find((key) => key.toLowerCase().includes("best story")) ?? "Best Story";
    const tagsKey = Object.keys(properties).find((key) => key.toLowerCase().includes("tags")) ?? "Tags";
    const practiceCountKey = Object.keys(properties).find((key) => key.toLowerCase().includes("practice count")) ?? "Practice Count";
    const lastScoreKey = Object.keys(properties).find((key) => key.toLowerCase().includes("last score")) ?? "Last Score";
    const lastPracticedKey = Object.keys(properties).find((key) => key.toLowerCase().includes("last practiced")) ?? "Last Practiced";
    const statusKey = Object.keys(properties).find((key) => key.toLowerCase().includes("status")) ?? "Status";
    const knowledgeKey = Object.keys(properties).find((key) => key.toLowerCase().includes("knowledge")) ?? "Knowledge";

    const roundRaw = roundKey
      ? readSelect(properties, roundKey, "") || readRichText(properties, roundKey)
      : "";

    return {
      id: typeof record.id === "string" ? record.id : "",
      title: readTitle(properties, titleKey),
      category: normalizeQuestionBankCategory(readSelect(properties, categoryKey, "项目深挖")),
      source: readSelect(properties, sourceKey, "手动输入"),
      company: readRichText(properties, companyKey),
      role: readRichText(properties, roleKey),
      round: roundRaw.trim(),
      difficulty: readSelect(properties, difficultyKey, "中等"),
      myAnswer: readRichText(properties, myAnswerKey),
      aiFeedback: readRichText(properties, aiFeedbackKey),
      bestStory: readRichText(properties, bestStoryKey),
      tags: readMultiSelect(properties, tagsKey),
      practiceCount: readNumber(properties, practiceCountKey, 0),
      lastScore: readNumber(properties, lastScoreKey, 0),
      lastPracticed: readDate(properties, lastPracticedKey, ""),
      status: readSelect(properties, statusKey, "未练习"),
      knowledge: readRelation(properties, knowledgeKey),
    };
  });

  return rows.filter((row) => {
    if (isEmptyQuestionRow(row)) return false;
    if (filters?.category && filters.category !== "all" && row.category !== filters.category) return false;
    if (filters?.source && filters.source !== "all" && row.source !== filters.source) return false;
    if (filters?.company && filters.company !== "all" && row.company !== filters.company) return false;
    if (filters?.status && filters.status !== "all" && row.status !== filters.status) return false;
    if (filters?.tags?.length && !filters.tags.some((tag) => row.tags.includes(tag))) return false;
    if (filters?.q && !`${row.title} ${row.company} ${row.role}`.toLowerCase().includes(filters.q.toLowerCase())) return false;
    return true;
  });
}

export async function addQuestion(data: Omit<QuestionRow, "id">) {
  ensureQuestionDbId();
  const available = await getQuestionPropertyNames();
  const defs = await getQuestionPropertyDefs();
  const titleKey = pickFirstExisting(["Title", "Name"], available);
  if (!titleKey) throw new Error("QuestionBank database must contain Title/Name");
  const categoryKey = pickFirstExisting(["Category", "分类"], available);
  const sourceKey = pickFirstExisting(["Source", "来源"], available);
  const companyKey = pickFirstExisting(["Company", "公司"], available);
  const roleKey = pickFirstExisting(["Role", "岗位"], available);
  const roundKey = pickFirstExisting(["Round", "轮次", "面试轮次"], available);
  const difficultyKey = pickFirstExisting(["Difficulty", "难度"], available);
  const myAnswerKey = pickFirstExisting(["My Answer"], available);
  const aiFeedbackKey = pickFirstExisting(["AI Feedback"], available);
  const bestStoryKey = pickFirstExisting(["Best Story"], available);
  const tagsKey = pickFirstExisting(["Tags", "标签"], available);
  const practiceCountKey = pickFirstExisting(["Practice Count"], available);
  const lastScoreKey = pickFirstExisting(["Last Score"], available);
  const lastPracticedKey = pickFirstExisting(["Last Practiced"], available);
  const statusKey = pickFirstExisting(["Status", "状态"], available);
  const knowledgeKey = pickFirstExisting(["Knowledge"], available);

  const category = normalizeQuestionBankCategory(data.category);
  const properties: Record<string, unknown> = {
    [titleKey]: { title: [{ text: { content: data.title } }] },
    ...(categoryKey ? { [categoryKey]: writeSelectLikeValue(defs, categoryKey, category) } : {}),
    ...(sourceKey ? { [sourceKey]: writeSelectLikeValue(defs, sourceKey, data.source) } : {}),
    ...(companyKey ? { [companyKey]: { rich_text: [{ text: { content: data.company } }] } } : {}),
    ...(roleKey ? { [roleKey]: { rich_text: [{ text: { content: data.role } }] } } : {}),
    ...(roundKey && data.round?.trim()
      ? {
          [roundKey]:
            defs[roundKey]?.type === "rich_text"
              ? { rich_text: [{ text: { content: data.round.trim() } }] }
              : writeSelectLikeValue(defs, roundKey, data.round.trim()),
        }
      : {}),
    ...(difficultyKey ? { [difficultyKey]: writeSelectLikeValue(defs, difficultyKey, data.difficulty) } : {}),
    ...(myAnswerKey ? { [myAnswerKey]: { rich_text: [{ text: { content: data.myAnswer.slice(0, 2000) } }] } } : {}),
    ...(aiFeedbackKey ? { [aiFeedbackKey]: { rich_text: [{ text: { content: data.aiFeedback.slice(0, 2000) } }] } } : {}),
    ...(bestStoryKey ? { [bestStoryKey]: { rich_text: [{ text: { content: data.bestStory } }] } } : {}),
    ...(tagsKey ? { [tagsKey]: { multi_select: data.tags.map((tag) => ({ name: tag })) } } : {}),
    ...(practiceCountKey ? { [practiceCountKey]: { number: data.practiceCount } } : {}),
    ...(lastScoreKey ? { [lastScoreKey]: { number: data.lastScore } } : {}),
    ...(lastPracticedKey && data.lastPracticed ? { [lastPracticedKey]: { date: { start: data.lastPracticed } } } : {}),
    ...(statusKey ? { [statusKey]: writeSelectLikeValue(defs, statusKey, data.status) } : {}),
    ...(knowledgeKey && Array.isArray(data.knowledge) && data.knowledge.length > 0
      ? { [knowledgeKey]: { relation: data.knowledge.map((item) => ({ id: item.id })) } }
      : {}),
  };

  return notion.pages.create({
    parent: { database_id: dbs.questionBank },
    properties: properties as never,
  });
}

export async function addQuestionsBatch(rows: Array<Omit<QuestionRow, "id">>) {
  await Promise.all(rows.map((item) => addQuestion(item)));
}

export async function updateQuestion(pageId: string, data: Partial<Omit<QuestionRow, "id">>) {
  const available = await getQuestionPropertyNames();
  const defs = await getQuestionPropertyDefs();
  const titleKey = pickFirstExisting(["Title", "Name"], available);
  const categoryKey = pickFirstExisting(["Category", "分类"], available);
  const sourceKey = pickFirstExisting(["Source", "来源"], available);
  const companyKey = pickFirstExisting(["Company", "公司"], available);
  const roleKey = pickFirstExisting(["Role", "岗位"], available);
  const roundKey = pickFirstExisting(["Round", "轮次", "面试轮次"], available);
  const difficultyKey = pickFirstExisting(["Difficulty", "难度"], available);
  const myAnswerKey = pickFirstExisting(["My Answer"], available);
  const aiFeedbackKey = pickFirstExisting(["AI Feedback"], available);
  const bestStoryKey = pickFirstExisting(["Best Story"], available);
  const tagsKey = pickFirstExisting(["Tags", "标签"], available);
  const practiceCountKey = pickFirstExisting(["Practice Count"], available);
  const lastScoreKey = pickFirstExisting(["Last Score"], available);
  const lastPracticedKey = pickFirstExisting(["Last Practiced"], available);
  const statusKey = pickFirstExisting(["Status", "状态"], available);
  const knowledgeKey = pickFirstExisting(["Knowledge"], available);

  const properties: Record<string, unknown> = {};
  if (titleKey && typeof data.title === "string") {
    properties[titleKey] = { title: [{ text: { content: data.title } }] };
  }
  if (data.category && categoryKey) {
    properties[categoryKey] = writeSelectLikeValue(defs, categoryKey, normalizeQuestionBankCategory(data.category));
  }
  if (data.source && sourceKey) properties[sourceKey] = writeSelectLikeValue(defs, sourceKey, data.source);
  if (typeof data.company === "string" && companyKey) properties[companyKey] = { rich_text: [{ text: { content: data.company } }] };
  if (typeof data.role === "string" && roleKey) properties[roleKey] = { rich_text: [{ text: { content: data.role } }] };
  if (typeof data.round === "string" && roundKey && data.round.trim()) {
    properties[roundKey] =
      defs[roundKey]?.type === "rich_text"
        ? { rich_text: [{ text: { content: data.round.trim() } }] }
        : writeSelectLikeValue(defs, roundKey, data.round.trim());
  }
  if (data.difficulty && difficultyKey) properties[difficultyKey] = writeSelectLikeValue(defs, difficultyKey, data.difficulty);
  if (typeof data.myAnswer === "string" && myAnswerKey) properties[myAnswerKey] = { rich_text: [{ text: { content: data.myAnswer.slice(0, 2000) } }] };
  if (typeof data.aiFeedback === "string" && aiFeedbackKey) properties[aiFeedbackKey] = { rich_text: [{ text: { content: data.aiFeedback.slice(0, 2000) } }] };
  if (typeof data.bestStory === "string" && bestStoryKey) properties[bestStoryKey] = { rich_text: [{ text: { content: data.bestStory } }] };
  if (Array.isArray(data.tags) && tagsKey) properties[tagsKey] = { multi_select: data.tags.map((tag) => ({ name: tag })) };
  if (typeof data.practiceCount === "number" && practiceCountKey) properties[practiceCountKey] = { number: data.practiceCount };
  if (typeof data.lastScore === "number" && lastScoreKey) properties[lastScoreKey] = { number: data.lastScore };
  if (typeof data.lastPracticed === "string" && lastPracticedKey) properties[lastPracticedKey] = { date: { start: data.lastPracticed } };
  if (typeof data.status === "string" && statusKey) properties[statusKey] = writeSelectLikeValue(defs, statusKey, data.status);
  if (Array.isArray(data.knowledge) && knowledgeKey) properties[knowledgeKey] = { relation: data.knowledge.map((item) => ({ id: item.id })) };

  return notion.pages.update({
    page_id: pageId,
    properties: properties as never,
  });
}

export async function archiveQuestion(pageId: string) {
  return notion.pages.update({
    page_id: pageId,
    archived: true,
  });
}

// ==========================================
// 1. 故事库 (StoryBank) 操作
// ==========================================
export async function getStories() {
  const response = await notion.databases.query({
    database_id: dbs.stories,
    sorts: [{ property: "Last Used", direction: "descending" }],
  });
  return response.results;
}

export async function addStory(data: {
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  earnedSecret: string;
  tags: string[];
  strength: number;
  aiCachedViews?: Record<string, string>;
}) {
  const available = await getStoryPropertyNames();
  const titleKey = pickFirstExisting(["Title", "Name"], available);
  if (!titleKey) {
    throw new Error("Story database must contain Title or Name property.");
  }

  const properties: Record<string, unknown> = {
    [titleKey]: { title: [{ text: { content: data.title } }] },
  };

  const situationKey = pickFirstExisting(
    ["Situation", "Context", "情境", "场景", "背景", "场景（Situation）", "情境（Situation）"],
    available,
  );
  if (situationKey) {
    properties[situationKey] = { rich_text: [{ text: { content: data.situation } }] };
  }
  const taskKey = pickFirstExisting(
    ["Task", "Goal", "任务", "目标", "任务（Task）", "目标（Task）", "任务（Goal）"],
    available,
  );
  if (taskKey) {
    properties[taskKey] = { rich_text: [{ text: { content: data.task } }] };
  }
  const actionKey = pickFirstExisting(
    ["Action", "Actions", "行动", "做法", "行动（Action）", "做法（Action）"],
    available,
  );
  if (actionKey) {
    properties[actionKey] = { rich_text: [{ text: { content: data.action } }] };
  }
  const resultKey = pickFirstExisting(
    ["Result", "Outcome", "结果", "成果", "结果（Result）", "成果（Result）"],
    available,
  );
  if (resultKey) {
    properties[resultKey] = { rich_text: [{ text: { content: data.result } }] };
  }
  const earnedKey = pickFirstExisting(
    ["Earned Secret", "Learning", "关键洞察", "收获", "关键洞察（Earned Secret）", "复盘启发"],
    available,
  );
  if (earnedKey) {
    properties[earnedKey] = { rich_text: [{ text: { content: data.earnedSecret } }] };
  }
  const tagsKey = pickFirstExisting(["Tags", "Tag"], available);
  if (tagsKey) {
    properties[tagsKey] = { multi_select: data.tags.map((tag) => ({ name: tag })) };
  }
  const cachedViewsKey = pickFirstExisting(["AI_Cached_Views", "AI Cached Views", "aiCachedViews"], available);
  if (cachedViewsKey && data.aiCachedViews) {
    properties[cachedViewsKey] = { rich_text: toRichTextBlocks(JSON.stringify(data.aiCachedViews)) };
  }
  const strengthKey = pickFirstExisting(["Strength", "Rating"], available);
  if (strengthKey) {
    properties[strengthKey] = { number: data.strength };
  }
  const useCountKey = pickFirstExisting(["Use Count", "UseCount"], available);
  if (useCountKey) {
    properties[useCountKey] = { number: 0 };
  }

  return await notion.pages.create({
    parent: { database_id: dbs.stories },
    properties: properties as never,
  });
}

export async function updateStory(data: {
  pageId: string;
  title?: string;
  situation?: string;
  task?: string;
  action?: string;
  result?: string;
  earnedSecret?: string;
  tags?: string[];
  strength?: number;
  aiCachedViews?: Record<string, string>;
  clearCachedViews?: boolean;
}) {
  const available = await getStoryPropertyNames();
  const titleKey = pickFirstExisting(["Title", "Name"], available);
  if (!titleKey) {
    throw new Error("Story database must contain Title or Name property.");
  }

  const properties: Record<string, unknown> = {};
  if (typeof data.title === "string") {
    properties[titleKey] = { title: [{ text: { content: data.title } }] };
  }

  const situationKey = pickFirstExisting(
    ["Situation", "Context", "情境", "场景", "背景", "场景（Situation）", "情境（Situation）"],
    available,
  );
  if (situationKey && typeof data.situation === "string") {
    properties[situationKey] = { rich_text: [{ text: { content: data.situation } }] };
  }
  const taskKey = pickFirstExisting(
    ["Task", "Goal", "任务", "目标", "任务（Task）", "目标（Task）", "任务（Goal）"],
    available,
  );
  if (taskKey && typeof data.task === "string") {
    properties[taskKey] = { rich_text: [{ text: { content: data.task } }] };
  }
  const actionKey = pickFirstExisting(
    ["Action", "Actions", "行动", "做法", "行动（Action）", "做法（Action）"],
    available,
  );
  if (actionKey && typeof data.action === "string") {
    properties[actionKey] = { rich_text: [{ text: { content: data.action } }] };
  }
  const resultKey = pickFirstExisting(
    ["Result", "Outcome", "结果", "成果", "结果（Result）", "成果（Result）"],
    available,
  );
  if (resultKey && typeof data.result === "string") {
    properties[resultKey] = { rich_text: [{ text: { content: data.result } }] };
  }
  const earnedKey = pickFirstExisting(
    ["Earned Secret", "Learning", "关键洞察", "收获", "关键洞察（Earned Secret）", "复盘启发"],
    available,
  );
  if (earnedKey && typeof data.earnedSecret === "string") {
    properties[earnedKey] = { rich_text: [{ text: { content: data.earnedSecret } }] };
  }
  const tagsKey = pickFirstExisting(["Tags", "Tag"], available);
  if (tagsKey && Array.isArray(data.tags)) {
    properties[tagsKey] = { multi_select: data.tags.map((tag) => ({ name: tag })) };
  }
  const cachedViewsKey = pickFirstExisting(["AI_Cached_Views", "AI Cached Views", "aiCachedViews"], available);
  if (cachedViewsKey) {
    if (data.clearCachedViews) {
      properties[cachedViewsKey] = { rich_text: [] };
    } else if (data.aiCachedViews) {
      properties[cachedViewsKey] = { rich_text: toRichTextBlocks(JSON.stringify(data.aiCachedViews)) };
    }
  }
  const strengthKey = pickFirstExisting(["Strength", "Rating"], available);
  if (strengthKey && typeof data.strength === "number") {
    properties[strengthKey] = { number: data.strength };
  }

  return await notion.pages.update({
    page_id: data.pageId,
    properties: properties as never,
  });
}

export async function archiveStory(pageId: string) {
  return await notion.pages.update({
    page_id: pageId,
    archived: true,
  });
}

export async function updateStoryUsage(data: {
  pageId: string;
  useCount: number;
  lastUsed: string;
}) {
  const available = await getStoryPropertyNames();
  const properties: Record<string, unknown> = {};
  const useCountKey = pickFirstExisting(["Use Count", "UseCount"], available);
  if (useCountKey) {
    properties[useCountKey] = { number: data.useCount };
  }
  const lastUsedKey = pickFirstExisting(["Last Used", "LastUsed"], available);
  if (lastUsedKey) {
    properties[lastUsedKey] = { date: { start: data.lastUsed } };
  }
  return await notion.pages.update({
    page_id: data.pageId,
    properties: properties as never,
  });
}

// ==========================================
// 2. JD 解码记录 (JD Records) 操作
// ==========================================
export async function getJDRecords() {
  const response = await notion.databases.query({
    database_id: dbs.jd,
  });
  return response.results;
}

export async function addJDRecord(data: {
  title: string;
  company?: string;
  role?: string;
  jdText: string;
  matchScore?: number | null;
  decodeResult?: string;
  priority?: string;
  location?: string;
  salaryRange?: string;
  keyRequirements?: string[];
  decodeSummary: string;
  fitScore: number;
  gapAnalysis: string;
  coreResponsibilities?: string;
  implicitExpectations?: string;
  fitSummary?: string;
  keyGaps?: string;
}) {
  const defs = await getJDPropertyDefs();
  const matchScore = typeof data.matchScore === "number" && Number.isFinite(data.matchScore) ? data.matchScore : null;
  const priorityType = defs.Priority?.type;
  const locationType = defs.Location?.type;
  const salaryType = defs["Salary Range"]?.type;
  const requirementsType = defs["Key Requirements"]?.type;
  const shortProperties: Record<string, unknown> = {
    Title: { title: [{ text: { content: data.title } }] },
    Company: { rich_text: [{ text: { content: data.company || "" } }] },
    Role: { rich_text: [{ text: { content: data.role || "" } }] },
    "Match Score": { number: matchScore },
    ...(defs.Priority
      ? {
          Priority:
            priorityType === "select"
              ? { select: { name: data.priority || "中" } }
              : { rich_text: [{ text: { content: data.priority || "中" } }] },
        }
      : {}),
    ...(defs.Location
      ? {
          Location:
            locationType === "select"
              ? { select: { name: data.location || "" } }
              : { rich_text: createNotionRichText(data.location || "") },
        }
      : {}),
    ...(defs["Salary Range"]
      ? {
          "Salary Range":
            salaryType === "select"
              ? { select: { name: data.salaryRange || "未提及" } }
              : { rich_text: createNotionRichText(data.salaryRange || "未提及") },
        }
      : {}),
    ...(defs["Key Requirements"]
      ? {
          "Key Requirements":
            requirementsType === "multi_select"
              ? { multi_select: (data.keyRequirements || []).slice(0, 10).map((item) => ({ name: item })) }
              : { rich_text: createNotionRichText((data.keyRequirements || []).join(" | ")) },
        }
      : {}),
    Status: { select: { name: "Decoded" } },
  };

  const created = await notion.pages.create({
    parent: { database_id: dbs.jd },
    properties: shortProperties as never,
  });

  const longProperties: Record<string, unknown> = {
    "JD Text": { rich_text: createNotionRichText(data.jdText || "") },
    "Decode Result": { rich_text: createNotionRichText(data.decodeResult || "") },
  };

  // Persist decoded JD fields that are required by story AI optimization.
  // Some older records may be missing these values, but new saves will be complete.
  const available = new Set(Object.keys(defs));
  const coreKey = pickFirstExisting(["Core Responsibilities", "核心职责", "Responsibilities"], available);
  const implicitKey = pickFirstExisting(["Implicit Expectations", "隐含期望", "Expectations"], available);
  const fitSummaryKey = pickFirstExisting(["Fit Summary", "匹配总结", "Summary"], available);
  const keyGapsKey = pickFirstExisting(["Key Gaps", "关键差距", "Gaps Detail"], available);

  const setTextByType = (key: string, value: string) => {
    const v = value.trim();
    if (!v) return;
    const type = defs[key]?.type;
    if (type === "select") {
      longProperties[key] = { select: { name: v } };
      return;
    }
    // Default to rich_text for most text-style properties.
    longProperties[key] = { rich_text: createNotionRichText(v) };
  };

  if (typeof data.coreResponsibilities === "string") {
    if (coreKey) setTextByType(coreKey, data.coreResponsibilities);
  }
  if (typeof data.implicitExpectations === "string") {
    if (implicitKey) setTextByType(implicitKey, data.implicitExpectations);
  }
  if (typeof data.fitSummary === "string") {
    if (fitSummaryKey) setTextByType(fitSummaryKey, data.fitSummary);
  }
  if (typeof data.keyGaps === "string") {
    if (keyGapsKey) setTextByType(keyGapsKey, data.keyGaps);
  }

  await notion.pages.update({
    page_id: created.id,
    properties: longProperties as never,
  });

  return created;
}

export async function appendJDPrepPlan(data: {
  pageId: string;
  prepMarkdown: string;
  generatedAt?: string;
}) {
  const prep = String(data.prepMarkdown ?? "").trim();
  if (!prep) {
    throw new Error("prepMarkdown is empty");
  }

  const defs = await getJDPropertyDefs();
  const noteKey = Object.keys(defs).find((key) =>
    ["Notes", "Note", "备注", "笔记", "Prep Notes"].includes(key),
  );
  const generatedAt = data.generatedAt || new Date().toLocaleString("zh-CN");
  const section = `--- 7 天 Prep 清单（生成于 ${generatedAt}）---\n${prep}`;

  if (noteKey && defs[noteKey]?.type === "rich_text") {
    const page = await notion.pages.retrieve({ page_id: data.pageId });
    const props =
      page && typeof page === "object" && "properties" in page
        ? (page.properties as Record<string, unknown>)
        : {};
    const existing = readRichText(props, noteKey);
    const merged = [existing, section].filter(Boolean).join("\n\n").trim();
    if (merged.length <= NOTION_PROPERTY_SOFT_LIMIT) {
      await notion.pages.update({
        page_id: data.pageId,
        properties: {
          [noteKey]: { rich_text: createNotionRichText(merged) },
        } as never,
      });
      return { savedTo: "notes" as const };
    }
  }

  await appendTextBlocksToPage(data.pageId, "7 天 Prep 清单", section);
  return { savedTo: "page_body" as const };
}

export async function getInterviewRecords() {
  const response = await notion.databases.query({
    database_id: dbs.interview,
  });
  return response.results;
}

export async function getRecentPrepInterviewRecords(limit = 10) {
  const response = await notion.databases.query({
    database_id: dbs.interview,
    filter: {
      property: "Type",
      select: {
        equals: "Behavioral",
      },
    },
    sorts: [{ timestamp: "created_time", direction: "descending" }],
    page_size: Math.max(10, Math.min(limit * 3, 50)),
  });
  return response.results.filter((item) => {
    const record = asRecord(item);
    const properties = asRecord(record.properties);
    const titleKey = Object.keys(properties).find((key) => {
      const prop = asRecord(properties[key]);
      return prop.type === "title";
    });
    if (!titleKey) return false;
    const title = readTitle(properties, titleKey);
    return title.startsWith("[备战简报]");
  }).slice(0, Math.max(1, Math.min(limit, 20)));
}

export async function getPagePlainTextContent(pageId: string) {
  const chunks: string[] = [];
  let cursor: string | undefined = undefined;
  do {
    const response = await notion.blocks.children.list({
      block_id: pageId,
      start_cursor: cursor,
      page_size: 100,
    });
    for (const block of response.results) {
      const blockRecord = block as Record<string, unknown>;
      const blockType = typeof blockRecord.type === "string" ? blockRecord.type : "";
      const blockValue = asRecord(blockRecord[blockType]);
      const richText = Array.isArray(blockValue.rich_text) ? blockValue.rich_text : [];
      const text = richText
        .map((item) =>
          item !== null && typeof item === "object" && "plain_text" in item
            ? String((item as { plain_text?: unknown }).plain_text ?? "")
            : "",
        )
        .join("")
        .trim();
      if (text) {
        chunks.push(text);
      }
    }
    cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (cursor);
  return chunks.join("\n\n").trim();
}

export async function getResumeVersions() {
  if (!dbs.resume) return [];
  const response = await notion.databases.query({
    database_id: dbs.resume,
    sorts: [{ timestamp: "created_time", direction: "descending" }],
  });
  return response.results;
}

export async function getLatestResumeBaseByType() {
  if (!dbs.resume) return null;
  const response = await notion.databases.query({
    database_id: dbs.resume,
    filter: {
      property: "Type",
      select: {
        equals: "Base",
      },
    },
    sorts: [{ timestamp: "created_time", direction: "descending" }],
    page_size: 1,
  });
  return response.results[0] ?? null;
}

export async function getResumeBaseList(limit = 20) {
  if (!dbs.resume) return [];
  const response = await notion.databases.query({
    database_id: dbs.resume,
    filter: {
      property: "Type",
      select: {
        equals: "Base",
      },
    },
    sorts: [{ timestamp: "created_time", direction: "descending" }],
    page_size: Math.max(1, Math.min(limit, 100)),
  });
  return response.results;
}

function pickActiveResumeFlagKey(
  available: Set<string>,
  defs: Record<string, { type?: string }>,
) {
  const candidates = [
    "当前活跃底本",
    "Is Active Base",
    "Active Base",
    "isActive",
    "IsActive",
    "IsActiveBase",
    "Is Active",
    "Active",
  ];
  for (const key of candidates) {
    if (available.has(key) && defs[key]?.type === "checkbox") {
      return key;
    }
  }
  return "";
}

export async function addResumeVersion(data: {
  version: string;
  title?: string;
  type?: string;
  targetCompany: string;
  targetJD: string;
  beforeText: string;
  afterText: string;
  aiSuggestions: string;
  createdDate: string;
}) {
  if (!dbs.resume) {
    throw new Error("Missing Resume DB env: set NOTION_RESUME_DB (or legacy NOYION_RESUME_DB)");
  }
  const available = await getResumePropertyNames();
  const titleKey = pickFirstExisting(["Title", "Name"], available);
  if (!titleKey) {
    throw new Error("Resume database must contain Title or Name property.");
  }
  const versionKey = pickFirstExisting(["版本号", "Version", "Version No", "Version Number"], available);
  const typeKey = pickFirstExisting(["Type", "类型"], available);
  const companyKey = pickFirstExisting(["目标公司", "Target Company", "Company"], available);
  const jdKey = pickFirstExisting(["JD", "目标JD", "Target JD"], available);
  const beforeKey = pickFirstExisting(["优化前文本", "Before Text", "Original Resume", "Before"], available);
  const afterKey = pickFirstExisting(["优化后文本", "After Text", "Optimized Resume", "After"], available);
  const suggestKey = pickFirstExisting(["AI建议", "AI Suggestions", "Suggestions"], available);
  const dateKey = pickFirstExisting(["创建日期", "Created Date", "Date"], available);
  const isBase = data.type === "Base";
  const safeTitle = (data.title || "").trim() || `简历版本 ${data.version}`;
  const safeCompany = isBase ? "" : data.targetCompany;
  const safeJd = isBase ? "" : data.targetJD;
  const safeSuggestions = isBase ? "" : data.aiSuggestions;

  return notion.pages.create({
    parent: { database_id: dbs.resume },
    properties: {
      [titleKey]: { title: [{ text: { content: safeTitle } }] },
      ...(versionKey
        ? {
            [versionKey]: { rich_text: [{ text: { content: String(data.version || "") } }] },
          }
        : {}),
      ...(typeKey && data.type
        ? {
            [typeKey]: { select: { name: data.type } },
          }
        : {}),
      ...(companyKey ? { [companyKey]: { rich_text: createNotionRichText(safeCompany) } } : {}),
      ...(jdKey ? { [jdKey]: { rich_text: createNotionRichText(safeJd) } } : {}),
      ...(beforeKey ? { [beforeKey]: { rich_text: createNotionRichText(data.beforeText) } } : {}),
      ...(afterKey ? { [afterKey]: { rich_text: createNotionRichText(data.afterText) } } : {}),
      ...(suggestKey
        ? { [suggestKey]: { rich_text: createNotionRichText(safeSuggestions) } }
        : {}),
      ...(dateKey ? { [dateKey]: { date: { start: data.createdDate } } } : {}),
    } as never,
  });
}

export async function updateResumeVersion(data: {
  pageId: string;
  title?: string;
  type?: string;
  targetCompany?: string;
  targetJD?: string;
  beforeText?: string;
  afterText?: string;
  aiSuggestions?: string;
  createdDate?: string;
}) {
  if (!dbs.resume) {
    throw new Error("Missing Resume DB env: set NOTION_RESUME_DB (or legacy NOYION_RESUME_DB)");
  }
  const available = await getResumePropertyNames();
  const titleKey = pickFirstExisting(["Title", "Name"], available);
  if (!titleKey) {
    throw new Error("Resume database must contain Title or Name property.");
  }
  const typeKey = pickFirstExisting(["Type", "类型"], available);
  const companyKey = pickFirstExisting(["目标公司", "Target Company", "Company"], available);
  const jdKey = pickFirstExisting(["JD", "目标JD", "Target JD"], available);
  const beforeKey = pickFirstExisting(["优化前文本", "Before Text", "Original Resume", "Before"], available);
  const afterKey = pickFirstExisting(["优化后文本", "After Text", "Optimized Resume", "After"], available);
  const suggestKey = pickFirstExisting(["AI建议", "AI Suggestions", "Suggestions"], available);
  const dateKey = pickFirstExisting(["创建日期", "Created Date", "Date"], available);

  const properties: Record<string, unknown> = {};
  if (typeof data.title === "string") {
    properties[titleKey] = { title: [{ text: { content: data.title.trim() } }] };
  }
  if (typeKey && typeof data.type === "string" && data.type.trim()) {
    properties[typeKey] = { select: { name: data.type.trim() } };
  }
  if (companyKey && typeof data.targetCompany === "string") {
    properties[companyKey] = { rich_text: createNotionRichText(data.targetCompany) };
  }
  if (jdKey && typeof data.targetJD === "string") {
    properties[jdKey] = { rich_text: createNotionRichText(data.targetJD) };
  }
  if (beforeKey && typeof data.beforeText === "string") {
    properties[beforeKey] = { rich_text: createNotionRichText(data.beforeText) };
  }
  if (afterKey && typeof data.afterText === "string") {
    properties[afterKey] = { rich_text: createNotionRichText(data.afterText) };
  }
  if (suggestKey && typeof data.aiSuggestions === "string") {
    properties[suggestKey] = { rich_text: createNotionRichText(data.aiSuggestions) };
  }
  if (dateKey && typeof data.createdDate === "string" && data.createdDate.trim()) {
    properties[dateKey] = { date: { start: data.createdDate.trim() } };
  }

  try {
    return await notion.pages.update({
      page_id: data.pageId,
      properties: properties as never,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "");
    // Some pages may have been archived previously; unarchive then retry once.
    if (/archived/i.test(message)) {
      await notion.pages.update({
        page_id: data.pageId,
        archived: false,
      });
      return await notion.pages.update({
        page_id: data.pageId,
        properties: properties as never,
      });
    }
    throw error;
  }
}

export async function archiveResumeVersion(pageId: string) {
  try {
    return await notion.pages.update({
      page_id: pageId,
      archived: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "");
    // Idempotent behavior: already archived is treated as success.
    if (/archived/i.test(message)) {
      return null;
    }
    throw error;
  }
}

export async function setActiveResumeBase(pageId: string) {
  if (!dbs.resume) {
    throw new Error("Missing Resume DB env: set NOTION_RESUME_DB (or legacy NOYION_RESUME_DB)");
  }
  const available = await getResumePropertyNames();
  const defs = await getResumePropertyDefs();
  const typeKey = pickFirstExisting(["Type", "类型"], available);
  if (!typeKey) {
    throw new Error("Resume database must contain Type property to mark Base resumes.");
  }
  const activeKey = pickActiveResumeFlagKey(available, defs);
  if (!activeKey) {
    throw new Error(
      "Resume database is missing a checkbox property for active base. Please add one like '当前活跃底本' or 'Is Active Base'.",
    );
  }

  const results = await getResumeBaseList(100);
  const updates = results
    .map((item) => {
      const record = asRecord(item);
      const id = typeof record.id === "string" ? record.id : "";
      if (!id) return null;
      const properties = asRecord(record.properties);
      const currentValue = readCheckbox(properties, activeKey, false);
      const nextValue = id === pageId;
      if (currentValue === nextValue) return null;
      return notion.pages.update({
        page_id: id,
        properties: {
          [activeKey]: { checkbox: nextValue },
        } as never,
      });
    })
    .filter(Boolean) as Array<Promise<unknown>>;

  if (updates.length > 0) {
    await Promise.all(updates);
  }
}

export async function getCoachingSessions(filters?: {
  module?: string;
  entityId?: string;
  limit?: number;
}) {
  if (!dbs.coachingSession) return [];
  const response = await notion.databases.query({
    database_id: dbs.coachingSession,
    sorts: [{ timestamp: "created_time", direction: "descending" }],
    page_size: Math.max(1, Math.min(filters?.limit ?? 20, 100)),
  });
  const rows = response.results;
  if (!filters?.module && !filters?.entityId) return rows;
  return rows.filter((item) => {
    const record = asRecord(item);
    const properties = asRecord(record.properties);
    const moduleKey = Object.keys(properties).find((key) => key.toLowerCase() === "module") ?? "Module";
    const entityIdKey = Object.keys(properties).find((key) => key.toLowerCase().includes("entity id")) ?? "Entity ID";
    const moduleValue = readRichText(properties, moduleKey) || readSelect(properties, moduleKey, "");
    const entityValue = readRichText(properties, entityIdKey);
    if (filters.module && moduleValue !== filters.module) return false;
    if (filters.entityId && entityValue !== filters.entityId) return false;
    return true;
  });
}

export async function addCoachingSession(data: {
  title: string;
  module: string;
  entityId: string;
  entityTitle: string;
  sessionType: string;
  messageJson: string;
  lastAssistantReply: string;
  applied: boolean;
  createdDate: string;
}) {
  if (!dbs.coachingSession) {
    throw new Error("Missing Coaching Session DB env: set NOTION_COACHING_SESSION_DB");
  }
  const available = await getCoachingPropertyNames();
  const defs = await getCoachingPropertyDefs();
  const getType = (key?: string) => (key ? defs[key]?.type ?? "" : "");
  const titleKey = pickFirstExisting(["Title", "Name"], available);
  if (!titleKey) {
    throw new Error("Coaching Session database must contain Title or Name property.");
  }
  const moduleKey = pickFirstExisting(["Module"], available);
  const entityIdKey = pickFirstExisting(["Entity ID"], available);
  const entityTitleKey = pickFirstExisting(["Entity Title"], available);
  const sessionTypeKey = pickFirstExisting(["Session Type"], available);
  const messageJsonKey = pickFirstExisting(["Message Json", "Messages Json", "Message JSON"], available);
  const replyKey = pickFirstExisting(["Last Assistant Reply"], available);
  const appliedKey = pickFirstExisting(["Applied"], available);
  const dateKey = pickFirstExisting(["Created Date", "Date"], available);

  const asRichText = (text: string) => ({ rich_text: toRichTextBlocks(text) });
  const asSelect = (text: string) => ({ select: { name: text } });

  return notion.pages.create({
    parent: { database_id: dbs.coachingSession },
    properties: {
      [titleKey]: { title: [{ text: { content: data.title } }] },
      ...(moduleKey
        ? {
            [moduleKey]:
              getType(moduleKey) === "select" ? asSelect(data.module) : asRichText(data.module),
          }
        : {}),
      ...(entityIdKey
        ? {
            [entityIdKey]:
              getType(entityIdKey) === "number"
                ? { number: Number(data.entityId) || 0 }
                : asRichText(data.entityId),
          }
        : {}),
      ...(entityTitleKey ? { [entityTitleKey]: asRichText(data.entityTitle.slice(0, 4000)) } : {}),
      ...(sessionTypeKey
        ? {
            [sessionTypeKey]:
              getType(sessionTypeKey) === "select"
                ? asSelect(data.sessionType)
                : asRichText(data.sessionType),
          }
        : {}),
      ...(messageJsonKey ? { [messageJsonKey]: asRichText(data.messageJson) } : {}),
      ...(replyKey ? { [replyKey]: asRichText(data.lastAssistantReply) } : {}),
      ...(appliedKey
        ? {
            [appliedKey]:
              getType(appliedKey) === "checkbox"
                ? { checkbox: data.applied }
                : asRichText(data.applied ? "true" : "false"),
          }
        : {}),
      ...(dateKey ? { [dateKey]: { date: { start: data.createdDate } } } : {}),
    } as never,
  });
}

export async function updateCoachingSession(data: {
  pageId: string;
  applied?: boolean;
  messageJson?: string;
  lastAssistantReply?: string;
}) {
  if (!dbs.coachingSession) {
    throw new Error("Missing Coaching Session DB env: set NOTION_COACHING_SESSION_DB");
  }
  const available = await getCoachingPropertyNames();
  const defs = await getCoachingPropertyDefs();
  const appliedKey = pickFirstExisting(["Applied"], available);
  const messageJsonKey = pickFirstExisting(["Message Json", "Messages Json", "Message JSON"], available);
  const replyKey = pickFirstExisting(["Last Assistant Reply"], available);
  const getType = (key?: string) => (key ? defs[key]?.type ?? "" : "");
  const asRichText = (text: string) => ({ rich_text: toRichTextBlocks(text) });

  const properties: Record<string, unknown> = {};
  if (typeof data.applied === "boolean" && appliedKey) {
    properties[appliedKey] =
      getType(appliedKey) === "checkbox"
        ? { checkbox: data.applied }
        : asRichText(data.applied ? "true" : "false");
  }
  if (typeof data.messageJson === "string" && messageJsonKey) {
    properties[messageJsonKey] = asRichText(data.messageJson);
  }
  if (typeof data.lastAssistantReply === "string" && replyKey) {
    properties[replyKey] = asRichText(data.lastAssistantReply);
  }

  return notion.pages.update({
    page_id: data.pageId,
    properties: properties as never,
  });
}

export async function getProfileOptimizationRecordsFromResume(limit = 50) {
  if (!dbs.resume) return [];
  const response = await notion.databases.query({
    database_id: dbs.resume,
    filter: {
      property: "Type",
      select: {
        equals: "Profile",
      },
    },
    sorts: [{ timestamp: "created_time", direction: "descending" }],
    page_size: Math.max(1, Math.min(limit, 100)),
  });
  return response.results;
}

// ==========================================
// 3. 面试记录 (Interview Records) 操作
// ==========================================
export async function addInterviewRecord(data: {
  title: string;
  company: string;
  role?: string;
  type: string;
  date: string;
  transcript?: string;
  aiAnalysis?: string;
  analysisInPageBodyMarkdown?: string;
  jdRelationId?: string;
  questionBank?: string;
  recruiterFeedback?: string;
  outcomeLog?: string;
  intelligenceJson?: string;
}) {
  let available = await getInterviewPropertyNames();
  const titleKey = pickFirstExisting(["Title", "Name"], available) ?? "Title";
  const companyKey = pickFirstExisting(["Company"], available);
  const roleKey = pickFirstExisting(["Role", "岗位"], available);
  const typeKey = pickFirstExisting(["Type", "Interview Type"], available);
  const dateKey = pickFirstExisting(["Date", "Interview Date"], available);
  let jdRelationKey = pickFirstExisting(
    ["关联的 Mock 记录"],
    available,
  );
  // If the Interview Records DB schema was recently changed, in-memory cache might be stale.
  // We do one forced refresh for the relation property lookup.
  if (data.jdRelationId && !jdRelationKey) {
    const db = await notion.databases.retrieve({ database_id: dbs.interview });
    const properties =
      db && typeof db === "object" && "properties" in db ? (db.properties as Record<string, unknown>) : {};
    available = new Set(Object.keys(properties));
    jdRelationKey = pickFirstExisting(["关联的 Mock 记录"], available);
  }
  if (data.jdRelationId && !jdRelationKey) {
    throw new Error('Notion Interview Records 表缺少 Relation 列：' + '"关联的 Mock 记录"');
  }
  const questionBankKey = pickFirstExisting(["Question Bank", "QuestionBank"], available);
  const feedbackKey = pickFirstExisting(["Recruiter Feedback", "Feedback"], available);
  const outcomeKey = pickFirstExisting(["Outcome Log", "Outcome"], available);
  const intelligenceKey = pickFirstExisting(["Interview Intelligence", "Intelligence"], available);
  const pageBodyText = String(data.analysisInPageBodyMarkdown ?? "").trim();
  const pageBodyParagraphs = pageBodyText
    .split(/\n\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const pageBodyChildren = pageBodyParagraphs.flatMap((paragraph) =>
    toRichTextBlocks(paragraph, 1900, 50).map((chunk) => ({
      object: "block",
      type: "paragraph",
      paragraph: { rich_text: [{ type: "text", text: { content: chunk.text.content } }] },
    })),
  );
  return await notion.pages.create({
    parent: { database_id: dbs.interview },
    properties: {
      [titleKey]: { title: [{ text: { content: data.title } }] },
      ...(companyKey
        ? { [companyKey]: { rich_text: [{ text: { content: data.company } }] } }
        : {}),
      ...(roleKey && data.role ? { [roleKey]: { rich_text: [{ text: { content: data.role } }] } } : {}),
      ...(typeKey ? { [typeKey]: { select: { name: data.type } } } : {}),
      ...(dateKey ? { [dateKey]: { date: { start: data.date } } } : {}),
      ...(jdRelationKey && data.jdRelationId
        ? { [jdRelationKey]: { relation: [{ id: data.jdRelationId }] } }
        : {}),
      ...(data.questionBank && questionBankKey
        ? {
            [questionBankKey]: { rich_text: [{ text: { content: data.questionBank.substring(0, 2000) } }] },
          }
        : {}),
      ...(data.recruiterFeedback && feedbackKey
        ? {
            [feedbackKey]: { rich_text: [{ text: { content: data.recruiterFeedback.substring(0, 2000) } }] },
          }
        : {}),
      ...(data.outcomeLog && outcomeKey
        ? {
            [outcomeKey]: { rich_text: [{ text: { content: data.outcomeLog.substring(0, 2000) } }] },
          }
        : {}),
      ...(data.intelligenceJson && intelligenceKey
        ? {
            [intelligenceKey]: {
              rich_text: [{ text: { content: data.intelligenceJson.substring(0, 2000) } }],
            },
          }
        : {}),
    } as never,
    ...(pageBodyChildren.length ? { children: pageBodyChildren as never } : {}),
  });
}

export async function updateInterviewRecord(data: {
  pageId: string;
  recruiterFeedback?: string;
  outcomeLog?: string;
  intelligenceJson?: string;
  questionBank?: string;
  analysisInPageBodyMarkdown?: string;
  title?: string;
}) {
  const available = await getInterviewPropertyNames();
  const titleKey = pickFirstExisting(["Title", "Name"], available);
  const questionBankKey = pickFirstExisting(["Question Bank", "QuestionBank"], available);
  const feedbackKey = pickFirstExisting(["Recruiter Feedback", "Feedback"], available);
  const outcomeKey = pickFirstExisting(["Outcome Log", "Outcome"], available);
  const intelligenceKey = pickFirstExisting(["Interview Intelligence", "Intelligence"], available);
  const properties: Record<string, unknown> = {};

  if (titleKey && data.title) {
    properties[titleKey] = { title: [{ text: { content: data.title } }] };
  }
  if (questionBankKey && data.questionBank) {
    properties[questionBankKey] = {
      rich_text: [{ text: { content: data.questionBank.substring(0, 2000) } }],
    };
  }
  if (feedbackKey && data.recruiterFeedback) {
    properties[feedbackKey] = {
      rich_text: [{ text: { content: data.recruiterFeedback.substring(0, 2000) } }],
    };
  }
  if (outcomeKey && data.outcomeLog) {
    properties[outcomeKey] = {
      rich_text: [{ text: { content: data.outcomeLog.substring(0, 2000) } }],
    };
  }
  if (intelligenceKey && data.intelligenceJson) {
    properties[intelligenceKey] = {
      rich_text: [{ text: { content: data.intelligenceJson.substring(0, 2000) } }],
    };
  }

  if (Object.keys(properties).length > 0) {
    await notion.pages.update({
      page_id: data.pageId,
      properties: properties as never,
    });
  }

  if (data.analysisInPageBodyMarkdown?.trim()) {
    await appendTextBlocksToPage(
      data.pageId,
      `面试复盘（${new Date().toISOString().slice(0, 10)}）`,
      data.analysisInPageBodyMarkdown.trim(),
    );
  }
}

// ==========================================
// 4. 知识训练 (Knowledge) 操作 - SM2 算法基础
// ==========================================
export async function getKnowledgeCardsToReview() {
  const today = new Date().toISOString().split("T")[0];
  const response = await notion.databases.query({
    database_id: dbs.knowledge,
    filter: {
      property: "Next Review",
      date: { on_or_before: today },
    },
  });
  return response.results;
}

export async function getAllKnowledgeCards() {
  const response = await notion.databases.query({
    database_id: dbs.knowledge,
  });
  return response.results;
}

export async function updateKnowledgeCardReview(data: {
  pageId: string;
  interval: number;
  easeFactor: number;
  nextReview: string;
  mastery?: number;
  lastQuality?: number;
}) {
  return await notion.pages.update({
    page_id: data.pageId,
    properties: {
      Interval: { number: data.interval },
      "Ease Factor": { number: data.easeFactor },
      "Next Review": { date: { start: data.nextReview } },
      ...(typeof data.mastery === "number" ? { Mastery: { number: data.mastery } } : {}),
      ...(typeof data.lastQuality === "number"
        ? { "Last Quality": { number: data.lastQuality } }
        : {}),
    },
  });
}

export async function addKnowledgeCard(data: {
  title: string;
  domain: string;
  content: string;
  questions?: Array<{ id: string }>;
}) {
  const available = await getKnowledgePropertyNames();
  const titleKey = pickFirstExisting(["Title", "Name"], available);
  if (!titleKey) {
    throw new Error("Knowledge database must contain Title or Name property.");
  }
  const domainKey = pickFirstExisting(["Domain", "领域"], available);
  const contentKey = pickFirstExisting(["Content", "Answer", "Notes", "Back"], available);
  const masteryKey = pickFirstExisting(["Mastery"], available);
  const intervalKey = pickFirstExisting(["Interval"], available);
  const easeFactorKey = pickFirstExisting(["Ease Factor"], available);
  const nextReviewKey = pickFirstExisting(["Next Review"], available);
  const questionsKey = pickFirstExisting(["Questions"], available);

  return await notion.pages.create({
    parent: { database_id: dbs.knowledge },
    properties: {
      [titleKey]: { title: [{ text: { content: data.title } }] },
      ...(domainKey ? { [domainKey]: { select: { name: data.domain } } } : {}),
      ...(contentKey ? { [contentKey]: { rich_text: [{ text: { content: data.content.substring(0, 2000) } }] } } : {}),
      ...(masteryKey ? { [masteryKey]: { number: 0 } } : {}),
      ...(intervalKey ? { [intervalKey]: { number: 1 } } : {}),
      ...(easeFactorKey ? { [easeFactorKey]: { number: 2.5 } } : {}),
      ...(nextReviewKey ? { [nextReviewKey]: { date: { start: new Date().toISOString().slice(0, 10) } } } : {}),
      ...(questionsKey && Array.isArray(data.questions) && data.questions.length > 0
        ? { [questionsKey]: { relation: data.questions.map((item) => ({ id: item.id })) } }
        : {}),
    },
  });
}

export async function addKnowledgeCardsBatch(
  rows: Array<{
    title: string;
    domain: string;
    content: string;
    questions?: Array<{ id: string }>;
  }>,
) {
  await Promise.all(rows.map((item) => addKnowledgeCard(item)));
}

// ==========================================
// 5. 岗位监控 (Job Monitor) 操作
// ==========================================

function ensureJobsDbId() {
  if (!dbs.jobs) {
    throw new Error("Missing Jobs DB env: set NOTION_JOBS_DB");
  }
}

const jobsPropertyCache = new Map<string, Set<string>>();
const jobsPropertyDefCache = new Map<string, Record<string, { type?: string }>>();

async function getJobsPropertyNames() {
  ensureJobsDbId();
  if (jobsPropertyCache.has(dbs.jobs)) {
    return jobsPropertyCache.get(dbs.jobs)!;
  }
  const db = await notion.databases.retrieve({ database_id: dbs.jobs });
  const properties =
    db && typeof db === "object" && "properties" in db
      ? (db.properties as Record<string, unknown>)
      : {};
  const names = new Set(Object.keys(properties));
  jobsPropertyCache.set(dbs.jobs, names);
  return names;
}

async function getJobsPropertyDefs() {
  ensureJobsDbId();
  if (jobsPropertyDefCache.has(dbs.jobs)) {
    return jobsPropertyDefCache.get(dbs.jobs)!;
  }
  const db = await notion.databases.retrieve({ database_id: dbs.jobs });
  const properties =
    db && typeof db === "object" && "properties" in db
      ? (db.properties as Record<string, { type?: string }>)
      : {};
  jobsPropertyDefCache.set(dbs.jobs, properties);
  return properties;
}

export type JobRow = {
  id: string;
  title: string;
  company: string;
  role: string;
  matchScore: number;
  status: string;
  location: string;
  url: string;
  jdText: string;
  platform: string;
  salaryRange: string;
  notes: string;
  jdSummary: string;
  matchReasons?: string;
  mismatchReasons?: string;
  createdAt: string;
  updatedAt: string;
};

function toJobRow(item: unknown): JobRow {
  const record = asRecord(item);
  const properties = asRecord(record.properties);
  const titleKey = Object.keys(properties).find((key) => asRecord(properties[key]).type === "title") ?? "Title";
  const statusKey = Object.keys(properties).find((key) => {
    const prop = asRecord(properties[key]);
    return prop.type === "select" || prop.type === "status";
  }) ?? "Status";
  const companyKey = Object.keys(properties).find((key) => key.toLowerCase().includes("company")) ?? "Company";
  const roleKey = Object.keys(properties).find((key) => key.toLowerCase().includes("role")) ?? "Role";
  const matchScoreKey = Object.keys(properties).find((key) => {
    const prop = asRecord(properties[key]);
    return prop.type === "number" && (key.toLowerCase().includes("match") || key.toLowerCase().includes("score"));
  }) ?? "Match Score";
  const locationKey = Object.keys(properties).find((key) => key.toLowerCase().includes("location")) ?? "Location";
  const urlKey = Object.keys(properties).find((key) => key.toLowerCase().includes("url")) ?? "URL";
  const jdTextKey = Object.keys(properties).find((key) => key.toLowerCase().includes("jd") || key.toLowerCase().includes("job description")) ?? "JD Text";
  const platformKey = Object.keys(properties).find((key) => key.toLowerCase().includes("platform")) ?? "Platform";
  const salaryKey = Object.keys(properties).find((key) => key.toLowerCase().includes("salary")) ?? "Salary Range";
  const notesKey = Object.keys(properties).find((key) => key.toLowerCase().includes("notes") || key.toLowerCase().includes("备注")) ?? "Notes";
  const jdSummaryKey = Object.keys(properties).find((key) => key.toLowerCase().includes("summary") || key.toLowerCase().includes("jd summary")) ?? "JD Summary";
  const matchReasonsKey = Object.keys(properties).find((key) => {
    const lower = key.toLowerCase();
    return (lower.includes("match reasons") || lower.includes("match_reasons")) && !lower.includes("mismatch");
  }) ?? "Match Reasons";
  const mismatchReasonsKey = Object.keys(properties).find((key) => key.toLowerCase().includes("mismatch reasons") || key.toLowerCase().includes("mismatch_reasons")) ?? "Mismatch Reasons";

  // 读取 URL 类型属性
  function readUrl(properties: Record<string, unknown>, key: string): string {
    const prop = asRecord(properties[key]);
    return typeof prop.url === "string" ? prop.url : "";
  }

  return {
    id: typeof record.id === "string" ? record.id : "",
    title: readTitle(properties, titleKey),
    company: companyKey ? readRichText(properties, companyKey) : "",
    role: roleKey ? readRichText(properties, roleKey) : "",
    matchScore: matchScoreKey ? readNumber(properties, matchScoreKey, 0) : 0,
    status: statusKey ? readSelect(properties, statusKey, "新发现") : "新发现",
    location: locationKey ? readRichText(properties, locationKey) : "",
    url: urlKey ? readUrl(properties, urlKey) : "",
    jdText: jdTextKey ? readRichText(properties, jdTextKey) : "",
    platform: platformKey ? readRichText(properties, platformKey) : "",
    salaryRange: salaryKey ? readRichText(properties, salaryKey) : "",
    notes: notesKey ? readRichText(properties, notesKey) : "",
    jdSummary: jdSummaryKey ? readRichText(properties, jdSummaryKey) : "",
    matchReasons: matchReasonsKey ? readRichText(properties, matchReasonsKey) : undefined,
    mismatchReasons: mismatchReasonsKey ? readRichText(properties, mismatchReasonsKey) : undefined,
    createdAt: typeof record.created_time === "string" ? record.created_time : "",
    updatedAt: typeof record.last_edited_time === "string" ? record.last_edited_time : "",
  };
}

export async function getJobs(filters?: {
  status?: string;
  platform?: string;
  sortBy?: "matchScore" | "createdAt";
  sortOrder?: "ascending" | "descending";
}) {
  ensureJobsDbId();
  const sorts: Array<Record<string, unknown>> = [];
  if (filters?.sortBy === "matchScore") {
    const defs = await getJobsPropertyDefs();
    const matchScoreKey = Object.keys(defs).find((key) => key.toLowerCase().includes("match") || key.toLowerCase().includes("score"));
    if (matchScoreKey) {
      sorts.push({ property: matchScoreKey, direction: filters.sortOrder || "descending" });
    }
  }
  if (sorts.length === 0) {
    sorts.push({ timestamp: "created_time", direction: "descending" });
  }

  const filterClauses: Array<Record<string, unknown>> = [];
  if (filters?.status) {
    const defs = await getJobsPropertyDefs();
    const statusKey = Object.keys(defs).find((key) => {
      const prop = defs[key];
      return prop?.type === "select" || prop?.type === "status";
    }) ?? "Status";
    filterClauses.push({
      property: statusKey,
      select: { equals: filters.status },
    });
  }
  if (filters?.platform) {
    const defs = await getJobsPropertyDefs();
    const platformKey = Object.keys(defs).find((key) => key.toLowerCase().includes("platform")) ?? "Platform";
    filterClauses.push({
      property: platformKey,
      select: { equals: filters.platform },
    });
  }

  const response = await notion.databases.query({
    database_id: dbs.jobs,
    sorts: sorts as never,
    ...(filterClauses.length > 0 ? { filter: { and: filterClauses } as never } : {}),
  });

  const rows = response.results.map((item) => toJobRow(item));

  // 打印第一条岗位数据，验证新增字段
  if (rows.length > 0) {
    console.log("[getJobs] 第一条岗位数据:", JSON.stringify(rows[0], null, 2));
  }

  // 打印所有 Notion 属性键名，确认数据库字段名
  if (response.results.length > 0) {
    const record = response.results[0] as Record<string, unknown>;
    const props = (record.properties ?? {}) as Record<string, unknown>;
    console.log("[getJobs] Notion 原始属性键名:", Object.keys(props));
  }

  return rows;
}

export async function addJob(data: {
  title: string;
  company?: string;
  role?: string;
  matchScore?: number;
  status?: string;
  location?: string;
  url?: string;
  jdText?: string;
  platform?: string;
  salaryRange?: string;
  notes?: string;
  jdSummary?: string;
  matchReasons?: string[];
  mismatchReasons?: string[];
}) {
  ensureJobsDbId();
  const available = await getJobsPropertyNames();
  const defs = await getJobsPropertyDefs();
  const titleKey = pickFirstExisting(["Title", "Name"], available);
  if (!titleKey) throw new Error("Jobs database must contain Title or Name property.");

  const companyKey = pickFirstExisting(["Company"], available);
  const roleKey = pickFirstExisting(["Role"], available);
  const matchScoreKey = Object.keys(defs).find((key) => key.toLowerCase().includes("match") || key.toLowerCase().includes("score"));
  const statusKey = Object.keys(defs).find((key) => {
    const prop = defs[key];
    return prop?.type === "select" || prop?.type === "status";
  }) ?? "Status";
  const locationKey = pickFirstExisting(["Location"], available);
  const urlKey = pickFirstExisting(["URL"], available);
  const jdTextKey = Object.keys(defs).find((key) => key.toLowerCase().includes("jd") || key.toLowerCase().includes("job description"));
  const platformKey = pickFirstExisting(["Platform"], available);
  const salaryKey = Object.keys(defs).find((key) => key.toLowerCase().includes("salary"));
  const notesKey = Object.keys(defs).find((key) => key.toLowerCase().includes("notes") || key.toLowerCase().includes("备注"));
  const jdSummaryKey = Object.keys(defs).find((key) => key.toLowerCase().includes("jd summary") || (key.toLowerCase().includes("summary") && !key.toLowerCase().includes("match")));
  const matchReasonsKey = Object.keys(defs).find((key) => {
    const lower = key.toLowerCase();
    return (lower.includes("match reasons") || lower.includes("match_reasons")) && !lower.includes("mismatch");
  });
  const mismatchReasonsKey = Object.keys(defs).find((key) => key.toLowerCase().includes("mismatch reasons") || key.toLowerCase().includes("mismatch_reasons"));

  const properties: Record<string, unknown> = {
    [titleKey]: { title: [{ text: { content: data.title } }] },
  };

  if (companyKey && data.company) {
    properties[companyKey] = { rich_text: [{ text: { content: data.company } }] };
  }
  if (roleKey && data.role) {
    properties[roleKey] = { rich_text: [{ text: { content: data.role } }] };
  }
  if (matchScoreKey && typeof data.matchScore === "number") {
    properties[matchScoreKey] = { number: data.matchScore };
  }
  if (statusKey && data.status) {
    const statusType = defs[statusKey]?.type;
    if (statusType === "status") {
      properties[statusKey] = { status: { name: data.status } };
    } else {
      properties[statusKey] = { select: { name: data.status } };
    }
  }
  if (locationKey && data.location) {
    properties[locationKey] = { rich_text: [{ text: { content: data.location } }] };
  }
  if (urlKey && data.url) {
    properties[urlKey] = { url: data.url };
  }
  if (jdTextKey && data.jdText) {
    properties[jdTextKey] = { rich_text: createNotionRichText(data.jdText) };
  }
  if (platformKey && data.platform) {
    properties[platformKey] = { select: { name: data.platform } };
  }
  if (salaryKey && data.salaryRange) {
    properties[salaryKey] = { rich_text: [{ text: { content: data.salaryRange } }] };
  }
  if (notesKey && data.notes) {
    properties[notesKey] = { rich_text: [{ text: { content: data.notes } }] };
  }
  if (jdSummaryKey && data.jdSummary) {
    properties[jdSummaryKey] = { rich_text: [{ text: { content: data.jdSummary } }] };
  }
  if (matchReasonsKey && data.matchReasons && data.matchReasons.length > 0) {
    properties[matchReasonsKey] = { rich_text: [{ text: { content: data.matchReasons.join("\n• ") } }] };
  }
  if (mismatchReasonsKey && data.mismatchReasons && data.mismatchReasons.length > 0) {
    properties[mismatchReasonsKey] = { rich_text: [{ text: { content: data.mismatchReasons.join("\n• ") } }] };
  }

  return notion.pages.create({
    parent: { database_id: dbs.jobs },
    properties: properties as never,
  });
}

export async function updateJobStatus(pageId: string, status: string) {
  ensureJobsDbId();
  const defs = await getJobsPropertyDefs();
  const statusKey = Object.keys(defs).find((key) => {
    const prop = defs[key];
    return prop?.type === "select" || prop?.type === "status";
  }) ?? "Status";
  const statusType = defs[statusKey]?.type;

  return notion.pages.update({
    page_id: pageId,
    properties: {
      [statusKey]: statusType === "status"
        ? { status: { name: status } }
        : { select: { name: status } },
    } as never,
  });
}

export async function deleteJob(pageId: string) {
  ensureJobsDbId();
  return notion.pages.update({
    page_id: pageId,
    archived: true,
  });
}

// ==========================================
// 6. 深度背调报告 (Deep Research Report) 操作
// ==========================================

/**
 * 根据公司名在 JobMonitor 数据库中检索包含 "🤖 InterviewOS 深度背调报告" 锚点的页面。
 * 返回匹配的 pageId 列表。
 */
export async function getJobPagesByCompany(company: string) {
  ensureJobsDbId();
  const response = await notion.databases.query({
    database_id: dbs.jobs,
    filter: {
      property: "Company",
      rich_text: { contains: company },
    },
  });
  return response.results;
}

/**
 * 将 Notion Block 递归转换为 Markdown 字符串。
 * 支持 heading_1/2/3, paragraph, bulleted_list_item, numbered_list_item, quote, code, toggle, divider, callout。
 */
function blockToMarkdown(block: Record<string, unknown>, indent = ""): string {
  const type = typeof block.type === "string" ? block.type : "";
  const blockValue = block[type] as Record<string, unknown> | undefined;
  if (!blockValue) return "";

  const richText = Array.isArray(blockValue.rich_text) ? blockValue.rich_text : [];
  const text = richText
    .map((item: unknown) => {
      const t = item as { plain_text?: string; text?: { content?: string }; annotations?: { bold?: boolean; italic?: boolean; code?: boolean; strikethrough?: boolean } } | undefined;
      if (!t) return "";
      let content = t.plain_text ?? t.text?.content ?? "";
      const ann = t.annotations;
      if (ann) {
        if (ann.bold) content = `**${content}**`;
        if (ann.italic) content = `*${content}*`;
        if (ann.code) content = `\`${content}\``;
        if (ann.strikethrough) content = `~~${content}~~`;
      }
      return content;
    })
    .join("");

  switch (type) {
    case "heading_1":
      return `# ${text}\n\n`;
    case "heading_2":
      return `## ${text}\n\n`;
    case "heading_3":
      return `### ${text}\n\n`;
    case "paragraph":
      return `${text}\n\n`;
    case "bulleted_list_item":
      return `${indent}- ${text}\n`;
    case "numbered_list_item":
      return `${indent}1. ${text}\n`;
    case "to_do":
      const checked = blockValue.checked === true;
      return `${indent}- [${checked ? "x" : " "}] ${text}\n`;
    case "quote":
      return `> ${text}\n\n`;
    case "code":
      const lang = typeof blockValue.language === "string" ? blockValue.language : "";
      return `\`\`\`${lang}\n${text}\n\`\`\`\n\n`;
    case "toggle":
      // 递归渲染 toggle 内的 children
      const toggleChildren = Array.isArray(blockValue.children) ? blockValue.children : [];
      let toggleMd = `<details>\n<summary>${text}</summary>\n\n`;
      for (const child of toggleChildren) {
        toggleMd += blockToMarkdown(child as Record<string, unknown>, indent + "  ");
      }
      toggleMd += `</details>\n\n`;
      return toggleMd;
    case "divider":
      return `---\n\n`;
    case "callout":
      const emoji = typeof blockValue.icon === "object" && blockValue.icon && "emoji" in (blockValue.icon as Record<string, unknown>)
        ? ((blockValue.icon as Record<string, unknown>).emoji as string) ?? ""
        : "";
      return `> ${emoji} ${text}\n\n`;
    case "image":
      const imgUrl = typeof blockValue.external === "object" && blockValue.external
        ? ((blockValue.external as Record<string, unknown>).url as string) ?? ""
        : "";
      return imgUrl ? `![${text}](${imgUrl})\n\n` : "";
    default:
      return text ? `${text}\n\n` : "";
  }
}

/**
 * 获取指定 page 的所有 blocks 并转换为 Markdown 字符串。
 * 支持分页获取所有 blocks。
 */
export async function getPageBlocksAsMarkdown(pageId: string): Promise<string> {
  const mdParts: string[] = [];
  let cursor: string | undefined = undefined;

  do {
    const response = await notion.blocks.children.list({
      block_id: pageId,
      start_cursor: cursor,
      page_size: 100,
    });

    for (const block of response.results) {
      const b = block as Record<string, unknown>;
      const md = blockToMarkdown(b);
      if (md.trim()) {
        mdParts.push(md);
      }

      // 如果 block 有 children（如 toggle、column_list），递归获取
      const hasChildren = b.has_children === true;
      if (hasChildren) {
        const childMd = await getPageBlocksAsMarkdown(typeof b.id === "string" ? b.id : "");
        if (childMd.trim()) {
          mdParts.push(childMd);
        }
      }
    }

    cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (cursor);

  return mdParts.join("").trim();
}

/**
 * 根据公司名在 JobMonitor 数据库中检索包含 "🤖 InterviewOS 深度背调报告" 锚点的页面，
 * 并提取该锚点下方的所有子 blocks 内容，转换为 Markdown 字符串返回。
 */
export async function getDeepResearchReport(company: string): Promise<string | null> {
  const pages = await getJobPagesByCompany(company);
  if (pages.length === 0) return null;

  const ANCHOR = "🤖 InterviewOS 深度背调报告";

  for (const page of pages) {
    const pageId = typeof page.id === "string" ? page.id : "";
    if (!pageId) continue;

    const fullMd = await getPageBlocksAsMarkdown(pageId);

    // 查找锚点位置
    const anchorIndex = fullMd.indexOf(ANCHOR);
    if (anchorIndex === -1) continue;

    // 提取锚点之后的所有内容
    const reportContent = fullMd.slice(anchorIndex + ANCHOR.length).trim();
    if (reportContent) {
      return `## ${ANCHOR}\n\n${reportContent}`;
    }
  }

  return null;
}
