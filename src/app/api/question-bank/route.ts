import { generateText } from "ai";
import { Client } from "@notionhq/client";
import { getModel, type ModelType } from "@/lib/llm";
import { buildUserContextForPrompt } from "@/lib/user-profile";
import type { NotionRelationRef, QuestionBankNotionRow } from "@/types/notion";

type NotionProperties = Record<string, unknown>;

type QuestionBankCategory =
  | "Behavioral"
  | "Product Sense"
  | "Technical"
  | "Case Study"
  | "System Design"
  | "Culture Fit";

type Difficulty = "简单" | "中等" | "困难";
type QuestionStatus = "未练习" | "已练习" | "已掌握" | "需加强";

type QuestionBankRow = QuestionBankNotionRow & {
  category: QuestionBankCategory;
  difficulty: Difficulty;
  status: QuestionStatus;
};

function isEmptyQuestionRow(row: QuestionBankRow) {
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

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const questionBankDb =
  process.env.NOTION_QUESTION_DB || process.env.NOTION_QUESTIONS_DB || process.env.NOTION_QUESTION_BANK_DB || "";
const interviewDb = process.env.NOTION_INTERVIEW_DB || "";

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function pickFirstExisting(candidates: string[], available: Set<string>) {
  return candidates.find((name) => available.has(name));
}

function readRichText(properties: NotionProperties, key: string) {
  const prop = asRecord(properties[key]);
  const rich = prop.rich_text;
  if (!Array.isArray(rich) || rich.length === 0) {
    return "";
  }
  return rich
    .map((part) =>
      part !== null && typeof part === "object" && "plain_text" in part
        ? String((part as { plain_text?: unknown }).plain_text ?? "")
        : "",
    )
    .join("")
    .trim();
}

function readTitle(properties: NotionProperties, key = "Title") {
  const prop = asRecord(properties[key]);
  const title = Array.isArray(prop.title) ? (prop.title as Array<{ plain_text?: string }>) : [];
  return title.map((entry) => entry?.plain_text ?? "").join("").trim();
}

function readSelect(properties: NotionProperties, key: string, fallback = "") {
  const prop = asRecord(properties[key]);
  const select = asRecord(prop.select);
  return typeof select.name === "string" ? select.name : fallback;
}

function readMultiSelect(properties: NotionProperties, key: string) {
  const prop = asRecord(properties[key]);
  const list = Array.isArray(prop.multi_select) ? prop.multi_select : [];
  return list
    .map((entry) =>
      entry !== null && typeof entry === "object" && "name" in entry
        ? String((entry as { name?: unknown }).name ?? "")
        : "",
    )
    .filter(Boolean);
}

function readNumber(properties: NotionProperties, key: string, fallback = 0) {
  const prop = asRecord(properties[key]);
  return typeof prop.number === "number" ? prop.number : fallback;
}

function readDate(properties: NotionProperties, key: string, fallback = "") {
  const prop = asRecord(properties[key]);
  const date = asRecord(prop.date);
  return typeof date.start === "string" ? date.start : fallback;
}

function readRelation(properties: NotionProperties, key: string) {
  const prop = asRecord(properties[key]);
  const relations = Array.isArray(prop.relation) ? prop.relation : [];
  return relations
    .map((entry) =>
      entry !== null && typeof entry === "object" && "id" in entry
        ? ({ id: String((entry as { id?: unknown }).id ?? "") } satisfies NotionRelationRef)
        : null,
    )
    .filter((entry): entry is NotionRelationRef => Boolean(entry?.id));
}

async function getPropertyNames(databaseId: string) {
  const db = await notion.databases.retrieve({ database_id: databaseId });
  const props =
    db && typeof db === "object" && "properties" in db
      ? (db.properties as Record<string, unknown>)
      : {};
  return new Set(Object.keys(props));
}

function parseJson(raw: string) {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON found");
  return JSON.parse(raw.slice(start, end + 1));
}

function parseJsonArray(raw: string) {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start < 0 || end <= start) throw new Error("No JSON array found");
  return JSON.parse(raw.slice(start, end + 1));
}

