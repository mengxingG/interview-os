import { NextResponse } from "next/server";
import { addJDRecord, appendJDPrepPlan } from "@/lib/notion";

export const maxDuration = 60;

type JdSaveBody = {
  title?: string;
  jdText?: string;
  decodeSummary?: string;
  decodeResult?: string;
  company?: string;
  role?: string;
  title_summary?: string;
  match_score?: number;
  priority?: "高" | "中" | "低";
  salary_range?: string;
  key_requirements?: string[];
  fitScore?: number;
  gapAnalysis?: string;
  coreResponsibilities?: string;
  implicitExpectations?: string;
  fitSummary?: string;
  keyGaps?: string;
  prepMarkdown?: string;
};

type ParsedData = {
  company: string;
  role: string;
  location: string;
  title_summary: string;
  match_score: number | null;
  priority: "高" | "中" | "低";
  salary_range: string;
  key_requirements: string[];
  decode_result: string;
};

function extractStructuredJsonBlock(rawText: string): { parsedData: ParsedData; extracted: boolean } {
  const fallback: ParsedData = {
    company: "",
    role: "",
    location: "",
    title_summary: "",
    match_score: null,
    priority: "中",
    salary_range: "未提及",
    key_requirements: [],
    decode_result: "",
  };

  const match = rawText.match(/```json\s*([\s\S]*?)\s*```/i);
  if (!match?.[1]) {
    return { parsedData: fallback, extracted: false };
  }

  try {
    const obj = JSON.parse(match[1]) as Record<string, unknown>;
    const parsedScore =
      typeof obj.match_score === "number" && Number.isFinite(obj.match_score)
        ? Math.max(0, Math.min(100, Math.round(obj.match_score)))
        : null;
    const parsedPriority = obj.priority === "高" || obj.priority === "中" || obj.priority === "低" ? obj.priority : "中";
    const parsedRequirements = Array.isArray(obj.key_requirements)
      ? obj.key_requirements.map((item) => String(item)).filter(Boolean).slice(0, 5)
      : [];

    return {
      parsedData: {
        company: String(obj.company ?? "").trim(),
        role: String(obj.role ?? "").trim(),
        location: String(obj.location ?? "").trim(),
        title_summary: String(obj.title_summary ?? "").trim(),
        match_score: parsedScore,
        priority: parsedPriority,
        salary_range: String(obj.salary_range ?? "未提及").trim() || "未提及",
        key_requirements: parsedRequirements,
        decode_result: rawText.trim(),
      },
      extracted: true,
    };
  } catch (error) {
    console.error("JSON解析失败:", error);
    return { parsedData: fallback, extracted: false };
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as JdSaveBody;
    const jdText = typeof body.jdText === "string" ? body.jdText.trim() : "";
    const decodeSummary = typeof body.decodeSummary === "string" ? body.decodeSummary.trim() : "";
    const decodeResultInput = typeof body.decodeResult === "string" ? body.decodeResult.trim() : "";
    const fitScore = typeof body.fitScore === "number" ? body.fitScore : 0;
    const gapAnalysis = typeof body.gapAnalysis === "string" ? body.gapAnalysis : "";
    const prepMarkdown = typeof body.prepMarkdown === "string" ? body.prepMarkdown.trim() : "";

    if (!jdText || !decodeSummary || !gapAnalysis) {
      return NextResponse.json({ success: false, error: "Missing required JD fields." }, { status: 400 });
    }

    const { parsedData, extracted } = extractStructuredJsonBlock(decodeSummary || decodeResultInput);
    const frontendMatchScore =
      typeof body.match_score === "number" && Number.isFinite(body.match_score)
        ? Math.max(0, Math.min(100, Math.round(body.match_score)))
        : null;
    const frontendPriority = body.priority === "高" || body.priority === "中" || body.priority === "低" ? body.priority : null;
    const mergedParsedData: ParsedData = {
      company: typeof body.company === "string" && body.company.trim() ? body.company.trim() : parsedData.company,
      role: typeof body.role === "string" && body.role.trim() ? body.role.trim() : parsedData.role,
      location: parsedData.location,
      title_summary:
        typeof body.title_summary === "string" && body.title_summary.trim() ? body.title_summary.trim() : parsedData.title_summary,
      match_score: frontendMatchScore ?? parsedData.match_score,
      priority: frontendPriority ?? parsedData.priority,
      salary_range: typeof body.salary_range === "string" && body.salary_range.trim() ? body.salary_range.trim() : parsedData.salary_range,
      key_requirements: Array.isArray(body.key_requirements) && body.key_requirements.length > 0
        ? body.key_requirements.map((item) => String(item)).filter(Boolean).slice(0, 5)
        : parsedData.key_requirements,
      decode_result: decodeResultInput || parsedData.decode_result || decodeSummary,
    };

    const pageTitle =
      mergedParsedData.company || mergedParsedData.role
        ? `${mergedParsedData.company || ""} - ${mergedParsedData.role || ""}`.replace(/^- |-$/g, "").trim()
        : `JD 解码 ${new Date().toLocaleDateString()}`;

    const rawDecodeResult = mergedParsedData.decode_result || decodeSummary;

    const created = await addJDRecord({
      title: mergedParsedData.title_summary || pageTitle,
      company: mergedParsedData.company,
      role: mergedParsedData.role,
      jdText,
      matchScore:
        typeof mergedParsedData.match_score === "number" && Number.isFinite(mergedParsedData.match_score)
          ? mergedParsedData.match_score
          : fitScore ?? null,
      decodeResult: rawDecodeResult,
      priority: mergedParsedData.priority || "中",
      location: mergedParsedData.location,
      salaryRange: mergedParsedData.salary_range,
      keyRequirements: mergedParsedData.key_requirements,
      decodeSummary,
      fitScore,
      gapAnalysis,
      coreResponsibilities: body.coreResponsibilities,
      implicitExpectations: body.implicitExpectations,
      fitSummary: body.fitSummary,
      keyGaps: body.keyGaps,
    });

    console.log("✅ Notion 写入成功！准备返回前端。");
    let prepSaved = false;
    let prepWarning: string | undefined;
    if (prepMarkdown) {
      try {
        await appendJDPrepPlan({
          pageId: created.id,
          prepMarkdown,
          generatedAt: new Date().toLocaleString("zh-CN"),
        });
        prepSaved = true;
      } catch (error) {
        prepWarning = error instanceof Error ? error.message : "Prep sync failed";
      }
    }

    return NextResponse.json({
      success: true,
      pageId: created.id,
      prepSaved,
      prepWarning,
      extracted,
      warning: extracted ? undefined : "自动提取失败，请手动补充公司和岗位信息",
      parsedData: {
        ...mergedParsedData,
        title: mergedParsedData.title_summary || pageTitle,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to save JD record.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
