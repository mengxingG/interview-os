import { NextResponse } from "next/server";
import { addStory, archiveStory, getStories, updateStory, updateStoryUsage } from "@/lib/notion";

type NotionProperties = Record<string, unknown>;

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function readTitle(properties: NotionProperties) {
  const readFromProperty = (prop: unknown) => {
    const titleBlocks = Array.isArray(asRecord(prop).title)
      ? (asRecord(prop).title as Array<{ plain_text?: string; text?: { content?: string } }>)
      : [];
    return titleBlocks
      .map((block) => block?.plain_text ?? block?.text?.content ?? "")
      .join("")
      .trim();
  };
  const fromTitle = readFromProperty(properties.Title);
  if (fromTitle) return fromTitle;
  const fromName = readFromProperty(properties.Name);
  if (fromName) return fromName;
  return "Untitled Card";
}

function findPropertyKeyByKeywords(
  properties: NotionProperties,
  keywords: string[],
  type?: string,
) {
  const entries = Object.entries(properties);
  const lowerKeywords = keywords.map((k) => k.toLowerCase());
  for (const [key, value] of entries) {
    const prop = asRecord(value);
    if (type && prop.type !== type) {
      continue;
    }
    const lowerKey = key.toLowerCase();
    if (lowerKeywords.some((keyword) => lowerKey.includes(keyword))) {
      return key;
    }
  }
  return undefined;
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

function readPropertyText(properties: NotionProperties, key: string) {
  const prop = asRecord(properties[key]);
  const type = typeof prop.type === "string" ? prop.type : "";

  if (type === "title") {
    const list = Array.isArray(prop.title) ? (prop.title as Array<{ plain_text?: string }>) : [];
    return list.map((item) => item?.plain_text ?? "").join("").trim();
  }
  if (type === "rich_text") {
    return readRichText(properties, key);
  }
  if (type === "select") {
    const select = asRecord(prop.select);
    return typeof select.name === "string" ? select.name : "";
  }
  if (type === "multi_select") {
    const list = readMultiSelect(properties, key);
    return list.join(", ");
  }
  if (type === "number") {
    return typeof prop.number === "number" ? String(prop.number) : "";
  }
  if (type === "formula") {
    const formula = asRecord(prop.formula);
    if (typeof formula.string === "string") return formula.string.trim();
    if (typeof formula.number === "number") return String(formula.number);
    if (typeof formula.boolean === "boolean") return formula.boolean ? "true" : "false";
    return "";
  }
  if (type === "status") {
    const status = asRecord(prop.status);
    return typeof status.name === "string" ? status.name : "";
  }
  if (type === "url") return typeof prop.url === "string" ? prop.url : "";
  if (type === "email") return typeof prop.email === "string" ? prop.email : "";
  if (type === "phone_number") return typeof prop.phone_number === "string" ? prop.phone_number : "";
  return "";
}

function parseAiCachedViews(raw: string) {
  if (!raw.trim()) return {} as Record<string, string>;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return {};
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string") {
        normalized[key] = value;
      }
    }
    return normalized;
  } catch {
    return {} as Record<string, string>;
  }
}

function readNumber(properties: NotionProperties, key: string, fallback: number) {
  const prop = asRecord(properties[key]);
  return typeof prop.number === "number" ? prop.number : fallback;
}

function readMultiSelect(properties: NotionProperties, key: string) {
  const prop = asRecord(properties[key]);
  const list = prop.multi_select;
  if (!Array.isArray(list)) {
    return [] as string[];
  }
  return list
    .map((entry) =>
      entry !== null && typeof entry === "object" && "name" in entry
        ? String((entry as { name?: unknown }).name ?? "")
        : "",
    )
    .filter(Boolean);
}

function readMultiSelectAny(properties: NotionProperties, keys: string[]) {
  for (const key of keys) {
    const values = readMultiSelect(properties, key);
    if (values.length > 0) {
      return values;
    }
  }
  return [] as string[];
}

function readFirstNonEmptyTitle(properties: NotionProperties) {
  for (const value of Object.values(properties)) {
    const prop = asRecord(value);
    if (prop.type !== "title" || !Array.isArray(prop.title)) {
      continue;
    }
    const text = (prop.title as Array<{ plain_text?: string }>)
      .map((item) => item?.plain_text ?? "")
      .join("")
      .trim();
    if (text) {
      return text;
    }
  }
  return "Untitled Card";
}

