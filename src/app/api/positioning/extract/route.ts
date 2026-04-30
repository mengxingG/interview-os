import { generateText } from "ai";
import { getModel } from "@/lib/llm";

type ExtractRequest = {
  resumeText?: string;
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
    const body = (await req.json()) as ExtractRequest;
    const resumeText = String(body.resumeText ?? "").trim();
    if (!resumeText) {
      return Response.json({ error: "Missing resumeText." }, { status: 400 });
    }

    const system = `你是一位精通 AI 行业的技术型猎头。请阅读用户的简历底本，提取并输出一段 JSON 数据，包含以下两个字段：

1. coreSkills (核心技能)：请详细梳理候选人的硬核技能栈。必须使用换行符（\n）和「•」列表符号，严格按照以下 4 个维度进行归类提取，保留具体的【技术栈关键词】和【量化数据】：
• 垂直领域与复杂业务拆解：提取其在金融交易系统（Pre-Trade）、强监管/高合规场景下的业务理解力与跨团队推动机制（如分层问责协议、Trader决策模式）。
• AI 产品架构与策略：提取其混合架构设计（L0+L1 RAG）、向量检索、缓存策略（Semantic Cache）及评价体系（Golden Dataset）。
• 全栈原型交付能力（Vibe Coding）：提取其使用 Cursor/Claude Code 及前后端框架独立交付端到端产品的实战栈。
• 数据驱动与风控闭环：提取其在降低误报率、提升采纳率、构建数据飞轮等方面的机制设计。

👉 【排版格式强制要求】：在输出 coreSkills 时，必须使用换行符（\n）将不同维度的技能清晰地分段！请使用「•」作为列表符号（例如：• AI 产品架构：... \n\n • 全栈工程能力：...）。绝对不要把所有内容挤成一整段，同时尽量减少不必要的 Markdown 符号（如 **），以确保在前端的纯文本 <textarea> 中拥有极佳的阅读排版。

transformationStory (转型故事)：撰写一段约 200-300 字的转型故事。拒绝假大空，必须将候选人履历中的真实高光数据（如降本 $120K、延迟 1.5s 降至 200ms 等）以及技术落地经验有机融入。论证其从「金融交易系统」向「AI 产品经理」转型的合理性，强调其懂业务约束、能驾驭复杂架构、具备端到端 AI 产品交付能力的不可替代性。
👉 【极其重要的视角约束】：必须严格使用第一人称（「我」）进行叙述！绝对禁止使用「这位候选人」、「该候选人」或「他/她」。语气要自信、专业，完全模拟候选人自己在面试现场做自我介绍的口吻。

Return JSON only:
{
  "coreSkills": string,
  "transformationStory": string
}`.trim();

    const modelResult = await generateText({
      model: getModel("fast"),
      system,
      prompt: `简历底本全文：\n${resumeText}`,
    });

    const parsed = parseJson(modelResult.text) as {
      coreSkills?: string;
      transformationStory?: string;
    };

    return Response.json({
      result: {
        coreSkills: String(parsed.coreSkills ?? "").trim(),
        transformationStory: String(parsed.transformationStory ?? "").trim(),
      },
    });
  } catch (error) {
    return Response.json(
      {
        error: "Failed to extract positioning fields from resume base.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
