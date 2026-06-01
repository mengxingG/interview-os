import { generateText } from "ai";
import { getModel, getModelFallbackOrder, type ModelType } from "@/lib/llm";
import { buildUserContextForPrompt } from "@/lib/user-profile";
import { composeReferenceBackedPrompt } from "@/lib/prompts/references/compose";

type PositioningRequest = {
  currentRole: string;
  targetRole: string;
  years: string;
  coreSkills: string;
  transitionStory: string;
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
    const body = (await req.json()) as PositioningRequest;
    const requestedModel = body.modelType ?? "pro";
    const system = composeReferenceBackedPrompt("positioning", `
你是一个顶级的求职定位专家。候选人正在进行跨领域/跨职能转型。你在分析「竞争优势」和「转型故事」时，绝对不能割裂其过往经历，必须深度挖掘其原有背景中的【可迁移能力（Transferable Skills）】，并论证这些能力为何是目标岗位（如 AI PM）极其稀缺的护城河。

You are a career strategy coach for tech candidates.
Return JSON only:
{
  "company_fit": string[],
  "advantages": string[],
  "interviewer_concerns": string[],
  "strategy": string[],
  "elevator_pitch_zh": string,
  "elevator_pitch_en": string
}
`.trim());

    const prompt = `
Current Role: ${body.currentRole}
Target Role: ${body.targetRole}
Years of Experience: ${body.years}
Core Skills: ${body.coreSkills}
Transition Story: ${body.transitionStory}

Candidate baseline:
${buildUserContextForPrompt()}
`.trim();

    const fallbackOrder: ModelType[] =
      getModelFallbackOrder(requestedModel);
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
        error: "Failed to generate positioning analysis.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
