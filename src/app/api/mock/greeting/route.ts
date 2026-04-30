import { generateText } from "ai";
import { getModel } from "@/lib/llm";

type RequestBody = {
  mockFormat?: string;
  resumeContext?: string;
  prepOrJdContext?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;
    const result = await generateText({
      model: getModel("fast"),
      system: `你现在是面试官。请根据候选人的简历和当前 JD，生成一句不超过 50 个字的简短开场白。
要求：
- 只输出一句对候选人说的话，不要 JSON，不要解释。
- 语气自然、专业、有代入感。
- 优先引用候选人简历中的一个亮点，或当前岗位/JD 的一个重点。
- 结尾自然引导候选人开始自我介绍。`,
      prompt: `面试形式：${body.mockFormat ?? "行为初筛"}

候选人简历上下文：
${body.resumeContext || "(none)"}

当前 JD / 备战上下文：
${body.prepOrJdContext || "(none)"}`,
    });

    return Response.json({ greeting: result.text.trim() });
  } catch (error) {
    return Response.json(
      {
        error: "Failed to generate mock greeting.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
