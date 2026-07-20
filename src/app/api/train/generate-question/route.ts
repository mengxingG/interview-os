import { generateText } from "ai";
import { addQuestion } from "@/lib/notion";
import { getFeatureFallbackOrder, getModel, getModelFallbackOrder, isFeatureModel, type ModelType } from "@/lib/llm";
import { buildUserContextForPrompt } from "@/lib/user-profile";
import {
  DEFAULT_QUESTION_BANK_CATEGORY,
  normalizeQuestionBankCategory,
  questionBankCategoryUnionForPrompt,
} from "@/lib/question-bank-categories";

function parseJson(raw: string) {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON found");
  return JSON.parse(raw.slice(start, end + 1));
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      knowledgePageId?: string;
      title?: string;
      content?: string;
      modelType?: ModelType;
    };
    if (!body.knowledgePageId?.trim() || !body.title?.trim() || !body.content?.trim()) {
      return Response.json({ error: "knowledgePageId, title and content are required." }, { status: 400 });
    }

    const requested = body.modelType ?? "practice";
    const fallbackOrder: ModelType[] = isFeatureModel(requested)
      ? getFeatureFallbackOrder("practice")
      : getModelFallbackOrder(requested);

    const system = `你是面试教练。基于知识点生成 1 道实战面试题，返回 JSON：
{
  "question": string,
  "category": ${questionBankCategoryUnionForPrompt()},
  "difficulty": "简单" | "中等" | "困难",
  "tags": string[]
}
要求：问题必须可用于真实面试，避免泛泛定义题。`.trim();

    const prompt = `用户画像：
${buildUserContextForPrompt()}

知识点标题：${body.title}
知识点内容：
${body.content}`.trim();

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

    const parsed = parseJson(text) as {
      question?: string;
      category?: string;
      difficulty?: "简单" | "中等" | "困难";
      tags?: string[];
    };

    const questionTitle = String(parsed.question ?? "").trim();
    if (!questionTitle) {
      return Response.json({ error: "LLM returned empty question." }, { status: 500 });
    }

    const created = await addQuestion({
      title: questionTitle,
      category: normalizeQuestionBankCategory(parsed.category ?? DEFAULT_QUESTION_BANK_CATEGORY),
      source: "知识实战",
      company: "",
      role: "",
      round: "",
      difficulty: parsed.difficulty ?? "中等",
      myAnswer: "",
      aiFeedback: `来源：知识训练自动生成（Knowledge: ${body.title}）`,
      bestStory: "",
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      practiceCount: 0,
      lastScore: 0,
      lastPracticed: "",
      status: "未练习",
      knowledge: [{ id: body.knowledgePageId }],
    });

    const record = created as { id?: string };
    return Response.json({
      ok: true,
      questionId: typeof record.id === "string" ? record.id : "",
      questionTitle,
    });
  } catch (error) {
    return Response.json(
      { error: "Failed to generate practice interview question.", detail: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}
