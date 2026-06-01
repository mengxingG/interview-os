import { generateText } from "ai";
import { getModel, getModelFallbackOrder, type ModelType } from "@/lib/llm";
import { buildUserContextForPrompt } from "@/lib/user-profile";
import { composeReferenceBackedPrompt } from "@/lib/prompts/references/compose";

type NetworkingRequest = {
  scene: string;
  language: "zh" | "en";
  targetRole?: string;
  targetCompany?: string;
  coreAdvantage?: string;
  contactName: string;
  contactRole: string;
  company: string;
  connectionPoint: string;
  extraContext?: string;
  baseMessage?: string;
  maxChars?: number;
  minChars?: number;
  rewriteMode?: "compress" | "expand";
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
    const body = (await req.json()) as NetworkingRequest;
    const requestedModel = body.modelType ?? "fast";
    const system = composeReferenceBackedPrompt(
      "networking",
      `
你是一位拥有 10 年经验的高级猎头和求职专家。你的任务是根据用户的简历优势和目标岗位 JD，撰写用于 BOSS直聘/猎聘/LinkedIn 等聊天场景的“破冰打招呼消息”。

【核心原则 - 必须严格遵守】
1. 首句黄金法则（最重要）：绝对禁止使用“你好，我对这个岗位感兴趣”或“我在某公司做过...”作为开头。第一句必须直接抛出高浓度的名词性结构（身份+核心战绩）。
👉 正面例子（必须严格模仿此句式）："你好！4年花旗金融AI产品实战经验，主导0-1合规助手落地，决策效率提升数倍。"
👉 反面例子（绝对禁止使用）："你好，我在花旗做过4年产品经理，做了一套系统..."
2. 拒绝简历压缩包：绝对不要在对话中堆砌复杂数字、括号或长难句。数据必须高度概括为“提升了数倍效率”或“实现了 0 到 1 的商业闭环”。
3. 极致简短：HR 在手机上只有 3 秒钟看消息，整体字数严格控制在 50-100 字（特殊场景如系统要求的压缩/扩展改写优先遵守调用参数约束）。
4. 强匹配感：话术必须体现出“我看过你的 JD，我正好能解决你的痛点”，建立强关联。
5. 明确 CTA：结尾必须引导对方索要简历或开启对话（如“不知是否有机会发您一份简历详聊？”）。

【三种风格约束】
- 专业正式（Professional）：适合外企/金融/高管。不卑不亢，用词精准，强调资历与项目盘子。
- 亲和随意（Friendly）：适合互联网/初创公司。语气自然，像与同行交流，拉近距离。
- 直接高效（Direct）：适合 BOSS 直聘或内推。开门见山，一句话证明实力，一句话说明来意。

输出要求（必须）：
1) 只返回 JSON，不要返回任何额外说明。
2) 严格返回以下结构：
{
  "versions": [
    { "style": "专业正式", "message": string },
    { "style": "亲和随意", "message": string },
    { "style": "直接高效", "message": string }
  ]
}
3) 三种风格都必须包含，且每条 message 都遵守“首句黄金法则”。
      `.trim(),
    );

    const sceneHint =
      body.scene.includes("BOSS直聘")
        ? "BOSS平台特性：直聊模式，HR 会根据打招呼语判断是否回复；前 30 字决定打开率，整体建议 <=150字。"
        : body.scene.includes("猎聘")
          ? "猎聘平台特性：更专业化，猎头更重视行业匹配、履历可信度与岗位契合。"
          : body.scene.includes("LinkedIn")
            ? "LinkedIn特性：偏国际化职业沟通，语气专业友好，价值表达要具体。"
            : "通用求职沟通场景：先建立信任，再明确诉求，最后给出轻量行动请求。";

    const prompt = `
Scene: ${body.scene}
Language: ${body.language}
Target Role: ${body.targetRole ?? ""}
Target Company: ${body.targetCompany ?? ""}
Core Advantage: ${body.coreAdvantage ?? ""}
Contact Name: ${body.contactName}
Contact Role: ${body.contactRole}
Company: ${body.company}
Connection Point: ${body.connectionPoint}
Extra Context: ${body.extraContext ?? ""}

Platform/Scene Hint:
${sceneHint}

Candidate baseline:
${buildUserContextForPrompt()}

Requirements:
- Keep each version concise and practical.
- If scene includes "BOSS直聘打招呼话术", prioritize strongest signal in first 30 chars.
- If scene includes "BOSS直聘自动回复模板", write as follow-up after HR replied.
- If scene includes "猎聘主动沟通话术", emphasize professional fit and industry keywords.
- If baseMessage exists, rewrite it with same intent in tighter format; max chars = ${body.maxChars ?? 9999}.
- If rewriteMode is "expand", enrich details while preserving truthfulness; target min chars = ${body.minChars ?? 0}, max chars = ${body.maxChars ?? 9999}.
- If rewriteMode is "compress", keep intent and strongest signals only.
- Match recommended length range for this scene when possible.

Base Message to Rewrite (optional):
${body.baseMessage ?? ""}
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
        error: "Failed to generate networking scripts.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
