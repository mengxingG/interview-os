import { generateText } from "ai";
import { getFeatureFallbackOrder, getModel, getModelFallbackOrder, isFeatureModel, type ModelType } from "@/lib/llm";
import { buildUserContextForPrompt } from "@/lib/user-profile";
import { getAllKnowledgeCards, getJDRecords, getKnowledgeCardsToReview, getQuestions } from "@/lib/notion";

type Mode = "aipm" | "question-bank" | "jd" | "review-plan";

type RequestBody = {
  mode?: Mode;
  modelType?: ModelType;
  count?: number;
  reviewPlanTitles?: string[];
};

type GeneratedItem = {
  title: string;
  domain: string;
  content: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function readRichText(properties: Record<string, unknown>, key: string) {
  const prop = asRecord(properties[key]);
  const rich = prop.rich_text;
  if (!Array.isArray(rich) || rich.length === 0) return "";
  return rich
    .map((part) =>
      part !== null && typeof part === "object" && "plain_text" in part
        ? String((part as { plain_text?: unknown }).plain_text ?? "")
        : "",
    )
    .join("")
    .trim();
}

function readTitle(properties: Record<string, unknown>) {
  const titleProp = asRecord(properties.Title);
  const nameProp = asRecord(properties.Name);
  const fromTitle = (titleProp.title as Array<{ plain_text?: string }> | undefined)?.[0]?.plain_text ?? "";
  const fromName = (nameProp.title as Array<{ plain_text?: string }> | undefined)?.[0]?.plain_text ?? "";
  return (fromTitle || fromName || "Untitled").trim();
}

function parseJsonArray(raw: string): GeneratedItem[] {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start < 0 || end <= start) return [];
  const parsed = JSON.parse(raw.slice(start, end + 1)) as unknown;
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((item) => asRecord(item))
    .map((item) => ({
      title: String(item.title ?? "").trim(),
      domain: String(item.domain ?? "产品方法论").trim() || "产品方法论",
      content: String(item.content ?? "").trim(),
    }))
    .filter((item) => item.title && item.content);
}

function aipmFallback(): GeneratedItem[] {
  return [
    "RAG 架构核心概念（检索增强生成的工作原理）",
    "Hybrid Search 为什么比纯向量检索好",
    "AI PM 如何定义和衡量模型效果（Precision/Recall/F1）",
    "为什么不微调金融专用模型而用 RAG",
    "Semantic Cache 的工作原理和成本优化",
    "LLM 应用的 Prompt Engineering 最佳实践",
    "AI 产品的 A/B Testing 方法论",
    "推荐系统核心指标（CTR/CVR/NDCG）",
    "数据飞轮（Data Flywheel）概念",
    "AI 产品的 Build vs Buy 决策框架",
    "可解释 AI（XAI）在高风险场景的重要性",
    "Agent / Workflow / RAG 三种 LLM 应用架构对比",
    "AI 产品的冷启动策略",
    "模型评估：离线指标 vs 在线指标",
    "AI 产品的合规与隐私（GDPR/数据安全）",
  ].map((title) => ({
    title,
    domain: "NLP与LLM",
    content: `${title}：请从定义、适用场景、常见误区、面试回答模板四个维度掌握。`,
  }));
}

function dedupe(items: GeneratedItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;
    const mode = body.mode ?? "aipm";
    const count = Math.min(Math.max(body.count ?? 15, 5), 20);
    const requestedModel = body.modelType ?? "practice";
    const fallbackOrder: ModelType[] = isFeatureModel(requestedModel)
      ? getFeatureFallbackOrder("practice")
      : getModelFallbackOrder(requestedModel);
    let sourceContext = "";

    if (mode === "question-bank") {
      const rows = await getQuestions();
      sourceContext = rows
        .slice(0, 60)
        .map((row, idx) => `${idx + 1}. [${row.category}] ${row.title}`)
        .join("\n");
    } else if (mode === "jd") {
      const rows = await getJDRecords();
      sourceContext = rows
        .slice(0, 20)
        .map((item, idx) => {
          const props = asRecord(asRecord(item).properties);
          return `${idx + 1}. ${readTitle(props)}\nSummary: ${readRichText(props, "Decode Summary") || readRichText(props, "Summary")}`;
        })
        .join("\n");
    } else if (mode === "review-plan") {
      const due = await getKnowledgeCardsToReview();
      const all = due.length > 0 ? due : await getAllKnowledgeCards();
      const pickedTitles = Array.isArray(body.reviewPlanTitles) && body.reviewPlanTitles.length > 0
        ? body.reviewPlanTitles
        : all
            .slice(0, 20)
            .map((item) => readTitle(asRecord(asRecord(item).properties)));
      sourceContext = pickedTitles.map((title, idx) => `${idx + 1}. ${title}`).join("\n");
    }

    const system = `你是 AI 面试教练，请输出知识训练卡片，返回 JSON 数组，不要输出任何解释。
格式：
[
  { "title": string, "domain": "NLP与LLM" | "产品方法论" | "数据分析" | "系统设计", "content": string }
]
要求：
- 生成 ${count} 条
- 每条 content 80-160 字，必须包含：定义 + 面试使用场景 + 一句关键表达
- 语气简洁，可直接用于 SM-2 复习。`;

    const prompt = `
模式：${mode}
候选人画像：
${buildUserContextForPrompt()}

素材（可为空）：
${sourceContext || "无，按 AI PM 高频知识点生成"}
`.trim();

    let items: GeneratedItem[] = [];
    for (const m of fallbackOrder) {
      try {
        const text = (await generateText({ model: getModel(m), system, prompt })).text;
        items = parseJsonArray(text);
        if (items.length > 0) break;
      } catch {
        // fallback
      }
    }

    if (items.length === 0 && mode === "aipm") {
      items = aipmFallback();
    }
    const finalItems = dedupe(items).slice(0, count);
    return Response.json({ items: finalItems });
  } catch (error) {
    return Response.json(
      { error: "Failed to generate knowledge points.", detail: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}

