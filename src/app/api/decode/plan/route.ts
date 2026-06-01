import { generateText } from "ai";
import { getModel, getModelFallbackOrder, type ModelType } from "@/lib/llm";
import { buildUserContextForPrompt } from "@/lib/user-profile";
import { composeReferenceBackedPrompt } from "@/lib/prompts/references/compose";

type DecodeResult = {
  core_responsibilities: string[];
  must_have_skills: string[];
  plus_points: string[];
  culture_signals: string[];
  implicit_expectations: string[];
  fit_analysis: {
    fit_summary: string;
    fit_score_1_to_10: number;
    key_gaps: string[];
    prep_priorities: string[];
  };
};

type PlanRequest = {
  decodeResult: DecodeResult;
  modelType?: ModelType;
};

function parseJson(raw: string) {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < 0 || end <= start) {
    throw new Error("No JSON found in plan output.");
  }
  return JSON.parse(raw.slice(start, end + 1));
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as PlanRequest;
    const requestedModel = body.modelType ?? "pro";
    if (!body.decodeResult?.fit_analysis) {
      return Response.json({ error: "Missing decodeResult." }, { status: 400 });
    }

    const system = composeReferenceBackedPrompt("prep", `
You are an interview prep planner.
Given a JD decode result, create a practical 7-day preparation plan for AI PM interview.
Output JSON only in this schema:
{
  "goal": string,
  "daily_plan": [
    { "day": 1, "focus": string, "tasks": string[] },
    { "day": 2, "focus": string, "tasks": string[] },
    { "day": 3, "focus": string, "tasks": string[] },
    { "day": 4, "focus": string, "tasks": string[] },
    { "day": 5, "focus": string, "tasks": string[] },
    { "day": 6, "focus": string, "tasks": string[] },
    { "day": 7, "focus": string, "tasks": string[] }
  ],
  "checkpoints": string[]
}
Rules:
- Each day must include 2-4 concrete tasks.
- Prioritize key_gaps and prep_priorities from fit_analysis.
- Keep tasks specific and execution-oriented.
`.trim());

    const fallbackOrder: ModelType[] =
      getModelFallbackOrder(requestedModel);
    let text = "";
    for (const type of fallbackOrder) {
      try {
        const modelResult = await generateText({
          model: getModel(type),
          system,
          prompt: `Candidate baseline:\n${buildUserContextForPrompt()}\n\nDecode result JSON:\n${JSON.stringify(body.decodeResult, null, 2)}`,
        });
        text = modelResult.text;
        break;
      } catch {
        // try next fallback
      }
    }
    if (!text) {
      throw new Error("All models failed");
    }

    return Response.json({ plan: parseJson(text) });
  } catch (error) {
    return Response.json(
      {
        error: "Failed to generate prep plan.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
