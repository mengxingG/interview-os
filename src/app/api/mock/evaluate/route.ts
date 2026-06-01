import { generateText } from "ai";
import { withClaudeRoleLock } from "@/config/prompts";
import { getFeatureFallbackOrder, getModel } from "@/lib/llm";
import { buildEvaluateSystemPrompt } from "@/lib/prompts/evaluate";
import { buildUserContextForPrompt } from "@/lib/user-profile";

type EvaluateRequest = {
  transcript: string;
  targetRole?: string;
};

function extractJsonObject(raw: string) {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < 0 || end <= start) {
    throw new Error("No JSON object found in model output.");
  }
  return JSON.parse(raw.slice(start, end + 1));
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as EvaluateRequest;
    const transcript = typeof body.transcript === "string" ? body.transcript.trim() : "";
    if (!transcript) {
      return Response.json({ error: "Missing transcript." }, { status: 400 });
    }

    const systemPrompt = withClaudeRoleLock(`${buildEvaluateSystemPrompt({
      targetRole: body.targetRole ?? "AI Product Manager",
      rubricHint: "focus on measurable impact, ownership clarity, and decision quality",
    })}
Candidate baseline context:
${buildUserContextForPrompt()}

Return additional fields:
{
  "globalArcFeedback": string[],
  "signalReading": string[],
  "energyTrajectory": string,
  "hireSignal": "Strong Hire" | "Hire" | "Mixed" | "No Hire"
}`);

    let text = "";
    for (const modelType of getFeatureFallbackOrder("mock")) {
      try {
        const result = await generateText({
          model: getModel(modelType),
          system: systemPrompt,
          prompt: `Interview transcript:\n${transcript}`,
        });
        text = result.text;
        break;
      } catch {
        // fallback
      }
    }
    if (!text) throw new Error("All mock evaluation model channels failed");

    const parsed = extractJsonObject(text);
    return Response.json({ result: parsed });
  } catch (error) {
    return Response.json(
      {
        error: "Failed to generate mock interview evaluation.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
