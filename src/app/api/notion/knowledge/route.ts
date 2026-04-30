import { NextResponse } from "next/server";
import {
  addKnowledgeCard,
  addKnowledgeCardsBatch,
  getAllKnowledgeCards,
  getKnowledgeCardsToReview,
  updateKnowledgeCardReview,
} from "@/lib/notion";
import type { KnowledgeNotionRow, NotionRelationRef } from "@/types/notion";

type NotionProperties = Record<string, unknown>;

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function readTitle(properties: NotionProperties) {
  const titleProp = asRecord(properties.Title);
  const nameProp = asRecord(properties.Name);
  const fromTitle = (titleProp.title as Array<{ plain_text?: string }> | undefined)?.[0]?.plain_text;
  const fromName = (nameProp.title as Array<{ plain_text?: string }> | undefined)?.[0]?.plain_text;
  return fromTitle ?? fromName ?? "Untitled Card";
}

function readRichText(properties: NotionProperties, key: string) {
  const prop = asRecord(properties[key]);
  const rich = prop.rich_text;
  if (!Array.isArray(rich) || rich.length === 0) {
    return "";
  }
  return rich
    .map((part) =>
      part !== null && typeof part === "object" && "plain_text" in part
        ? String((part as { plain_text?: unknown }).plain_text ?? "")
        : "",
    )
    .join("")
    .trim();
}

function readNumber(properties: NotionProperties, key: string, fallback: number) {
  const prop = asRecord(properties[key]);
  return typeof prop.number === "number" ? prop.number : fallback;
}

function readDate(properties: NotionProperties, key: string, fallback: string) {
  const prop = asRecord(properties[key]);
  const date = asRecord(prop.date);
  return typeof date.start === "string" ? date.start : fallback;
}

function readSelect(properties: NotionProperties, key: string, fallback: string) {
  const prop = asRecord(properties[key]);
  const select = asRecord(prop.select);
  return typeof select.name === "string" ? select.name : fallback;
}

function readRelation(properties: NotionProperties, key: string) {
  const prop = asRecord(properties[key]);
  const relation = Array.isArray(prop.relation) ? prop.relation : [];
  return relation
    .map((entry) =>
      entry !== null && typeof entry === "object" && "id" in entry
        ? ({ id: String((entry as { id?: unknown }).id ?? "") } satisfies NotionRelationRef)
        : null,
    )
    .filter((entry): entry is NotionRelationRef => Boolean(entry?.id));
}

function readProperties(item: unknown) {
  const record = asRecord(item);
  return asRecord(record.properties);
}

function readId(item: unknown) {
  const record = asRecord(item);
  return typeof record.id === "string" ? record.id : "";
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function toKnowledgeCard(item: unknown) {
  const properties = readProperties(item);
  const prompt =
    readRichText(properties, "Prompt") ||
    readRichText(properties, "Question") ||
    readRichText(properties, "Front");
  const answer =
    readRichText(properties, "Content") ||
    readRichText(properties, "Answer") ||
    readRichText(properties, "Back") ||
    readRichText(properties, "Notes");
  const questionsKey = Object.keys(properties).find((k) => k.toLowerCase().includes("questions")) ?? "Questions";
  return {
    id: readId(item),
    title: readTitle(properties),
    prompt,
    answer,
    content: answer || prompt,
    domain: readSelect(properties, "Domain", "General"),
    interval: readNumber(properties, "Interval", 1),
    easeFactor: readNumber(properties, "Ease Factor", 2.5),
    mastery: readNumber(properties, "Mastery", 0),
    nextReview: readDate(properties, "Next Review", todayISO()),
    questions: readRelation(properties, questionsKey),
  } satisfies KnowledgeNotionRow;
}

export async function GET() {
  try {
    const dueResults = await getKnowledgeCardsToReview();
    if (dueResults.length > 0) {
      return NextResponse.json({ cards: dueResults.map((item) => toKnowledgeCard(item)) });
    }
    const allResults = await getAllKnowledgeCards();
    return NextResponse.json({ cards: allResults.map((item) => toKnowledgeCard(item)) });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch knowledge cards from Notion.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      action?: "create" | "create-batch" | "review";
      title?: string;
      domain?: string;
      content?: string;
      items?: Array<{
        title: string;
        domain?: string;
        content: string;
      }>;
      pageId?: string;
      interval?: number;
      easeFactor?: number;
      nextReview?: string;
      mastery?: number;
      lastQuality?: number;
    };

    if (body.action === "create") {
      if (!body.title || !body.content) {
        return NextResponse.json({ error: "Missing required card fields." }, { status: 400 });
      }
      await addKnowledgeCard({
        title: body.title,
        domain: body.domain ?? "General",
        content: body.content,
      });
      return NextResponse.json({ ok: true });
    }
    if (body.action === "create-batch") {
      const items = Array.isArray(body.items) ? body.items : [];
      if (items.length === 0) {
        return NextResponse.json({ error: "Missing items." }, { status: 400 });
      }
      await addKnowledgeCardsBatch(
        items
          .filter((item) => item.title?.trim() && item.content?.trim())
          .map((item) => ({
            title: item.title.trim(),
            domain: item.domain?.trim() || "General",
            content: item.content.trim(),
          })),
      );
      return NextResponse.json({ ok: true, count: items.length });
    }

    if (
      !body.pageId ||
      typeof body.interval !== "number" ||
      typeof body.easeFactor !== "number" ||
      !body.nextReview
    ) {
      return NextResponse.json({ error: "Missing required review fields." }, { status: 400 });
    }

    await updateKnowledgeCardReview({
      pageId: body.pageId,
      interval: body.interval,
      easeFactor: body.easeFactor,
      nextReview: body.nextReview,
      mastery: body.mastery,
      lastQuality: body.lastQuality,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to update knowledge card review.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
