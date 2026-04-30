import { generateText } from "ai";
import { getModel, type ModelType } from "@/lib/llm";
import { buildUserContextForPrompt } from "@/lib/user-profile";
import { getStories } from "@/lib/notion";
import { composeReferenceBackedPrompt } from "@/lib/prompts/references/compose";

type RequestBody = {
  prepFullContent?: string;
  modelType?: ModelType;
};

function parseJson(raw: string) {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON found");
  return JSON.parse(raw.slice(start, end + 1));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function readTitle(properties: Record<string, unknown>) {
  const titleProp = asRecord(properties.Title);
  const nameProp = asRecord(properties.Name);
  const fromTitle = (titleProp.title as Array<{ plain_text?: string }> | undefined)?.[0]?.plain_text;
  const fromName = (nameProp.title as Array<{ plain_text?: string }> | undefined)?.[0]?.plain_text;
  return String(fromTitle ?? fromName ?? "").trim();
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

function normalizeHypeResult(input: unknown) {
  const obj = asRecord(input);
  const three = asRecord(obj.threeByThree);
  const trimShort = (value: string, maxChars = 15) => {
    const normalized = value.replace(/\s+/g, " ").trim();
    if (normalized.length <= maxChars) return normalized;
    return normalized.slice(0, maxChars);
  };
  const readList = (value: unknown) =>
    Array.isArray(value)
      ? value.map((item) => String(item ?? "").trim()).filter(Boolean)
      : [];
  return {
    highlightReplay60s: readList(obj.highlightReplay60s)
      .slice(0, 3)
      .map((item) => trimShort(item, 15)),
    threeByThree: {
      mustLandPoints: readList(three.mustLandPoints),
      likelyQuestions: readList(three.likelyQuestions),
    },
    recoveryManual: readList(obj.recoveryManual),
    focusCue: String(obj.focusCue ?? "").trim(),
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;
    const requestedModel = body.modelType ?? "deep";
    const storiesRaw = await getStories();
    const stories = storiesRaw
      .map((item) => {
        const props = asRecord(asRecord(item).properties);
        return {
          title: readTitle(props),
          situation: readRichText(props, "Situation") || readRichText(props, "Context"),
          result: readRichText(props, "Result") || readRichText(props, "Outcome"),
          earnedSecret: readRichText(props, "Earned Secret") || readRichText(props, "Learning"),
        };
      })
      .filter((story) => story.title);
    if (stories.length === 0) {
      return Response.json({ error: "请先在故事库中添加至少 1 个故事" }, { status: 400 });
    }

    const system = composeReferenceBackedPrompt("hype", `你是一个面试前的冲刺教练。请仔细阅读附带的【候选人完整备战简报】（包含文化判断、顾虑反制、故事映射等），并只提炼最值得在进门前 3 分钟速记的内容。Return JSON only:
{
  "highlightReplay60s": string[],
  "threeByThree": {
    "mustLandPoints": string[],
    "likelyQuestions": string[]
  },
  "recoveryManual": string[],
  "focusCue": string
}

Hard constraints for highlightReplay60s:
- Force ultra-minimal mode for pre-interview 5-minute recall.
- Must be at most 3 bullet points.
- Each bullet must be 15 Chinese characters or fewer.
- Emphasize key numbers with markdown bold, e.g. "**10%**".
- Prefer action + impact snippets, avoid long explanations.

Extraction priority:
1. 60秒自我介绍高光
2. 3个必须传达的核心要点
3. 3个最可能被问到的致命问题
4. 遇到知识盲区时的失误恢复话术`.trim());

    const prompt = `
完整备战简报:
${body.prepFullContent ?? ""}

Candidate profile:
${buildUserContextForPrompt()}
Top stories:
${stories.map((s, idx) => `- S${String(idx + 1).padStart(3, "0")}: ${s.title}; situation=${s.situation}; result=${s.result}; secret=${s.earnedSecret}`).join("\n")}
`.trim();

    const fallbackOrder: ModelType[] =
      requestedModel === "pro" ? ["pro", "deep", "fast"] : requestedModel === "deep" ? ["deep", "fast"] : ["fast"];
    let text = "";
    for (const type of fallbackOrder) {
      try {
        text = (await generateText({ model: getModel(type), system, prompt })).text;
        break;
      } catch {
        // try next fallback
      }
    }
    if (!text) {
      throw new Error("All models failed");
    }
    return Response.json({ result: normalizeHypeResult(parseJson(text)) });
  } catch (error) {
    return Response.json(
      { error: "Failed to generate hype brief.", detail: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}

