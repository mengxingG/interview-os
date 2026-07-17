import { generateText } from "ai";
import { getFeatureFallbackOrder, getModel, getModelFallbackOrder, isFeatureModel, type ModelType } from "@/lib/llm";
import { buildMockAnswerSystemPrompt } from "@/lib/mock-answer-prompt";
import { resolveResumeContext } from "@/lib/resume-base-context";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      question?: string;
      category?: string;
      company?: string;
      role?: string;
      difficulty?: string;
      modelType?: ModelType;
      resumeContext?: string;
      resumeBaseId?: string;
      regenerate?: boolean;
    };

    const question = String(body.question ?? "").trim();
    if (!question) {
      return Response.json({ error: "question is required" }, { status: 400 });
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

    const system = buildMockAnswerSystemPrompt({ regenerate: Boolean(body.regenerate) });

    const prompt = `请用日常对话的方式回答：先一句直答，再口语展开（不要分点编号），最后自然落到自己的项目经验。

【面试问题】
${question}

分类：${body.category ?? ""}
目标公司：${body.company ?? ""}
目标岗位：${body.role ?? ""}
难度：${body.difficulty ?? ""}

【我的个人项目与简历经验】
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
      throw lastError instanceof Error ? lastError : new Error("生成模拟回答失败");
    }

    return Response.json({ answer: text });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "生成模拟回答失败" },
      { status: 500 },
    );
  }
}
