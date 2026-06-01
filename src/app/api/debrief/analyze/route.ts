import { generateText } from "ai";
import { getModel, getModelFallbackOrder, type ModelType } from "@/lib/llm";
import { buildDebriefSystemPrompt } from "@/lib/prompts/debrief";
import { buildUserContextForPrompt } from "@/lib/user-profile";

type DebriefRequest = {
  company: string;
  round: string;
  interviewType: "Behavioral" | "Case Study" | "Technical" | "Panel";
  transcript: string;
  prepContext?: string;
  modelType?: ModelType;
};

function trimTo(text: string, max = 12000) {
  const value = String(text ?? "").trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max)}\n\n[...已截断，保留前 ${max} 字符用于本轮分析]`;
}

async function normalizeTranscript(rawTranscript: string, requestedModel: ModelType) {
  const system = `
你是一个面试复盘助手。请把用户粘贴的面试逐字稿整理成“可用于后续评分分析”的结构化文本。

要求：
1) 只输出纯文本，不输出 JSON、不输出代码块。
2) 识别并按顺序整理为：
   - 面试流程概览（3-6条）
   - 逐题 Q&A（Q1/A1, Q2/A2...；每题保留追问）
   - 关键信号（面试官兴趣点、质疑点、追问点）
   - 候选人失误点（跑题、无数据、不具体等）
3) 若原文混乱，也要做合理归并，不得凭空捏造。
4) 尽量保留原文中的技术名词和业务指标。
`.trim();

  for (const type of getModelFallbackOrder(requestedModel)) {
    try {
      const result = await generateText({
        model: getModel(type),
        system,
        prompt: `原始逐字稿：\n${trimTo(rawTranscript, 16000)}`,
      });
      const normalized = result.text.trim();
      if (normalized) {
        return normalized;
      }
    } catch {
      // try next fallback
    }
  }
  return rawTranscript.trim();
}

function parseJson(raw: string) {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < 0 || end <= start) {
    throw new Error("No JSON found in debrief response.");
  }
  return JSON.parse(raw.slice(start, end + 1));
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as DebriefRequest;
    const requestedModel = body.modelType ?? "practice";
    if (!body.company || !body.round || !body.interviewType || !body.transcript) {
      return Response.json({ error: "Missing required fields." }, { status: 400 });
    }

    const system = buildDebriefSystemPrompt({
      targetRole: "AI Product Manager",
      emphasis: ["clarity", "metrics", "question fit", "credibility", "differentiation"],
      strategyComparison: Boolean(body.prepContext?.trim()),
    });

    const normalizedTranscript = await normalizeTranscript(body.transcript, requestedModel);

    const prompt = `
Candidate baseline:
${buildUserContextForPrompt()}

Company: ${body.company}
Round: ${body.round}
Interview Type: ${body.interviewType}

备战简报（原定策略）:
${body.prepContext?.trim() || "(none)"}

Transcript:
${trimTo(normalizedTranscript, 14000)}

Raw Transcript (for detail cross-check):
${trimTo(body.transcript, 8000)}
`.trim();

    let text = "";
    for (const type of getModelFallbackOrder(requestedModel)) {
      try {
        const result = await generateText({
          model: getModel(type),
          system,
          prompt,
        });
        text = result.text;
        break;
      } catch {
        // try next fallback
      }
    }
    if (!text) {
      throw new Error("All models failed");
    }

    return Response.json({
      result: parseJson(text),
      normalizedTranscript,
    });
  } catch (error) {
    return Response.json(
      {
        error: "Failed to analyze interview debrief.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
