import { generateText } from "ai";
import { getModel } from "@/lib/llm";
import {
  normalizeQuestionBankCategory,
  questionBankCategoryListForPrompt,
} from "@/lib/question-bank-categories";

type SmartExtractTarget = "story" | "question";

type SmartExtractRequest = {
  target?: SmartExtractTarget;
  rawText?: string;
};

function parseJson(raw: string) {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("No JSON payload found.");
  }
  return JSON.parse(raw.slice(start, end + 1));
}

function buildSystemPrompt(target: SmartExtractTarget) {
  if (target === "story") {
    return `你是一位顶级面试教练，擅长把零散的项目回忆整理成可直接进入 Story Bank 的 STAR 故事。

请阅读用户粘贴的非结构化文本，提取并重组为一个完整、可信、可复述的故事 JSON。

要求：
1. 必须输出合法 JSON，不要输出任何解释、Markdown 或额外文字。
2. title：生成一个清晰、可作为故事卡片标题的短标题。
3. situation / task / action / result：分别提炼 STAR 四部分。如果原文信息不足，也要尽量基于原文做最合理的归纳，但不要编造明显不存在的细节。
4. earnedSecret：提炼这段经历背后的方法论、反思或可迁移洞察。
5. tags：从以下标签中选择 1-3 个最相关项，必须只用这些英文值：Leadership, Cross-functional, Data-driven, Technical, Conflict, Innovation。

Return JSON only:
{
  "title": string,
  "situation": string,
  "task": string,
  "action": string,
  "result": string,
  "earnedSecret": string,
  "tags": string[]
}`.trim();
  }

  return `你是一位资深面试题库教练，擅长从零散的面试回忆中抽取结构化题目。

请阅读用户粘贴的非结构化文本，提取出最核心的一道面试题，并输出为 JSON。

要求：
1. 必须输出合法 JSON，不要输出任何解释、Markdown 或额外文字。
2. title：输出清晰、可直接进入题库的题干。
3. category：必须只从以下值中选择一个：${questionBankCategoryListForPrompt()}。
4. dimensions：用 2-4 个简短短语概括这道题主要考察什么，例如“冲突处理”“主人翁意识”“优先级判断”。
5. difficulty：必须只从以下值中选择一个：简单, 中等, 困难。

Return JSON only:
{
  "title": string,
  "category": string,
  "dimensions": string[],
  "difficulty": string
}`.trim();
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SmartExtractRequest;
    const target = body.target;
    const rawText = String(body.rawText ?? "").trim();

    if (target !== "story" && target !== "question") {
      return Response.json({ error: "Invalid target." }, { status: 400 });
    }
    if (!rawText) {
      return Response.json({ error: "Missing rawText." }, { status: 400 });
    }

    const result = await generateText({
      model: getModel("fast"),
      system: buildSystemPrompt(target),
      prompt: `原始文本：\n${rawText}`,
    });

    const parsed = parseJson(result.text) as Record<string, unknown>;

    if (target === "story") {
      const allowedTags = new Set([
        "Leadership",
        "Cross-functional",
        "Data-driven",
        "Technical",
        "Conflict",
        "Innovation",
      ]);
      const tags = Array.isArray(parsed.tags)
        ? parsed.tags
            .map((item) => String(item ?? "").trim())
            .filter((item) => allowedTags.has(item))
            .slice(0, 3)
        : [];

      return Response.json({
        result: {
          title: String(parsed.title ?? "").trim(),
          situation: String(parsed.situation ?? "").trim(),
          task: String(parsed.task ?? "").trim(),
          action: String(parsed.action ?? "").trim(),
          result: String(parsed.result ?? "").trim(),
          earnedSecret: String(parsed.earnedSecret ?? "").trim(),
          tags,
        },
      });
    }

    const difficulty = String(parsed.difficulty ?? "").trim();
    const dimensions = Array.isArray(parsed.dimensions)
      ? parsed.dimensions.map((item) => String(item ?? "").trim()).filter(Boolean).slice(0, 4)
      : [];

    return Response.json({
      result: {
        title: String(parsed.title ?? "").trim(),
        category: normalizeQuestionBankCategory(parsed.category),
        dimensions,
        difficulty: difficulty === "简单" || difficulty === "中等" || difficulty === "困难" ? difficulty : "中等",
      },
    });
  } catch (error) {
    return Response.json(
      {
        error: "Failed to smart extract content.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
