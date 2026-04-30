import { NextResponse } from "next/server";
import { syncStoryOptimizationStructured } from "@/lib/notion";

type ChatMessageView = { role: string; content: string };

function extractDefenseFaqPairsFromMessages(messages: ChatMessageView[]) {
  const assistantText = Array.isArray(messages)
    ? messages
        .filter((m) => m && typeof m.content === "string" && m.role === "assistant")
        .map((m) => m.content)
        .join("\n\n")
    : "";

  if (!assistantText.trim()) return [];

  // Expected format:
  // 🔴 追问：[问题文本] (标题) -> 🟢 防御：[回答要点] (内容)
  const pairs: Array<{
    questionText: string;
    questionTitle: string;
    answerText: string;
    answerContent: string;
  }> = [];

  const re = /🔴\s*追问：\s*([\s\S]*?)\s*\(([^)]+)\)\s*(?:->|→)\s*🟢\s*防御：\s*([\s\S]*?)\s*\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((match = re.exec(assistantText))) {
    const [, questionTextRaw, questionTitleRaw, answerTextRaw, answerContentRaw] = match;
    const questionText = String(questionTextRaw ?? "").trim();
    const questionTitle = String(questionTitleRaw ?? "").trim();
    const answerText = String(answerTextRaw ?? "").trim();
    const answerContent = String(answerContentRaw ?? "").trim();

    if (!questionText || !answerText) continue;
    pairs.push({ questionText, questionTitle, answerText, answerContent });
    if (pairs.length >= 30) break;
  }

  return pairs;
}

function extractSectionByMarkdownHeading(text: string, headingRegex: RegExp) {
  // headingRegex should match a single markdown heading line and optionally capture inline remainder in group(1).
  const safe = String(text ?? "");
  if (!safe.trim()) return "";
  const lines = safe.split(/\r?\n/);

  const idx = lines.findIndex((line) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    return headingRegex.test(trimmed);
  });
  if (idx < 0) return "";

  const headingLine = lines[idx].trim();
  const m = headingRegex.exec(headingLine);
  const firstInline = m && typeof m[1] === "string" ? m[1].trim() : "";

  const collected: string[] = [];
  if (firstInline) collected.push(firstInline);
  for (let i = idx + 1; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();
    if (/^###\s*/.test(trimmed)) break;
    collected.push(line);
  }
  return collected.join("\n").trim();
}

function extractStoryVersionsFromMessages(messages: ChatMessageView[]) {
  const assistantContents = Array.isArray(messages)
    ? messages
        .filter((m) => m && typeof m.content === "string" && m.role === "assistant")
        .map((m) => m.content)
    : [];

  const standardHeadingRe = /^###\s*✨\s*标准优化版\s*(.*)?$/i;
  const ninetyHeadingRe = /^###\s*⏱️?\s*90秒口述版本\s*(.*)?$/i;
  const customHeadingRe = /^###\s*🎯\s*岗位定制版\s*(.*)?$/i;

  let standardText = "";
  let ninetySecText = "";
  let customText = "";

  for (let i = assistantContents.length - 1; i >= 0; i -= 1) {
    const content = assistantContents[i];
    if (!standardText) {
      const extracted = extractSectionByMarkdownHeading(content, standardHeadingRe);
      if (extracted) standardText = extracted;
    }
    if (!ninetySecText) {
      const extracted = extractSectionByMarkdownHeading(content, ninetyHeadingRe);
      if (extracted) ninetySecText = extracted;
    }
    if (!customText) {
      const extracted = extractSectionByMarkdownHeading(content, customHeadingRe);
      if (extracted) customText = extracted;
    }
    if (standardText && ninetySecText && customText) break;
  }

  return { standardText, ninetySecText, customText };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      pageId?: string;
      messages?: ChatMessageView[];
      applied?: boolean;
      type?: string;
    };

    if (!body?.pageId || typeof body.pageId !== "string") {
      return NextResponse.json({ error: "Missing pageId." }, { status: 400 });
    }

    // Step 3: Handle explicit type: '90s_oral' - extract 90s content and wrap as callout block
    if (body.type === "90s_oral") {
      const { ninetySecText } = extractStoryVersionsFromMessages(body.messages ?? []);
      if (!ninetySecText) {
        return NextResponse.json(
          { error: "No 90s oral content found in messages." },
          { status: 400 },
        );
      }

      // Use syncStoryOptimizationStructured which wraps ninetySecText as a callout block
      await syncStoryOptimizationStructured({
        pageId: body.pageId,
        ninetySecText,
        defenseFaqPairs: [],
      });

      return NextResponse.json({
        ok: true,
        storedVersions: {
          ninetySec: true,
        },
      });
    }

    const defenseFaqPairs = extractDefenseFaqPairsFromMessages(body.messages ?? []);
    const { standardText, ninetySecText, customText } = extractStoryVersionsFromMessages(body.messages ?? []);

    await syncStoryOptimizationStructured({
      pageId: body.pageId,
      standardText: standardText || undefined,
      ninetySecText: ninetySecText || undefined,
      customText: customText || undefined,
      defenseFaqPairs,
    });

    return NextResponse.json({
      ok: true,
      storedDefenseCount: defenseFaqPairs.length,
      storedVersions: {
        standard: Boolean(standardText),
        ninetySec: Boolean(ninetySecText),
        custom: Boolean(customText),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to sync story optimization to Notion.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

