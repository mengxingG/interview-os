import { generateText } from "ai";
import { withClaudeRoleLock } from "@/config/prompts";
import { getModel, getModelFallbackOrder, type ModelType } from "@/lib/llm";
import { getStories } from "@/lib/notion";
import { buildUserContextForPrompt } from "@/lib/user-profile";

function parseJson(raw: string) {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON found");
  return JSON.parse(raw.slice(start, end + 1));
}

function averageScore(scores: Record<string, number>) {
  const list = ["Substance", "Structure", "Relevance", "Credibility", "Differentiation"].map(
    (key) => Number(scores[key] ?? 0),
  );
  return list.reduce((a, b) => a + b, 0) / 5;
}

function inferStatus(avg: number) {
  if (avg >= 4) return "已掌握";
  if (avg >= 3) return "已练习";
  return "需加强";
}

function readTitleFromStory(result: unknown) {
  const record = result !== null && typeof result === "object" ? (result as Record<string, unknown>) : {};
  const properties =
    record.properties !== null && typeof record.properties === "object"
      ? (record.properties as Record<string, unknown>)
      : {};
  const titlePropKey = Object.keys(properties).find((key) => {
    const v = properties[key];
    return v !== null && typeof v === "object" && "type" in (v as Record<string, unknown>) && (v as { type?: unknown }).type === "title";
  });
  if (!titlePropKey) return "";
  const titleProp = properties[titlePropKey] as { title?: Array<{ plain_text?: string }> };
  return Array.isArray(titleProp.title) ? titleProp.title.map((entry) => entry.plain_text ?? "").join("").trim() : "";
}

function readStoryText(result: unknown) {
  const record = result !== null && typeof result === "object" ? (result as Record<string, unknown>) : {};
  const properties =
    record.properties !== null && typeof record.properties === "object"
      ? (record.properties as Record<string, unknown>)
      : {};
  const chunks: string[] = [];
  for (const [key, value] of Object.entries(properties)) {
    const prop = value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
    if (prop.type === "title" && Array.isArray(prop.title)) {
      chunks.push(
        (prop.title as Array<{ plain_text?: string }>)
          .map((item) => item.plain_text ?? "")
          .join(" ")
          .trim(),
      );
    }
    if (prop.type === "rich_text" && Array.isArray(prop.rich_text)) {
      chunks.push(
        (prop.rich_text as Array<{ plain_text?: string }>)
          .map((item) => item.plain_text ?? "")
          .join(" ")
          .trim(),
      );
    }
    if (prop.type === "multi_select" && Array.isArray(prop.multi_select)) {
      chunks.push(
        (prop.multi_select as Array<{ name?: string }>)
          .map((item) => item.name ?? "")
          .join(" ")
          .trim(),
      );
    }
    if (typeof key === "string") chunks.push(key);
  }
  return chunks.join(" ").toLowerCase();
}

function computeTextSimilarity(query: string, text: string) {
  const qTokens = query
    .toLowerCase()
    .split(/[^a-zA-Z0-9\u4e00-\u9fa5]+/)
    .filter((item) => item.length >= 2);
  if (qTokens.length === 0) return 0;
  let hit = 0;
  for (const token of qTokens) {
    if (text.includes(token)) hit += 1;
  }
  return hit / qTokens.length;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      question?: string;
      answer?: string;
      selfScore?: number;
      modelType?: ModelType;
    };
    if (!body.question?.trim() || !body.answer?.trim()) {
      return Response.json({ error: "question and answer are required." }, { status: 400 });
    }
    const requested = body.modelType ?? "mock";
    const fallbackOrder = getModelFallbackOrder(requested);
    const system = withClaudeRoleLock(`You are an interview evaluator.
Return JSON only:
{
  "scores": { "Substance": number, "Structure": number, "Relevance": number, "Credibility": number, "Differentiation": number },
  "strengths": string[],
  "gaps": string[],
  "improvements": string[],
  "coachMarkdown": string
}`.trim());
    const prompt = `${buildUserContextForPrompt()}

Question:
${body.question}

Candidate answer:
${body.answer}

Self score (1-5): ${body.selfScore ?? 3}`.trim();
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
    const result = parseJson(text) as {
      scores: Record<string, number>;
      strengths?: string[];
      gaps?: string[];
      improvements?: string[];
      coachMarkdown?: string;
    };
    const avg = averageScore(result.scores ?? {});
    let bestStory = "";
    try {
      const stories = await getStories();
      const query = `${body.question}\n${body.answer}`;
      const ranked = stories
        .map((story) => ({
          title: readTitleFromStory(story),
          score: computeTextSimilarity(query, readStoryText(story)),
        }))
        .sort((a, b) => b.score - a.score);
      bestStory = ranked[0]?.title ?? "";
    } catch {
      bestStory = "";
    }
    return Response.json({
      result: {
        ...result,
        coachMarkdown:
          typeof result.coachMarkdown === "string" && result.coachMarkdown.trim().length > 0
            ? result.coachMarkdown.trim()
            : [
                "## 教练批语与重写建议",
                "",
                "### 亮点",
                ...((result.strengths ?? []).slice(0, 4).map((item) => `- ${item}`) || ["- 暂无明确亮点，请补充更具体的成果数据。"]),
                "",
                "### 主要扣分点",
                ...((result.gaps ?? []).slice(0, 4).map((item) => `- ${item}`) || ["- 回答需进一步贴合问题，避免泛泛而谈。"]),
                "",
                "### 可直接替换的表达（STAR）",
                ...((result.improvements ?? []).slice(0, 4).map((item) => `- ${item}`) || ["- 建议采用 STAR：先交代场景，再讲动作与结果。"]),
              ].join("\n"),
        avgScore: Number(avg.toFixed(1)),
        status: inferStatus(avg),
        bestStory,
      },
    });
  } catch (error) {
    return Response.json(
      { error: "Failed to score question practice.", detail: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}
