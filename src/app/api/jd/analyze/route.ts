import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { z } from "zod";
import { getModel } from "@/lib/llm";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { jdText?: string };
    const jdText = String(body.jdText ?? "").trim();
    if (!jdText) {
      return NextResponse.json({ error: "Missing jdText" }, { status: 400 });
    }

    const system = `你是一个 JD 分析助手。从岗位描述中提取关键信息，返回结构化数据。`;

    const prompt = `请分析以下 JD 文本，提取关键字段：

${jdText.slice(0, 8000)}

请返回：
- title: 岗位名称（简洁）
- company: 公司名称（如能推断）
- role: 岗位角色分类（如：前端开发、产品经理、数据分析等）
- matchScore: 匹配度评分（0-100，基于常见技能要求与通用候选人画像的匹配程度，无法判断时返回 null）
- platform: 招聘平台（如能推断：Boss直聘、LinkedIn、拉勾等）
- location: 工作地点
- salaryRange: 薪资范围`;

    const { object } = await generateObject({
      model: getModel("fast"),
      schema: z.object({
        title: z.string().default(""),
        company: z.string().default(""),
        role: z.string().default(""),
        matchScore: z.number().nullable().default(null),
        platform: z.string().default(""),
        location: z.string().default(""),
        salaryRange: z.string().default(""),
      }),
      system,
      prompt,
    });

    return NextResponse.json({
      title: object.title || "",
      company: object.company || "",
      role: object.role || "",
      matchScore: typeof object.matchScore === "number" ? object.matchScore : null,
      platform: object.platform || "",
      location: object.location || "",
      salaryRange: object.salaryRange || "",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "JD 分析失败",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
