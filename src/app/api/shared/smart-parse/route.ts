import { generateText } from "ai";
import { getModel } from "@/lib/llm";
import {
  normalizeQuestionBankCategory,
  questionBankCategoryListForPrompt,
} from "@/lib/question-bank-categories";

type SmartParseType = "story" | "question";

type SmartParseRequest = {
  type?: SmartParseType;
  target?: SmartParseType;
  rawText?: string;
};

function parseJson(raw: string) {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("No JSON payload found.");
  }
  return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
}

function buildSystemPrompt(type: SmartParseType) {
  if (type === "story") {
    return `你是一个结构化面试专家。请分析用户输入的文本，将其拆解为合规的 JSON 格式。包含字段：title (精炼标题), situation (背景), task (任务), action (动作), result (结果/数据), earnedSecret (学到的关键洞察/教训), tags (从[领导力, 跨团队协作, 数据驱动, 技术能力, 冲突处理, 创新推动]中提取1-3个标签的数组), rating (根据故事含金量评估1-5的整数)。如果某部分信息缺失，请在对应字段中填入空字符串或合理的推测。

只返回合法 JSON，不要输出任何解释文本、Markdown 或代码块。`.trim();
  }

  return `你是一个资深面试官。请分析用户输入的面试题文本，将其拆解为 JSON 格式。包含字段：title (提取出核心问题题干), category (必须从[${questionBankCategoryListForPrompt()}]中选择一个), company (如果文本中提到了公司名则提取，否则为空), role (如果提到了岗位则提取，否则为空), difficulty (评估难度，从[简单, 中等, 困难]中选择)。

只返回合法 JSON，不要输出任何解释文本、Markdown 或代码块。`.trim();
}

function normalizeStoryTags(value: unknown) {
  const map: Record<string, string> = {
    "领导力": "Leadership",
    "跨团队协作": "Cross-functional",
    "数据驱动": "Data-driven",
    "技术能力": "Technical",
    "冲突处理": "Conflict",
    "创新推动": "Innovation",
    Leadership: "Leadership",
    "Cross-functional": "Cross-functional",
    "Data-driven": "Data-driven",
    Technical: "Technical",
    Conflict: "Conflict",
    Innovation: "Innovation",
  };
  const list = Array.isArray(value) ? value : [];
  const normalized = list
    .map((item) => map[String(item ?? "").trim()])
    .filter((item): item is string => Boolean(item));
  return Array.from(new Set(normalized)).slice(0, 3);
}

function normalizeDifficulty(value: unknown) {
  const parsed = String(value ?? "").trim();
  return parsed === "简单" || parsed === "中等" || parsed === "困难" ? parsed : "中等";
}

function normalizeRating(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 3;
  return Math.max(1, Math.min(5, Math.round(n)));
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SmartParseRequest;
    const type = body.type ?? body.target;
    const rawText = String(body.rawText ?? "").trim();

    if (type !== "story" && type !== "question") {
      return Response.json({ error: "Invalid type." }, { status: 400 });
    }
    if (!rawText) {
      return Response.json({ error: "Missing rawText." }, { status: 400 });
    }

    const generated = await generateText({
      model: getModel("fast"),
      system: buildSystemPrompt(type),
      prompt: `原始文本：\n${rawText}`,
    });
    const parsed = parseJson(generated.text);

    if (type === "story") {
      return Response.json({
        result: {
          title: String(parsed.title ?? "").trim(),
          situation: String(parsed.situation ?? "").trim(),
          task: String(parsed.task ?? "").trim(),
          action: String(parsed.action ?? "").trim(),
          result: String(parsed.result ?? "").trim(),
          earnedSecret: String(parsed.earnedSecret ?? "").trim(),
          tags: normalizeStoryTags(parsed.tags),
          rating: normalizeRating(parsed.rating),
        },
      });
    }

    return Response.json({
      result: {
        title: String(parsed.title ?? "").trim(),
        category: normalizeQuestionBankCategory(parsed.category),
        company: String(parsed.company ?? "").trim(),
        role: String(parsed.role ?? "").trim(),
        difficulty: normalizeDifficulty(parsed.difficulty),
      },
    });
  } catch (error) {
    return Response.json(
      {
        error: "Failed to smart parse content.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
