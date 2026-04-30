import { generateText } from "ai";
import { getModel } from "@/lib/llm";
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

    const systemPrompt = `${buildEvaluateSystemPrompt({
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
}`;

    let text: string;
    try {
      const deepResult = await generateText({
        model: getModel("deep"),
        system: systemPrompt,
        prompt: `Interview transcript:\n${transcript}`,
      });
      text = deepResult.text;
    } catch {
      // Fallback to fast model when deep model/network is unavailable.
      const fastResult = await generateText({
        model: getModel("fast"),
        system: systemPrompt,
        prompt: `Interview transcript:\n${transcript}`,
      });
      text = fastResult.text;
    }

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
