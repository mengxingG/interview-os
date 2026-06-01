import { generateText } from "ai";
import { getModel, getModelFallbackOrder, type ModelType } from "@/lib/llm";
import { buildDecodeSystemPrompt } from "@/lib/prompts/decode";
import { buildUserContextForPrompt } from "@/lib/user-profile";

type DecodeRequest = {
  jdText: string;
  modelType?: ModelType;
};

function extractLeadingJsonBlock(raw: string) {
  const match = raw.match(/```json\s*([\s\S]*?)\s*```/i);
  if (!match?.[1]) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function extractPrepMarkdown(raw: string) {
  return raw.replace(/```json[\s\S]*?```/i, "").trim();
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as DecodeRequest;
    const requestedModel = body.modelType ?? "pro";
    const jdText = typeof body.jdText === "string" ? body.jdText.trim() : "";
    if (!jdText) {
      return Response.json({ error: "Missing JD text." }, { status: 400 });
    }

    const system = buildDecodeSystemPrompt({
      targetRole: "AI Product Manager",
      candidateProfile: buildUserContextForPrompt(),
    });

    const fallbackOrder = getModelFallbackOrder(requestedModel);
    let text = "";
    for (const type of fallbackOrder) {
      try {
        const modelResult = await generateText({
          model: getModel(type),
          system,
          prompt: `Decode this JD text:\n\n${jdText}`,
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

    const result = extractLeadingJsonBlock(text);
    if (!result) {
      throw new Error("No leading JSON block found in decode response.");
    }
    const prepPlanMarkdown = extractPrepMarkdown(text);
    return Response.json({ result, rawText: text, prepPlanMarkdown });
  } catch (error) {
    return Response.json(
      {
        error: "Failed to decode JD.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
