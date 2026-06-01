import { generateText, streamText } from "ai";
import { ANTI_HALLUCINATION, GLOBAL_PERSONA, withClaudeRoleLock } from "@/config/prompts";
import { getFeatureFallbackOrder, getModel, isFeatureModel, type ModelType } from "@/lib/llm";

type ModelMessage = { role: "user" | "assistant" | "system"; content: string };
type MockStage = "product_sense" | "technical" | "execution" | "behavioral";

const STAGE_SEQUENCE: MockStage[] = ["product_sense", "technical", "execution", "behavioral"];

function getNextStage(stage: MockStage): MockStage | null {
  const idx = STAGE_SEQUENCE.indexOf(stage);
  if (idx < 0 || idx >= STAGE_SEQUENCE.length - 1) return null;
  return STAGE_SEQUENCE[idx + 1];
}

function estimateCurrentTurn(messages: ModelMessage[]) {
  const userTurns = messages.filter((item) => item.role === "user").length;
  return Math.max(0, userTurns);
}

function normalizeMessages(input: unknown): ModelMessage[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((raw) => {
      if (!raw || typeof raw !== "object") return null;
      const row = raw as Record<string, unknown>;
      const role = row.role;
      if (role !== "user" && role !== "assistant" && role !== "system") return null;
      let content = "";
      if (typeof row.content === "string") content = row.content;
      else if (Array.isArray(row.parts)) {
        content = row.parts
          .map((part) => {
            if (!part || typeof part !== "object") return "";
            const p = part as Record<string, unknown>;
            return p.type === "text" && typeof p.text === "string" ? p.text : "";
          })
          .join("\n");
      }
      if (!content.trim()) return null;
      return { role, content: content.trim() };
    })
    .filter((v): v is ModelMessage => Boolean(v));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string) {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errorMessage)), timeoutMs)),
  ]);
}

function buildPersonaInstruction(currentStage: MockStage) {
  if (currentStage === "technical") {
    return `你现在是字节跳动或 OpenAI 的 Staff Engineer（资深架构师）。你绝对不要问宏观概念，必须用「显微镜级别」的颗粒度深挖候选人简历中的技术落地细节。
【追问法则】：如果候选人提到模型微调 (SFT)，你必须追问其训练数据的具体格式、Input/Output 的结构长什么样、如何清洗脏数据；如果提到 RAG，必须追问切片策略 (Chunking)、召回评估指标 (Recall/MRR)、混合检索的权重为什么是这么分配的；如果提到缓存机制，追问语义相似度阈值和淘汰策略。你需要不断反问：「为什么不直接用规则引擎？」「这个方案的极端边界 Case (Corner Case) 会导致什么系统崩溃？」`;
  }
  if (currentStage === "execution") {
    return `你现在是严苛的 Data Science Lead。候选人给出任何结果，你都要质疑其因果性。追问其埋点设计的具体口径（是 PV 还是 UV？漏斗流失在哪一步？），如果核心指标没有显著提升，你要求候选人当场给出 3 个维度的排查思路。`;
  }
  if (currentStage === "behavioral") {
    return `你现在是跨部门主管。你需要寻找候选人回答中的「破绽」。重点考察其在资源极度紧缺、研发明确拒绝排期、或者跨部门目标完全冲突时的真实手腕。拒绝倾听伟光正的套话，逼问其「最难堪/最失败」的一次妥协过程。`;
  }
  return `你现在是资深产品面试官，重点考察产品判断与问题拆解。避免泛泛而谈，要求候选人给出具体取舍、优先级依据和反事实推演。`;
}

