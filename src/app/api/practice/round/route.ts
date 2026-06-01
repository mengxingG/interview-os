import { generateText } from "ai";
import { withClaudeRoleLock } from "@/config/prompts";
import { getFeatureFallbackOrder, getModel } from "@/lib/llm";
import { buildUserContextForPrompt } from "@/lib/user-profile";
import { composeReferenceBackedPrompt } from "@/lib/prompts/references/compose";

type RequestBody = {
  stage: string;
  question: string;
  answer: string;
  selfScore: number;
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
    const system = withClaudeRoleLock(composeReferenceBackedPrompt("practice", `You are an interview coach for practice rounds. Return JSON only:
{
  "coachScores": {
    "Substance": number,
    "Structure": number,
    "Relevance": number,
    "Credibility": number,
    "Differentiation": number
  },
  "interviewerRead": string[],
  "gaps": string[],
  "nextRoundAdjustment": string,
  "recommendedSelfScore": number,
  "calibrationLabel": "over" | "under" | "accurate"
}`.trim()));
    const prompt = `
${buildUserContextForPrompt()}

Stage: ${body.stage}
Question: ${body.question}
Candidate answer:
${body.answer}
Candidate self-score(1-5): ${body.selfScore}
`.trim();
    let text = "";
    for (const modelType of getFeatureFallbackOrder("mock")) {
      try {
        text = (await generateText({ model: getModel(modelType), system, prompt })).text;
        break;
      } catch {
        // fallback
      }
    }
    if (!text) throw new Error("All practice model channels failed");
    return Response.json({ result: parseJson(text) });
  } catch (error) {
    return Response.json(
      { error: "Failed to evaluate practice round.", detail: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}