async function toQuestionBankRow(item: unknown): Promise<QuestionBankRow> {
  const record = asRecord(item);
  const properties = asRecord(record.properties);

  const titleKey = Object.keys(properties).find((k) => asRecord(properties[k]).type === "title") ?? "Title";
  const categoryKey = Object.keys(properties).find((k) => k.toLowerCase().includes("category")) ?? "Category";
  const sourceKey = Object.keys(properties).find((k) => k.toLowerCase().includes("source")) ?? "Source";
  const companyKey = Object.keys(properties).find((k) => k.toLowerCase().includes("company")) ?? "Company";
  const roleKey = Object.keys(properties).find((k) => k.toLowerCase().includes("role")) ?? "Role";
  const difficultyKey = Object.keys(properties).find((k) => k.toLowerCase().includes("difficulty")) ?? "Difficulty";
  const myAnswerKey = Object.keys(properties).find((k) => k.toLowerCase().includes("my answer")) ?? "My Answer";
  const aiFeedbackKey = Object.keys(properties).find((k) => k.toLowerCase().includes("ai feedback")) ?? "AI Feedback";
  const storyKey = Object.keys(properties).find((k) => k.toLowerCase().includes("best story")) ?? "Best Story";
  const tagsKey = Object.keys(properties).find((k) => k.toLowerCase().includes("tags")) ?? "Tags";
  const practiceCountKey = Object.keys(properties).find((k) => k.toLowerCase().includes("practice count")) ?? "Practice Count";
  const lastScoreKey = Object.keys(properties).find((k) => k.toLowerCase().includes("last score")) ?? "Last Score";
  const lastPracticedKey = Object.keys(properties).find((k) => k.toLowerCase().includes("last practiced")) ?? "Last Practiced";
  const statusKey = Object.keys(properties).find((k) => k.toLowerCase().includes("status")) ?? "Status";
  const knowledgeKey = Object.keys(properties).find((k) => k.toLowerCase().includes("knowledge")) ?? "Knowledge";

  return {
      id: typeof record.id === "string" ? record.id : "",
    title: readTitle(properties, titleKey),
    category: readSelect(properties, categoryKey, "Behavioral") as QuestionBankCategory,
    source: readSelect(properties, sourceKey, "手动输入"),
    company: readRichText(properties, companyKey),
    role: readRichText(properties, roleKey),
    difficulty: readSelect(properties, difficultyKey, "中等") as Difficulty,
    myAnswer: readRichText(properties, myAnswerKey),
    aiFeedback: readRichText(properties, aiFeedbackKey),
    bestStory: readRichText(properties, storyKey),
    tags: readMultiSelect(properties, tagsKey),
    practiceCount: readNumber(properties, practiceCountKey, 0),
    lastScore: readNumber(properties, lastScoreKey, 0),
    lastPracticed: readDate(properties, lastPracticedKey, ""),
    status: readSelect(properties, statusKey, "未练习") as QuestionStatus,
    knowledge: readRelation(properties, knowledgeKey),
  };
}

async function createQuestionInNotion(data: Omit<QuestionBankRow, "id" | "knowledge"> & { knowledge?: NotionRelationRef[] }) {
  if (!questionBankDb) {
    throw new Error("Question DB env missing: set NOTION_QUESTION_DB (legacy: NOTION_QUESTIONS_DB/NOTION_QUESTION_BANK_DB)");
  }
  const available = await getPropertyNames(questionBankDb);
  const titleKey = pickFirstExisting(["Title", "Name"], available);
  if (!titleKey) throw new Error("QuestionBank database must contain Title or Name");

  const categoryKey = pickFirstExisting(["Category"], available);
  const sourceKey = pickFirstExisting(["Source"], available);
  const companyKey = pickFirstExisting(["Company"], available);
  const roleKey = pickFirstExisting(["Role"], available);
  const difficultyKey = pickFirstExisting(["Difficulty"], available);
  const myAnswerKey = pickFirstExisting(["My Answer"], available);
  const aiFeedbackKey = pickFirstExisting(["AI Feedback"], available);
  const bestStoryKey = pickFirstExisting(["Best Story"], available);
  const tagsKey = pickFirstExisting(["Tags"], available);
  const practiceCountKey = pickFirstExisting(["Practice Count"], available);
  const lastScoreKey = pickFirstExisting(["Last Score"], available);
  const lastPracticedKey = pickFirstExisting(["Last Practiced"], available);
  const statusKey = pickFirstExisting(["Status"], available);
  const knowledgeKey = pickFirstExisting(["Knowledge"], available);

  const props: Record<string, unknown> = {
    [titleKey]: { title: [{ text: { content: data.title } }] },
  };
  if (categoryKey) props[categoryKey] = { select: { name: data.category } };
  if (sourceKey) props[sourceKey] = { select: { name: data.source } };
  if (companyKey) props[companyKey] = { rich_text: [{ text: { content: data.company } }] };
  if (roleKey) props[roleKey] = { rich_text: [{ text: { content: data.role } }] };
  if (difficultyKey) props[difficultyKey] = { select: { name: data.difficulty } };
  if (myAnswerKey) props[myAnswerKey] = { rich_text: [{ text: { content: data.myAnswer.substring(0, 2000) } }] };
  if (aiFeedbackKey) props[aiFeedbackKey] = { rich_text: [{ text: { content: data.aiFeedback.substring(0, 2000) } }] };
  if (bestStoryKey) props[bestStoryKey] = { rich_text: [{ text: { content: data.bestStory } }] };
  if (tagsKey) props[tagsKey] = { multi_select: data.tags.map((tag) => ({ name: tag })) };
  if (practiceCountKey) props[practiceCountKey] = { number: data.practiceCount };
  if (lastScoreKey) props[lastScoreKey] = { number: data.lastScore };
  if (lastPracticedKey && data.lastPracticed) props[lastPracticedKey] = { date: { start: data.lastPracticed } };
  if (statusKey) props[statusKey] = { select: { name: data.status } };
  if (knowledgeKey && Array.isArray(data.knowledge) && data.knowledge.length > 0) {
    props[knowledgeKey] = { relation: data.knowledge.map((item) => ({ id: item.id })) };
  }

  return notion.pages.create({
    parent: { database_id: questionBankDb },
    properties: props as never,
  });
}

