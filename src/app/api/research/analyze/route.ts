import { generateText } from "ai";
import { getModel, type ModelType } from "@/lib/llm";
import { buildUserContextForPrompt } from "@/lib/user-profile";
import { composeReferenceBackedPrompt } from "@/lib/prompts/references/compose";

type RequestBody = {
  company: string;
  depth: "quick" | "standard" | "deep";
  modelType?: ModelType;
};

function parseJson(raw: string) {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON found");
  return JSON.parse(raw.slice(start, end + 1));
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;
    const requestedModel = body.modelType ?? "pro";
    const system = composeReferenceBackedPrompt("research", `You are a company research copilot. Follow research workflow. Return JSON only:
{
  "snapshot": string[],
  "cultureSignals": string[],
  "interviewStylePrediction": string[],
  "fitAssessment": string[],
  "verdict": "Strong Fit" | "Investable Stretch" | "Long-Shot Stretch" | "Weak Fit",
  "recommendedNextSteps": string[],
  "sources": string[]
}`.trim());
    const prompt = `
Company: ${body.company}
Depth: ${body.depth}
Candidate profile:
${buildUserContextForPrompt()}

Output requirements:
- Snapshot must include stage/size/funding/product line signals.
- Add source-tier awareness (verified vs general vs unknown).
- If confidence is limited, say so in fitAssessment.
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
    return Response.json({ result: parseJson(text) });
  } catch (error) {
    return Response.json(
      { error: "Failed to analyze company.", detail: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}

