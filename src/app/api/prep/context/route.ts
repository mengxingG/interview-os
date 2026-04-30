import { getAllKnowledgeCards, getStories } from "@/lib/notion";
import { storySeeds } from "@/lib/user-profile";

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function readTitle(properties: Record<string, unknown>) {
  const keys = Object.keys(properties);
  const titleKey = keys.find((key) => asRecord(properties[key]).type === "title") ?? "Title";
  const prop = asRecord(properties[titleKey]);
  const title = Array.isArray(prop.title) ? prop.title : [];
  return title
    .map((item) =>
      item !== null && typeof item === "object" && "plain_text" in item
        ? String((item as { plain_text?: unknown }).plain_text ?? "")
        : "",
    )
    .join("")
    .trim();
}

function readRichText(properties: Record<string, unknown>, candidates: string[]) {
  for (const key of candidates) {
    const prop = asRecord(properties[key]);
    const rich = Array.isArray(prop.rich_text) ? prop.rich_text : [];
    const text = rich
      .map((item) =>
        item !== null && typeof item === "object" && "plain_text" in item
          ? String((item as { plain_text?: unknown }).plain_text ?? "")
          : "",
      )
      .join("")
      .trim();
    if (text) return text;
  }
  return "";
}

export async function POST() {
  try {
    const [storiesResult, knowledgeResult] = await Promise.allSettled([getStories(), getAllKnowledgeCards()]);
    const warnings: string[] = [];

    const stories =
      storiesResult.status === "fulfilled"
        ? storiesResult.value
            .map((row) => {
              const props = asRecord(asRecord(row).properties);
              const title = readTitle(props);
              const secret = readRichText(props, ["Earned Secret", "Learning"]);
              return title ? `${title}${secret ? `：${secret}` : ""}` : "";
            })
            .filter(Boolean)
            .slice(0, 8)
        : (() => {
            warnings.push("故事库读取失败，已回退到本地默认故事素材。");
            return storySeeds.map((item) => `${item.title}：${item.earnedSecret}`).slice(0, 8);
          })();

    const knowledgeTitles =
      knowledgeResult.status === "fulfilled"
        ? knowledgeResult.value
            .map((row) => {
              const props = asRecord(asRecord(row).properties);
              return readTitle(props);
            })
            .filter(Boolean)
            .slice(0, 10)
        : (() => {
            warnings.push("知识库读取失败，本次未注入知识点上下文。");
            return [];
          })();

    return Response.json({
      storyContext: stories,
      knowledgeContext: knowledgeTitles,
      warnings,
      counts: {
        stories: stories.length,
        knowledge: knowledgeTitles.length,
      },
    });
  } catch (error) {
    return Response.json(
      { error: "Failed to load prep context.", detail: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}

