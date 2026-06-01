import { generateText } from "ai";
import { appendQwenConciseInstruction, QWEN_MAX_OUTPUT_TOKENS } from "@/config/prompts";
import { getModel, getModelFallbackOrder, type ModelType } from "@/lib/llm";
import { generateTextWithQwenFallback } from "@/lib/qwen-fallback";
import { buildResumeSystemPrompt } from "@/lib/prompts/resume";

export const maxDuration = 60;

function parseJson(raw: string) {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON found");
  return JSON.parse(raw.slice(start, end + 1));
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      targetRole?: string;
      targetJD?: string;
      beforeText?: string;
      targetCompany?: string;
      modelType?: ModelType;
    };
    if (!body.targetJD?.trim() || !body.beforeText?.trim()) {
      return Response.json({ error: "targetJD and beforeText are required." }, { status: 400 });
    }

    const system = buildResumeSystemPrompt({
      targetRole: body.targetRole || "AI Product Manager",
      outputLanguage: "zh",
      jdFocus: [
        "ownership",
        "cross-functional leadership",
        "AI product execution",
        "business outcomes",
      ],
    });

    const prompt = `目标公司：${body.targetCompany || "未提供"}
目标 JD：
${body.targetJD}

当前简历（优化前）：
${body.beforeText}

请输出 JSON：
{
  "afterText": "优化后的完整文本（可直接粘贴）",
  "aiSuggestions": "关键优化建议（3-8条）"
}

要求：
- 不捏造事实
- 保留真实经历
- 优先提升与 JD 的匹配度、关键词命中、表达简洁度`.trim();

    const qwenPrompt = appendQwenConciseInstruction(prompt);
    const requestedModel = body.modelType ?? "resume";
    const fallbackOrder = getModelFallbackOrder(requestedModel);
    let text = "";
    let lastError: unknown = null;
    for (const modelType of fallbackOrder) {
      try {
        console.log(`🤖 尝试模型通道: ${modelType}`);
        const modelResult =
          modelType === "resume"
            ? await generateTextWithQwenFallback({
                system,
                prompt: qwenPrompt,
                maxOutputTokens: QWEN_MAX_OUTPUT_TOKENS,
              })
            : await generateText({
                model: getModel(modelType),
                system,
                prompt,
              });
        text = modelResult.text;
        console.log(`✅ 模型通道成功: ${modelType}`);
        break;
      } catch (error) {
        lastError = error;
        console.error(`⚠️ 模型通道失败: ${modelType}`, error);
      }
    }

    if (!text) {
      throw new Error(
        `All resume optimize model channels failed. Last error: ${
          lastError instanceof Error ? lastError.message : String(lastError ?? "unknown")
        }`,
      );
    }

    const parsed = parseJson(text) as {
      afterText?: string;
      aiSuggestions?: string;
    };

    const afterText = String(parsed.afterText ?? "").trim();
    if (!afterText) {
      return Response.json({ error: "LLM returned empty afterText." }, { status: 500 });
    }

    console.log("✅ 大模型响应成功！");
    return Response.json({
      afterText,
      aiSuggestions: String(parsed.aiSuggestions ?? "").trim(),
    });
  } catch (error) {
    console.error("❌ 简历优化 LLM 调用彻底失败, 详细原因:", error);
    return Response.json(
      {
        error: "大模型生成失败",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
