import { NextResponse } from "next/server";
import {
  getQuestions,
  getAllKnowledgeCards,
  getInterviewRecords,
  getJDRecords,
  getKnowledgeCardsToReview,
  getStories,
} from "@/lib/notion";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

function readNumber(properties: NotionProperties, key: string, fallback: number) {
  const prop = asRecord(properties[key]);
  return typeof prop.number === "number" ? prop.number : fallback;
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

function readSelect(properties: NotionProperties, key: string, fallback: string) {
  const prop = asRecord(properties[key]);
  const select = asRecord(prop.select);
  return typeof select.name === "string" ? select.name : fallback;
}

function readProperties(item: unknown) {
  const record = asRecord(item);
  return asRecord(record.properties);
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

function isToday(isoDate: string) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  const today = new Date();
  return date.toISOString().slice(0, 10) === today.toISOString().slice(0, 10);
}

function toStory(item: unknown) {
  const properties = readProperties(item);
  return {
    title: readTitle(properties),
    strength: readNumber(properties, "Strength", 3),
  };
}

function isBlankStory(story: ReturnType<typeof toStory>) {
  const title = story.title.trim();
  return !title || title === "Untitled Card";
}

function toKnowledge(item: unknown) {
  const properties = readProperties(item);
  return {
    domain: readSelect(properties, "Domain", "General"),
    mastery: readNumber(properties, "Mastery", 0),
  };
}

function parseInterviewScores(item: unknown) {
  const properties = readProperties(item);
  const analysisText = readRichText(properties, "AI Analysis");
  if (!analysisText) {
    return null;
  }
  try {
    const parsed = JSON.parse(analysisText) as Record<string, unknown>;
    const root = parsed.scoreAverages && typeof parsed.scoreAverages === "object"
      ? (parsed.scoreAverages as Record<string, unknown>)
      : parsed.scores && typeof parsed.scores === "object"
        ? (parsed.scores as Record<string, unknown>)
        : null;
    if (!root) {
      return null;
    }
    return {
      date: String(asRecord(item).created_time ?? new Date().toISOString()),
      Substance: Number(root.Substance ?? 0),
      Structure: Number(root.Structure ?? 0),
      Relevance: Number(root.Relevance ?? 0),
      Credibility: Number(root.Credibility ?? 0),
      Differentiation: Number(root.Differentiation ?? 0),
    };
  } catch {
    return null;
  }
}

function toJDStatus(item: unknown) {
  const properties = readProperties(item);
  const title = readTitle(properties).trim();
  const jdText = readRichText(properties, "JD Text") || readRichText(properties, "JD") || readRichText(properties, "Job Description");
  const decodeSummary = readRichText(properties, "Decode Summary") || readRichText(properties, "Summary");
  const status = readSelect(properties, "Status", "待投");
  return {
    title,
    status,
    hasJD: jdText.trim().length > 0,
    hasSummary: decodeSummary.trim().length > 0,
    isDecoded: decodeSummary.trim().length > 0 || status.toLowerCase() === "decoded",
  };
}

function isDebriefRecord(item: unknown) {
  const properties = readProperties(item);
  const title = readTitle(properties).toLowerCase();
  const type = readSelect(properties, "Type", "").toLowerCase();
  const analysis = readRichText(properties, "AI Analysis").toLowerCase();
  return (
    title.includes("debrief") ||
    title.includes("复盘") ||
    type.includes("debrief") ||
    type.includes("复盘") ||
    analysis.includes("improvements") ||
    analysis.includes("nextsteps")
  );
}

function toProgressSnapshot(data: {
  stories: unknown[];
  jd: unknown[];
  interviews: unknown[];
  knowledgeDue: unknown[];
  knowledgeAll: unknown[];
  questions: Array<{
    practiceCount: number;
    status: string;
    lastPracticed?: string;
  }>;
}) {
  const storyRows = data.stories.map((item) => toStory(item)).filter((story) => !isBlankStory(story));
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

  const interviewTrend = data.interviews
    .map((item) => parseInterviewScores(item))
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .slice(-10)
    .map((item, index) => ({
      session: index + 1,
      ...item,
    }));

  const knowledgeByDomain = data.knowledgeAll
    .map((item) => toKnowledge(item))
    .reduce<Record<string, { total: number; mastery: number }>>((acc, item) => {
      const bucket = acc[item.domain] ?? { total: 0, mastery: 0 };
      bucket.total += 1;
      bucket.mastery += item.mastery;
      acc[item.domain] = bucket;
      return acc;
    }, {});

  const masteryDistribution = Object.entries(knowledgeByDomain).map(([domain, value]) => ({
    domain,
    avgMastery: Number((value.mastery / Math.max(1, value.total)).toFixed(2)),
    count: value.total,
  }));

  const jdRows = data.jd
    .map((item) => toJDStatus(item))
    .filter((item) => item.title.length > 0 || item.hasJD || item.hasSummary);
  const jdDecodedCount = jdRows.filter((item) => item.isDecoded).length;
  const jdStatusBoard = jdRows
    .reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = (acc[item.status] ?? 0) + 1;
      return acc;
    }, {});
  const totalQuestions = data.questions.length;
  const practicedQuestions = data.questions.filter((q) => q.practiceCount > 0 || q.status !== "未练习").length;
  const practicedQuestionsToday = data.questions.filter((q) => q.lastPracticed && q.lastPracticed === new Date().toISOString().slice(0, 10)).length;
  const reviewedKnowledge = data.knowledgeAll
    .map((item) => toKnowledge(item))
    .filter((item) => item.mastery > 0).length;
  const reviewedKnowledgeToday = data.knowledgeAll.filter((item) => {
    const record = asRecord(item);
    return isToday(String(record.last_edited_time ?? ""));
  }).length;
  const prepCount = data.interviews.filter((item) => {
    const props = readProperties(item);
    const title = readTitle(props).toLowerCase();
    const analysis = readRichText(props, "AI Analysis").toLowerCase();
    return title.includes("prep") || analysis.includes("predictedquestions");
  }).length;
  const mocksToday = data.interviews.filter((item) => {
    const record = asRecord(item);
    return isToday(String(record.created_time ?? ""));
  }).length;
  const debriefCount = data.interviews.filter((item) => isDebriefRecord(item)).length;

  return {
    metrics: {
      storyCount: storyRows.length,
      strongStories,
      jdCount: jdRows.length,
      interviewCount: data.interviews.length,
      interviewsThisWeek,
      dueCount,
      totalKnowledge,
      reviewedThisWeek,
      readiness,
    },
    radar,
    interviewTrend,
    masteryDistribution,
    jdStatusBoard,
    dashboard: {
      stories: storyRows.length,
      strongStories,
      questions: totalQuestions,
      practicedQuestions,
      practicedQuestionsToday,
      jd: jdRows.length,
      jdDecoded: jdDecodedCount,
      prepCount,
      mocks: data.interviews.length,
      mocksToday,
      debriefCount,
      interviewRecords: data.interviews.length,
      reviewedKnowledge,
      reviewedKnowledgeToday,
      totalKnowledge,
      knowledgeMastery:
        masteryDistribution.length > 0
          ? Number(
              (
                masteryDistribution.reduce((sum, row) => sum + row.avgMastery, 0) /
                masteryDistribution.length
              ).toFixed(2),
            )
          : 0,
    },
  };
}

