import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { z } from "zod";
import {
  addCoachingSession,
  addResumeVersion,
  archiveResumeVersion,
  addJDRecord,
  addStory,
  addInterviewRecord,
  getAllKnowledgeCards,
  getInterviewRecords,
  getJDRecords,
  getKnowledgeCardsToReview,
  getCoachingSessions,
  getProfileOptimizationRecordsFromResume,
  getPagePlainTextContent,
  getRecentPrepInterviewRecords,
  getResumeVersions,
  getLatestResumeBaseByType,
  getResumeBaseList,
  setActiveResumeBase,
  getStories,
  appendStoryDefenseRecord,
  updateResumeVersion,
  updateInterviewRecord,
  updateKnowledgeCardReview,
  updateCoachingSession,
  updateNotionPageProperties,
  archiveNotionPage,
  getJobs,
  addJob,
  updateJobStatus,
  deleteJob,
} from "@/lib/notion";
import { getModel } from "@/lib/llm";

function buildProfileMarkdownFromOptimizedFields(raw: string) {
  if (!raw.trim()) return "";
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const sections = [
      { key: "个人优势", aliases: ["个人优势", "advantage"] },
      { key: "工作经历", aliases: ["工作经历", "workExperience", "work"] },
      { key: "项目经历", aliases: ["项目经历", "projectExperience", "project"] },
    ];
    const lines: string[] = [];
    for (const section of sections) {
      const found = section.aliases
        .map((alias) => parsed[alias])
        .find((value) => typeof value === "string" && String(value).trim().length > 0);
      if (typeof found === "string" && found.trim()) {
        lines.push(`### ${section.key}`);
        lines.push(found.trim());
        lines.push("");
      }
    }
    const content = lines.join("\n").trim();
    return content || raw.trim();
  } catch {
    return raw.trim();
  }
}

type NotionProperties = Record<string, unknown>;

type ParsedJDForStorage = {
  company: string;
  role: string;
  match_score: number | null;
  decode_result: string;
};

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
  if (type === "rich_text") return readRichText(properties, key);
  if (type === "select") {
    const select = asRecord(prop.select);
    return typeof select.name === "string" ? select.name : "";
  }
  if (type === "multi_select") return readMultiSelect(properties, key).join(", ");
  if (type === "number") return typeof prop.number === "number" ? String(prop.number) : "";
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
      if (typeof value === "string") normalized[key] = value;
    }
    return normalized;
  } catch {
    return {} as Record<string, string>;
  }
}

function toBulletLines(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item ?? "").trim())
      .filter(Boolean)
      .map((item) => `- ${item}`);
  }
  const text = String(value ?? "").trim();
  return text ? [text] : [];
}

function buildPrepReportMarkdown(payload: unknown) {
  if (!payload) return "";
  const normalized =
    typeof payload === "string"
      ? (() => {
          try {
            return JSON.parse(payload) as Record<string, unknown>;
          } catch {
            return { rawText: payload } as Record<string, unknown>;
          }
        })()
      : asRecord(payload);

  const sections: Array<{ title: string; lines: string[] }> = [
    { title: "面试形式指引", lines: toBulletLines(normalized.interviewFormatGuide ?? normalized.formatGuide) },
    { title: "文化判断", lines: toBulletLines(normalized.cultureJudgement ?? normalized.cultureFit) },
    { title: "面试官情报", lines: toBulletLines(normalized.interviewerIntel) },
    { title: "最佳定位策略", lines: toBulletLines(normalized.bestPositioningStrategy ?? normalized.bestStrategy) },
    { title: "顾虑与反制策略", lines: toBulletLines(normalized.concernsAndCounters) },
    { title: "故事映射", lines: toBulletLines(normalized.storyMapping) },
    { title: "反向提问", lines: toBulletLines(normalized.reverseQuestions) },
    { title: "面试当天清单", lines: toBulletLines(normalized.dayOfChecklist) },
  ];
  const selfIntroScript = String(normalized.selfIntroScript ?? "").trim();
  const content = sections
    .filter((section) => section.lines.length > 0)
    .map((section) => `## ${section.title}\n${section.lines.join("\n")}`)
    .join("\n\n")
    .trim();

  if (content || selfIntroScript) {
    return [content, selfIntroScript ? `## 🎤 定制自我介绍逐字稿\n${selfIntroScript}` : ""].filter(Boolean).join("\n\n");
  }
  const rawText = String(normalized.rawText ?? "").trim();
  return rawText;
}

