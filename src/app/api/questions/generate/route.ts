import { generateText } from "ai";
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
      role?: string;
      company?: string;
      count?: number;
      categories?: string[];
      modelType?: ModelType;
    };
    if (!body.role?.trim()) {
      return Response.json({ error: "role is required" }, { status: 400 });
    }
    const count = body.count === 5 || body.count === 10 || body.count === 15 ? body.count : 10;
    const requested = body.modelType ?? "deep";
    const fallbackOrder: ModelType[] =
      requested === "pro" ? ["pro", "deep", "fast"] : requested === "deep" ? ["deep", "fast"] : ["fast"];
    const categoryList = Array.isArray(body.categories) ? body.categories.filter(Boolean) : [];
    const categoryHint =
      categoryList.length > 0
        ? `Prefer these categories: ${categoryList.join(", ")}.`
        : "Cover categories evenly.";
    const system = `You generate interview questions. Return JSON array only, length=${count}.
Each item schema:
{
  "title": string,
  "category": "Behavioral" | "Product Sense" | "Technical" | "Case Study" | "System Design" | "Culture Fit",
  "difficulty": "简单" | "中等" | "困难",
  "tags": string[]
}
${categoryHint}`.trim();
    const prompt = `Target role: ${body.role}
Target company: ${body.company ?? ""}
Candidate profile:
${buildUserContextForPrompt()}`.trim();
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
    const items = parseJsonArray(text) as Array<{
      title: string;
      category: string;
      difficulty: string;
      tags?: string[];
    }>;
    return Response.json({
      items: items.slice(0, count).map((item) => ({
        title: item.title,
        category: item.category,
        difficulty: item.difficulty,
        tags: item.tags ?? [],
      })),
    });
  } catch (error) {
    return Response.json(
      { error: "Failed to generate questions.", detail: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}