function readFirstNonEmptyMultiSelect(properties: NotionProperties) {
  for (const [key] of Object.entries(properties)) {
    const values = readMultiSelect(properties, key);
    if (values.length > 0) {
      return values;
    }
  }
  return [] as string[];
}

function readFirstNonEmptyRichText(properties: NotionProperties, excludeKeys: string[] = []) {
  const exclude = new Set(excludeKeys);
  for (const [key, value] of Object.entries(properties)) {
    if (exclude.has(key)) {
      continue;
    }
    const prop = asRecord(value);
    if (prop.type !== "rich_text") {
      continue;
    }
    const text = readRichText(properties, key);
    if (text) {
      return { key, text };
    }
  }
  return { key: "", text: "" };
}

function readProperties(item: unknown) {
  const record = asRecord(item);
  return asRecord(record.properties);
}

function readId(item: unknown) {
  const record = asRecord(item);
  return typeof record.id === "string" ? record.id : "";
}

function toStory(item: unknown) {
  const properties = readProperties(item);
  const textEntries = Object.keys(properties)
    .map((key) => ({ key, text: readPropertyText(properties, key) }))
    .filter((entry) => entry.text.trim().length > 0);

  const pickTextByKeywords = (keywords: string[]) => {
    const lowerKeywords = keywords.map((k) => k.toLowerCase());
    return (
      textEntries.find((entry) => {
        const lowerKey = entry.key.toLowerCase();
        return lowerKeywords.some((keyword) => lowerKey.includes(keyword));
      })?.text ?? ""
    );
  };

  const title =
    readTitle(properties) !== "Untitled Card"
      ? readTitle(properties)
      : readFirstNonEmptyTitle(properties) !== "Untitled Card"
        ? readFirstNonEmptyTitle(properties)
        : (pickTextByKeywords(["title", "name", "标题"]) || "Untitled Card");
  const tags =
    readMultiSelectAny(properties, ["Tags", "Tag"]).length > 0
      ? readMultiSelectAny(properties, ["Tags", "Tag"])
      : readFirstNonEmptyMultiSelect(properties);

  const situationKey = findPropertyKeyByKeywords(properties, ["situation", "context", "背景", "情境"], "rich_text");
  const taskKey = findPropertyKeyByKeywords(properties, ["task", "goal", "任务", "目标"], "rich_text");
  const actionKey = findPropertyKeyByKeywords(properties, ["action", "actions", "做法", "行动"], "rich_text");
  const resultKey = findPropertyKeyByKeywords(properties, ["result", "outcome", "成果", "结果"], "rich_text");
  const earnedKey = findPropertyKeyByKeywords(
    properties,
    ["earned", "secret", "learning", "takeaway", "复盘", "收获"],
    "rich_text",
  );

  const s = (situationKey ? readRichText(properties, situationKey) : "") || pickTextByKeywords(["situation", "context", "背景", "情境"]);
  const t = (taskKey ? readRichText(properties, taskKey) : "") || pickTextByKeywords(["task", "goal", "任务", "目标"]);
  const a = (actionKey ? readRichText(properties, actionKey) : "") || pickTextByKeywords(["action", "actions", "做法", "行动"]);
  const r = (resultKey ? readRichText(properties, resultKey) : "") || pickTextByKeywords(["result", "outcome", "成果", "结果"]);
  const e =
    (earnedKey ? readRichText(properties, earnedKey) : "") ||
    pickTextByKeywords(["earned", "secret", "learning", "takeaway", "复盘", "收获"]);
  const fallback1 = readFirstNonEmptyRichText(properties, [situationKey ?? "", taskKey ?? "", actionKey ?? "", resultKey ?? "", earnedKey ?? ""]);
  const fallback2 = readFirstNonEmptyRichText(properties, [situationKey ?? "", taskKey ?? "", actionKey ?? "", resultKey ?? "", earnedKey ?? "", fallback1.key]);
  const aiCachedViewsKey =
    findPropertyKeyByKeywords(properties, ["ai_cached_views", "ai cached views", "aicachedviews"], "rich_text") ??
    findPropertyKeyByKeywords(properties, ["ai_cached_views", "ai cached views", "aicachedviews"]);
  const aiCachedViews = parseAiCachedViews(aiCachedViewsKey ? readPropertyText(properties, aiCachedViewsKey) : "");

  return {
    id: readId(item),
    title,
    situation: s || fallback1.text,
    task: t || fallback2.text,
    action: a,
    result: r,
    earnedSecret: e,
    tags,
    strength: readNumber(properties, "Strength", readNumber(properties, "Rating", 3)),
    useCount: readNumber(properties, "Use Count", readNumber(properties, "UseCount", 0)),
    aiCachedViews,
  };
}

