import { NextResponse } from "next/server";
import { appendJDPrepPlan } from "@/lib/notion";

export const maxDuration = 60;

type PrepBody = {
  pageId?: string;
  prepMarkdown?: string;
  generatedAt?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as PrepBody;
    const pageId = typeof body.pageId === "string" ? body.pageId.trim() : "";
    const prepMarkdown = typeof body.prepMarkdown === "string" ? body.prepMarkdown.trim() : "";
    if (!pageId || !prepMarkdown) {
      return NextResponse.json({ success: false, error: "Missing pageId or prepMarkdown." }, { status: 400 });
    }
    const result = await appendJDPrepPlan({
      pageId,
      prepMarkdown,
      generatedAt: typeof body.generatedAt === "string" ? body.generatedAt : undefined,
    });
    return NextResponse.json({ success: true, savedTo: result.savedTo });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to append prep plan.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
