import { generateText } from "ai";
import { getFeatureFallbackOrder, getModel, getModelFallbackOrder, isFeatureModel, type ModelType } from "@/lib/llm";
import { buildRefineAnswerSystemPrompt } from "@/lib/mock-answer-prompt";
import { resolveResumeContext } from "@/lib/resume-base-context";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      question?: string;
      currentAnswer?: string;
      instruction?: string;
      category?: string;
      company?: string;
      role?: string;
      modelType?: ModelType;
      resumeContext?: string;
      resumeBaseId?: string;
    };

    const question = String(body.question ?? "").trim();
    const currentAnswer = String(body.currentAnswer ?? "").trim();
    const instruction = String(body.instruction ?? "").trim();

    if (!question) {
      return Response.json({ error: "question is required" }, { status: 400 });
    }
    if (!currentAnswer) {
      return Response.json({ error: "请先有一份现有回答，再进行微调。" }, { status: 400 });
    }
    if (!instruction) {
      return Response.json({ error: "请填写微调建议。" }, { status: 400 });
    }

    const resumeContext = await resolveResumeContext(body.resumeContext, body.resumeBaseId);
    if (!resumeContext) {
      return Response.json(
        { error: "未找到可用的简历底本，请先在「简历底本管理」中创建并设置活跃底本。" },
        { status: 400 },
      );
    }

    const requested = body.modelType ?? "mock";
    const fallbackOrder: ModelType[] = isFeatureModel(requested)
      ? getFeatureFallbackOrder(
          requested === "practice" ? "practice" : requested === "resume" ? "resume" : "mock",
        )
      : getModelFallbackOrder(requested);

    const system = buildRefineAnswerSystemPrompt();

    const prompt = `请在保持日常对话式口语（直答 → 口语展开 → 落到项目，不要分点编号）的前提下，按建议微调现有回答。

【面试问题】
${question}

分类：${body.category ?? ""}
目标公司：${body.company ?? ""}
目标岗位：${body.role ?? ""}

【用户微调建议】
${instruction}

【现有回答】
${currentAnswer}

【我的个人项目与简历经验】（仅用于事实核对）
${resumeContext}`.trim();

    let text = "";
    let lastError: unknown = null;
    for (const type of fallbackOrder) {
      try {
        text = (
          await generateText({
            model: getModel(type),
            system,
            prompt,
          })
        ).text.trim();
        if (text) break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!text) {
      throw lastError instanceof Error ? lastError : new Error("微调回答失败");
    }

    return Response.json({ answer: text });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "微调回答失败" },
      { status: 500 },
    );
  }
}