async function updatePracticeInNotion(
  pageId: string,
  patch: { myAnswer: string; aiFeedback: string; score: number; bestStory?: string; status: QuestionStatus },
) {
  if (!questionBankDb) {
    throw new Error("Question DB env missing: set NOTION_QUESTION_DB (legacy: NOTION_QUESTIONS_DB/NOTION_QUESTION_BANK_DB)");
  }
  const available = await getPropertyNames(questionBankDb);
  const myAnswerKey = pickFirstExisting(["My Answer"], available);
  const aiFeedbackKey = pickFirstExisting(["AI Feedback"], available);
  const bestStoryKey = pickFirstExisting(["Best Story"], available);
  const practiceCountKey = pickFirstExisting(["Practice Count"], available);
  const lastScoreKey = pickFirstExisting(["Last Score"], available);
  const lastPracticedKey = pickFirstExisting(["Last Practiced"], available);
  const statusKey = pickFirstExisting(["Status"], available);

  const current = await notion.pages.retrieve({ page_id: pageId });
  const props = asRecord((current as { properties?: unknown }).properties);
  const currentPracticeCount = practiceCountKey ? readNumber(props, practiceCountKey, 0) : 0;

  const updateProps: Record<string, unknown> = {};
  if (myAnswerKey) updateProps[myAnswerKey] = { rich_text: [{ text: { content: patch.myAnswer.substring(0, 2000) } }] };
  if (aiFeedbackKey) updateProps[aiFeedbackKey] = { rich_text: [{ text: { content: patch.aiFeedback.substring(0, 2000) } }] };
  if (bestStoryKey && patch.bestStory) updateProps[bestStoryKey] = { rich_text: [{ text: { content: patch.bestStory } }] };
  if (practiceCountKey) updateProps[practiceCountKey] = { number: currentPracticeCount + 1 };
  if (lastScoreKey) updateProps[lastScoreKey] = { number: Number(patch.score.toFixed(1)) };
  if (lastPracticedKey) updateProps[lastPracticedKey] = { date: { start: new Date().toISOString().slice(0, 10) } };
  if (statusKey) updateProps[statusKey] = { select: { name: patch.status } };

  await notion.pages.update({
    page_id: pageId,
    properties: updateProps as never,
  });
}

async function listQuestions(filters: {
  category?: string;
  source?: string;
  company?: string;
  difficulty?: string;
  status?: string;
}) {
  if (!questionBankDb) {
    throw new Error("Question DB env missing: set NOTION_QUESTION_DB (legacy: NOTION_QUESTIONS_DB/NOTION_QUESTION_BANK_DB)");
  }
  const results = await notion.databases.query({
    database_id: questionBankDb,
  });
  const rows = await Promise.all(results.results.map((item) => toQuestionBankRow(item)));
  return rows.filter((row) => {
    if (isEmptyQuestionRow(row)) return false;
    if (filters.category && filters.category !== "all" && row.category !== filters.category) return false;
    if (filters.source && filters.source !== "all" && row.source !== filters.source) return false;
    if (filters.company && filters.company !== "all" && row.company !== filters.company) return false;
    if (filters.difficulty && filters.difficulty !== "all" && row.difficulty !== filters.difficulty) return false;
    if (filters.status && filters.status !== "all" && row.status !== filters.status) return false;
    return true;
  });
}

