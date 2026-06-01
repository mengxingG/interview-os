import { generateText } from "ai";
import { getModel, getModelFallbackOrder, type ModelType } from "@/lib/llm";
import { storySeeds, buildUserContextForPrompt } from "@/lib/user-profile";
import { composeReferenceBackedPrompt } from "@/lib/prompts/references/compose";

type RequestBody = {
  company: string;
  role: string;
  jdText: string;
  researchSummary?: string;
  interviewerInfo?: string;
  resumeContext?: string;
  elevatorPitch?: string;
  storyContext?: string[];
  knowledgeContext?: string[];
  modelType?: ModelType;
};

type PrepGenerateResult = {
  interviewFormatGuide: string[];
  cultureJudgement: string[];
  interviewerIntel: string[];
  bestPositioningStrategy: string[];
  concernsAndCounters: string[];
  predictedQuestions: string[];
  storyMapping: string[];
  reverseQuestions: string[];
  dayOfChecklist: string[];
  selfIntroScript?: string;
};

function parseJson(raw: string) {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON found");
  return JSON.parse(raw.slice(start, end + 1));
}

function normalizeSelfIntroScript(raw: string) {
  // Safety-first: never rewrite or parse-away model body text.
  // The previous regex-based normalizer could drop generated paragraphs.
  return String(raw ?? "").trim();
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;
    const requestedModel = body.modelType ?? "practice";
    const system = composeReferenceBackedPrompt("prep", `You are an interview prep strategist. Merge prep + concerns + questions workflows. Return JSON only:
{
  "interviewFormatGuide": string[],
  "cultureJudgement": string[],
  "interviewerIntel": string[],
  "bestPositioningStrategy": string[],
  "concernsAndCounters": string[],
  "predictedQuestions": string[],
  "storyMapping": string[],
  "reverseQuestions": string[],
  "dayOfChecklist": string[],
  "selfIntroScript": string
}`.trim());
    const prompt = `
Company: ${body.company}
Role: ${body.role}
JD:
${body.jdText}

Research Summary:
${body.researchSummary ?? ""}

Interviewer Info:
${body.interviewerInfo ?? ""}

Resume / Story Context:
${body.resumeContext ?? ""}

Candidate generic elevator pitch:
${body.elevatorPitch ?? ""}

Candidate Profile:
${buildUserContextForPrompt()}

Storybank:
${storySeeds.map((s) => `- ${s.id} ${s.title}: ${s.earnedSecret}`).join("\n")}

Retrieved Story Context:
${(body.storyContext ?? []).map((item) => `- ${item}`).join("\n")}

Retrieved Knowledge Context:
${(body.knowledgeContext ?? []).map((item) => `- ${item}`).join("\n")}

Custom intro-generation instruction:
你需要将候选人的【通用自我介绍】与【当前岗位的 JD 核心需求】进行深度融合。请生成三个版本的逐字稿，并在输出的 Markdown 中明确分段：
- 30秒快读版（主打核心高光与 JD 匹配度，适合破冰）
- 1分钟标准版（逻辑闭环，包含 1-2 个核心指标，适合标准流程）
- 3分钟深度版（含具体的项目操盘细节及转型故事，适合高管面）
语气要求：使用第一人称，语气自然口语化，自信强势、结果导向，带有强烈的「精准匹配」的业务压迫感，拒绝使用假大空的废话。
格式强制要求（必须严格遵守，不得省略，不得改标题）：
1) selfIntroScript 必须是 Markdown。
2) 必须使用以下三个三级标题（###）且顺序固定：
   - ### 30秒快读版 (核心高光)
   - ### 1分钟标准版 (逻辑闭环)
   - ### 3分钟深度版 (细节与故事)
3) 每个版本的第一行必须是视觉提示语：
   > **适用场景**：[一句话场景说明]
4) “标题”和“适用场景”之间必须有一个空行；“适用场景”和“正文”之间必须有一个空行。也就是每个部分至少使用双换行（\\n\\n）分隔。
5) 第一段和第二段之间、第二段和第三段之间必须使用分隔线 ---，且分隔线上下各保留一个空行。
6) 严格按下面模板填充正文（保持标题完全一致）：
### 30秒快读版 (核心高光)

> **适用场景**：面试官让你简单介绍自己，或时间有限时破冰。

{在这里直接输出你为该候选人定制的 30 秒第一人称自我介绍正文，不准留空！}

---

### 1分钟标准版 (逻辑闭环)

> **适用场景**：标准自我介绍流程，需要展现背景+核心成果+职位契合度。

{在这里直接输出定制的 1 分钟正文，不准留空！}

---

### 3分钟深度版 (细节与故事)

> **适用场景**：高管面或技术深挖轮，需要详细的项目操盘细节与转型故事。

{在这里直接输出定制的 3 分钟正文，不准留空！}
你必须生成【完整且真实的自我介绍正文】，绝对不能只输出结构模板或占位符；严禁输出“{}”“[]”“此处”“待补充”等占位文本。每个版本至少输出 4 句完整自然语言。
`.trim();
    const fallbackOrder = getModelFallbackOrder(requestedModel);
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
    const parsed = parseJson(text) as PrepGenerateResult;
    const normalizedResult: PrepGenerateResult = {
      ...parsed,
      selfIntroScript: normalizeSelfIntroScript(parsed.selfIntroScript ?? ""),
    };
    return Response.json({ result: normalizedResult });
  } catch (error) {
    return Response.json(
      { error: "Failed to generate prep brief.", detail: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}