function parseJsonSafe<T>(raw: string): T | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function extractTranscriptQA(transcript: string) {
  const text = String(transcript ?? "").trim();
  if (!text) return { question: "", answer: "" };
  const qaLine = text.match(/题目（Q）:\s*([\s\S]*?)\n回答（A）:\s*([\s\S]*?)(?:\n|$)/);
  if (qaLine) {
    return { question: qaLine[1]?.trim() || "", answer: qaLine[2]?.trim() || "" };
  }
  const pairs = Array.from(text.matchAll(/\*\*考官\*\*：([\s\S]*?)\n\n\*\*我\*\*：([\s\S]*?)(?=\n\n\*\*考官\*\*：|$)/g));
  if (pairs.length > 0) {
    const last = pairs[pairs.length - 1];
    return { question: String(last[1] ?? "").trim(), answer: String(last[2] ?? "").trim() };
  }
  return { question: "", answer: "" };
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

function readCheckbox(properties: NotionProperties, key: string, fallback: boolean) {
  const prop = asRecord(properties[key]);
  return typeof prop.checkbox === "boolean" ? prop.checkbox : fallback;
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

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

async function extractStructuredJDForStorage(input: {
  jdText: string;
  decodeSummary: string;
}): Promise<ParsedJDForStorage> {
  const fallback: ParsedJDForStorage = {
    company: "",
    role: "",
    match_score: null,
    decode_result: input.decodeSummary.trim(),
  };
  try {
    const system = "你是 JD 结构化提取助手。严格按 schema 返回结构化字段。";
    const prompt = [
      "原始 JD 文本：",
      input.jdText,
      "",
      "已有解码分析：",
      input.decodeSummary,
    ].join("\n");
    const { object } = await generateObject({
      model: getModel("deep"),
      schema: z.object({
        company: z.string().default("").describe("提取的公司名称，如果没有则为空字符串"),
        role: z.string().default("").describe("提取的岗位名称，如果没有则为空字符串"),
        match_score: z.number().nullable().describe("匹配分数1-10，无法判断时可为 null"),
        decode_result: z.string().describe("完整的 JD 解码分析长文本"),
      }),
      system,
      prompt,
    });
    const parsed: ParsedJDForStorage = {
      company: String(object.company ?? "").trim(),
      role: String(object.role ?? "").trim(),
      match_score:
        typeof object.match_score === "number" && Number.isFinite(object.match_score)
          ? Math.max(1, Math.min(10, Math.round(object.match_score)))
          : null,
      decode_result: String(object.decode_result ?? "").trim(),
    };
    return {
      company: parsed.company,
      role: parsed.role,
      match_score: parsed.match_score,
      decode_result: parsed.decode_result || fallback.decode_result,
    };
  } catch {
    return fallback;
  }
}

function isWithinLast7Days(isoDate: string) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return diffMs >= 0 && diffMs <= 7 * 24 * 60 * 60 * 1000;
}

function toKnowledgeCard(item: unknown) {
  const properties = readProperties(item);
  return {
    id: readId(item),
    title: readTitle(properties),
    prompt:
      readRichText(properties, "Prompt") ||
      readRichText(properties, "Question") ||
      readRichText(properties, "Front"),
    answer:
      readRichText(properties, "Answer") ||
      readRichText(properties, "Back") ||
      readRichText(properties, "Notes"),
    interval: readNumber(properties, "Interval", 1),
    repetitions: readNumber(properties, "Repetitions", 0),
    easeFactor: readNumber(properties, "Ease Factor", 2.5),
    nextReview: readDate(properties, "Next Review", todayISO()),
  };
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

function toProgressSnapshot(data: {
  stories: unknown[];
  jd: unknown[];
  interviews: unknown[];
  knowledgeDue: unknown[];
  knowledgeAll: unknown[];
}) {
  const storyRows = data.stories.map((item) => toStory(item));
  const strongStories = storyRows.filter((story) => story.strength >= 4).length;
  const dueCount = data.knowledgeDue.length;
  const totalKnowledge = data.knowledgeAll.length;
  const reviewedThisWeek = data.knowledgeAll.filter((item) => {
    const record = asRecord(item);
    return isWithinLast7Days(String(record.last_edited_time ?? ""));
  }).length;
  const interviewsThisWeek = data.interviews.filter((item) => {
    const record = asRecord(item);
    return isWithinLast7Days(String(record.created_time ?? ""));
  }).length;

  const readiness = Math.max(
    30,
    Math.min(
      95,
      Math.round(
        strongStories * 6 +
          interviewsThisWeek * 8 +
          (totalKnowledge > 0 ? ((totalKnowledge - dueCount) / totalKnowledge) * 40 : 20),
      ),
    ),
  );

  const radar = {
    stories: Math.min(10, Math.round((strongStories / Math.max(1, storyRows.length)) * 10)),
    practice: Math.min(10, Math.max(2, interviewsThisWeek * 2 + 4)),
    knowledge: Math.min(
      10,
      Math.round(
        totalKnowledge > 0 ? ((totalKnowledge - dueCount) / Math.max(1, totalKnowledge)) * 10 : 5,
      ),
    ),
    targeting: Math.min(10, Math.max(3, Math.round(data.jd.length / 2) + 4)),
    consistency: Math.min(10, Math.max(3, Math.round((reviewedThisWeek + interviewsThisWeek) / 2) + 4)),
  };

  return {
    metrics: {
      storyCount: storyRows.length,
      strongStories,
      jdCount: data.jd.length,
      interviewCount: data.interviews.length,
      interviewsThisWeek,
      dueCount,
      totalKnowledge,
      reviewedThisWeek,
      readiness,
    },
    radar,
  };
}

function toJDRecord(item: unknown) {
  const properties = readProperties(item);
  const title = readFirstNonEmptyTitle(properties);
  const pick = (names: string[]) => names.find((name) => Object.prototype.hasOwnProperty.call(properties, name)) ?? "";
  const pickLongestRichText = (excludeKeys: string[] = []) => {
    const exclude = new Set(excludeKeys);
    let best = "";
    for (const [key, value] of Object.entries(properties)) {
      if (exclude.has(key)) continue;
      const prop = asRecord(value);
      if (prop.type !== "rich_text") continue;
      const text = readPropertyText(properties, key);
      if (text.length > best.length) best = text;
    }
    return best;
  };
  const jdTextKey =
    pick(["JD Text", "JD原文", "JD 原文", "JD", "Job Description", "Job Desc"]) ||
    findPropertyKeyByKeywords(properties, ["jd text", "job description", "jd原文", "jd 原文"], "rich_text") ||
    findPropertyKeyByKeywords(properties, ["jd text", "job description", "jd原文", "jd 原文"]);
  const decodeResultKey = pick(["Decode Result", "Decode Summary", "Summary", "解码结果", "解码总结"]);
  const jdTextFromColumn = jdTextKey ? readPropertyText(properties, jdTextKey) : "";
  const decodeSummaryFromColumn = decodeResultKey ? readPropertyText(properties, decodeResultKey) : "";
  const jdText = jdTextFromColumn || pickLongestRichText([decodeResultKey]);
  const coreKey = pick(["Core Responsibilities", "核心职责", "Responsibilities"]);
  const implicitKey = pick(["Implicit Expectations", "隐含期望", "Expectations"]);
  const fitSummaryKey = pick(["Fit Summary", "匹配总结", "Summary"]);
  const keyGapsKey = pick(["Key Gaps", "关键差距", "Gaps Detail"]);
  const fitScoreKey = pick(["Fit Score", "Match Score"]);
  const gapAnalysisKey = pick(["Gap Analysis", "Gaps"]);
  const decodeSummaryKey = pick(["Decode Summary", "Summary"]);
  const companyKey = pick(["Company", "公司"]);
  const roleKey = pick(["Role", "岗位", "职位"]);
  return {
    id: readId(item),
    title,
    company: companyKey ? readPropertyText(properties, companyKey) : "",
    role: roleKey ? readPropertyText(properties, roleKey) : "",
    jdText,
    coreResponsibilities: coreKey ? readPropertyText(properties, coreKey) : "",
    implicitExpectations: implicitKey ? readPropertyText(properties, implicitKey) : "",
    fitSummary: fitSummaryKey ? readPropertyText(properties, fitSummaryKey) : "",
    keyGaps: keyGapsKey ? readPropertyText(properties, keyGapsKey) : "",
    fitScore: fitScoreKey ? readNumber(properties, fitScoreKey, 0) : 0,
    matchScore: fitScoreKey ? readNumber(properties, fitScoreKey, 0) : 0,
    gapAnalysis: gapAnalysisKey ? readPropertyText(properties, gapAnalysisKey) : "",
    notes: readRichText(properties, "Notes") || readRichText(properties, "备注") || "",
    decodeSummary: decodeSummaryFromColumn || (decodeSummaryKey ? readPropertyText(properties, decodeSummaryKey) : ""),
  };
}

function toResumeVersion(item: unknown) {
  const properties = readProperties(item);
  const pick = (names: string[]) => names.find((name) => Object.prototype.hasOwnProperty.call(properties, name)) ?? "";
  const versionKey = pick(["版本号", "Version", "Version No", "Version Number"]);
  const companyKey = pick(["目标公司", "Target Company", "Company"]);
  const jdKey = pick(["JD", "目标JD", "Target JD"]);
  const beforeKey = pick(["优化前文本", "Before Text", "Original Resume", "Before"]);
  const afterKey = pick(["优化后文本", "After Text", "Optimized Resume", "After"]);
  const suggestionKey = pick(["AI建议", "AI Suggestions", "Suggestions"]);
  const dateKey = pick(["创建日期", "Created Date", "Date"]);
  const activeKey = pick([
    "当前活跃底本",
    "Is Active Base",
    "Active Base",
    "isActive",
    "IsActive",
    "IsActiveBase",
    "Is Active",
    "Active",
  ]);

  return {
    id: readId(item),
    title: readFirstNonEmptyTitle(properties),
    version: versionKey ? readPropertyText(properties, versionKey) : "",
    targetCompany: companyKey ? readPropertyText(properties, companyKey) : "",
    targetJD: jdKey ? readPropertyText(properties, jdKey) : "",
    beforeText: beforeKey ? readPropertyText(properties, beforeKey) : "",
    afterText: afterKey ? readPropertyText(properties, afterKey) : "",
    aiSuggestions: suggestionKey ? readPropertyText(properties, suggestionKey) : "",
    createdDate: dateKey ? readDate(properties, dateKey, "") : "",
    isActive: activeKey ? readCheckbox(properties, activeKey, false) : false,
  };
}

function toProfileOptimizationRecord(item: unknown) {
  const properties = readProperties(item);
  const pick = (names: string[]) => names.find((name) => Object.prototype.hasOwnProperty.call(properties, name)) ?? "";
  const platformKey = pick(["Platform", "平台"]);
  const depthKey = pick(["Depth", "深度"]);
  const inputKey = pick(["Input Summary", "输入摘要"]);
  const optimizedKey = pick(["Optimized Fields", "优化结果"]);
  const analysisKey = pick(["Analysis", "分析"]);
  const consistencyKey = pick(["Consistency Check", "一致性检查"]);
  const keywordsKey = pick(["Target Keywords", "关键词建议"]);
  const dateKey = pick(["Created Date", "创建日期", "Date"]);
  return {
    id: readId(item),
    title: readFirstNonEmptyTitle(properties),
    platform: platformKey ? readPropertyText(properties, platformKey) : "",
    depth: depthKey ? readPropertyText(properties, depthKey) : "",
    inputSummary: inputKey ? readPropertyText(properties, inputKey) : "",
    optimizedFields: optimizedKey ? readPropertyText(properties, optimizedKey) : "",
    analysis: analysisKey ? readPropertyText(properties, analysisKey) : "",
    consistencyCheck: consistencyKey ? readPropertyText(properties, consistencyKey) : "",
    targetKeywords: keywordsKey ? readPropertyText(properties, keywordsKey) : "",
    createdDate: dateKey ? readDate(properties, dateKey, "") : "",
  };
}

function parseProfileNotes(raw: string) {
  const text = raw || "";
  const pick = (label: string) => {
    const regex = new RegExp(`${label}：\\n([\\s\\S]*?)(?:\\n\\n[\\u4e00-\\u9fa5A-Za-z]+：\\n|$)`);
    const match = text.match(regex);
    return match?.[1]?.trim() ?? "";
  };
  return {
    analysis: pick("分析"),
    consistencyCheck: pick("一致性检查"),
    targetKeywords: pick("关键词建议"),
  };
}

function toCoachingSessionRecord(item: unknown) {
  const properties = readProperties(item);
  const pick = (names: string[]) => names.find((name) => Object.prototype.hasOwnProperty.call(properties, name)) ?? "";
  const moduleKey = pick(["Module"]);
  const entityIdKey = pick(["Entity ID"]);
  const entityTitleKey = pick(["Entity Title"]);
  const sessionTypeKey = pick(["Session Type"]);
  const messageJsonKey = pick(["Message Json", "Messages Json", "Message JSON"]);
  const replyKey = pick(["Last Assistant Reply"]);
  const appliedKey = pick(["Applied"]);
  const dateKey = pick(["Created Date", "Date"]);
  return {
    id: readId(item),
    title: readFirstNonEmptyTitle(properties),
    module: moduleKey ? readPropertyText(properties, moduleKey) : "",
    entityId: entityIdKey ? readPropertyText(properties, entityIdKey) : "",
    entityTitle: entityTitleKey ? readPropertyText(properties, entityTitleKey) : "",
    sessionType: sessionTypeKey ? readPropertyText(properties, sessionTypeKey) : "",
    messageJson: messageJsonKey ? readPropertyText(properties, messageJsonKey) : "",
    lastAssistantReply: replyKey ? readPropertyText(properties, replyKey) : "",
    applied: appliedKey ? String(readPropertyText(properties, appliedKey)).toLowerCase() === "true" : false,
    createdDate: dateKey ? readDate(properties, dateKey, "") : "",
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const resource = url.searchParams.get("resource");

  try {
    if (resource === "knowledge") {
      const results = await getKnowledgeCardsToReview();
      const cards = results.map((item) => toKnowledgeCard(item));
      return NextResponse.json({ cards });
    }

    if (resource === "stories") {
      const results = await getStories();
      const stories = results.map((item) => toStory(item)).filter((story) => !isBlankStory(story));
      return NextResponse.json({ stories });
    }

    if (resource === "progress") {
      const [stories, jd, interviews, knowledgeDue, knowledgeAll] = await Promise.all([
        getStories(),
        getJDRecords(),
        getInterviewRecords(),
        getKnowledgeCardsToReview(),
        getAllKnowledgeCards(),
      ]);
      const progress = toProgressSnapshot({
        stories,
        jd,
        interviews,
        knowledgeDue,
        knowledgeAll,
      });
      return NextResponse.json(progress);
    }

    if (resource === "jd") {
      const results = await getJDRecords();
      const records = results.map((item) => toJDRecord(item));
      return NextResponse.json({ records });
    }

    if (resource === "resume") {
      const results = await getResumeVersions();
      const records = results.map((item) => toResumeVersion(item));
      return NextResponse.json({ records });
    }
    if (resource === "hype-records") {
      const results = await getRecentPrepInterviewRecords(10);
      const records = results.map((item) => {
        const properties = readProperties(item);
        const title = readFirstNonEmptyTitle(properties);
        const companyKey = findPropertyKeyByKeywords(properties, ["company"]);
        const roleKey = findPropertyKeyByKeywords(properties, ["role", "岗位"]);
        const dateKey = findPropertyKeyByKeywords(properties, ["date", "日期"], "date");
        return {
          id: readId(item),
          title,
          company: companyKey ? readPropertyText(properties, companyKey) : "",
          role: roleKey ? readPropertyText(properties, roleKey) : "",
          date: dateKey ? readDate(properties, dateKey, "") : "",
        };
      });
      return NextResponse.json({ records });
    }
    if (resource === "hype-record-content") {
      const pageId = url.searchParams.get("pageId")?.trim();
      if (!pageId) {
        return NextResponse.json({ error: "Missing pageId." }, { status: 400 });
      }
      const content = await getPagePlainTextContent(pageId);
      return NextResponse.json({ content });
    }
    if (resource === "mock-reports") {
      const results = await getInterviewRecords();
      const rows = results
        .map((item) => {
          const properties = readProperties(item);
          const title = readFirstNonEmptyTitle(properties);
          const companyKey = findPropertyKeyByKeywords(properties, ["company"]);
          const roleKey = findPropertyKeyByKeywords(properties, ["role", "岗位"]);
          const typeKey = findPropertyKeyByKeywords(properties, ["type", "interview type"]);
          const dateKey = findPropertyKeyByKeywords(properties, ["date", "日期"], "date");
          const transcriptKey = findPropertyKeyByKeywords(properties, ["transcript", "记录", "回忆"]);
          const aiAnalysisKey = findPropertyKeyByKeywords(properties, ["ai analysis", "analysis"]);
          const intelligenceKey = findPropertyKeyByKeywords(properties, ["interview intelligence", "intelligence"]);
          const company = companyKey ? readPropertyText(properties, companyKey) : "";
          const type = typeKey ? readPropertyText(properties, typeKey) : "";
          const transcript = transcriptKey ? readPropertyText(properties, transcriptKey) : "";
          const aiAnalysis = aiAnalysisKey ? readPropertyText(properties, aiAnalysisKey) : "";
          const intelligenceRaw = intelligenceKey ? readPropertyText(properties, intelligenceKey) : "";
          const intelligence = parseJsonSafe<Record<string, unknown>>(intelligenceRaw) ?? {};
          const modeText =
            String(intelligence.mode ?? intelligence.sessionType ?? "").trim() ||
            (type.includes("模拟面试") ? "Mock" : company.includes("训练场景") ? "Practice" : "");
          const looksLikeMock =
            company.includes("模拟仿真") || company.includes("训练场景") || type.includes("模拟面试") || Boolean(modeText);
          if (!looksLikeMock) return null;
          const qa = extractTranscriptQA(transcript);
          const scoreObj = asRecord(intelligence.coachScores);
          const gaps =
            Array.isArray(intelligence.gaps) && intelligence.gaps.length > 0
              ? intelligence.gaps.map((x) => String(x ?? "")).filter(Boolean)
              : [];
          const nextRoundAdjustment = String(intelligence.nextRoundAdjustment ?? "").trim();
          return {
            id: readId(item),
            title,
            company,
            role: roleKey ? readPropertyText(properties, roleKey) : "",
            date: dateKey ? readDate(properties, dateKey, "") : "",
            type,
            mode: modeText,
            question: String(intelligence.question ?? qa.question ?? "").trim(),
            answer: String(intelligence.answer ?? qa.answer ?? "").trim(),
            transcript,
            aiAnalysis,
            result:
              Object.keys(scoreObj).length > 0 || gaps.length > 0 || nextRoundAdjustment
                ? {
                    coachScores: {
                      Substance: Number(scoreObj.Substance ?? 0),
                      Structure: Number(scoreObj.Structure ?? 0),
                      Relevance: Number(scoreObj.Relevance ?? 0),
                      Credibility: Number(scoreObj.Credibility ?? 0),
                      Differentiation: Number(scoreObj.Differentiation ?? 0),
                    },
                    gaps,
                    nextRoundAdjustment,
                  }
                : null,
            ts: asRecord(item).created_time ?? "",
          };
        })
        .filter((row): row is NonNullable<typeof row> => Boolean(row))
        .sort((a, b) => String(b.ts).localeCompare(String(a.ts)))
        .slice(0, 50);
      return NextResponse.json({ records: rows });
    }
    if (resource === "resume-base") {
      const latest = await getLatestResumeBaseByType();
      if (!latest) {
        return NextResponse.json(
          { error: "未找到 Type 为 Base 的简历底本，请检查 Notion 数据库设置" },
          { status: 404 },
        );
      }
      const record = toResumeVersion(latest);
      return NextResponse.json({ record });
    }
    if (resource === "resume-bases") {
      const results = await getResumeBaseList(20);
      const records = results.map((item) => toResumeVersion(item)).map((row) => ({
        id: row.id,
        title: row.title || `简历版本 ${row.version || ""}`.trim(),
        version: row.version || "",
        optimizedText: row.afterText || "",
        createdAt: row.createdDate || "",
        isActive: Boolean((row as { isActive?: unknown }).isActive),
      }));
      return NextResponse.json({ records });
    }
    if (resource === "profile-optimization") {
      const results = await getProfileOptimizationRecordsFromResume(50);
      const records = results.map((item) => {
        const resumeRow = toResumeVersion(item);
        const notes = parseProfileNotes(resumeRow.aiSuggestions || "");
        return {
          id: resumeRow.id,
          title: resumeRow.title,
          platform: resumeRow.targetCompany || "",
          depth: "",
          inputSummary: resumeRow.beforeText || resumeRow.targetJD || "",
          optimizedFields: resumeRow.afterText || "",
          analysis: notes.analysis,
          consistencyCheck: notes.consistencyCheck,
          targetKeywords: notes.targetKeywords,
          createdDate: resumeRow.createdDate || "",
        };
      });
      return NextResponse.json({ records });
    }
    if (resource === "profile-history") {
      const results = await getProfileOptimizationRecordsFromResume(10);
      const data = results.map((item) => {
        const row = toResumeVersion(item);
        return {
          id: row.id,
          title: row.title || "未命名记录",
          platform: row.targetCompany || "未知平台",
          content: row.afterText || "",
          createdAt: row.createdDate || "",
        };
      });
      return NextResponse.json({ success: true, data });
    }
    if (resource === "coaching-session") {
      const moduleName = url.searchParams.get("module") || undefined;
      const entityId = url.searchParams.get("entityId") || undefined;
      const limit = Number(url.searchParams.get("limit") || "20");
      const results = await getCoachingSessions({
        module: moduleName,
        entityId,
        limit: Number.isFinite(limit) ? limit : 20,
      });
      const records = results.map((item) => toCoachingSessionRecord(item));
      return NextResponse.json({ records });
    }

    if (resource === "jobs") {
      const status = url.searchParams.get("status") || undefined;
      const platform = url.searchParams.get("platform") || undefined;
      const sortBy = (url.searchParams.get("sortBy") as "matchScore" | "createdAt") || undefined;
      const sortOrder = (url.searchParams.get("sortOrder") as "ascending" | "descending") || undefined;
      const jobs = await getJobs({ status, platform, sortBy, sortOrder });
      return NextResponse.json({ jobs });
    }

    return NextResponse.json(
      { error: "Unsupported resource. Use resource=knowledge, resource=stories, resource=progress, resource=jd, resource=resume, resource=hype-records, resource=hype-record-content, resource=mock-reports, resource=resume-base, resource=resume-bases, resource=profile-optimization, resource=profile-history, resource=coaching-session, or resource=jobs." },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch data from Notion.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      action?: string;
      resource?: string;
      pageId?: string;
      interval?: number;
      repetitions?: number;
      easeFactor?: number;
      nextReview?: string;
      lastQuality?: number;
      title?: string;
      situation?: string;
      task?: string;
      actionText?: string;
      result?: string;
      earnedSecret?: string;
      tags?: string[];
      strength?: number;
      jdText?: string;
      decodeSummary?: string;
      fitScore?: number;
      gapAnalysis?: string;
      coreResponsibilities?: string;
      implicitExpectations?: string;
      fitSummary?: string;
      keyGaps?: string;
      version?: string;
      type?: string;
      company?: string;
      optimizedText?: string;
      targetCompany?: string;
      targetJD?: string;
      beforeText?: string;
      afterText?: string;
      aiSuggestions?: string;
      createdDate?: string;
      platform?: string;
      depthText?: string;
      inputSummary?: string;
      optimizedFieldsText?: string;
      analysisText?: string;
      consistencyCheckText?: string;
      targetKeywordsText?: string;
      module?: string;
      entityId?: string;
      entityTitle?: string;
      sessionType?: string;
      messageJson?: string;
      lastAssistantReply?: string;
      applied?: boolean;
      sessionPageId?: string;
      prepContext?: string;
      role?: string;
      jdId?: string;
      questionBank?: string;
      recruiterFeedback?: string;
      outcomeLog?: string;
      intelligenceJson?: string;
      analysisInPageBodyMarkdown?: string;
      persona?: "technical" | "execution" | "behavioral";
      qaPairs?: Array<{ question?: string; answer?: string }>;
      properties?: Record<string, unknown>;
      // Jobs fields
      matchScore?: number;
      status?: string;
      location?: string;
      url?: string;
      salaryRange?: string;
      notes?: string;
    };

    if (
      body.action === "update" &&
      body.properties &&
      typeof body.properties === "object" &&
      !Array.isArray(body.properties)
    ) {
      const pageId = String(body.pageId ?? "").trim();
      if (!pageId) {
        return NextResponse.json({ error: "Missing pageId for update." }, { status: 400 });
      }
      const properties = body.properties as Record<string, unknown>;
      if (Object.keys(properties).length === 0) {
        return NextResponse.json({ error: "Missing properties for update." }, { status: 400 });
      }
      await updateNotionPageProperties(pageId, properties);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "delete") {
      const pageId = String(body.pageId ?? "").trim();
      if (!pageId) {
        return NextResponse.json({ error: "Missing pageId for delete." }, { status: 400 });
      }
      await archiveNotionPage(pageId);
      return NextResponse.json({ ok: true });
    }

    if (body.resource === "stories" && body.action === "create") {
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
    }

    if (body.resource === "stories" && body.action === "append-defense") {
      const storyPageId = String(body.pageId ?? "").trim();
      const storyTitle = String(body.title ?? "").trim();
      const persona = body.persona;
      const qaPairs = Array.isArray(body.qaPairs) ? body.qaPairs : [];
      const normalizedPairs = qaPairs
        .map((pair) => ({
          question: String(pair.question ?? "").trim(),
          answer: String(pair.answer ?? "").trim(),
        }))
        .filter((pair) => pair.question && pair.answer);
      if (!storyPageId || !storyTitle || !persona || normalizedPairs.length === 0) {
        return NextResponse.json(
          { error: "Missing required fields for story defense append." },
          { status: 400 },
        );
      }
      await appendStoryDefenseRecord({
        storyPageId,
        storyTitle,
        persona,
        qaPairs: normalizedPairs,
      });
      return NextResponse.json({ ok: true });
    }

    if (body.resource === "interview" && body.action === "create") {
      const interviewBody = body as {
        title?: string;
        company?: string;
        role?: string;
        type?: string;
        date?: string;
        transcript?: string;
        aiAnalysis?: string;
        jdId?: string;
        prepReport?: unknown;
        questionBank?: string;
        recruiterFeedback?: string;
        outcomeLog?: string;
        intelligenceJson?: string;
      };
      const isPrepSave = interviewBody.prepReport !== undefined;
      const prepReportMarkdown = buildPrepReportMarkdown(interviewBody.prepReport);
      const hasUsableAnalysis = Boolean(
        (typeof interviewBody.aiAnalysis === "string" && interviewBody.aiAnalysis.trim()) || prepReportMarkdown,
      );
      if (
        !interviewBody.title ||
        !interviewBody.company ||
        !interviewBody.type ||
        !interviewBody.date ||
        (!isPrepSave && !interviewBody.transcript) ||
        !hasUsableAnalysis ||
        (isPrepSave && !String(interviewBody.jdId ?? "").trim())
      ) {
        return NextResponse.json(
          {
            error: isPrepSave
              ? "Missing required prep fields (company/type/date/prepReport/jdId)."
              : "Missing required interview fields.",
          },
          { status: 400 },
        );
      }

      await addInterviewRecord({
        title: interviewBody.title,
        company: interviewBody.company,
        role: interviewBody.role,
        type: interviewBody.type,
        date: interviewBody.date,
        transcript: interviewBody.transcript,
        aiAnalysis: interviewBody.aiAnalysis,
        jdRelationId: String(interviewBody.jdId ?? "").trim() || undefined,
        analysisInPageBodyMarkdown: prepReportMarkdown || undefined,
        questionBank: interviewBody.questionBank,
        recruiterFeedback: interviewBody.recruiterFeedback,
        outcomeLog: interviewBody.outcomeLog,
        intelligenceJson: interviewBody.intelligenceJson,
      });
      return NextResponse.json({ ok: true });
    }

    if (body.resource === "interview" && body.action === "update") {
      if (!body.pageId) {
        return NextResponse.json({ error: "Missing pageId for interview update." }, { status: 400 });
      }
      await updateInterviewRecord({
        pageId: body.pageId,
        title: body.title,
        questionBank: body.questionBank,
        recruiterFeedback: body.recruiterFeedback,
        outcomeLog: body.outcomeLog,
        intelligenceJson: body.intelligenceJson,
        analysisInPageBodyMarkdown: body.analysisInPageBodyMarkdown,
      });
      return NextResponse.json({ ok: true });
    }

    if (body.resource === "jd" && body.action === "create") {
      if (
        !body.jdText ||
        !body.decodeSummary ||
        typeof body.fitScore !== "number" ||
        !body.gapAnalysis
      ) {
        return NextResponse.json({ error: "Missing required JD record fields." }, { status: 400 });
      }

      const parsedData = await extractStructuredJDForStorage({
        jdText: body.jdText,
        decodeSummary: body.decodeSummary,
      });
      const pageTitle =
        parsedData.company || parsedData.role
          ? `${parsedData.company || ""} - ${parsedData.role || ""}`.replace(/^- |-$/g, "").trim()
          : `JD 解码 ${new Date().toLocaleDateString()}`;

      await addJDRecord({
        title: pageTitle,
        company: parsedData.company,
        role: parsedData.role,
        jdText: body.jdText,
        matchScore: parsedData.match_score,
        decodeResult: parsedData.decode_result,
        decodeSummary: body.decodeSummary,
        fitScore: body.fitScore,
        gapAnalysis: body.gapAnalysis,
        coreResponsibilities: body.coreResponsibilities,
        implicitExpectations: body.implicitExpectations,
        fitSummary: body.fitSummary,
        keyGaps: body.keyGaps,
      });
      return NextResponse.json({
        ok: true,
        parsedData: {
          title: pageTitle,
          company: parsedData.company,
          role: parsedData.role,
          match_score: parsedData.match_score,
        },
      });
    }

    if (body.resource === "resume" && body.action === "create") {
      const isBaseResume = body.type === "Base";
      const isProfileResume = body.type === "Profile";
      const normalizedAfterText = (body.afterText ?? body.optimizedText ?? "").trim();
      const normalizedBeforeText = (body.beforeText ?? body.targetJD ?? "").trim();
      const normalizedVersion =
        body.version ?? `${isProfileResume ? "PROFILE" : isBaseResume ? "BASE" : "RESUME"}-${new Date().toISOString().slice(0, 10)}-${Date.now().toString().slice(-4)}`;
      const normalizedCompany = body.targetCompany ?? body.company ?? "";

      if (!normalizedVersion || !normalizedAfterText) {
        return NextResponse.json({ error: "Missing required resume version fields." }, { status: 400 });
      }
      const safeCompany = isBaseResume ? "" : body.targetCompany ?? "";
      const safeJd = isBaseResume ? "" : body.targetJD ?? "";
      const safeSuggestions = isBaseResume ? "" : body.aiSuggestions ?? "";
      await addResumeVersion({
        version: normalizedVersion,
        title: body.title,
        type: isBaseResume ? "Base" : isProfileResume ? "Profile" : undefined,
        targetCompany: isBaseResume ? "" : normalizedCompany || safeCompany,
        targetJD: safeJd,
        beforeText: normalizedBeforeText,
        afterText: normalizedAfterText,
        aiSuggestions: safeSuggestions,
        createdDate: body.createdDate ?? new Date().toISOString().slice(0, 10),
      });
      return NextResponse.json({ ok: true });
    }

    if (body.resource === "resume" && body.action === "update") {
      const pageId = String(body.pageId ?? "").trim();
      const normalizedAfterText = (body.afterText ?? body.optimizedText ?? "").trim();
      const normalizedTitle = String(body.title ?? "").trim();
      const type = String(body.type ?? "").trim();
      const isBaseResume = type === "Base";

      if (!pageId) {
        return NextResponse.json({ error: "Missing pageId." }, { status: 400 });
      }
      if (!normalizedAfterText) {
        return NextResponse.json({ error: "Missing afterText." }, { status: 400 });
      }

      await updateResumeVersion({
        pageId,
        title: normalizedTitle || undefined,
        type: type || undefined,
        targetCompany: isBaseResume ? "" : (body.targetCompany ?? body.company ?? ""),
        targetJD: isBaseResume ? "" : (body.targetJD ?? ""),
        beforeText: String(body.beforeText ?? body.targetJD ?? ""),
        afterText: normalizedAfterText,
        aiSuggestions: isBaseResume ? "" : String(body.aiSuggestions ?? ""),
        createdDate: body.createdDate ?? undefined,
      });
      return NextResponse.json({ ok: true });
    }

    if (body.resource === "resume" && body.action === "archive") {
      const pageId = String(body.pageId ?? "").trim();
      if (!pageId) {
        return NextResponse.json({ error: "Missing pageId." }, { status: 400 });
      }
      await archiveResumeVersion(pageId);
      return NextResponse.json({ ok: true });
    }

    if (body.resource === "resume" && body.action === "set-active") {
      const pageId = String(body.pageId ?? "").trim();
      if (!pageId) {
        return NextResponse.json({ error: "Missing pageId." }, { status: 400 });
      }
      await setActiveResumeBase(pageId);
      return NextResponse.json({ ok: true });
    }

    if (body.resource === "profile-optimization" && body.action === "create") {
      if (!body.platform || !body.optimizedFieldsText) {
        return NextResponse.json({ error: "Missing required profile optimization fields." }, { status: 400 });
      }
      const createdDate = body.createdDate ?? new Date().toISOString().slice(0, 10);
      const profileMarkdown = buildProfileMarkdownFromOptimizedFields(body.optimizedFieldsText);
      const aiNotes = [
        body.analysisText?.trim() ? `分析：\n${body.analysisText.trim()}` : "",
        body.consistencyCheckText?.trim() ? `一致性检查：\n${body.consistencyCheckText.trim()}` : "",
        body.targetKeywordsText?.trim() ? `关键词建议：\n${body.targetKeywordsText.trim()}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
      await addResumeVersion({
        version: `PROFILE-${createdDate}-${Date.now().toString().slice(-4)}`,
        title: `[${body.platform}] 档案优化 - ${createdDate}`,
        type: "Profile",
        targetCompany: body.platform,
        targetJD: body.inputSummary ?? "",
        beforeText: body.inputSummary ?? "",
        afterText: profileMarkdown,
        aiSuggestions: aiNotes,
        createdDate,
      });
      return NextResponse.json({ ok: true });
    }

    if (body.resource === "coaching-session" && body.action === "create") {
      if (!body.module || !body.entityId || !body.messageJson) {
        return NextResponse.json({ error: "Missing required coaching session fields." }, { status: 400 });
      }
      const created = await addCoachingSession({
        title: body.title ?? `Coaching Session ${body.module}`,
        module: body.module,
        entityId: body.entityId,
        entityTitle: body.entityTitle ?? "",
        sessionType: body.sessionType ?? "General",
        messageJson: body.messageJson,
        lastAssistantReply: body.lastAssistantReply ?? "",
        applied: Boolean(body.applied),
        createdDate: body.createdDate ?? new Date().toISOString().slice(0, 10),
      });
      const createdRecord = created as { id?: string };
      return NextResponse.json({ ok: true, id: createdRecord.id ?? "" });
    }

    if (body.resource === "coaching-session" && body.action === "update") {
      if (!body.sessionPageId) {
        return NextResponse.json({ error: "Missing sessionPageId for coaching session update." }, { status: 400 });
      }
      await updateCoachingSession({
        pageId: body.sessionPageId,
        applied: body.applied,
        messageJson: body.messageJson,
        lastAssistantReply: body.lastAssistantReply,
      });
      return NextResponse.json({ ok: true });
    }

    if (body.resource === "knowledge" && body.action === "review") {
      if (
        !body.pageId ||
        typeof body.interval !== "number" ||
        typeof body.repetitions !== "number" ||
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
        mastery: body.lastQuality,
        lastQuality: body.lastQuality,
      });

      return NextResponse.json({ ok: true });
    }

    // ==========================================
    // 岗位监控 (Jobs) CRUD
    // ==========================================
    if (body.resource === "jobs" && body.action === "create") {
      if (!body.title) {
        return NextResponse.json({ error: "Missing required job title." }, { status: 400 });
      }
      const created = await addJob({
        title: body.title,
        company: body.company,
        role: body.role,
        matchScore: typeof body.matchScore === "number" ? body.matchScore : undefined,
        status: body.status || "新发现",
        location: body.location,
        url: body.url,
        jdText: body.jdText,
        platform: body.platform,
        salaryRange: body.salaryRange,
        notes: body.notes,
      });
      const createdRecord = created as { id?: string };
      return NextResponse.json({ ok: true, id: createdRecord.id ?? "" });
    }

    if (body.resource === "jobs" && body.action === "update-status") {
      if (!body.pageId || !body.status) {
        return NextResponse.json({ error: "Missing pageId or status." }, { status: 400 });
      }
      await updateJobStatus(body.pageId, body.status);
      return NextResponse.json({ ok: true });
    }

    if (body.resource === "jobs" && body.action === "delete") {
      if (!body.pageId) {
        return NextResponse.json({ error: "Missing pageId." }, { status: 400 });
      }
      await deleteJob(body.pageId);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { error: "Unsupported action/resource combination." },
      { status: 400 },
    );
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
