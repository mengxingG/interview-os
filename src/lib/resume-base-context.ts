import { getLatestResumeBaseByType, getResumeBaseList } from "@/lib/notion";

export function readResumeTextFromItem(item: unknown): string {
  const record = item !== null && typeof item === "object" ? (item as Record<string, unknown>) : {};
  const properties =
    record.properties !== null && typeof record.properties === "object"
      ? (record.properties as Record<string, unknown>)
      : {};
  const preferredKeys = ["优化后文本", "After Text", "Optimized Resume", "After", "Optimized", "正文", "Content"];
  for (const key of preferredKeys) {
    const prop = properties[key];
    if (!prop || typeof prop !== "object") continue;
    const typed = prop as {
      type?: string;
      rich_text?: Array<{ plain_text?: string }>;
      title?: Array<{ plain_text?: string }>;
    };
    if (typed.type === "rich_text" && Array.isArray(typed.rich_text)) {
      const text = typed.rich_text.map((entry) => entry.plain_text ?? "").join("").trim();
      if (text) return text;
    }
    if (typed.type === "title" && Array.isArray(typed.title)) {
      const text = typed.title.map((entry) => entry.plain_text ?? "").join("").trim();
      if (text) return text;
    }
  }
  for (const value of Object.values(properties)) {
    if (!value || typeof value !== "object") continue;
    const typed = value as { type?: string; rich_text?: Array<{ plain_text?: string }> };
    if (typed.type === "rich_text" && Array.isArray(typed.rich_text)) {
      const text = typed.rich_text.map((entry) => entry.plain_text ?? "").join("").trim();
      if (text.length > 80) return text;
    }
  }
  return "";
}

export async function resolveResumeContext(resumeContext?: string, resumeBaseId?: string) {
  const fromClient = (resumeContext ?? "").trim();
  if (fromClient) return fromClient;

  const list = await getResumeBaseList(20);
  if (resumeBaseId) {
    const matched = list.find((item) => {
      const id =
        item !== null && typeof item === "object" && "id" in item
          ? String((item as { id?: unknown }).id ?? "")
          : "";
      return id === resumeBaseId;
    });
    if (matched) {
      const text = readResumeTextFromItem(matched);
      if (text) return text;
    }
  }

  const active = list.find((item) => {
    const properties =
      item !== null && typeof item === "object" && "properties" in item
        ? ((item as { properties?: Record<string, unknown> }).properties ?? {})
        : {};
    for (const [key, value] of Object.entries(properties)) {
      if (!/active|活跃/i.test(key)) continue;
      if (value && typeof value === "object" && (value as { checkbox?: boolean }).checkbox === true) {
        return true;
      }
    }
    return false;
  });
  if (active) {
    const text = readResumeTextFromItem(active);
    if (text) return text;
  }

  const latest = await getLatestResumeBaseByType();
  return latest ? readResumeTextFromItem(latest) : "";
}