function isBlankStory(story: ReturnType<typeof toStory>) {
  const titleEmpty = !story.title.trim() || story.title === "Untitled Card";
  const starEmpty =
    !story.situation.trim() &&
    !story.task.trim() &&
    !story.action.trim() &&
    !story.result.trim() &&
    !story.earnedSecret.trim();
  const tagsEmpty = story.tags.length === 0;
  const untouchedMeta = story.useCount === 0 && story.strength === 3;
  return titleEmpty && starEmpty && tagsEmpty && untouchedMeta;
}

export async function GET() {
  try {
    const results = await getStories();
    const stories = results.map((item) => toStory(item)).filter((story) => !isBlankStory(story));
    return NextResponse.json({ stories });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch stories from Notion.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      title?: string;
      situation?: string;
      task?: string;
      actionText?: string;
      result?: string;
      earnedSecret?: string;
      tags?: string[];
      strength?: number;
    };

    if (
      !body.title ||
      !body.situation ||
      !body.task ||
      !body.actionText ||
      !body.result ||
      !body.earnedSecret
    ) {
      return NextResponse.json({ error: "Missing required story fields." }, { status: 400 });
    }

    const tags = Array.isArray(body.tags) ? body.tags.filter(Boolean) : [];
    await addStory({
      title: body.title,
      situation: body.situation,
      task: body.task,
      action: body.actionText,
      result: body.result,
      earnedSecret: body.earnedSecret,
      tags,
      strength:
        typeof body.strength === "number" && body.strength >= 1 && body.strength <= 5
          ? body.strength
          : 3,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to create story.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as {
      pageId?: string;
      title?: string;
      situation?: string;
      task?: string;
      actionText?: string;
      result?: string;
      earnedSecret?: string;
      tags?: string[];
      strength?: number;
      action?: string;
      useCount?: number;
      lastUsed?: string;
      viewKey?: string;
      viewContent?: string;
      aiCachedViews?: Record<string, string>;
    };

    if (body.action === "usage") {
      if (!body.pageId || typeof body.useCount !== "number" || !body.lastUsed) {
        return NextResponse.json({ error: "Missing usage fields." }, { status: 400 });
      }
      await updateStoryUsage({
        pageId: body.pageId,
        useCount: body.useCount,
        lastUsed: body.lastUsed,
      });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "cached-views") {
      if (!body.pageId) {
        return NextResponse.json({ error: "Missing pageId." }, { status: 400 });
      }
      const mergedViews = body.aiCachedViews && typeof body.aiCachedViews === "object"
        ? Object.fromEntries(
            Object.entries(body.aiCachedViews).filter(([, value]) => typeof value === "string"),
          )
        : body.viewKey && typeof body.viewContent === "string"
          ? { [body.viewKey]: body.viewContent }
          : null;
      if (!mergedViews) {
        return NextResponse.json({ error: "Missing cached view payload." }, { status: 400 });
      }
      await updateStory({
        pageId: body.pageId,
        aiCachedViews: mergedViews,
      });
      return NextResponse.json({ ok: true });
    }

    if (
      !body.pageId ||
      !body.title ||
      !body.situation ||
      !body.task ||
      !body.actionText ||
      !body.result ||
      !body.earnedSecret
    ) {
      return NextResponse.json({ error: "Missing required story fields." }, { status: 400 });
    }

    await updateStory({
      pageId: body.pageId,
      title: body.title,
      situation: body.situation,
      task: body.task,
      action: body.actionText,
      result: body.result,
      earnedSecret: body.earnedSecret,
      tags: Array.isArray(body.tags) ? body.tags.filter(Boolean) : [],
      strength:
        typeof body.strength === "number" && body.strength >= 1 && body.strength <= 5
          ? body.strength
          : 3,
      clearCachedViews: true,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to update story.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const pageId = url.searchParams.get("pageId");
    if (!pageId) {
      return NextResponse.json({ error: "Missing pageId." }, { status: 400 });
    }
    await archiveStory(pageId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to delete story.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