export async function GET() {
  const sourceMeta = [
    { key: "stories", label: "StoryBank", envKey: "NOTION_STORIES_DB" },
    { key: "jd", label: "JD Records", envKey: "NOTION_JD_DB" },
    { key: "interviews", label: "Interview Records", envKey: "NOTION_INTERVIEW_DB" },
    { key: "knowledgeDue", label: "Knowledge (due)", envKey: "NOTION_KNOWLEDGE_DB" },
    { key: "knowledgeAll", label: "Knowledge (all)", envKey: "NOTION_KNOWLEDGE_DB" },
  ] as const;

  const results = await Promise.allSettled([
    getStories(),
    getJDRecords(),
    getInterviewRecords(),
    getKnowledgeCardsToReview(),
    getAllKnowledgeCards(),
    getQuestions(),
  ]);

  const [storiesRes, jdRes, interviewRes, knowledgeDueRes, knowledgeAllRes, questionsRes] = results;

  const warnings: string[] = [];
  const diagnostics: Array<{ source: string; envKey: string; detail: string }> = [];
  const stories = storiesRes.status === "fulfilled" ? storiesRes.value : [];
  if (storiesRes.status === "rejected") {
    const detail = storiesRes.reason instanceof Error ? storiesRes.reason.message : "failed";
    warnings.push(`StoryBank 连接失败（NOTION_STORIES_DB）：${detail}`);
    diagnostics.push({ source: sourceMeta[0].label, envKey: sourceMeta[0].envKey, detail });
  }
  const jd = jdRes.status === "fulfilled" ? jdRes.value : [];
  if (jdRes.status === "rejected") {
    const detail = jdRes.reason instanceof Error ? jdRes.reason.message : "failed";
    warnings.push(`JD Records 连接失败（NOTION_JD_DB）：${detail}`);
    diagnostics.push({ source: sourceMeta[1].label, envKey: sourceMeta[1].envKey, detail });
  }
  const interviews = interviewRes.status === "fulfilled" ? interviewRes.value : [];
  if (interviewRes.status === "rejected") {
    const detail = interviewRes.reason instanceof Error ? interviewRes.reason.message : "failed";
    warnings.push(`Interview Records 连接失败（NOTION_INTERVIEW_DB）：${detail}`);
    diagnostics.push({ source: sourceMeta[2].label, envKey: sourceMeta[2].envKey, detail });
  }
  const knowledgeDue = knowledgeDueRes.status === "fulfilled" ? knowledgeDueRes.value : [];
  if (knowledgeDueRes.status === "rejected") {
    const detail = knowledgeDueRes.reason instanceof Error ? knowledgeDueRes.reason.message : "failed";
    warnings.push(`Knowledge (due) 连接失败（NOTION_KNOWLEDGE_DB）：${detail}`);
    diagnostics.push({ source: sourceMeta[3].label, envKey: sourceMeta[3].envKey, detail });
  }
  const knowledgeAll = knowledgeAllRes.status === "fulfilled" ? knowledgeAllRes.value : [];
  if (knowledgeAllRes.status === "rejected") {
    const detail = knowledgeAllRes.reason instanceof Error ? knowledgeAllRes.reason.message : "failed";
    warnings.push(`Knowledge (all) 连接失败（NOTION_KNOWLEDGE_DB）：${detail}`);
    diagnostics.push({ source: sourceMeta[4].label, envKey: sourceMeta[4].envKey, detail });
  }
  const questions = questionsRes.status === "fulfilled" ? questionsRes.value : [];
  if (questionsRes.status === "rejected") {
    const detail = questionsRes.reason instanceof Error ? questionsRes.reason.message : "failed";
    warnings.push(`QuestionBank 连接失败（NOTION_QUESTION_DB）：${detail}`);
    diagnostics.push({ source: "QuestionBank", envKey: "NOTION_QUESTION_DB", detail });
  }

  if (diagnostics.length > 0) {
    diagnostics.forEach((item) => {
      console.warn(
        `[notion-progress-diagnostic] source="${item.source}" env="${item.envKey}" detail="${item.detail}"`,
      );
    });
  }

  const payload = {
    ...toProgressSnapshot({
      stories,
      jd,
      interviews,
      knowledgeDue,
      knowledgeAll,
      questions: questions.map((q) => ({
        practiceCount: q.practiceCount,
        status: q.status,
        lastPracticed: q.lastPracticed,
      })),
    }),
    warnings,
    diagnostics,
  };

  // Always return dashboard data; expose failed sources via warnings.
  return NextResponse.json(payload);
}
