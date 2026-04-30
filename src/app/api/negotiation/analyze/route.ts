import { generateText } from "ai";
import { getModel, type ModelType } from "@/lib/llm";
import { buildUserContextForPrompt } from "@/lib/user-profile";
import { composeReferenceBackedPrompt } from "@/lib/prompts/references/compose";

type NegotiationRequest = {
  role: string;
  currentSalary: string;
  offerSalary: string;
  competingOffers: string;
  location: string;
  modelType?: ModelType;
};

function parseJson(raw: string) {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("No JSON payload found.");
  }
  return JSON.parse(raw.slice(start, end + 1));
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as NegotiationRequest;
    const requestedModel = body.modelType ?? "fast";
    const system = composeReferenceBackedPrompt("negotiation", `
You are a compensation negotiation coach for tech jobs.
Return JSON only:
{
  "market_range": string,
  "strategy": string[],
  "scripts": {
    "email": string,
    "phone": string,
    "meeting": string
  },
  "non_salary_points": string[]
}
`.trim());

    const prompt = `
Target Role: ${body.role}
Current Salary: ${body.currentSalary}
Offer Salary: ${body.offerSalary}
Competing Offers: ${body.competingOffers}
Location: ${body.location}

Candidate baseline:
${buildUserContextForPrompt()}
`.trim();

    const fallbackOrder: ModelType[] =
      requestedModel === "pro" ? ["pro", "deep", "fast"] : requestedModel === "deep" ? ["deep", "fast"] : ["fast"];
    let text = "";
    for (const type of fallbackOrder) {
      try {
        const modelResult = await generateText({ model: getModel(type), system, prompt });
        text = modelResult.text;
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
      {
        error: "Failed to generate negotiation insights.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