async function importFromInterviewRecords() {
  if (!interviewDb) throw new Error("NOTION_INTERVIEW_DB is missing");
  const results = await notion.databases.query({ database_id: interviewDb });
  const created: number[] = [];

  for (const item of results.results) {
    const record = asRecord(item);
    const properties = asRecord(record.properties);
    const titleKey = Object.keys(properties).find((k) => asRecord(properties[k]).type === "title") ?? "Title";
    const analysisKey = Object.keys(properties).find((k) => k.toLowerCase().includes("ai analysis")) ?? "AI Analysis";
    const companyKey = Object.keys(properties).find((k) => k.toLowerCase().includes("company")) ?? "Company";
    const typeKey = Object.keys(properties).find((k) => k.toLowerCase().includes("type")) ?? "Type";
    const analysisRaw = readRichText(properties, analysisKey);
    if (!analysisRaw) continue;

    try {
      const parsed = parseJson(analysisRaw) as { answerReviews?: Array<{ question?: string }>; answer_reviews?: Array<{ question?: string }> };
      const questions = (parsed.answerReviews ?? parsed.answer_reviews ?? [])
        .map((entry) => String(entry.question ?? "").trim())
        .filter(Boolean);
      for (const q of questions.slice(0, 10)) {
        await createQuestionInNotion({
          title: q,
          category: "Behavioral",
          source: "真实面试",
          company: readRichText(properties, companyKey) || readTitle(properties, titleKey),
          role: readSelect(properties, typeKey, ""),
          difficulty: "中等",
          myAnswer: "",
          aiFeedback: "",
          bestStory: "",
          tags: [],
          practiceCount: 0,
          lastScore: 0,
          lastPracticed: "",
          status: "未练习",
        });
        created.push(1);
      }
    } catch {
      // ignore single bad row
    }
  }

  return created.length;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const rows = await listQuestions({
      category: url.searchParams.get("category") ?? undefined,
      source: url.searchParams.get("source") ?? undefined,
      company: url.searchParams.get("company") ?? undefined,
      difficulty: url.searchParams.get("difficulty") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
    });
    return Response.json({ rows });
  } catch (error) {
    return Response.json(
      { error: "Failed to load question bank.", detail: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    type CreateQuestionPayload = Omit<QuestionBankRow, "id" | "knowledge"> & { knowledge?: NotionRelationRef[] };
    const body = (await req.json()) as
      | ({ action: "create"; item: CreateQuestionPayload })
      | ({ action: "batch_generate"; role: string; company: string; modelType?: ModelType })
      | ({ action: "import_interview" })
      | ({ action: "practice_update"; id: string; myAnswer: string; aiFeedback: string; score: number; bestStory?: string; status: QuestionStatus });

    if (body.action === "create") {
      await createQuestionInNotion(body.item);
      return Response.json({ ok: true });
    }

    if (body.action === "batch_generate") {
      const system = `
You are an interview question generator.
Generate exactly 10 high-frequency interview questions and return JSON array only:
[
  { "title": string, "category": "Behavioral" | "Product Sense" | "Technical" | "Case Study" | "System Design" | "Culture Fit", "difficulty": "简单" | "中等" | "困难", "tags": string[] }
]
`.trim();
      const prompt = `
Target role: ${body.role}
Target company: ${body.company}
Candidate profile:
${buildUserContextForPrompt()}
`.trim();
      const order: ModelType[] = body.modelType === "pro" ? ["pro", "deep", "fast"] : body.modelType === "deep" ? ["deep", "fast"] : ["fast"];
      let text = "";
      for (const t of order) {
        try {
          text = (await generateText({ model: getModel(t), system, prompt })).text;
          break;
        } catch {
          // fallback
        }
      }
      if (!text) throw new Error("All models failed");
      const generated = parseJsonArray(text) as Array<{
        title: string;
        category: QuestionBankCategory;
        difficulty: Difficulty;
        tags?: string[];
      }>;
      for (const item of generated.slice(0, 10)) {
        await createQuestionInNotion({
          title: item.title,
          category: item.category,
          source: "AI生成",
          company: body.company,
          role: body.role,
          difficulty: item.difficulty,
          myAnswer: "",
          aiFeedback: "",
          bestStory: "",
          tags: item.tags ?? [],
          practiceCount: 0,
          lastScore: 0,
          lastPracticed: "",
          status: "未练习",
        });
      }
      return Response.json({ ok: true, count: Math.min(10, generated.length) });
    }

    if (body.action === "import_interview") {
      const count = await importFromInterviewRecords();
      return Response.json({ ok: true, count });
    }

    if (body.action === "practice_update") {
      await updatePracticeInNotion(body.id, {
        myAnswer: body.myAnswer,
        aiFeedback: body.aiFeedback,
        score: body.score,
        bestStory: body.bestStory,
        status: body.status,
      });
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    return Response.json(
      { error: "Failed to update question bank.", detail: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}
