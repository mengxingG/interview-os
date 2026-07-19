import { generateText } from "ai";
import { getModel } from "@/lib/llm";
import { addQuestionsBatch, getInterviewRecords, type QuestionRow } from "@/lib/notion";
import { DEFAULT_QUESTION_BANK_CATEGORY } from "@/lib/question-bank-categories";

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function readRichText(properties: Record<string, unknown>, key: string) {
  const prop = asRecord(properties[key]);
  const list = Array.isArray(prop.rich_text) ? prop.rich_text : [];
  return list
    .map((item) =>
      item !== null && typeof item === "object" && "plain_text" in item
        ? String((item as { plain_text?: unknown }).plain_text ?? "")
        : "",
    )
    .join("")
    .trim();
}

function parseJson(raw: string) {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON");
  return JSON.parse(raw.slice(start, end + 1));
}

async function extractQuestionsByAI(transcript: string) {
  const system = `Extract interview questions from transcript. Return JSON:
{ "questions": string[] }`;
  const text = (await generateText({
    model: getModel("pro"),
    system,
    prompt: transcript.slice(0, 4000),
  })).text;
  const parsed = parseJson(text) as { questions?: string[] };
  return (parsed.questions ?? []).map((item) => item.trim()).filter(Boolean).slice(0, 10);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as
      | { mode: "preview"; limit?: number }
      | { mode: "commit"; rows: Array<Omit<QuestionRow, "id">> };

    if (body.mode === "commit") {
      await addQuestionsBatch(body.rows.map((row) => ({ ...row, knowledge: row.knowledge ?? [] })));
      return Response.json({ ok: true, count: body.rows.length });
    }

    const records = await getInterviewRecords();
    const limit = Math.min(50, Math.max(1, body.limit ?? 20));
    const output: Array<Omit<QuestionRow, "id">> = [];

    for (const item of records.slice(0, limit)) {
      const record = asRecord(item);
      const properties = asRecord(record.properties);
      const companyKey = Object.keys(properties).find((k) => k.toLowerCase().includes("company")) ?? "Company";
      const typeKey = Object.keys(properties).find((k) => k.toLowerCase().includes("type")) ?? "Type";
      const transcriptKey = Object.keys(properties).find((k) => k.toLowerCase().includes("transcript")) ?? "Transcript";
      const analysisKey = Object.keys(properties).find((k) => k.toLowerCase().includes("ai analysis")) ?? "AI Analysis";
      const company = readRichText(properties, companyKey);
      const role = readRichText(properties, typeKey);
      const transcript = readRichText(properties, transcriptKey);
      const analysis = readRichText(properties, analysisKey);

      let questions: string[] = [];
      if (analysis) {
        try {
          const parsed = parseJson(analysis) as { answerReviews?: Array<{ question?: string }>; answer_reviews?: Array<{ question?: string }> };
          questions = (parsed.answerReviews ?? parsed.answer_reviews ?? [])
            .map((entry) => String(entry.question ?? "").trim())
            .filter(Boolean);
        } catch {
          // fall back to AI extraction
        }
      }
      if (questions.length === 0 && transcript) {
        try {
          questions = await extractQuestionsByAI(transcript);
        } catch {
          questions = [];
        }
      }
      for (const q of questions.slice(0, 5)) {
        output.push({
          title: q,
          category: DEFAULT_QUESTION_BANK_CATEGORY,
          source: "真实面试",
          company,
          role,
          difficulty: "中等",
          myAnswer: "",
          aiFeedback: "来源：Interview Records 自动拆题",
          bestStory: "",
          tags: [],
          practiceCount: 0,
          lastScore: 0,
          lastPracticed: "",
          status: "未练习",
          knowledge: [],
        });
      }
    }

    return Response.json({ rows: output.slice(0, 100) });
  } catch (error) {
    return Response.json(
      { error: "Failed to import from debrief.", detail: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}
