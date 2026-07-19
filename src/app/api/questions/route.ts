import {
  addQuestion,
  addQuestionsBatch,
  archiveQuestion,
  getQuestions,
  updateQuestion,
  type QuestionRow,
} from "@/lib/notion";
import { normalizeQuestionBankCategory } from "@/lib/question-bank-categories";

type QuestionPayload = Omit<QuestionRow, "id" | "knowledge"> & { knowledge?: Array<{ id: string }> };

function normalizeQuestionPayload(item: QuestionPayload): QuestionPayload {
  return {
    ...item,
    category: normalizeQuestionBankCategory(item.category),
    knowledge: item.knowledge ?? [],
  };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const tags = (url.searchParams.get("tags") ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const rows = await getQuestions({
      category: url.searchParams.get("category") ?? undefined,
      source: url.searchParams.get("source") ?? undefined,
      company: url.searchParams.get("company") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      q: url.searchParams.get("q") ?? undefined,
      tags,
    });
    return Response.json({ rows });
  } catch (error) {
    return Response.json(
      { error: "Failed to query questions.", detail: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as
      | { item: QuestionPayload; items?: undefined }
      | { item?: undefined; items: QuestionPayload[] };
    if (Array.isArray(body.items)) {
      await addQuestionsBatch(body.items.map((item) => normalizeQuestionPayload(item)));
      return Response.json({ ok: true, count: body.items.length });
    }
    if (body.item) {
      await addQuestion(normalizeQuestionPayload(body.item));
      return Response.json({ ok: true, count: 1 });
    }
    return Response.json({ error: "Missing item(s)." }, { status: 400 });
  } catch (error) {
    return Response.json(
      { error: "Failed to add question(s).", detail: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as { pageId?: string; data?: Partial<QuestionPayload> };
    if (!body.pageId || !body.data) {
      return Response.json({ error: "Missing pageId or data." }, { status: 400 });
    }
    const data = { ...body.data };
    if (typeof data.category === "string") {
      data.category = normalizeQuestionBankCategory(data.category);
    }
    await updateQuestion(body.pageId, data);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: "Failed to update question.", detail: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const body = (await req.json()) as { pageId?: string };
    if (!body.pageId) return Response.json({ error: "Missing pageId." }, { status: 400 });
    await archiveQuestion(body.pageId);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: "Failed to archive question.", detail: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}
