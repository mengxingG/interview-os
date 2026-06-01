import { generateText } from "ai";
import { getModel, getModelFallbackOrder, type ModelType } from "@/lib/llm";
import { buildUserContextForPrompt } from "@/lib/user-profile";
import { composeReferenceBackedPrompt } from "@/lib/prompts/references/compose";

type Depth = "quick" | "standard" | "deep";
type Platform = "linkedin" | "boss" | "liepin" | "lagou" | "zhilian";
type RequestBody = {
  platform?: Platform;
  headline: string;
  about: string;
  experience: string;
  bossAdvantage?: string;
  bossExpectation?: string;
  bossWork?: string;
  bossProject?: string;
  liepinIntro?: string;
  liepinHighlights?: string[];
  liepinTargetRole?: string;
  lagouSummary?: string;
  lagouProject?: string;
  lagouTargetRole?: string;
  zhilianSummary?: string;
  zhilianExperience?: string;
  zhilianTargetRole?: string;
  depth: Depth;
  modelType?: ModelType;
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
    const platform: Platform = body.platform ?? "linkedin";
    const requestedModel = body.modelType ?? "pro";
    const system = composeReferenceBackedPrompt("linkedin", `You are a profile optimization assistant for job platforms. Return JSON only:
{
  "optimizedFields": {
    "<fieldName>": string
  },
  "analysis": string[],
  "commonAdvice": {
    "photoAdvice": string,
    "consistencyCheck": string[],
    "targetKeywords": string[]
  },
}`.trim());

    const platformPrompt =
      platform === "boss"
        ? `Platform: BOSS
Input:
- 个人优势: ${body.bossAdvantage ?? ""}
- 求职期望: ${body.bossExpectation ?? ""}
- 工作经历: ${body.bossWork ?? ""}
- 项目经历: ${body.bossProject ?? ""}
Optimize dimensions:
- 关键词密度（HR 搜索匹配）
- 个人优势吸引力（前 50 字）
- 求职期望合理性
Return optimized fields: 个人优势, 求职期望, 工作经历, 项目经历`
        : platform === "liepin"
          ? `Platform: Liepin
Input:
- 个人简介: ${body.liepinIntro ?? ""}
- 职业亮点: ${(body.liepinHighlights ?? []).join(" | ")}
- 期望岗位: ${body.liepinTargetRole ?? ""}
Optimize dimensions:
- 猎头视角吸引力
- 行业关键词覆盖
- 职业亮点差异化
Return optimized fields: 个人简介, 职业亮点1, 职业亮点2, 职业亮点3, 期望岗位`
          : platform === "lagou"
            ? `Platform: Lagou
Input:
- 个人简介: ${body.lagouSummary ?? ""}
- 项目经历: ${body.lagouProject ?? ""}
- 期望岗位: ${body.lagouTargetRole ?? ""}
Optimize dimensions:
- 互联网/技术岗位关键词
- 项目结果表达
- 岗位匹配信号
Return optimized fields: 个人简介, 项目经历, 期望岗位`
            : platform === "zhilian"
              ? `Platform: Zhilian
Input:
- 个人简介: ${body.zhilianSummary ?? ""}
- 工作经历: ${body.zhilianExperience ?? ""}
- 期望岗位: ${body.zhilianTargetRole ?? ""}
Optimize dimensions:
- 标准化表达
- 关键词匹配
- 稳定性与岗位适配
Return optimized fields: 个人简介, 工作经历, 期望岗位`
              : `Platform: LinkedIn
Input:
- Headline: ${body.headline}
- About: ${body.about}
- Experience: ${body.experience}
Optimize dimensions:
- discoverability
- credibility
- differentiation
Return optimized fields: Headline, About, Experience`;

    const prompt = `
Depth: ${body.depth}
Candidate profile:
${buildUserContextForPrompt()}

${platformPrompt}

Global requirements:
- Keep wording concise and directly copy-pastable.
- Do not fabricate metrics or job history.
- Add common advice for photo, cross-platform consistency, and role keywords.
- For quick depth: provide only top 3 analysis bullets.
- For deep depth: provide richer analysis and keyword list.
`.trim();

    const fallbackOrder: ModelType[] =
      getModelFallbackOrder(requestedModel);
    let text = "";
    for (const type of fallbackOrder) {
      try {
        text = (await generateText({ model: getModel(type), system, prompt })).text;
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
      { error: "Failed to optimize profile.", detail: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}

