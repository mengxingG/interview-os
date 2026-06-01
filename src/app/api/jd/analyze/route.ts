export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { z } from "zod";
import { getModel } from "@/lib/llm";

/**
 * POST /api/jd/analyze
 *
 * 分析岗位描述（JD），仅支持文本输入。
 * 使用 Gemini 3.5 Flash 进行结构化分析。
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      jdText?: string;
    };
    const jdText = String(body.jdText ?? "").trim();

    if (!jdText) {
      return NextResponse.json({ error: "Missing jdText" }, { status: 400 });
    }

    const system = `你是一个专业的 AI 产品经理岗位解析器。
请从岗位描述（JD）中提取关键信息，并对岗位进行全面分析。
严格按照 schema 返回结构化数据。`;

    const prompt = `请分析以下 JD 文本，提取关键字段并进行全面分析：

${jdText.slice(0, 8000)}

请严格按照以下 JSON 格式返回结果：
{
  "title": "岗位名称",
  "company": "公司名称",
  "role": "岗位角色分类",
  "matchScore": 0-100的匹配度评分,
  "platform": "招聘平台",
  "location": "工作地点",
  "salaryRange": "薪资范围",
  "jdSummary": "JD 核心摘要（1-3句话）",
  "requirements": ["要求1", "要求2", ...],
  "advantages": ["优点1", "优点2", ...],
  "disadvantages": ["缺点1", "缺点2", ...],
  "matchReasons": ["匹配理由1", ...],
  "mismatchReasons": ["不匹配项1", ...]
}`;

    // ===== 调用 LLM =====
    let object: z.infer<ReturnType<typeof getAnalysisSchema>>;
    try {
      console.log("[JD Analyze] 开始调用 LLM");

      const result = await generateObject({
        model: getModel("pro"),
        schema: z.object({
          title: z.string().default(""),
          company: z.string().default(""),
          role: z.string().default(""),
          matchScore: z.number().nullable().default(null),
          platform: z.string().default(""),
          location: z.string().default(""),
          salaryRange: z.string().default(""),
          jdSummary: z.string().default(""),
          requirements: z.array(z.string()).default([]),
          advantages: z.array(z.string()).default([]),
          disadvantages: z.array(z.string()).default([]),
          matchReasons: z.array(z.string()).default([]),
          mismatchReasons: z.array(z.string()).default([]),
        }),
        system,
        prompt,
      });
      object = result.object;

      console.log("[JD Analyze] LLM 调用成功, 解析结果:", JSON.stringify({
        title: object.title,
        company: object.company,
        matchScore: object.matchScore,
        requirementsCount: object.requirements?.length,
        advantagesCount: object.advantages?.length,
        disadvantagesCount: object.disadvantages?.length,
      }));
    } catch (llmError: unknown) {
      console.error("========== [JD Analyze] LLM 调用失败 ==========");
      console.error("错误对象:", llmError);
      if (llmError instanceof Error) {
        console.error("Error name:", llmError.name);
        console.error("Error message:", llmError.message);
        console.error("Error stack:", llmError.stack);
        const err = llmError as unknown as Record<string, unknown>;
        if (err.responseBody) console.error("Response body:", err.responseBody);
        if (err.statusCode) console.error("Status code:", err.statusCode);
        if (err.status) console.error("Status:", err.status);
        if (err.cause) console.error("Cause:", err.cause);
      }
      console.error("==============================================");

      return NextResponse.json(
        {
          error: "AI 分析失败",
          detail: llmError instanceof Error ? llmError.message : "未知 LLM 错误",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      title: object.title || "",
      company: object.company || "",
      role: object.role || "",
      matchScore: typeof object.matchScore === "number" ? object.matchScore : null,
      platform: object.platform || "",
      location: object.location || "",
      salaryRange: object.salaryRange || "",
      jdSummary: object.jdSummary || "",
      requirements: Array.isArray(object.requirements) ? object.requirements : [],
      advantages: Array.isArray(object.advantages) ? object.advantages : [],
      disadvantages: Array.isArray(object.disadvantages) ? object.disadvantages : [],
      matchReasons: Array.isArray(object.matchReasons) ? object.matchReasons : [],
      mismatchReasons: Array.isArray(object.mismatchReasons) ? object.mismatchReasons : [],
    });
  } catch (error) {
    console.error("========== [JD Analyze] 顶层异常 ==========");
    console.error("错误对象:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    console.error("============================================");

    return NextResponse.json(
      {
        error: "JD 分析失败",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

function getAnalysisSchema() {
  return z.object({
    title: z.string().default(""),
    company: z.string().default(""),
    role: z.string().default(""),
    matchScore: z.number().nullable().default(null),
    platform: z.string().default(""),
    location: z.string().default(""),
    salaryRange: z.string().default(""),
    jdSummary: z.string().default(""),
    requirements: z.array(z.string()).default([]),
    advantages: z.array(z.string()).default([]),
    disadvantages: z.array(z.string()).default([]),
    matchReasons: z.array(z.string()).default([]),
    mismatchReasons: z.array(z.string()).default([]),
  });
}
