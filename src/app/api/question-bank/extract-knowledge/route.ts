import { generateText } from "ai";
import { addKnowledgeCardsBatch } from "@/lib/notion";
import { getModel, type ModelType } from "@/lib/llm";
import { buildUserContextForPrompt } from "@/lib/user-profile";

function parseJsonArray(raw: string) {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start < 0 || end <= start) throw new Error("No JSON array found");
  return JSON.parse(raw.slice(start, end + 1));
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      questionPageId?: string;
      question?: string;
      answer?: string;
      aiFeedback?: string;
      avgScore?: number;
      modelType?: ModelType;
    };

    if (!body.questionPageId?.trim() || !body.question?.trim() || !body.answer?.trim()) {
      return Response.json({ error: "questionPageId, question and answer are required." }, { status: 400 });
    }

    const requested = body.modelType ?? "deep";
    const fallbackOrder: ModelType[] =
      requested === "pro" ? ["pro", "deep", "fast"] : requested === "deep" ? ["deep", "fast"] : ["fast"];

    const system = `你是面试教练。根据“题目 + 候选人糟糕回答 + 反馈”，提取 1-2 个该候选人缺失的核心知识点。
只返回 JSON 数组：
[
  {
    "title": string,
    "domain": string,
    "content": string
  }
]
要求：
- 每条都必须是可复习的“概念/框架/方法”
- 不要重复原题
- 每条 content 用 2-4 句，便于放入 SM-2 知识卡`.trim();

    const prompt = `用户画像：
${buildUserContextForPrompt()}

题目：${body.question}
候选人回答：
${body.answer}

AI反馈：
${body.aiFeedback ?? ""}

当前均分：${typeof body.avgScore === "number" ? body.avgScore.toFixed(1) : "unknown"}`.trim();

    let text = "";
    for (const type of fallbackOrder) {
      try {
        text = (await generateText({ model: getModel(type), system, prompt })).text;
        break;
      } catch {
        // fallback
      }
    }
    if (!text) throw new Error("All models failed");

    const parsed = parseJsonArray(text) as Array<{ title?: string; domain?: string; content?: string }>;
    const items = parsed
      .slice(0, 2)
      .map((item) => ({
        title: String(item.title ?? "").trim(),
        domain: String(item.domain ?? "General").trim() || "General",
        content: String(item.content ?? "").trim(),
      }))
      .filter((item) => item.title && item.content);

    if (items.length === 0) {
      return Response.json({ error: "LLM returned empty knowledge items." }, { status: 500 });
    }

    await addKnowledgeCardsBatch(
      items.map((item) => ({
        ...item,
        questions: [{ id: body.questionPageId! }],
      })),
    );

    return Response.json({ ok: true, count: items.length, items });
  } catch (error) {
    return Response.json(
      { error: "Failed to extract missing knowledge.", detail: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}