function buildMockSystemPrompt(format: string, currentStage: MockStage, fullLoop: boolean) {
  const nextStage = getNextStage(currentStage);
  return withClaudeRoleLock(`
${GLOBAL_PERSONA}
${ANTI_HALLUCINATION}

当前模拟面试形式：${format || "行为初筛（Behavioral Screen）"}。
当前考察阶段：${currentStage}。
${buildPersonaInstruction(currentStage)}

严格输出协议（必须遵守）：
1) 你每轮只能问一个问题，不得多问，不得总结，不得给建议。
2) 你必须输出严格 JSON，且只能包含以下字段：
{
  "spoken_text": "对候选人说的话（简短，一次只问一个问题）",
  "inner_thoughts": "面试官内心的打分和评价（不会被读出来）"
}
3) JSON 外禁止任何额外字符。
4) spoken_text 控制在 80 字以内，保持压迫感和紧凑节奏。
5) inner_thoughts 控制在 1-3 句，仅描述考察点与评分倾向。
6) 你的任务不是念问题清单，而是进行「链式追问 (Chain of Follow-ups)」。基于候选人的上一个回答，立刻挑出其中最薄弱、最缺乏数据支撑的一个环节，深挖剥洋葱。
7) 👉 【面试控场与议程指令（绝对规则）】：
你是一个极其专业且有时间观念的大厂面试官。本轮面试的总时长预期对应 10 到 15 个回合（你提问+候选人回答 = 1个回合）。你必须在内心维护一个进度条，并严格按照以下四个阶段推进面试：

Phase 1: 破冰与高管视角 (约 1-2 回合)
- 简短寒暄，要求候选人一句话总结核心项目背景，建立全局认知。

Phase 2: 致命弱点深挖 (约 4-5 回合)
- 抓住候选人回答中的某一个技术/业务难点，进行连续的链式追问（Chain of Follow-ups），显微镜级打破砂锅问到底，直到逼出能力边界。

Phase 3: 横向扩展与边界 Case (约 3-4 回合)
- 主动切换话题并引入极端变量，考察思维敏捷度与迁移能力。

Phase 4: 候选人反问与结束 (约 1-2 回合)
- 当回合数达到 10-12 左右，或证据已足够判定层级，必须主动停止技术考察，切入反问环节。

8) 🚨【触发结束暗号的唯一条件】：
只有在 Phase 4 结束后（候选人表示无问题，或你回答完候选人问题），你才允许结束本场。绝不能提前输出结束标记。

9) 你的最后一次回复必须是一句简短结束语，并在 spoken_text 结尾严格输出标记：
- 若当前是 Full Loop 且不是最后一轮，输出 [STAGE_COMPLETE]
- 若当前是 Quick Mock，或 Full Loop 最后一轮，输出 [INTERVIEW_OVER]

10) 若输出 [STAGE_COMPLETE]，请在标记后附加 JSON 元数据，便于前端转场：
[STAGE_COMPLETE] {"currentStage":"${currentStage}","nextStage":"${nextStage ?? ""}","notice":"☕️ 当前轮次已结束，准备进入下一轮。"}

11) ${fullLoop ? "当前是 Full Loop 连面，请严格控制每阶段回合并在阶段结束时再转场。" : "当前是 Quick Mock，只允许在最终结束时输出 [INTERVIEW_OVER]。"}
`.trim());
}

export async function POST(req: Request) {
  try {
    const {
      messages,
      modelType = "mock",
      mockFormat = "行为初筛（Behavioral Screen）",
      resumeContext = "",
      prepOrJdContext = "",
      currentStage = "product_sense",
      fullLoop = false,
      currentTurn,
      maxTurns = 12,
    }: {
      messages: unknown[];
      modelType?: ModelType;
      mockFormat?: string;
      resumeContext?: string;
      prepOrJdContext?: string;
      currentStage?: MockStage;
      fullLoop?: boolean;
      currentTurn?: number;
      maxTurns?: number;
    } = await req.json();
    const safeMessages = normalizeMessages(messages);
    const resolvedStage: MockStage = STAGE_SEQUENCE.includes(currentStage) ? currentStage : "product_sense";
    const turnNow = Number.isFinite(currentTurn) ? Number(currentTurn) : estimateCurrentTurn(safeMessages);
    const turnMax = Number.isFinite(maxTurns) ? Math.max(8, Number(maxTurns)) : 12;

    // preflight fallback happens before streaming to avoid duplicate/partial bubbles.
    let resolvedModel: ModelType = modelType;
    const preflightOrder = isFeatureModel(modelType)
      ? getFeatureFallbackOrder("mock")
      : modelType === "pro"
        ? (["pro", "fast"] as ModelType[])
        : [modelType];
    for (const candidate of preflightOrder) {
      try {
        await withTimeout(
          generateText({ model: getModel(candidate), prompt: "health check", maxOutputTokens: 4 }),
          8000,
          "Model preflight timeout",
        );
        resolvedModel = candidate;
        break;
      } catch {
        resolvedModel = preflightOrder[preflightOrder.length - 1] ?? "fast";
      }
    }

    const result = streamText({
      model: getModel(resolvedModel),
      system: `${buildMockSystemPrompt(mockFormat, resolvedStage, fullLoop)}

Candidate resume base context (for personalized follow-up):
${resumeContext || "(none)"}

Candidate prep/JD context (for role-specific deep questions):
${prepOrJdContext || "(none)"}

Round control hints:
- Estimated currentTurn=${turnNow}
- Max turns target=${turnMax}
`,
      messages: safeMessages as never,
    });
    return result.toUIMessageStreamResponse({
      headers: {
        "x-mock-model-selected": resolvedModel,
        "x-mock-model-fallback": resolvedModel !== modelType ? "1" : "0",
      },
    });
  } catch (error) {
    return Response.json(
      {
        error: "Mock chat generation failed.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

