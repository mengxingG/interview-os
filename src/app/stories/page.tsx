"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import ChatPanel from "@/components/ChatPanel";
import type { ChatMessageView } from "@/components/ChatPanel";
import { PageGuide } from "@/components/PageGuide";
import { toastFetch } from "@/lib/toast-utils";
import { buildStoryOptimizationPrompt } from "@/lib/prompts/stories";
import { parseDecodeResultSections } from "@/lib/jd-decode-format";

type StoryTag =
  | "Leadership"
  | "Cross-functional"
  | "Data-driven"
  | "Technical"
  | "Conflict"
  | "Innovation";

type Story = {
  id: string;
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  earnedSecret: string;
  tags: string[];
  strength: number;
  useCount: number;
  aiCachedViews?: Record<string, string>;
};

const tagOptions: StoryTag[] = [
  "Leadership",
  "Cross-functional",
  "Data-driven",
  "Technical",
  "Conflict",
  "Innovation",
];

const tagLabels: Record<StoryTag, string> = {
  Leadership: "领导力（Leadership）",
  "Cross-functional": "跨团队协作（Cross-functional）",
  "Data-driven": "数据驱动（Data-driven）",
  Technical: "技术能力（Technical）",
  Conflict: "冲突处理（Conflict）",
  Innovation: "创新推动（Innovation）",
};

const initialForm = {
  title: "",
  situation: "",
  task: "",
  actionText: "",
  result: "",
  earnedSecret: "",
  tags: [] as StoryTag[],
  strength: 3,
};
const STORY_OPTIMIZE_SESSIONS_KEY = "story-optimize-sessions";

type StoryOptimizeSession = {
  storyId: string;
  title: string;
  messages: ChatMessageView[];
  updatedAt: string;
};

type OptimizedStoryFields = {
  situation: string;
  task: string;
  action: string;
  result: string;
  earnedSecret: string;
};

type StoryFieldKey = keyof OptimizedStoryFields;
type SmartStoryExtractResult = {
  title?: string;
  situation?: string;
  task?: string;
  action?: string;
  result?: string;
  earnedSecret?: string;
  tags?: string[];
  rating?: number;
};

type StoryRollbackSnapshot = {
  storyId: string;
  before: OptimizedStoryFields;
  after: OptimizedStoryFields;
  changedKeys: StoryFieldKey[];
  createdAt: string;
};

type OptimizeQuickAction = {
  id: string;
  label: string;
  prompt: string;
};

type JDOption = {
  id: string;
  title: string;
  // Original / decoded content for fallback parsing.
  jdText?: string;
  decodeSummary?: string;
  coreResponsibilities?: string;
  implicitExpectations?: string;
  fitSummary?: string;
  keyGaps?: string;
};

type ChallengeQuestionRow = {
  id?: string;
  title?: string;
  category?: string;
  tags?: string[];
};

type StoryViewTab = "base" | "derived90s";
type StressPersona = "technical" | "execution" | "behavioral";

const STORY_VIEW_90S_KEY = "spoken90s";
const RETRIEVAL_DRILL_SECONDS = 10;
const STRESS_PERSONA_OPTIONS: Array<{ key: StressPersona; label: string }> = [
  { key: "technical", label: "Technical（技术与 AI 深度）" },
  { key: "execution", label: "Execution（执行与数据指标）" },
  { key: "behavioral", label: "Behavioral（行为与领导力）" },
];
const RANDOM_CHALLENGE_FALLBACKS = [
  "讲一次你彻底搞砸的项目，以及你后来怎么收拾残局。",
  "当你和上级意见完全相左时，你怎么处理？",
  "说一个你明知会被质疑、但仍坚持推进的决定。",
  "讲一次你在资源极少的情况下，还要按时交付结果的经历。",
  "有没有一次你推动的方案最后证明是错的？你怎么应对？",
  "讲一次你必须在速度和质量之间做艰难取舍的经历。",
  "说一个你最不擅长、但最终被迫补齐的能力短板。",
  "讲一次你影响了一个并不直接向你汇报的人。",
  "当团队里有人明显拖后腿时，你会怎么做？",
  "讲一次你被业务方强烈反对，但最后还是说服了他们的经历。",
  "有没有一次你高估了自己的判断，结果带来负面后果？",
  "说一个你在高压下临场反应失误、后来补救成功的例子。",
  "讲一次你做了一个 unpopular decision，但最终证明值得。",
  "当目标模糊、老板也说不清楚时，你如何推进？",
  "讲一次你必须在信息不完整时拍板决策的经历。",
];

function stripMarkdownAnchors(text: string) {
  return text.replace(/###\s*(✨|🎯|⏱️).*?\n?/g, "").trim();
}

function extractDerivedViewContent(raw: string, viewKey: string) {
  const text = raw.trim();
  if (!text) return "";
  if (viewKey === STORY_VIEW_90S_KEY) {
    // Strict: only match the exact anchor "### ⏱️ 90秒口述版本"
    const anchor = "### ⏱️ 90秒口述版本";
    const idx = text.indexOf(anchor);
    if (idx < 0) {
      // Also try with emoji variation
      const altAnchor = "### ⏱️ 90秒口述版本";
      const altIdx = text.indexOf(altAnchor);
      if (altIdx < 0) return "";
      return text.slice(altIdx + altAnchor.length).trim();
    }
    return text.slice(idx + anchor.length).trim();
  }
  return text;
}

const COMPRESS_90S_PROMPT =
  "请将当前故事压缩成90秒口述版本，必须以 '### ⏱️ 90秒口述版本' 开头，保留核心挑战和量化结果。";

const optimizeQuickActions: OptimizeQuickAction[] = [
  {
    id: "rewrite-star-only",
    label: "仅输出优化后STAR",
    prompt:
      "请只输出“优化后STAR”，并且输出必须以指定锚点开头：### ✨ 标准优化版\n请严格使用以下标题：Situation/Task/Action/Result/Earned Secret。不要输出点评、不要输出追问、不要输出解释。",
  },
  {
    id: "enhance-challenge-response",
    label: "强化挑战与应对",
    prompt:
      "请在Action中补充“最大挑战-我的判断-采取动作-风险控制-结果验证”的闭环，每段1-2句，避免空泛表述。",
  },
  {
    id: "strengthen-metrics",
    label: "补充量化结果",
    prompt:
      "请重写Result，必须包含基线、动作后指标、提升幅度、时间周期、业务意义，给出可直接口述的版本。",
  },
  {
    id: "jd-oriented-rewrite",
    label: "按目标岗位重写",
    prompt:
      "请按目标岗位面试官偏好重写STAR，突出岗位相关性、业务价值和跨团队协作影响。\n并且输出必须以指定锚点开头：### 🎯 岗位定制版\n请严格使用以下标题：Situation/Task/Action/Result/Earned Secret。不要输出点评、不要输出追问、不要输出解释。",
  },
  {
    id: "fact-anchor",
    label: "事实锚定与推演",
    prompt:
      "请对内容进行【事实锚定与推演】升级。必须严格遵守以下两条指令：\n1. 【保持张力】：你必须保留并发挥你之前优秀的结构化拆解能力（如详细的挑战背景、多维度的动作拆解、深度业务洞察等），保持篇幅的丰富度和逻辑的深度，绝对不要缩减成干瘪的流水账。\n2. 【事实红线】：在涉及具体数值、基线指标、客观时间周期时，必须严格与原始底稿对齐；对于逻辑上合理但底稿中未明确提供的数据或隐性收益，必须在相关句子的末尾明确打上\"[推演]\"标签。",
  },
];

function toSafeMessages(raw: unknown): ChatMessageView[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const id = typeof row.id === "string" ? row.id : crypto.randomUUID();
      const role = typeof row.role === "string" ? row.role : "assistant";
      const content = typeof row.content === "string" ? row.content : "";
      if (!content.trim()) return null;
      return { id, role, content };
    })
    .filter((item): item is ChatMessageView => Boolean(item));
}

function isSameMessages(a: ChatMessageView[], b: ChatMessageView[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].role !== b[i].role) return false;
    if (a[i].content !== b[i].content) return false;
  }
  return true;
}

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildHeadingPattern(aliases: string[]) {
  const aliasGroup = aliases.map((alias) => escapeRegExp(alias)).join("|");
  // Supports:
  // Task:
  // **Task:**
  // Task <content>
  // Task：<content>
  // Task
  return `(?:[-*]\\s*)?(?:#{1,6}\\s*)?(?:\\*{1,2}|__)?(?:${aliasGroup})(?:\\*{1,2}|__)?\\s*(?:[:：]\\s*|\\s+|$)`;
}

function extractOptimizedStarSegment(text: string) {
  const markers = [
    "优化后STAR",
    "优化后 STAR",
    "改写后的STAR",
    "改写后STAR",
    "STAR改写",
    "Optimized STAR",
    "Rewritten STAR",
  ];
  const lower = text.toLowerCase();
  for (const marker of markers) {
    const idx = lower.indexOf(marker.toLowerCase());
    if (idx >= 0) {
      return text.slice(idx + marker.length).trim();
    }
  }
  return "";
}

function hasStarHeadingStructure(text: string) {
  const normalized = text.toLowerCase();
  const hasS = new RegExp(`(?:^|\\n)\\s*${buildHeadingPattern(["situation", "场景", "情境", "背景", "s"])}`, "i").test(
    normalized,
  );
  const hasT = new RegExp(`(?:^|\\n)\\s*${buildHeadingPattern(["task", "任务", "目标", "t"])}`, "i").test(normalized);
  const hasA = new RegExp(`(?:^|\\n)\\s*${buildHeadingPattern(["action", "行动", "做法", "执行", "a"])}`, "i").test(
    normalized,
  );
  const hasR = new RegExp(`(?:^|\\n)\\s*${buildHeadingPattern(["result", "结果", "成果", "产出", "r"])}`, "i").test(
    normalized,
  );
  return hasS && hasT && hasA && hasR;
}

function extractSection(text: string, targets: string[], allHeadingAliases: string[]) {
  const targetSet = new Set(targets.map((item) => item.toLowerCase()));
  const stopAliases = allHeadingAliases
    .filter((h) => !targetSet.has(h.toLowerCase()))
    .map((h) => h.trim())
    .filter(Boolean);
  const stopPattern = stopAliases.length > 0 ? buildHeadingPattern(stopAliases) : "$^";
  const targetPattern = buildHeadingPattern(targets);
  const pattern = new RegExp(
    `(?:^|\\n)\\s*${targetPattern}([\\s\\S]*?)(?=\\n\\s*${stopPattern}|$)`,
    "i",
  );
  const matched = text.match(pattern)?.[1]?.trim();
  if (matched) return matched;
  return "";
}

function parseOptimizedStoryFields(assistantText: string, fallback: Story): OptimizedStoryFields {
  const headingAliases = {
    situation: ["Situation", "场景", "情境", "背景", "S"],
    task: ["Task", "任务", "目标", "T"],
    action: ["Action", "行动", "做法", "执行", "A"],
    result: ["Result", "结果", "成果", "产出", "R"],
    earnedSecret: ["Earned Secret", "关键洞察", "收获", "复盘启发"],
  };
  const allAliases = Object.values(headingAliases).flat();
  const cleaned = assistantText.trim();
  const starSegment = extractOptimizedStarSegment(cleaned);
  const parseScope = starSegment || cleaned;

  const buckets: Record<StoryFieldKey, string[]> = {
    situation: [],
    task: [],
    action: [],
    result: [],
    earnedSecret: [],
  };
  let currentKey: StoryFieldKey | null = null;
  const headingEntries = Object.entries(headingAliases) as Array<[StoryFieldKey, string[]]>;
  for (const rawLine of parseScope.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const headingKey = headingEntries.find(([, aliases]) => {
      const headingRegex = new RegExp(`^${buildHeadingPattern(aliases)}`, "i");
      return headingRegex.test(line);
    })?.[0];
    if (headingKey) {
      currentKey = headingKey;
      const inline = line
        .replace(/^(?:[-*]\s*)?(?:#+\s*)?\d*[.)]?\s*/g, "")
        .replace(new RegExp(`^${buildHeadingPattern(headingAliases[headingKey])}`, "i"), "")
        .trim();
      if (inline) buckets[headingKey].push(inline);
      continue;
    }
    if (currentKey) {
      buckets[currentKey].push(line);
    }
  }
  const fromBuckets: Partial<OptimizedStoryFields> = {
    situation: buckets.situation.join("\n").trim(),
    task: buckets.task.join("\n").trim(),
    action: buckets.action.join("\n").trim(),
    result: buckets.result.join("\n").trim(),
    earnedSecret: buckets.earnedSecret.join("\n").trim(),
  };

  const next = {
    situation:
      fromBuckets.situation ||
      extractSection(parseScope, headingAliases.situation, allAliases) ||
      fallback.situation,
    task:
      fromBuckets.task ||
      extractSection(parseScope, headingAliases.task, allAliases) ||
      fallback.task,
    action:
      fromBuckets.action ||
      extractSection(parseScope, headingAliases.action, allAliases) ||
      fallback.action,
    result:
      fromBuckets.result ||
      extractSection(parseScope, headingAliases.result, allAliases) ||
      fallback.result,
    earnedSecret:
      fromBuckets.earnedSecret ||
      extractSection(parseScope, headingAliases.earnedSecret, allAliases) ||
      fallback.earnedSecret,
  };

  return {
    situation: next.situation,
    task: next.task,
    action: next.action,
    result: next.result,
    earnedSecret: next.earnedSecret,
  };
}

function sanitizeParsedFieldText(text: string) {
  const headingLine =
    /^(?:[-*]\s*)?(?:#{1,6}\s*)?(?:Situation|Task|Action|Result|Earned Secret|场景|任务|行动|结果|关键洞察)\s*(?:[:：])?(?:\s|$)/i;
  const reviewSignalLine =
    /(?:相关性|可信度|差异化|表达力|结构性|主要问题|追问清单|改写建议|Relevance|Credibility|Differentiation|Substance|Structure|follow-up)/i;
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !headingLine.test(line))
    .filter((line) => !reviewSignalLine.test(line));
  return lines.join("\n").trim();
}

function sanitizeOptimizedFields(fields: OptimizedStoryFields): OptimizedStoryFields {
  return {
    situation: sanitizeParsedFieldText(fields.situation),
    task: sanitizeParsedFieldText(fields.task),
    action: sanitizeParsedFieldText(fields.action),
    result: sanitizeParsedFieldText(fields.result),
    earnedSecret: sanitizeParsedFieldText(fields.earnedSecret),
  };
}

function hasReviewNoise(fields: OptimizedStoryFields) {
  const joined = `${fields.situation}\n${fields.task}\n${fields.action}\n${fields.result}\n${fields.earnedSecret}`;
  return /(?:相关性|可信度|差异化|表达力|结构性|主要问题|追问清单|改写建议|Relevance|Credibility|Differentiation|Substance|Structure|follow-up)/i.test(
    joined,
  );
}

function getChangedStoryFields(base: Story, next: OptimizedStoryFields) {
  return [
    { key: "situation", label: "场景（Situation）", before: base.situation, after: next.situation },
    { key: "task", label: "任务（Task）", before: base.task, after: next.task },
    { key: "action", label: "行动（Action）", before: base.action, after: next.action },
    { key: "result", label: "结果（Result）", before: base.result, after: next.result },
    {
      key: "earnedSecret",
      label: "关键洞察（Earned Secret）",
      before: base.earnedSecret,
      after: next.earnedSecret,
    },
  ].filter((row) => row.before.trim() !== row.after.trim());
}

function mergeStoryFieldsBySelection(
  base: Story,
  next: OptimizedStoryFields,
  selected: StoryFieldKey[],
): OptimizedStoryFields {
  return {
    situation: selected.includes("situation") ? next.situation : base.situation,
    task: selected.includes("task") ? next.task : base.task,
    action: selected.includes("action") ? next.action : base.action,
    result: selected.includes("result") ? next.result : base.result,
    earnedSecret: selected.includes("earnedSecret")
      ? next.earnedSecret
      : base.earnedSecret,
  };
}

function extractNumericSignals(text: string) {
  const matches = text.match(/\b\d+(?:\.\d+)?%?\b/g) ?? [];
  return Array.from(new Set(matches));
}

function extractUpperTokens(text: string) {
  const matches = text.match(/\b[A-Z]{2,}(?:[-_][A-Z0-9]{2,})*\b/g) ?? [];
  return Array.from(new Set(matches));
}

function extractAlphaTokens(text: string) {
  const matches = text.match(/\b[a-zA-Z][a-zA-Z0-9_-]{2,}\b/g) ?? [];
  return Array.from(new Set(matches.map((item) => item.toLowerCase())));
}

function stripInferenceSegments(text: string) {
  return text
    .split("\n")
    .filter((line) => !line.includes("[推演]"))
    .join("\n");
}

function hasMitigationTag(text: string) {
  return /\[推演\]|【推演】|\(推演\)|（推演）/.test(text);
}

function checkPotentialFabrication(base: Story, next: OptimizedStoryFields) {
  const baseText = `${base.title}\n${base.situation}\n${base.task}\n${base.action}\n${base.result}\n${base.earnedSecret}`;
  const nextText = `${next.situation}\n${next.task}\n${next.action}\n${next.result}\n${next.earnedSecret}`;
  const hasDeductionTag = hasMitigationTag(nextText);
  const strictScopeText = stripInferenceSegments(nextText);

  const baseNums = new Set(extractNumericSignals(baseText));
  const nextNums = extractNumericSignals(strictScopeText);
  const newNums = nextNums.filter((n) => !baseNums.has(n));

  const baseUpper = new Set(extractUpperTokens(baseText));
  const nextUpper = extractUpperTokens(strictScopeText);
  const newUpper = nextUpper.filter((t) => !baseUpper.has(t));

  const alphaIgnore = new Set([
    "situation",
    "task",
    "action",
    "result",
    "earned",
    "secret",
    "the",
    "and",
    "for",
    "with",
    "from",
    "that",
    "this",
    "was",
    "were",
    "are",
    "you",
    "your",
  ]);
  const baseAlpha = new Set(extractAlphaTokens(baseText));
  const nextAlpha = extractAlphaTokens(nextText);
  const newAlpha = nextAlpha.filter((token) => !baseAlpha.has(token) && !alphaIgnore.has(token));
  const hasNewTerms = newUpper.length > 0 || newAlpha.length > 0;
  const termRiskMitigated = hasNewTerms && hasDeductionTag;

  return {
    hasStrictRisk: newNums.length > 0 && !hasDeductionTag,
    hasWarningRisk: hasNewTerms && !termRiskMitigated,
    hasMitigatedRisk: termRiskMitigated,
    hasRisk: (newNums.length > 0 && !hasDeductionTag) || (hasNewTerms && !termRiskMitigated),
    hasDeductionTag,
    newNums,
    newUpper,
    newAlpha,
  };
}

function checkRedlineDrift(base: Story, next: OptimizedStoryFields) {
  const baseText = `${base.title}\n${base.situation}\n${base.task}\n${base.action}\n${base.result}\n${base.earnedSecret}`.toLowerCase();
  const nextText = `${next.situation}\n${next.task}\n${next.action}\n${next.result}\n${next.earnedSecret}`;
  const nextLower = nextText.toLowerCase();
  const strictScopeText = stripInferenceSegments(nextText).toLowerCase();

  const suspiciousTechTerms = [
    "c++",
    "java",
    "golang",
    "go ",
    "python",
    "rust",
    "unit test",
    "单元测试",
    "代码重构",
    "代码解耦",
    "重写底层",
  ];
  const roleDriftTerms = ["开发工程师", "程序员", "后端工程师", "前端工程师", "写代码", "coding"];
  const newSuspiciousTerms = suspiciousTechTerms.filter(
    (term) => strictScopeText.includes(term) && !baseText.includes(term),
  );
  const roleDrifts = roleDriftTerms.filter((term) => nextLower.includes(term) && !baseText.includes(term));

  const inventedEntitySignals = [
    ...extractUpperTokens(stripInferenceSegments(nextText)),
  ].filter((token) => !extractUpperTokens(baseText).includes(token));

  const hasRedline = newSuspiciousTerms.length > 0 || roleDrifts.length > 0;
  return {
    hasRedline,
    newSuspiciousTerms,
    roleDrifts,
    inventedEntitySignals: inventedEntitySignals.slice(0, 8),
  };
}

function buildRedlineCorrectionPrompt(redline: {
  newSuspiciousTerms: string[];
  roleDrifts: string[];
  inventedEntitySignals: string[];
}) {
  const issues = [
    redline.newSuspiciousTerms.length
      ? `- 删除或改写以下疑似研发实现细节：${redline.newSuspiciousTerms.join(", ")}`
      : "",
    redline.roleDrifts.length
      ? `- 删除或改写以下角色漂移表达：${redline.roleDrifts.join(", ")}`
      : "",
    redline.inventedEntitySignals.length
      ? `- 核查并移除原文未出现的新术语：${redline.inventedEntitySignals.join(", ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
  return [
    "请立刻按“事实锚定 + AI PM 视角”重写，修正如下风险：",
    issues,
    "",
    "硬要求：",
    "1) 只能基于我原始故事事实重写，禁止新增项目名/技术栈/业务背景；",
    "2) 若 Task 为空，只能从已有 Action 和 Result 逆向推导；",
    "3) 输出必须严格为：Situation: / Task: / Action: / Result: / Earned Secret:（每行保留冒号）。",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildStoryMessage(_story: Story, targetJob?: JDOption | null) {
  // IMPORTANT:
  // - The user's message content must be instruction-only.
  // - The full original STAR story is provided implicitly via requestBody.originalStory
  //   and injected as a system message on the backend.
  const jobContext = targetJob
    ? `
目标岗位（来自 JD 解码）:
- 岗位标题: ${targetJob.title || "（未命名）"}
- 核心职责: ${targetJob.coreResponsibilities || "（未提供）"}
- 隐含期望: ${targetJob.implicitExpectations || "（未提供）"}
- 匹配总结: ${targetJob.fitSummary || "（未提供）"}
- 关键差距: ${targetJob.keyGaps || "（未提供）"}
`
    : "";

  return `
请根据“System 注入的候选人原始 STAR 底稿”，结合目标岗位偏好进行优化。
${jobContext}
请严格使用以下标题输出最终结果：Situation/Task/Action/Result/Earned Secret。`.trim();
}

function buildStressStorySummary(story: Story) {
  return [
    `标题：${story.title}`,
    `标签：${story.tags.join(", ") || "未标注"}`,
    `强度：${story.strength}/5`,
    `Situation: ${story.situation}`,
    `Task: ${story.task}`,
    `Action: ${story.action}`,
    `Result: ${story.result}`,
    `Earned Secret: ${story.earnedSecret}`,
  ].join("\n");
}

function buildOriginalStarText(story: Story) {
  // Used by the fixed readonly header in the AI optimization modal.
  return [
    `Situation: ${story.situation}`,
    `Task: ${story.task}`,
    `Action: ${story.action}`,
    `Result: ${story.result}`,
    `Earned Secret: ${story.earnedSecret}`,
  ].join("\n");
}

function sanitizeUserChatContentForDisplay(rawContent: string) {
  const content = String(rawContent ?? "");
  const looksLikeStar =
    /Situation\s*[:：]|Task\s*[:：]|Action\s*[:：]|Result\s*[:：]|Earned Secret\s*[:：]/i.test(content) ||
    /Situation\n|Task\n|Action\n|Result\n|Earned Secret\n/.test(content);
  if (looksLikeStar && content.length > 80) {
    return `${content.slice(0, 50)}...[内容已折叠]`;
  }
  if (content.length > 600) {
    return `${content.slice(0, 50)}...[内容已折叠]`;
  }
  return content;
}

function resolveJDDetailsForPrompt(jd: JDOption | null) {
  if (!jd) {
    return {
      coreResponsibilities: "",
      implicitExpectations: "",
      fitSummary: "",
      keyGaps: "",
    };
  }

  const decodeSource = String(jd.decodeSummary ?? jd.jdText ?? "");
  const parsed = decodeSource.trim() ? parseDecodeResultSections(decodeSource) : null;

  const coreResponsibilities = (jd.coreResponsibilities ?? "").trim() || parsed?.core || "";
  const implicitExpectations = (jd.implicitExpectations ?? "").trim() || parsed?.implicit || "";
  const fitSummary = (jd.fitSummary ?? "").trim() || parsed?.fitSummary || "";
  const keyGaps = (jd.keyGaps ?? "").trim() || parsed?.keyGaps || "";

  return { coreResponsibilities, implicitExpectations, fitSummary, keyGaps };
}

function buildStressSystemPrompt(persona: StressPersona, story: Story) {
  const personaInstruction =
    persona === "technical"
      ? "你是大厂 Staff Engineer。只问技术落地细节：数据结构、系统边界、异常场景、权衡依据。"
      : persona === "execution"
        ? "你是严苛 Data Science Lead。只问指标口径、因果验证、实验设计、排查路径。"
        : "你是跨部门负责人。只问冲突管理、资源博弈、失败复盘、艰难取舍。";
  return `
你是“故事深度拷问官”，目标是围绕同一条故事进行高压面试追问，不要给建议，不要给总结。
${personaInstruction}

规则：
1) 每次只提 1 个问题，短句、直接、有压迫感。
2) 必须基于故事事实追问，不要跳到无关题目。
3) 追问优先攻击“最薄弱、最缺证据”的环节。
4) 如果候选人回答空泛，继续追问“具体到动作、数据、时间、影响”。
5) 严格执行一问一答：你每次只允许提出一个问题；候选人未回答前，禁止继续提问。
6) 只输出问题本身，不要输出解析，不要一次输出多题。

当前故事（只读上下文）：
${buildStressStorySummary(story)}
`.trim();
}

function extractQAPairs(messages: ChatMessageView[]) {
  const pairs: Array<{ question: string; answer: string }> = [];
  let pendingQuestion = "";
  for (const msg of messages) {
    if (msg.role === "assistant") {
      pendingQuestion = msg.content.trim();
      continue;
    }
    if (msg.role === "user" && pendingQuestion) {
      const answer = msg.content.trim();
      if (answer) {
        pairs.push({ question: pendingQuestion, answer });
      }
      pendingQuestion = "";
    }
  }
  return pairs;
}

export default function StoriesPage() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("正在加载 StoryBank...");
  const [showForm, setShowForm] = useState(false);
  const [currentEditingId, setCurrentEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [optimizeStory, setOptimizeStory] = useState<Story | null>(null);
  const [optimizeSession, setOptimizeSession] = useState<StoryOptimizeSession | null>(null);
  const [optimizeSessionPageId, setOptimizeSessionPageId] = useState("");
  const [optimizeSyncText, setOptimizeSyncText] = useState("");
  const [syncingOptimizeSession, setSyncingOptimizeSession] = useState(false);
  const [originalStarSnapshot, setOriginalStarSnapshot] = useState("");
  const [optimizeContextExpanded, setOptimizeContextExpanded] = useState(false);
  const [optimizeToast, setOptimizeToast] = useState("");
  const [applyingOptimizeResult, setApplyingOptimizeResult] = useState(false);
  const [pendingOptimizedFields, setPendingOptimizedFields] =
    useState<OptimizedStoryFields | null>(null);
  const [selectedApplyFields, setSelectedApplyFields] = useState<StoryFieldKey[]>(
    [],
  );
  const [lastRollbackSnapshot, setLastRollbackSnapshot] =
    useState<StoryRollbackSnapshot | null>(null);
  const lastPersistedMessageSignatureRef = useRef("");
  const optimizeSessionRef = useRef<StoryOptimizeSession | null>(null);
  const persistIdleIdRef = useRef<number | null>(null);
  const persistTimeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [quickActionPrompt, setQuickActionPrompt] = useState("");
  const [quickActionNonce, setQuickActionNonce] = useState(0);
  const [isRiskIgnored, setIsRiskIgnored] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [retrievalQuestion, setRetrievalQuestion] = useState("");
  const [retrievalResult, setRetrievalResult] = useState("");
  const [retrievalScript, setRetrievalScript] = useState("");
  const [retrievalMatchedStoryId, setRetrievalMatchedStoryId] = useState<string | null>(null);
  const [showMatchedOnly, setShowMatchedOnly] = useState(false);
  const [selectedRetrievalTags, setSelectedRetrievalTags] = useState<string[]>([]);
  const [retrievalCountdown, setRetrievalCountdown] = useState(RETRIEVAL_DRILL_SECONDS);
  const [retrievalCountdownActive, setRetrievalCountdownActive] = useState(false);
  const [retrievalCountdownExpired, setRetrievalCountdownExpired] = useState(false);
  const [loadingRandomChallenge, setLoadingRandomChallenge] = useState(false);
  const [showSmartPasteModal, setShowSmartPasteModal] = useState(false);
  const [smartPasteInput, setSmartPasteInput] = useState("");
  const [smartExtracting, setSmartExtracting] = useState(false);
  const lastOptimizeUserMessageIdRef = useRef("");
  const [optimizeChatLoading, setOptimizeChatLoading] = useState(false);
  const optimizeQuickLockRef = useRef(false);
  // Synchronous ref to track latest optimize messages without async delay from schedulePersistOptimizeSession.
  // This ensures the 90s auto-detect useEffect and button handler always read fresh data.
  const latestOptimizeMessagesRef = useRef<ChatMessageView[]>([]);
  const [jdOptions, setJdOptions] = useState<JDOption[]>([]);
  const [selectedTargetJobId, setSelectedTargetJobId] = useState("");
  const [storyViewTabs, setStoryViewTabs] = useState<Record<string, StoryViewTab>>({});
  const [savingDerivedView, setSavingDerivedView] = useState(false);
  const [stressStory, setStressStory] = useState<Story | null>(null);
  const [stressMessages, setStressMessages] = useState<ChatMessageView[]>([]);
  const [stressPersona, setStressPersona] = useState<StressPersona>("technical");
  const [stressChatLoading, setStressChatLoading] = useState(false);
  const [archivingStressSession, setArchivingStressSession] = useState(false);
  const [stressArchivePreview, setStressArchivePreview] = useState<Array<{ question: string; answer: string }> | null>(null);
  const [stressKickoffPrompt, setStressKickoffPrompt] = useState("");
  const [stressKickoffNonce, setStressKickoffNonce] = useState(0);
  const [stressNotice, setStressNotice] = useState("");
  const [stressContextExpanded, setStressContextExpanded] = useState(false);
  const [derivedPreview, setDerivedPreview] = useState<{
    viewKey: string;
    title: string;
    content: string;
  } | null>(null);
  const [derivedPreviewDraft, setDerivedPreviewDraft] = useState("");
  const [derivedPreviewEditing, setDerivedPreviewEditing] = useState(false);
  const [derivedPreviewSaveNotice, setDerivedPreviewSaveNotice] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const retrievalTagStats = useMemo(() => {
    const tagCount = stories.reduce<Record<string, number>>((acc, s) => {
      s.tags.forEach((tag) => {
        acc[tag] = (acc[tag] ?? 0) + 1;
      });
      return acc;
    }, {});
    return Object.entries(tagCount).sort((a, b) => b[1] - a[1]);
  }, [stories]);
  useEffect(() => {
    optimizeSessionRef.current = optimizeSession;
  }, [optimizeSession]);

  useEffect(() => {
    if (!derivedPreview) return;
    setDerivedPreviewDraft(derivedPreview.content ?? "");
    setDerivedPreviewEditing(false);
    setDerivedPreviewSaveNotice(null);
  }, [derivedPreview]);

  useEffect(() => {
    if (!optimizeToast) return;
    const timer = window.setTimeout(() => setOptimizeToast(""), 2200);
    return () => window.clearTimeout(timer);
  }, [optimizeToast]);

  useEffect(() => {
    optimizeQuickLockRef.current = optimizeChatLoading;
  }, [optimizeChatLoading]);

  // Step 2: Auto-detect ### ⏱️ 90秒口述版本 in assistant messages and open preview modal
  // Uses latestOptimizeMessagesRef (synchronous) instead of optimizeSession?.messages (async-delayed)
  // to ensure the detection fires reliably when loading finishes.
  useEffect(() => {
    // Critical: never open preview while still loading (prevents showing half-baked content)
    if (optimizeChatLoading) return;
    if (!optimizeStory) return;
    const messages = latestOptimizeMessagesRef.current;
    if (!messages.length) return;
    const latestAssistant = [...messages]
      .reverse()
      .find((msg) => msg.role === "assistant")?.content ?? "";
    if (!latestAssistant) return;
    // Strict check: only the exact anchor "### ⏱️ 90秒口述版本" counts
    const anchor = "### ⏱️ 90秒口述版本";
    const idx = latestAssistant.indexOf(anchor);
    if (idx < 0) return;
    // Extract content strictly after the anchor
    const extracted = latestAssistant.slice(idx + anchor.length).trim();
    if (!extracted) return;
    // Only auto-open if the preview is not already showing the same content
    if (derivedPreview?.content === extracted) return;
    setDerivedPreview({
      viewKey: STORY_VIEW_90S_KEY,
      title: "90 秒口述视图",
      content: extracted,
    });
    setOptimizeSyncText("✅ 已自动检测到 90 秒口述版本，请在预览弹窗中确认并同步。");
  }, [optimizeChatLoading, optimizeStory, derivedPreview?.content]);
  useEffect(() => {
    return () => {
      if (persistIdleIdRef.current !== null && typeof window !== "undefined" && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(persistIdleIdRef.current);
      }
      if (persistTimeoutIdRef.current !== null) {
        window.clearTimeout(persistTimeoutIdRef.current);
      }
    };
  }, []);

  const statusIsError =
    /失败|错误|HTTP\\s*5\\d\\d|Request to Notion API has timed out|timed out|未连接|归档失败/i.test(status);
  const themeSummary = useMemo(() => {
    return retrievalTagStats
      .slice(0, 3)
      .map(([tag, count]) => `${tag}（${count}）`);
  }, [retrievalTagStats]);

  const openOptimizeModal = (story: Story) => {
    setOptimizeStory(story);
    // Snapshot the original STAR at modal open time.
    setOriginalStarSnapshot(buildOriginalStarText(story));
    // Default collapsed to free space for the chat stream.
    setOptimizeContextExpanded(false);
    setOptimizeSession(null);
    setOptimizeSessionPageId("");
    setPendingOptimizedFields(null);
    setSelectedApplyFields([]);
    setLastRollbackSnapshot(null);
    setOptimizeSyncText("");
    setIsRiskIgnored(false);
    setQuickActionPrompt("");
    setQuickActionNonce(0);
  };
  const filteredStories = useMemo(
    () =>
      selectedRetrievalTags.length > 0
        ? stories.filter((story) => selectedRetrievalTags.some((tag) => story.tags.includes(tag)))
        : stories,
    [selectedRetrievalTags, stories],
  );
  const displayedStories = useMemo(
    () =>
      showMatchedOnly && retrievalMatchedStoryId
        ? filteredStories.filter((story) => story.id === retrievalMatchedStoryId)
        : filteredStories,
    [filteredStories, retrievalMatchedStoryId, showMatchedOnly],
  );

  useEffect(() => {
    if (!retrievalCountdownActive) return;
    if (retrievalCountdown <= 0) {
      setRetrievalCountdownActive(false);
      setRetrievalCountdownExpired(true);
      return;
    }
    const timer = window.setTimeout(() => {
      setRetrievalCountdown((prev) => prev - 1);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [retrievalCountdown, retrievalCountdownActive]);

  function startRetrievalCountdown() {
    setRetrievalCountdown(RETRIEVAL_DRILL_SECONDS);
    setRetrievalCountdownExpired(false);
    setRetrievalCountdownActive(true);
  }

  function runRetrievalDrill(question: string) {
    const normalizedQuestion = question.trim();
    if (!normalizedQuestion) {
      setRetrievalResult("请先输入一个问题，再运行检索。");
      setRetrievalScript("");
      setRetrievalMatchedStoryId(null);
      setShowMatchedOnly(false);
      return;
    }
    startRetrievalCountdown();
    const q = normalizedQuestion.toLowerCase();
    const pool = filteredStories;
    const scored = pool.map((s) => {
      const text = `${s.title} ${s.situation} ${s.task} ${s.action} ${s.result} ${s.earnedSecret}`.toLowerCase();
      let score = 0;
      if (q.includes("质疑") || q.includes("冲突")) score += s.tags.includes("Conflict") ? 3 : 0;
      if (q.includes("领导")) score += s.tags.includes("Leadership") ? 3 : 0;
      if (q.includes("技术")) score += s.tags.includes("Technical") ? 3 : 0;
      if (text.includes("tradeoff") || text.includes("风险")) score += 1;
      score += s.strength >= 4 ? 1 : 0;
      return { story: s, score };
    });
    const best = scored.sort((a, b) => b.score - a.score)[0];
    const fit =
      !best || best.score <= 0
        ? "缺口（Gap）"
        : best.score >= 4
          ? "高匹配（Strong Fit）"
          : best.score >= 2
            ? "可用（Workable）"
            : "可拉伸（Stretch）";
    if (!best || best.score <= 0) {
      setRetrievalResult("缺口（Gap）：当前筛选范围内没有可用故事，建议补一条对应标签的新故事。");
      setRetrievalScript("");
      setRetrievalMatchedStoryId(null);
      setShowMatchedOnly(false);
      return;
    }
    const matchedTags =
      best.story.tags.length > 0 ? best.story.tags.map((tag) => tagLabels[tag as StoryTag] ?? tag).join("、") : "无标签";
    const actionHint =
      fit === "高匹配（Strong Fit）"
        ? "建议直接用这条故事作答。"
        : fit === "可用（Workable）"
          ? "建议补 1 句量化结果后再用。"
          : "建议先改写故事再使用。";
    const script = [
      `这题我想用“${best.story.title}”来回答。`,
      `当时的场景是：${best.story.situation}`,
      `我的任务是：${best.story.task}`,
      `我具体做了这些动作：${best.story.action}`,
      `最终结果是：${best.story.result}`,
      `这段经历让我形成的关键洞察是：${best.story.earnedSecret}`,
    ].join("");
    setRetrievalResult(`${fit}：${best.story.title}｜命中标签：${matchedTags}｜${actionHint}`);
    setRetrievalScript(script);
    setRetrievalMatchedStoryId(best.story.id);
    setShowMatchedOnly(true);
    setExpandedId(best.story.id);
  }

  async function handleRandomChallenge() {
    setLoadingRandomChallenge(true);
    try {
      const response = await fetch("/api/questions?category=Behavioral");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = (await response.json()) as { rows?: ChallengeQuestionRow[] };
      const candidates = Array.isArray(payload.rows)
        ? payload.rows.filter((row) => {
            const title = String(row.title ?? "").trim();
            const category = String(row.category ?? "");
            const tags = Array.isArray(row.tags) ? row.tags.map((tag) => String(tag).toLowerCase()) : [];
            return Boolean(title) && (category === "Behavioral" || tags.includes("高频") || tags.includes("behavioral"));
          })
        : [];
      const pool =
        candidates.length > 0
          ? candidates.map((row) => String(row.title ?? "").trim()).filter(Boolean)
          : RANDOM_CHALLENGE_FALLBACKS;
      const picked = pool[Math.floor(Math.random() * pool.length)] ?? RANDOM_CHALLENGE_FALLBACKS[0];
      setRetrievalQuestion(picked);
      setRetrievalResult(`随机挑战已就位：${picked}`);
      setRetrievalScript("");
      setRetrievalMatchedStoryId(null);
      setShowMatchedOnly(false);
      setRetrievalCountdown(RETRIEVAL_DRILL_SECONDS);
      setRetrievalCountdownExpired(false);
      setRetrievalCountdownActive(false);
    } catch {
      const picked =
        RANDOM_CHALLENGE_FALLBACKS[Math.floor(Math.random() * RANDOM_CHALLENGE_FALLBACKS.length)] ??
        RANDOM_CHALLENGE_FALLBACKS[0];
      setRetrievalQuestion(picked);
      setRetrievalResult(`随机挑战已就位：${picked}`);
      setRetrievalScript("");
      setRetrievalMatchedStoryId(null);
      setShowMatchedOnly(false);
      setRetrievalCountdown(RETRIEVAL_DRILL_SECONDS);
      setRetrievalCountdownExpired(false);
      setRetrievalCountdownActive(false);
    } finally {
      setLoadingRandomChallenge(false);
    }
  }

  async function handleSmartExtractStory() {
    if (!smartPasteInput.trim()) {
      setStatus("请先粘贴一段项目/面试回忆，再进行智能解析。");
      return;
    }
    setSmartExtracting(true);
    setStatus("正在智能解析故事...");
    try {
      const response = await fetch("/api/shared/smart-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "story", rawText: smartPasteInput }),
      });
      const payload = (await response.json()) as { result?: SmartStoryExtractResult; error?: string; detail?: string };
      if (!response.ok || !payload.result) {
        throw new Error(payload.error ?? payload.detail ?? "故事解析失败");
      }
      setForm((prev) => ({
        ...prev,
        title: payload.result?.title?.trim() || prev.title,
        situation: payload.result?.situation?.trim() || prev.situation,
        task: payload.result?.task?.trim() || prev.task,
        actionText: payload.result?.action?.trim() || prev.actionText,
        result: payload.result?.result?.trim() || prev.result,
        earnedSecret: payload.result?.earnedSecret?.trim() || prev.earnedSecret,
        tags:
          Array.isArray(payload.result?.tags) && payload.result.tags.length > 0
            ? payload.result.tags.filter((tag): tag is StoryTag => tagOptions.includes(tag as StoryTag))
            : prev.tags,
        strength:
          typeof payload.result?.rating === "number" && Number.isFinite(payload.result.rating)
            ? Math.max(1, Math.min(5, Math.round(payload.result.rating)))
            : prev.strength,
      }));
      setShowSmartPasteModal(false);
      setSmartPasteInput("");
      setStatus("智能解析完成，已回填到故事表单。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "故事智能解析失败");
    } finally {
      setSmartExtracting(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    async function loadStories() {
      try {
        const response = await fetch("/api/notion?resource=stories");
        let payload: { stories?: Story[]; error?: string; detail?: string } = {};
        try {
          payload = (await response.json()) as typeof payload;
        } catch {
          // ignore JSON parse errors for error bodies
        }
        if (!response.ok) {
          throw new Error(payload.detail ?? payload.error ?? `HTTP ${response.status}`);
        }
        if (mounted) {
          setStories(Array.isArray(payload.stories) ? payload.stories : []);
          setStatus("已连接 Notion StoryBank");
        }
      } catch (error) {
        if (mounted) {
          setStatus(error instanceof Error ? error.message : "读取失败，请检查 Notion 配置");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }
    void loadStories();
    return () => {
      mounted = false;
    };
  }, []);

  const refreshStories = async () => {
    const response = await fetch("/api/notion?resource=stories", { cache: "no-store" });
    let payload: { stories?: Story[]; error?: string; detail?: string } = {};
    try {
      payload = (await response.json()) as typeof payload;
    } catch {
      // ignore JSON parse errors
    }
    if (!response.ok) {
      throw new Error(payload.detail ?? payload.error ?? `HTTP ${response.status}`);
    }
    setStories(Array.isArray(payload.stories) ? payload.stories : []);
  };

  const isEditing = Boolean(currentEditingId);

  const optimizePrompt = useMemo(
    () => (optimizeStory ? buildStoryOptimizationPrompt() : ""),
    [optimizeStory],
  );
  const stressPrompt = useMemo(
    () => (stressStory ? buildStressSystemPrompt(stressPersona, stressStory) : ""),
    [stressPersona, stressStory],
  );
  const isAwaitingStressAnswer = useMemo(() => {
    if (stressMessages.length === 0) return false;
    const last = stressMessages[stressMessages.length - 1];
    return last?.role === "assistant";
  }, [stressMessages]);
  const isStressPersonaLocked = useMemo(() => stressMessages.length > 0, [stressMessages.length]);
  const selectedTargetJob = useMemo(
    () => jdOptions.find((item) => item.id === selectedTargetJobId) ?? null,
    [jdOptions, selectedTargetJobId],
  );
  const optimizeMessage = useMemo(
    () => (optimizeStory ? buildStoryMessage(optimizeStory, selectedTargetJob) : ""),
    [optimizeStory, selectedTargetJob],
  );
  const latestOptimizeAssistant = useMemo(
    () =>
      [...(optimizeSession?.messages ?? [])]
        .reverse()
        .find((msg) => msg.role === "assistant")?.content ?? "",
    [optimizeSession?.messages],
  );
  const optimizeRiskHint = useMemo(() => {
    if (!optimizeStory || !latestOptimizeAssistant.trim()) return "";
    if (
      !extractOptimizedStarSegment(latestOptimizeAssistant) &&
      !hasStarHeadingStructure(latestOptimizeAssistant)
    ) {
      return "当前输出未按 STAR 结构组织，建议先点“仅输出优化后STAR”重新生成。";
    }
    const cleaned = stripMarkdownAnchors(latestOptimizeAssistant);
    const parsed = parseOptimizedStoryFields(cleaned, optimizeStory);
    const nextFields = sanitizeOptimizedFields(parsed);
    const redlineCheck = checkRedlineDrift(optimizeStory, nextFields);
    const isMitigated = hasMitigationTag(latestOptimizeAssistant);
    if (redlineCheck.hasRedline) {
      if (isRiskIgnored) {
        return "✅ 已由用户人工确认豁免风险。";
      }
      if (isMitigated) {
        return "✅ 硬事实风险已解除：已检测到推演标签。";
      }
      const hints = [
        redlineCheck.newSuspiciousTerms.length
          ? `疑似新增技术实现：${redlineCheck.newSuspiciousTerms.join(", ")}`
          : "",
        redlineCheck.roleDrifts.length
          ? `疑似角色漂移：${redlineCheck.roleDrifts.join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join("；");
      return `检测到红线风险：${hints}。请要求 AI 回到 AI PM 视角并严格事实锚定。`;
    }
    const fabricationCheck = checkPotentialFabrication(optimizeStory, nextFields);
    if (!fabricationCheck.hasRisk && !fabricationCheck.hasMitigatedRisk) return "";
    const hints = [
      fabricationCheck.newNums.length ? `新增数值：${fabricationCheck.newNums.join(", ")}` : "",
      fabricationCheck.newUpper.length ? `新增术语：${fabricationCheck.newUpper.join(", ")}` : "",
      fabricationCheck.newAlpha.length
        ? `新增英文词：${fabricationCheck.newAlpha.slice(0, 10).join(", ")}`
        : "",
    ]
      .filter(Boolean)
      .join("；");
    if (fabricationCheck.hasStrictRisk) {
      return `检测到硬事实风险：${hints}。请点击下方的"事实锚定与推演"按钮，要求 AI 消除幻觉。`;
    }
    if (fabricationCheck.hasMitigatedRisk) {
      return `✅ 硬事实风险已解除：已通过 [推演] 标签锚定新增术语（${fabricationCheck.newUpper
        .concat(fabricationCheck.newAlpha.slice(0, 10))
        .slice(0, 10)
        .join(", ") || "如 OMG, FIX"}）。`;
    }
    return `检测到表达层新增词汇（提示）：${hints}。如属于合理推演，请补 [推演] 标记后再确认应用。`;
  }, [isRiskIgnored, latestOptimizeAssistant, optimizeStory]);
  const optimizeRedlineAutoFixPrompt = useMemo(() => {
    if (!optimizeStory || !latestOptimizeAssistant.trim()) return "";
    if (isRiskIgnored) return "";
    if (hasMitigationTag(latestOptimizeAssistant)) return "";
    const cleaned = stripMarkdownAnchors(latestOptimizeAssistant);
    const parsed = parseOptimizedStoryFields(cleaned, optimizeStory);
    const nextFields = sanitizeOptimizedFields(parsed);
    const redlineCheck = checkRedlineDrift(optimizeStory, nextFields);
    if (!redlineCheck.hasRedline) return "";
    return buildRedlineCorrectionPrompt(redlineCheck);
  }, [isRiskIgnored, latestOptimizeAssistant, optimizeStory]);
  function persistOptimizeSession(story: Story, messages: ChatMessageView[]) {
    if (typeof window === "undefined") return;
    const signature = JSON.stringify(
      messages.map((msg) => ({ role: msg.role, content: msg.content })),
    );
    if (lastPersistedMessageSignatureRef.current === signature) {
      return;
    }
    lastPersistedMessageSignatureRef.current = signature;
    const nextSession: StoryOptimizeSession = {
      storyId: story.id,
      title: story.title,
      messages,
      updatedAt: new Date().toISOString(),
    };
    const prevSession = optimizeSessionRef.current;
    const isSameAsCurrent =
      prevSession &&
      prevSession.storyId === nextSession.storyId &&
      isSameMessages(prevSession.messages, nextSession.messages);
    if (!isSameAsCurrent) {
      optimizeSessionRef.current = nextSession;
      window.setTimeout(() => {
        setOptimizeSession((current) => {
          if (
            current &&
            current.storyId === nextSession.storyId &&
            isSameMessages(current.messages, nextSession.messages)
          ) {
            return current;
          }
          return nextSession;
        });
      }, 0);
    }
    try {
      const raw = window.localStorage.getItem(STORY_OPTIMIZE_SESSIONS_KEY);
      const rows = raw ? (JSON.parse(raw) as StoryOptimizeSession[]) : [];
      const merged = [nextSession, ...rows.filter((row) => row.storyId !== story.id)].slice(0, 80);
      window.localStorage.setItem(STORY_OPTIMIZE_SESSIONS_KEY, JSON.stringify(merged));
    } catch {
      // ignore localStorage errors
    }
  }

  function schedulePersistOptimizeSession(story: Story, messages: ChatMessageView[]) {
    if (typeof window === "undefined") return;
    const browserWindow = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    if (persistIdleIdRef.current !== null && typeof browserWindow.cancelIdleCallback === "function") {
      browserWindow.cancelIdleCallback(persistIdleIdRef.current);
      persistIdleIdRef.current = null;
    }
    if (persistTimeoutIdRef.current !== null) {
      globalThis.clearTimeout(persistTimeoutIdRef.current);
      persistTimeoutIdRef.current = null;
    }
    const run = () => persistOptimizeSession(story, messages);
    if (typeof browserWindow.requestIdleCallback === "function") {
      persistIdleIdRef.current = browserWindow.requestIdleCallback(() => {
        run();
        persistIdleIdRef.current = null;
      });
      return;
    }
    persistTimeoutIdRef.current = globalThis.setTimeout(() => {
      run();
      persistTimeoutIdRef.current = null;
    }, 120);
  }

  useEffect(() => {
    if (!optimizeStory || typeof window === "undefined") {
      return;
    }
    const currentStory = optimizeStory;
    setIsRiskIgnored(false);
    lastOptimizeUserMessageIdRef.current = "";
    let mounted = true;
    async function loadSession() {
      setOptimizeSyncText("");
      let localFound: StoryOptimizeSession | null = null;
      try {
        const raw = window.localStorage.getItem(STORY_OPTIMIZE_SESSIONS_KEY);
        const rows = raw ? (JSON.parse(raw) as StoryOptimizeSession[]) : [];
        localFound = rows.find((row) => row.storyId === currentStory.id) ?? null;
      } catch {
        localFound = null;
      }
      if (mounted) setOptimizeSession(localFound);
      if (mounted) setOptimizeSessionPageId("");
      try {
        const response = await fetch(`/api/notion?resource=coaching-session&module=stories&entityId=${encodeURIComponent(currentStory.id)}&limit=1`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          records?: Array<{ id?: string; messageJson?: string; createdDate?: string }>;
        };
        const first = Array.isArray(payload.records) ? payload.records[0] : undefined;
        if (!first?.messageJson) return;
        const parsed = toSafeMessages(JSON.parse(first.messageJson));
        if (!parsed.length || !mounted) return;
        const fromNotion: StoryOptimizeSession = {
          storyId: currentStory.id,
          title: currentStory.title,
          messages: parsed,
          updatedAt: first.createdDate || new Date().toISOString(),
        };
        setOptimizeSession(fromNotion);
        setOptimizeSessionPageId(first.id ?? "");
        setOptimizeSyncText("已从 Notion 恢复会话。");
        persistOptimizeSession(currentStory, parsed);
      } catch {
        // ignore Notion load failure and keep local
      }
    }
    void loadSession();
    return () => {
      mounted = false;
    };
  }, [optimizeStory]);

  useEffect(() => {
    if (!optimizeStory) return;
    let mounted = true;
    async function loadJDOptions() {
      try {
        const response = await fetch("/api/notion?resource=jd", { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = (await response.json()) as { records?: JDOption[] };
        const records = Array.isArray(payload.records) ? payload.records : [];
        if (!mounted) return;
        setJdOptions(records);
        setSelectedTargetJobId((prev) => prev || records[0]?.id || "");
      } catch {
        if (!mounted) return;
        setJdOptions([]);
        setSelectedTargetJobId("");
      }
    }
    void loadJDOptions();
    return () => {
      mounted = false;
    };
  }, [optimizeStory]);

  const clearOptimizeSession = (storyId: string) => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORY_OPTIMIZE_SESSIONS_KEY);
      const rows = raw ? (JSON.parse(raw) as StoryOptimizeSession[]) : [];
      const merged = rows.filter((row) => row.storyId !== storyId);
      window.localStorage.setItem(STORY_OPTIMIZE_SESSIONS_KEY, JSON.stringify(merged));
    } catch {
      // ignore
    }
    setOptimizeSession(null);
    setOptimizeSessionPageId("");
    setPendingOptimizedFields(null);
    setSelectedApplyFields([]);
    setLastRollbackSnapshot(null);
    setOptimizeSyncText("已清空本地会话。");
  };

  const syncOptimizeSessionToNotion = async (
    story: Story,
    messages: ChatMessageView[],
    applied = false,
  ) => {
    if (!messages.length) return;
    setSyncingOptimizeSession(true);

    toastFetch(
      "/api/story/sync",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId: story.id,
          messages,
          applied,
        }),
      },
      {
        loading: "正在同步至 Notion...",
        success: (data) => {
          const payload = data as { storedDefenseCount?: number; storedVersions?: { standard?: boolean; ninetySec?: boolean; custom?: boolean } } | null;
          const versions = payload?.storedVersions;
          const parts: string[] = [];
          if (versions?.standard) parts.push("标准优化版");
          if (versions?.ninetySec) parts.push("90秒口述版本");
          if (versions?.custom) parts.push("岗位定制版");
          const defenseText = typeof payload?.storedDefenseCount === "number" && payload.storedDefenseCount > 0 ? `（防御卡片：${payload.storedDefenseCount}）` : "";
          return `✅ ${applied ? "会话已同步到 Notion" : "同步到 Notion"}（已提取：${parts.length ? parts.join("、") : "未检测到指定锚点模块"}）${defenseText}`;
        },
        error: (err) => `❌ 同步 Notion 失败：${err.message}，已保留本地会话。`,
      },
      () => {
        setSyncingOptimizeSession(false);
      },
    );
  };

  const applyOptimizedFieldsToStory = async (
    story: Story,
    sessionMessages: ChatMessageView[],
    nextFields: OptimizedStoryFields,
  ) => {
    if (!selectedApplyFields.length) {
      setOptimizeSyncText("请至少勾选 1 个要应用的字段。");
      return;
    }
    const selectedFields = mergeStoryFieldsBySelection(
      story,
      nextFields,
      selectedApplyFields,
    );
    const beforeSnapshot: OptimizedStoryFields = {
      situation: story.situation,
      task: story.task,
      action: story.action,
      result: story.result,
      earnedSecret: story.earnedSecret,
    };
    setApplyingOptimizeResult(true);

    toastFetch(
      "/api/notion/stories",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId: story.id,
          title: story.title,
          situation: selectedFields.situation,
          task: selectedFields.task,
          actionText: selectedFields.action,
          result: selectedFields.result,
          earnedSecret: selectedFields.earnedSecret,
          tags: story.tags,
          strength: story.strength,
        }),
      },
      {
        loading: "正在应用优化字段到 Notion...",
        success: "✅ 已应用到故事字段，并标记 Applied",
        error: (err) => `❌ 应用失败：${err.message}`,
      },
      () => {
        const merged: Story = {
          ...story,
          ...selectedFields,
          action: selectedFields.action,
          aiCachedViews: {},
        };
        setStories((prev) => prev.map((row) => (row.id === merged.id ? merged : row)));
        setOptimizeStory(merged);
        setLastRollbackSnapshot({
          storyId: story.id,
          before: beforeSnapshot,
          after: selectedFields,
          changedKeys: selectedApplyFields,
          createdAt: new Date().toISOString(),
        });
        void syncOptimizeSessionToNotion(merged, sessionMessages, true);
        setOptimizeSyncText("已应用到故事字段，并标记 Applied。");
        setPendingOptimizedFields(null);
        setSelectedApplyFields([]);
      },
      () => {
        setApplyingOptimizeResult(false);
      },
    );
  };

  const rollbackLastAppliedFields = async () => {
    if (!optimizeStory || !optimizeSession?.messages?.length || !lastRollbackSnapshot) {
      setOptimizeSyncText("暂无可回滚的应用记录。");
      return;
    }
    if (lastRollbackSnapshot.storyId !== optimizeStory.id) {
      setOptimizeSyncText("当前故事与快照不一致，无法回滚。");
      return;
    }
    setApplyingOptimizeResult(true);
    toastFetch(
      "/api/notion/stories",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId: optimizeStory.id,
          title: optimizeStory.title,
          situation: lastRollbackSnapshot.before.situation,
          task: lastRollbackSnapshot.before.task,
          actionText: lastRollbackSnapshot.before.action,
          result: lastRollbackSnapshot.before.result,
          earnedSecret: lastRollbackSnapshot.before.earnedSecret,
          tags: optimizeStory.tags,
          strength: optimizeStory.strength,
        }),
      },
      {
        loading: "正在回滚故事字段...",
        success: "✅ 已回滚到应用前版本",
        error: (err) => `❌ 回滚失败：${err.message}`,
      },
      () => {
        const rolledBack: Story = {
          ...optimizeStory,
          ...lastRollbackSnapshot.before,
          action: lastRollbackSnapshot.before.action,
          aiCachedViews: {},
        };
        setStories((prev) => prev.map((row) => (row.id === rolledBack.id ? rolledBack : row)));
        setOptimizeStory(rolledBack);
        void syncOptimizeSessionToNotion(rolledBack, optimizeSession.messages, false);
        setOptimizeSyncText("已回滚到应用前版本，并同步 Applied=false。");
        setLastRollbackSnapshot(null);
        setApplyingOptimizeResult(false);
      },
    );
  };

  const prepareApplyOptimizeResult = () => {
    if (!optimizeStory) {
      setOptimizeSyncText("当前没有选中的故事，请先打开一条故事的 AI 优化面板。");
      return;
    }
    if (applyingOptimizeResult) {
      setOptimizeSyncText("正在处理上一次应用，请稍候。");
      return;
    }
    if (!optimizeSession?.messages?.length) {
      setOptimizeSyncText("当前还没有优化会话内容，请先让教练生成优化建议。");
      return;
    }
    const latestAssistant = [...optimizeSession.messages]
      .reverse()
      .find((msg) => msg.role === "assistant")?.content;
    if (!latestAssistant?.trim()) {
      setOptimizeSyncText("还没有教练建议，先让 AI 输出优化稿。");
      return;
    }
    const cleanedAssistant = stripMarkdownAnchors(latestAssistant);
    const parsed = parseOptimizedStoryFields(cleanedAssistant, optimizeStory);
    const nextFields = sanitizeOptimizedFields(parsed);
    const redlineCheck = checkRedlineDrift(optimizeStory, nextFields);
    const isMitigated = hasMitigationTag(latestAssistant);
    if (redlineCheck.hasRedline && !isMitigated && !isRiskIgnored) {
      const hints = [
        redlineCheck.newSuspiciousTerms.length
          ? `疑似新增技术实现：${redlineCheck.newSuspiciousTerms.join(", ")}`
          : "",
        redlineCheck.roleDrifts.length
          ? `疑似角色漂移：${redlineCheck.roleDrifts.join(", ")}`
          : "",
        redlineCheck.inventedEntitySignals.length
          ? `新增术语：${redlineCheck.inventedEntitySignals.join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join("；");
      setOptimizeSyncText(`检测到红线风险，已阻止直接应用。${hints}。请先让 AI 严格按原始事实重写。`);
      return;
    }
    const fabricationCheck = checkPotentialFabrication(optimizeStory, nextFields);
    if (fabricationCheck.hasStrictRisk) {
      const hints = [
        fabricationCheck.newNums.length
          ? `新增数值：${fabricationCheck.newNums.join(", ")}`
          : "",
        fabricationCheck.newUpper.length
          ? `新增术语：${fabricationCheck.newUpper.join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join("；");
      setOptimizeSyncText(
        `检测到硬事实风险，已阻止直接应用。${hints}。请先点“仅输出优化后STAR”并要求“事实锚定，推演需标 [推演]”。`,
      );
      return;
    }
    const changed = getChangedStoryFields(optimizeStory, nextFields);
    if (!changed.length) {
      setOptimizeSyncText("解析后没有检测到变更内容，暂不覆盖。");
      return;
    }
    if (hasReviewNoise(nextFields)) {
      setOptimizeSyncText(
        "当前输出混入了点评/追问内容，不是可直接替换的 STAR。请让教练重新输出“优化后STAR”后再应用。",
      );
      return;
    }
    setPendingOptimizedFields(nextFields);
    setSelectedApplyFields(changed.map((item) => item.key as StoryFieldKey));
    setOptimizeSyncText(`已生成预览，共 ${changed.length} 处变更，确认后再写入。`);
  };

  const triggerQuickAction = (action: OptimizeQuickAction) => {
    if (optimizeChatLoading || optimizeQuickLockRef.current) {
      setOptimizeToast("正在生成回复，请稍候");
      return;
    }
    optimizeQuickLockRef.current = true;
    setIsRiskIgnored(false);
    if (action.id === "jd-oriented-rewrite") {
      if (!selectedTargetJob) {
        setOptimizeToast("请先选择绑定的目标岗位");
        return;
      }
      const resolved = resolveJDDetailsForPrompt(selectedTargetJob);
      const promptWithTarget = [
        action.prompt,
        "",
        `目标岗位标题：${selectedTargetJob.title || "（未命名）"}`,
        `核心职责：${resolved.coreResponsibilities || "（未提供）"}`,
        `隐含期望：${resolved.implicitExpectations || "（未提供）"}`,
        `匹配总结：${resolved.fitSummary || "（未提供）"}`,
        `关键差距：${resolved.keyGaps || "（未提供）"}`,
        "请基于以上目标岗位偏好重写，不要泛化。",
      ].join("\n");
      setQuickActionPrompt(promptWithTarget);
      setQuickActionNonce((prev) => prev + 1);
      setOptimizeSyncText(`已发送快捷指令：${action.label}（${selectedTargetJob.title || "目标岗位"}）`);
      return;
    }
    setQuickActionPrompt(action.prompt);
    setQuickActionNonce((prev) => prev + 1);
    setOptimizeSyncText(`已发送快捷指令：${action.label}`);
  };

  const saveDerivedView = async (
    story: Story,
    viewKey: string,
    content: string,
  ) => {
    const trimmed = extractDerivedViewContent(content, viewKey).trim();
    if (!trimmed) {
      setOptimizeSyncText("当前没有可保存的衍生内容。");
      return false;
    }
    const mergedViews = {
      ...(story.aiCachedViews ?? {}),
      [viewKey]: trimmed,
    };
    setSavingDerivedView(true);
    return new Promise<boolean>((resolve) => {
      toastFetch(
        "/api/notion/stories",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "cached-views",
            pageId: story.id,
            aiCachedViews: mergedViews,
          }),
        },
        {
          loading: "正在保存衍生视图...",
          success: "✅ 衍生视图已保存到 Notion",
          error: (err) => `❌ 保存衍生视图失败：${err.message}`,
        },
        () => {
          setStories((prev) =>
            prev.map((row) =>
              row.id === story.id
                ? { ...row, aiCachedViews: mergedViews }
                : row,
            ),
          );
          if (optimizeStory?.id === story.id) {
            setOptimizeStory({ ...optimizeStory, aiCachedViews: mergedViews });
          }
          setOptimizeSyncText("衍生视图已保存到 Notion。");
          setSavingDerivedView(false);
          resolve(true);
        },
      );
    });
  };

  const onSubmit = async () => {
    if (saving) {
      return;
    }
    if (
      !form.title.trim() ||
      !form.situation.trim() ||
      !form.task.trim() ||
      !form.actionText.trim() ||
      !form.result.trim() ||
      !form.earnedSecret.trim()
    ) {
      setStatus("请完整填写 STAR + Earned Secret");
      return;
    }
    setSaving(true);

    const commonPayload = {
      resource: "stories",
      title: form.title.trim(),
      situation: form.situation.trim(),
      task: form.task.trim(),
      actionText: form.actionText.trim(),
      result: form.result.trim(),
      earnedSecret: form.earnedSecret.trim(),
      tags: form.tags,
      strength: form.strength,
    };

    toastFetch(
      "/api/notion",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isEditing
            ? {
                action: "update",
                pageId: currentEditingId,
                properties: {
                  Title: { title: [{ text: { content: commonPayload.title } }] },
                  Situation: { rich_text: [{ text: { content: commonPayload.situation } }] },
                  Task: { rich_text: [{ text: { content: commonPayload.task } }] },
                  Action: { rich_text: [{ text: { content: commonPayload.actionText } }] },
                  Result: { rich_text: [{ text: { content: commonPayload.result } }] },
                  "Earned Secret": { rich_text: [{ text: { content: commonPayload.earnedSecret } }] },
                  Tags: { multi_select: commonPayload.tags.map((tag) => ({ name: tag })) },
                  Strength: { number: commonPayload.strength },
                },
              }
            : {
                action: "create",
                ...commonPayload,
              }),
        }),
      },
      {
        loading: isEditing ? "正在更新 Notion StoryBank..." : "正在写入 Notion StoryBank...",
        success: isEditing ? "✅ 故事已更新" : "✅ 故事已保存到 Notion",
        error: (err) => `❌ ${isEditing ? "更新" : "保存"}失败：${err.message}`,
      },
      () => {
        void refreshStories();
        setForm(initialForm);
        setCurrentEditingId(null);
        setShowForm(false);
        setStatus(isEditing ? "故事已更新" : "故事已保存到 Notion");
      },
    );

    setSaving(false);
  };

  const onDeleteStory = async (story: Story) => {
    const ok = window.confirm("确定要删除这条记录吗？");
    if (!ok) {
      return;
    }

    toastFetch(
      "/api/notion",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          pageId: story.id,
        }),
      },
      {
        loading: "正在删除故事...",
        success: "✅ 故事已删除",
        error: (err) => `❌ 删除失败：${err.message}`,
      },
      () => {
        setStories((prev) => prev.filter((item) => item.id !== story.id));
        if (currentEditingId === story.id) {
          setCurrentEditingId(null);
          setForm(initialForm);
          setShowForm(false);
        }
        setStatus("故事已删除");
      },
    );
  };

  const onOpenStressRoom = (story: Story) => {
    setStressStory(story);
    setStressMessages([]);
    setStressPersona("technical");
    setArchivingStressSession(false);
    setStressKickoffPrompt("请开始技术深挖轮。");
    setStressKickoffNonce((prev) => prev + 1);
    setStressNotice("Staff Engineer 已加入对话，请准备防守。");
    setStressContextExpanded(false);
  };

  const triggerStressPersona = (persona: StressPersona) => {
    if (stressChatLoading) {
      setStressNotice("正在生成回复，请稍候");
      return;
    }
    if (isStressPersonaLocked && persona !== stressPersona) {
      setStressNotice("当前拷问轮次已锁定人设，结束本轮后再切换。");
      return;
    }
    if (isAwaitingStressAnswer) {
      setStressNotice("请先回答当前问题，再切换考官模式。");
      return;
    }
    setStressPersona(persona);
    if (persona === "technical") {
      setStressKickoffPrompt("请开始技术深挖（Technical）模式拷问。");
      setStressNotice("Staff Engineer 已加入对话，请准备防守。");
    } else if (persona === "execution") {
      setStressKickoffPrompt("请开始数据质疑（Execution）模式拷问。");
      setStressNotice("Data Science Lead 已加入对话，请准备防守。");
    } else {
      setStressKickoffPrompt("请开始压力面（Behavioral）模式拷问。");
      setStressNotice("Behavioral Lead 已加入对话，请准备防守。");
    }
    setStressKickoffNonce((prev) => prev + 1);
  };

  const onArchiveStressSession = async () => {
    if (!stressStory) return;
    const qaPairs = stressArchivePreview ?? extractQAPairs(stressMessages);
    if (qaPairs.length === 0) {
      setStatus("暂无可存档的一问一答，请先完成至少一轮追问。");
      return;
    }
    setArchivingStressSession(true);
    toastFetch(
      "/api/notion",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resource: "stories",
          action: "append-defense",
          pageId: stressStory.id,
          title: stressStory.title,
          persona: stressPersona,
          qaPairs,
        }),
      },
      {
        loading: "正在将防守记录归档至 Notion...",
        success: "✅ 已将防守记录永久归档至 Notion",
        error: (err) => `❌ 存档失败：${err.message}`,
      },
      () => {
        setStatus("已将防守记录永久归档至 Notion。");
        setStressNotice("已将防守记录永久归档至 Notion。");
        setStressStory(null);
        setStressMessages([]);
        setStressArchivePreview(null);
      },
    );
    setArchivingStressSession(false);
  };

  return (
    <main className="flex w-full flex-col gap-4">
      <section className="neon-card rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold">故事库管理</h1>
            <p className="mt-2 text-sm text-zinc-400">
              面试的弹药库。把你的工作经历按 STAR 结构沉淀成可复用的故事素材。
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setCurrentEditingId(null);
              setForm(initialForm);
              setShowForm(true);
            }}
            className="rounded-lg border border-violet-500/45 bg-violet-500/15 px-3 py-2 text-sm text-violet-100 transition hover:bg-violet-500/25"
          >
            添加故事
          </button>
        </div>
        <p className={`mt-3 text-xs ${statusIsError ? "text-red-300" : "text-zinc-500"}`}>{status}</p>
      </section>
      <PageGuide
        pageKey="stories"
        items={[
          "点击“添加故事”，按 场景（Situation）→ 任务（Task）→ 行动（Action）→ 结果（Result）→ 关键洞察（Earned Secret） 填写。",
          "给每个故事打标签（如 领导力 Leadership / 创新推动 Innovation）并设置强度评分。",
          "建议至少准备 5 个高强度（4+）故事覆盖不同标签。",
          "点“AI 优化”让教练从面试官视角给出改进建议。",
          "模拟面试时 AI 会自动引用你的故事库出题。",
        ]}
      />

      <section className="grid gap-3">
        <article className="neon-card rounded-xl p-4">
          <h3 className="text-sm font-semibold text-zinc-100">故事检索训练（Retrieval Drill）</h3>
          <p className="mt-1 text-xs text-zinc-500">输入问题后 10 秒内选故事，系统按 高匹配（Strong Fit）/ 可用（Workable）/ 可拉伸（Stretch）/ 缺口（Gap） 给映射建议。</p>
          <div className="mt-2 flex gap-2">
            <label className="sr-only">检索问题</label>
            <input value={retrievalQuestion} onChange={(e) => setRetrievalQuestion(e.target.value)} placeholder="例如：讲一次你处理质疑的经历" className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" />
            <button
              onClick={() => runRetrievalDrill(retrievalQuestion)}
              className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100"
            >
              运行检索
            </button>
            <button
              type="button"
              onClick={() => {
                void handleRandomChallenge();
              }}
              disabled={loadingRandomChallenge}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 transition hover:border-zinc-500 disabled:opacity-60"
            >
              {loadingRandomChallenge ? "抽题中..." : "🎲 随机奇葩问题"}
            </button>
          </div>
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-[11px]">
              <span className={retrievalCountdownExpired ? "text-rose-300" : "text-zinc-500"}>
                {retrievalCountdownExpired
                  ? "思考时间已耗尽，请立刻进入作答。"
                  : retrievalCountdownActive
                    ? `思考倒计时：${retrievalCountdown} 秒`
                    : "点击“运行检索”后开始 10 秒思考倒计时。"}
              </span>
              <span className={retrievalCountdownExpired ? "text-rose-300" : "text-zinc-500"}>
                {retrievalCountdownActive ? `${retrievalCountdown}s` : retrievalCountdownExpired ? "TIME OUT" : "10s"}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-900">
              <div
                className={`h-full transition-all duration-1000 ${
                  retrievalCountdownExpired ? "bg-rose-500" : retrievalCountdownActive ? "bg-amber-400" : "bg-cyan-500/70"
                }`}
                style={{
                  width: `${
                    retrievalCountdownExpired
                      ? 100
                      : retrievalCountdownActive
                        ? (retrievalCountdown / RETRIEVAL_DRILL_SECONDS) * 100
                        : 100
                  }%`,
                }}
              />
            </div>
          </div>
          <p className="mt-2 text-sm text-zinc-300">{retrievalResult || "点击“运行检索”后，这里会显示匹配等级、命中故事和使用建议。"}</p>
          {retrievalScript ? (
            <div className="mt-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3">
              <p className="text-xs text-cyan-200">可直接口述逐字稿（可按你语速微调）</p>
              <p className="mt-1 text-sm leading-6 text-cyan-50">{retrievalScript}</p>
            </div>
          ) : null}
          <p className="mt-2 text-xs text-zinc-500">叙事身份主题：{themeSummary.join(" / ") || "暂无"}</p>
        </article>
        <article className="neon-card rounded-xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-zinc-500">按标签筛选候选故事（可多选）</p>
            {retrievalMatchedStoryId ? (
              <button
                type="button"
                onClick={() => setShowMatchedOnly((prev) => !prev)}
                className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-100 transition hover:bg-cyan-500/20"
              >
                {showMatchedOnly ? "显示全部卡片" : "只看命中卡片"}
              </button>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {retrievalTagStats.map(([tag, count]) => {
              const active = selectedRetrievalTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() =>
                    setSelectedRetrievalTags((prev) =>
                      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag],
                    )
                  }
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    active
                      ? "border-cyan-300/80 bg-cyan-500/25 text-cyan-50 shadow-[0_0_20px_rgba(34,211,238,0.35)]"
                      : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500"
                  }`}
                >
                  {tagLabels[tag as StoryTag] ?? tag}（{count}）
                </button>
              );
            })}
            {selectedRetrievalTags.length > 0 ? (
              <button
                type="button"
                onClick={() => setSelectedRetrievalTags([])}
                className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-300 transition hover:border-zinc-500"
              >
                清空标签筛选
              </button>
            ) : null}
          </div>
        </article>
        {loading ? (
          <div className="neon-card rounded-xl p-4 text-sm text-zinc-400">加载中...</div>
        ) : displayedStories.length === 0 ? (
          <div className="neon-card rounded-xl p-4 text-sm text-zinc-400">
            你的弹药库还是空的。点击「添加故事」开始准备面试素材。
          </div>
        ) : (
          displayedStories.map((story) => {
            const expanded = expandedId === story.id;
            const activeTab = storyViewTabs[story.id] ?? "base";
            const cached90s = story.aiCachedViews?.[STORY_VIEW_90S_KEY] ?? "";
            return (
              <article
                key={story.id}
                className={`neon-card rounded-xl p-4 ${
                  retrievalMatchedStoryId === story.id ? "border border-cyan-400/40" : ""
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold text-zinc-100">{story.title}</h3>
                    <p className="mt-1 text-xs text-zinc-500">
                      标签：{story.tags.map((tag) => tagLabels[tag as StoryTag] ?? tag).join(", ") || "未标注"} | 强度：{story.strength}/5 | 使用次数：
                      {/* TODO(story-usage): 当 mock/evaluate 中被 AI 引用到该故事时，回写 useCount +1，用于后续“故事疲劳度”预警 */}
                      {story.useCount}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : story.id)}
                      className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-500"
                    >
                      {expanded ? "收起" : "展开 STAR"}
                    </button>
                    <button
                      type="button"
                      onClick={() => openOptimizeModal(story)}
                      className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-100 transition hover:bg-cyan-500/20"
                    >
                      AI 优化
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenStressRoom(story)}
                      className="rounded-lg border border-orange-500/45 bg-orange-500/15 px-3 py-1.5 text-xs font-semibold text-orange-100 transition hover:bg-orange-500/25"
                    >
                      🔥 深度拷问
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentEditingId(story.id);
                        setForm({
                          title: story.title,
                          situation: story.situation,
                          task: story.task,
                          actionText: story.action,
                          result: story.result,
                          earnedSecret: story.earnedSecret,
                          tags: story.tags.filter((tag): tag is StoryTag =>
                            tagOptions.includes(tag as StoryTag),
                          ),
                          strength: story.strength,
                        });
                        setShowForm(true);
                      }}
                      className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-100 transition hover:bg-amber-500/20"
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteStory(story)}
                      className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-100 transition hover:bg-rose-500/20"
                    >
                      删除
                    </button>
                  </div>
                </div>
                {expanded ? (
                  <div className="mt-3 grid gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-sm text-zinc-300">
                    <div className="mb-1 flex flex-wrap gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setStoryViewTabs((prev) => ({ ...prev, [story.id]: "base" }))}
                        className={`rounded-md border px-2 py-1 transition ${
                          activeTab === "base"
                            ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-100"
                            : "border-zinc-700 bg-zinc-900 text-zinc-300"
                        }`}
                      >
                        基础 STAR
                      </button>
                      <button
                        type="button"
                        onClick={() => setStoryViewTabs((prev) => ({ ...prev, [story.id]: "derived90s" }))}
                        className={`rounded-md border px-2 py-1 transition ${
                          activeTab === "derived90s"
                            ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-100"
                            : "border-zinc-700 bg-zinc-900 text-zinc-300"
                        }`}
                      >
                        90秒口述
                      </button>
                    </div>
                    {activeTab === "base" ? (
                      <>
                        <p><span className="text-zinc-100">场景（Situation）:</span> {story.situation}</p>
                        <p><span className="text-zinc-100">任务（Task）:</span> {story.task}</p>
                        <p><span className="text-zinc-100">行动（Action）:</span> {story.action}</p>
                        <p><span className="text-zinc-100">结果（Result）:</span> {story.result}</p>
                        <p><span className="text-zinc-100">关键洞察（Earned Secret）:</span> {story.earnedSecret}</p>
                      </>
                    ) : activeTab === "derived90s" ? (
                      cached90s ? (
                        <div className="prose prose-invert prose-p:my-1 max-w-none text-sm text-zinc-200">
                          <ReactMarkdown>{cached90s}</ReactMarkdown>
                        </div>
                      ) : (
                        <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3 text-xs text-zinc-400">
                          <p>暂无 90 秒口述视图。</p>
                          <button
                            type="button"
                            onClick={() => {
                              setOptimizeStory(story);
                              triggerQuickAction(optimizeQuickActions.find((a) => a.id === "fact-anchor") ?? optimizeQuickActions[0]);
                            }}
                            className="mt-2 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-100"
                          >
                            点击生成
                          </button>
                        </div>
                      )
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </section>

      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="neon-card w-full max-w-2xl rounded-2xl p-5">
            <h3 className="text-lg font-semibold text-zinc-100">
              {isEditing ? "编辑故事（STAR）" : "添加故事（STAR）"}
            </h3>
            <div className="mt-3 grid gap-2">
              <button
                type="button"
                onClick={() => setShowSmartPasteModal((prev) => !prev)}
                className="mb-1 rounded-lg border border-fuchsia-500/45 bg-fuchsia-500/10 px-3 py-2 text-sm font-medium text-fuchsia-100 transition hover:bg-fuchsia-500/20"
              >
                ✨ 智能粘贴解析
              </button>
              {showSmartPasteModal ? (
                <div className="mb-1 rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/5 p-3">
                  <textarea
                    value={smartPasteInput}
                    onChange={(event) => setSmartPasteInput(event.target.value)}
                    placeholder="粘贴你的面试回忆、面经、或长段文字，AI 将自动帮你拆解填入下方表单..."
                    className="min-h-44 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100"
                  />
                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowSmartPasteModal(false);
                        setSmartPasteInput("");
                      }}
                      className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 transition hover:border-zinc-500"
                    >
                      收起
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void handleSmartExtractStory();
                      }}
                      disabled={smartExtracting}
                      className="rounded-lg border border-fuchsia-500/45 bg-fuchsia-500/15 px-3 py-2 text-sm text-fuchsia-100 transition hover:bg-fuchsia-500/25 disabled:opacity-50"
                    >
                      {smartExtracting ? <span className="loading-dots">正在智能拆解...</span> : "开始解析"}
                    </button>
                  </div>
                </div>
              ) : null}
              <p className="text-xs text-zinc-500">标题</p>
              <input
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="标题"
                className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
              />
              <p className="text-xs text-zinc-500">场景（Situation）</p>
              <textarea
                value={form.situation}
                onChange={(event) => setForm((prev) => ({ ...prev, situation: event.target.value }))}
                placeholder="场景（Situation）"
                className="min-h-16 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
              />
              <p className="text-xs text-zinc-500">任务（Task）</p>
              <textarea
                value={form.task}
                onChange={(event) => setForm((prev) => ({ ...prev, task: event.target.value }))}
                placeholder="任务（Task）"
                className="min-h-14 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
              />
              <p className="text-xs text-zinc-500">行动（Action）</p>
              <textarea
                value={form.actionText}
                onChange={(event) => setForm((prev) => ({ ...prev, actionText: event.target.value }))}
                placeholder="行动（Action）"
                className="min-h-16 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
              />
              <p className="text-xs text-zinc-500">结果（Result）</p>
              <textarea
                value={form.result}
                onChange={(event) => setForm((prev) => ({ ...prev, result: event.target.value }))}
                placeholder="结果（Result）"
                className="min-h-16 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
              />
              <p className="text-xs text-zinc-500">关键洞察（Earned Secret）</p>
              <textarea
                value={form.earnedSecret}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, earnedSecret: event.target.value }))
                }
                placeholder="关键洞察（Earned Secret）"
                className="min-h-16 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
              />

              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-2">
                <p className="mb-2 text-xs text-zinc-500">标签</p>
                <div className="flex flex-wrap gap-2">
                  {tagOptions.map((tag) => {
                    const active = form.tags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            tags: active ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag],
                          }))
                        }
                        className={`rounded-full border px-3 py-1 text-xs transition ${
                          active
                            ? "border-violet-400/60 bg-violet-500/20 text-violet-100"
                            : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                        }`}
                      >
                        {tagLabels[tag]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="text-xs text-zinc-500">
                强度评分：{form.strength}/5
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={form.strength}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, strength: Number(event.target.value) }))
                  }
                  className="mt-1 w-full"
                />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onSubmit}
                disabled={saving}
                className="rounded-lg border border-violet-500/45 bg-violet-500/15 px-3 py-2 text-sm text-violet-100 transition hover:bg-violet-500/25 disabled:opacity-50"
              >
                {saving ? "提交中..." : isEditing ? "保存修改" : "提交到 Notion"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setCurrentEditingId(null);
                  setForm(initialForm);
                }}
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 transition hover:border-zinc-500"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {stressStory ? (
        <div className="fixed inset-0 z-[55] bg-black/60">
          <div className="ml-auto flex h-full w-full max-w-[1000px] flex-col border-l border-zinc-700/70 bg-zinc-950 p-4">
            <div className="neon-card rounded-xl p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-orange-100">🔥 深度拷问作战室</p>
                  <p className="text-xs text-zinc-400">{stressStory.title}</p>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    标签：{stressStory.tags.join(", ") || "未标注"} ｜ 强度：{stressStory.strength}/5
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const qaPairs = extractQAPairs(stressMessages);
                      if (qaPairs.length === 0) {
                        setStatus("暂无可存档的一问一答，请先完成至少一轮追问。");
                        return;
                      }
                      setStressArchivePreview(qaPairs);
                    }}
                    disabled={archivingStressSession || stressChatLoading}
                    className="rounded-md border border-orange-500/45 bg-orange-500/20 px-2 py-1 text-xs font-semibold text-orange-100 transition hover:bg-orange-500/30 disabled:opacity-50"
                  >
                    {archivingStressSession ? <span className="loading-dots">存档中</span> : "结束拷问并存档"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStressContextExpanded((prev) => !prev)}
                    className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300"
                  >
                    {stressContextExpanded ? "收起底稿" : "展开底稿"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!archivingStressSession) {
                        setStressStory(null);
                        setStressArchivePreview(null);
                        setStressNotice("");
                      }
                    }}
                    className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300"
                  >
                    关闭
                  </button>
                </div>
              </div>
              {stressContextExpanded ? (
                <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900/60 p-2 text-xs text-zinc-300 whitespace-pre-wrap">
                  {buildStressStorySummary(stressStory)}
                </div>
              ) : null}
              {stressNotice ? (
                <div className="mt-2 rounded-lg border border-orange-500/35 bg-orange-500/10 px-2 py-1.5 text-xs text-orange-200">
                  {stressNotice}
                </div>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => triggerStressPersona("technical")}
                  disabled={
                    stressChatLoading ||
                    ((isAwaitingStressAnswer || isStressPersonaLocked) && stressPersona !== "technical")
                  }
                  className={`rounded-full border px-3 py-1.5 text-[11px] transition disabled:cursor-not-allowed disabled:opacity-45 ${
                    stressPersona === "technical"
                      ? "border-orange-400/60 bg-orange-500/20 text-orange-100 hover:border-orange-400/80"
                      : "border-zinc-700 bg-zinc-900 text-orange-200 hover:border-orange-500/50 hover:text-orange-100"
                  }`}
                >
                  🔥 开启技术深挖 (Technical)
                </button>
                <button
                  type="button"
                  onClick={() => triggerStressPersona("execution")}
                  disabled={
                    stressChatLoading ||
                    ((isAwaitingStressAnswer || isStressPersonaLocked) && stressPersona !== "execution")
                  }
                  className={`rounded-full border px-3 py-1.5 text-[11px] transition disabled:cursor-not-allowed disabled:opacity-45 ${
                    stressPersona === "execution"
                      ? "border-orange-400/60 bg-orange-500/20 text-orange-100 hover:border-orange-400/80"
                      : "border-zinc-700 bg-zinc-900 text-orange-200 hover:border-orange-500/50 hover:text-orange-100"
                  }`}
                >
                  🔥 开启数据质疑 (Execution)
                </button>
                <button
                  type="button"
                  onClick={() => triggerStressPersona("behavioral")}
                  disabled={
                    stressChatLoading ||
                    ((isAwaitingStressAnswer || isStressPersonaLocked) && stressPersona !== "behavioral")
                  }
                  className={`rounded-full border px-3 py-1.5 text-[11px] transition disabled:cursor-not-allowed disabled:opacity-45 ${
                    stressPersona === "behavioral"
                      ? "border-rose-400/60 bg-rose-500/20 text-rose-100 hover:border-rose-400/80"
                      : "border-zinc-700 bg-zinc-900 text-rose-200 hover:border-rose-500/50 hover:text-rose-100"
                  }`}
                >
                  🔥 开启压力面 (Behavioral)
                </button>
              </div>
            </div>

            <div className="mt-3 min-h-0 flex-1">
              <ChatPanel
                key={`${stressStory.id}-${stressPersona}`}
                systemPrompt={stressPrompt}
                modelType="deep"
                programmaticUserMessage={stressKickoffPrompt}
                programmaticMessageNonce={stressKickoffNonce}
                hideProgrammaticUserBubble
                inputPlaceholder="回答当前追问，尽量给出动作/数据/时间细节..."
                emptyStateText="正在加载拷问会话..."
                onMessagesChange={setStressMessages}
                onLoadingChange={setStressChatLoading}
                heightClassName="h-full"
                immersiveLayout
                maxWidthClassName="max-w-[1000px]"
              />
            </div>
          </div>
        </div>
      ) : null}
      {stressStory && stressArchivePreview ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/65 p-4">
          <div className="neon-card w-full max-w-3xl rounded-2xl p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-100">存档前确认：本轮 Q&A（{stressArchivePreview.length} 组）</h3>
              <button
                type="button"
                disabled={archivingStressSession}
                onClick={() => setStressArchivePreview(null)}
                className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300"
              >
                关闭
              </button>
            </div>
            <div className="max-h-[52vh] space-y-2 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
              {stressArchivePreview.map((pair, idx) => (
                <div key={`${idx}-${pair.question.slice(0, 16)}`} className="rounded-lg border border-zinc-800/70 bg-zinc-950/60 p-2">
                  <p className="text-xs font-medium text-orange-200">Q{idx + 1}: {pair.question}</p>
                  <p className="mt-1 whitespace-pre-wrap text-xs text-zinc-300">A: {pair.answer}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                disabled={archivingStressSession}
                onClick={() => setStressArchivePreview(null)}
                className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300"
              >
                取消
              </button>
              <button
                type="button"
                disabled={archivingStressSession}
                onClick={() => {
                  void onArchiveStressSession();
                }}
                className="rounded-md border border-orange-500/45 bg-orange-500/20 px-3 py-1.5 text-xs font-semibold text-orange-100 disabled:opacity-50"
              >
                {archivingStressSession ? <span className="loading-dots">存档中</span> : "确认存档到 Notion"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {optimizeStory ? (
        <div className="fixed inset-0 z-50 bg-black/60">
          <div className="ml-auto flex h-full w-full max-w-[1000px] flex-col border-l border-zinc-700/70 bg-zinc-950 p-4">
            <div className="neon-card rounded-xl p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-zinc-300">AI 优化：{optimizeStory.title}</p>
                <div className="flex items-center gap-2">
                  {lastRollbackSnapshot && lastRollbackSnapshot.storyId === optimizeStory.id ? (
                    <button
                      type="button"
                      onClick={rollbackLastAppliedFields}
                      disabled={applyingOptimizeResult || syncingOptimizeSession}
                      className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-100 disabled:opacity-50"
                    >
                      {applyingOptimizeResult ? "处理中..." : "回滚上次应用"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={prepareApplyOptimizeResult}
                    disabled={
                      applyingOptimizeResult ||
                      syncingOptimizeSession ||
                      (() => {
                        if (isRiskIgnored) return false;
                        if (!optimizeStory || !latestOptimizeAssistant.trim()) return false;
                        const cleaned = stripMarkdownAnchors(latestOptimizeAssistant);
                        const parsed = parseOptimizedStoryFields(
                          cleaned,
                          optimizeStory,
                        );
                        const nextFields = sanitizeOptimizedFields(parsed);
                        return checkPotentialFabrication(optimizeStory, nextFields).hasStrictRisk;
                      })()
                    }
                    className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-100 disabled:opacity-50"
                  >
                    {applyingOptimizeResult ? "应用中..." : "预览并应用到 STAR"}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!optimizeSession?.messages?.length) {
                        setOptimizeSyncText("暂无可同步会话。");
                        return;
                      }
                      await syncOptimizeSessionToNotion(optimizeStory, optimizeSession.messages);
                    }}
                    disabled={syncingOptimizeSession}
                    className="rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-100 disabled:opacity-50"
                  >
                    {syncingOptimizeSession ? "同步中..." : "同步到 Notion"}
                  </button>
                  <button
                    type="button"
                    onClick={() => clearOptimizeSession(optimizeStory.id)}
                    className="rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-xs text-rose-100"
                  >
                    清空会话
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (optimizeSession?.messages?.length) {
                        await syncOptimizeSessionToNotion(optimizeStory, optimizeSession.messages);
                      }
                      setPendingOptimizedFields(null);
                      setSelectedApplyFields([]);
                      setLastRollbackSnapshot(null);
                      setOptimizeStory(null);
                      setOriginalStarSnapshot("");
                      setOptimizeContextExpanded(false);
                    }}
                    className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300"
                  >
                    关闭
                  </button>
                </div>
              </div>
            </div>
            <div className="mt-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-xs">
              {optimizeToast ? (
                <div className="mb-2 neon-card rounded-xl border border-amber-500/35 bg-amber-500/10 p-2 text-[11px] text-amber-200">
                  {optimizeToast}
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-zinc-200">原始 STAR（只读）</p>
                <span className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-400">
                  聊天区不重复显示
                </span>
              </div>

              <div
                className={`mt-2 min-h-0 whitespace-pre-wrap font-mono leading-5 text-[11px] text-zinc-300 ${
                  optimizeContextExpanded ? "" : "max-h-[150px] overflow-y-auto pr-1"
                }`}
              >
                {originalStarSnapshot || (optimizeStory ? buildOriginalStarText(optimizeStory) : "")}
              </div>

              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setOptimizeContextExpanded((v) => !v)}
                  className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-[11px] text-zinc-300 transition hover:border-zinc-500/60"
                >
                  {optimizeContextExpanded ? "收起" : "展开"}
                </button>
              </div>
            </div>

            <div className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {optimizeSyncText ? (
              <div
                className={`neon-card mb-2 rounded-xl p-2 text-xs ${
                  /(?:未检测到|没有检测到|暂不覆盖|失败|阻止)/.test(optimizeSyncText)
                    ? "text-red-300"
                    : "text-zinc-400"
                }`}
              >
                {optimizeSyncText}
              </div>
            ) : null}
            {optimizeRiskHint ? (
              <div
                className={`neon-card mb-2 rounded-xl p-2 text-xs ${
                  optimizeRiskHint.startsWith("✅")
                    ? "border border-emerald-500/35 bg-emerald-500/10 text-emerald-200"
                    : "border border-amber-500/35 bg-amber-500/10 text-amber-200"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span>{optimizeRiskHint}</span>
                  <div className="flex items-center gap-2">
                    {!optimizeRiskHint.startsWith("✅") ? (
                      <button
                        type="button"
                        onClick={() => {
                          setIsRiskIgnored(true);
                        }}
                        className="shrink-0 rounded-md border border-zinc-500/40 bg-zinc-500/10 px-2 py-1 text-[11px] text-zinc-100 transition hover:bg-zinc-500/20"
                      >
                        忽略风险并强制放行
                      </button>
                    ) : null}
                    {optimizeRedlineAutoFixPrompt ? (
                      <button
                        type="button"
                        disabled={optimizeChatLoading}
                        onClick={() => {
                          setIsRiskIgnored(false);
                          setQuickActionPrompt(optimizeRedlineAutoFixPrompt);
                          setQuickActionNonce((prev) => prev + 1);
                          setOptimizeSyncText("已发送红线修正指令，请等待 AI 按事实锚定重写。");
                        }}
                        className="shrink-0 rounded-md border border-amber-400/40 bg-amber-400/10 px-2 py-1 text-[11px] text-amber-100 transition hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        一键修正并重写
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
            {lastRollbackSnapshot && lastRollbackSnapshot.storyId === optimizeStory.id ? (
              <div className="neon-card mb-2 rounded-xl p-2 text-xs text-amber-200">
                已记录最近一次应用快照（{new Date(lastRollbackSnapshot.createdAt).toLocaleString()}），可一键回滚。
              </div>
            ) : null}
            {optimizeStory && optimizeSession?.messages?.length && pendingOptimizedFields ? (
              <div className="neon-card mb-2 rounded-xl p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs text-zinc-400">应用前预览（旧值 → 新值）</p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedApplyFields(
                          getChangedStoryFields(optimizeStory, pendingOptimizedFields).map(
                            (row) => row.key as StoryFieldKey,
                          ),
                        )
                      }
                      className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300"
                    >
                      全选
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedApplyFields([])}
                      className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300"
                    >
                      全不选
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPendingOptimizedFields(null);
                        setSelectedApplyFields([]);
                      }}
                      className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        applyOptimizedFieldsToStory(
                          optimizeStory,
                          optimizeSession.messages,
                          pendingOptimizedFields,
                        )
                      }
                      disabled={applyingOptimizeResult}
                      className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-100 disabled:opacity-50"
                    >
                      确认写回 Notion
                    </button>
                  </div>
                </div>
                <div className="grid gap-2">
                  {getChangedStoryFields(optimizeStory, pendingOptimizedFields).map((row) => (
                    <div key={row.key} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-zinc-500">{row.label}</p>
                        <label className="flex items-center gap-1 text-xs text-zinc-300">
                          <input
                            type="checkbox"
                            checked={selectedApplyFields.includes(row.key as StoryFieldKey)}
                            onChange={(event) => {
                              const key = row.key as StoryFieldKey;
                              setSelectedApplyFields((prev) =>
                                event.target.checked
                                  ? [...new Set([...prev, key])]
                                  : prev.filter((item) => item !== key),
                              );
                            }}
                          />
                          应用此字段
                        </label>
                      </div>
                      <div className="mt-1 grid gap-2 lg:grid-cols-2">
                        <div>
                          <p className="mb-1 text-[11px] text-zinc-500">旧值</p>
                          <div className="max-h-56 overflow-auto rounded-md border border-zinc-800 bg-zinc-950/70 p-2">
                            <div className="prose prose-invert prose-headings:my-1 prose-p:my-0 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-pre:my-1 prose-code:text-violet-200 max-w-none break-words text-xs leading-5 text-zinc-300">
                              <ReactMarkdown>{row.before || "（空）"}</ReactMarkdown>
                            </div>
                          </div>
                        </div>
                        <div>
                          <p className="mb-1 text-[11px] text-zinc-500">新值</p>
                          <div className="max-h-56 overflow-auto rounded-md border border-emerald-500/20 bg-zinc-950/70 p-2">
                            <div className="prose prose-invert prose-headings:my-1 prose-p:my-0 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-pre:my-1 prose-code:text-emerald-200 max-w-none break-words text-xs leading-5 text-emerald-200">
                              <ReactMarkdown>{row.after || "（空）"}</ReactMarkdown>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {optimizeSession?.messages?.length ? (
              <div className="neon-card mb-2 rounded-xl p-3">
                <p className="mb-2 text-xs text-zinc-500">
                  已恢复上次优化记录（{new Date(optimizeSession.updatedAt).toLocaleString()}）
                </p>
                <div className="max-h-36 space-y-2 overflow-auto rounded-lg border border-zinc-800 bg-zinc-950/70 p-2 text-xs">
                  {optimizeSession.messages.slice(-6).map((msg, idx) => (
                    <div
                      key={`${msg.id}-${idx}`}
                      className="rounded-md border border-zinc-800/70 bg-zinc-950/70 p-2 text-zinc-300"
                    >
                      <p className="mb-1 text-[11px] text-zinc-500">{msg.role === "user" ? "你" : "教练"}：</p>
                      <div className="prose prose-invert prose-headings:my-1 prose-p:my-0 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-pre:my-1 prose-code:text-violet-200 max-w-none break-words text-xs leading-5">
                        <ReactMarkdown>
                          {msg.role === "user"
                            ? sanitizeUserChatContentForDisplay(msg.content)
                            : msg.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <ChatPanel
              key={optimizeStory.id}
              systemPrompt={optimizePrompt}
              modelType="deep"
              initialUserMessage={optimizeSession?.messages?.length ? undefined : optimizeMessage}
              programmaticUserMessage={quickActionPrompt}
              programmaticMessageNonce={quickActionNonce}
              hideInitialUserBubble={!optimizeSession?.messages?.length}
              immersiveLayout
              requestBody={
                optimizeStory
                  ? {
                      // Used by /api/chat to inject story context as a system message.
                      originalStory: optimizeStory,
                    }
                  : undefined
              }
              maxWidthClassName="max-w-[1000px]"
              inputTopContent={
                <div>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <label className="text-xs text-zinc-400">目标岗位（来自 JD 解码）</label>
                    <select
                      value={selectedTargetJobId}
                      onChange={(event) => setSelectedTargetJobId(event.target.value)}
                      disabled={optimizeChatLoading}
                      className="min-w-[240px] rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {jdOptions.length === 0 ? (
                        <option value="">暂无 JD 解码岗位</option>
                      ) : null}
                      {jdOptions.map((job) => (
                        <option key={job.id} value={job.id}>
                          {job.title || "未命名岗位"}
                        </option>
                      ))}
                    </select>
                    {selectedTargetJob ? (
                      <span className="text-[11px] text-cyan-300/90">
                        已绑定：{selectedTargetJob.title || "未命名岗位"}
                      </span>
                    ) : (
                      <span className="text-[11px] text-amber-300/90">
                        未绑定目标岗位，“按目标岗位重写”将不可用
                      </span>
                    )}
                  </div>
                  <p className="mb-2 text-xs text-zinc-500">
                    快捷提示语（点击后会直接发给教练，推荐先点“仅输出优化后STAR”）
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {optimizeQuickActions.map((action) => (
                      <button
                        key={action.id}
                        type="button"
                        disabled={optimizeChatLoading}
                        onClick={() => triggerQuickAction(action)}
                        className={`rounded-full border px-3 py-1 text-[11px] transition disabled:cursor-not-allowed disabled:opacity-50 ${
                          action.id === "enhance-challenge-response"
                            ? "border-amber-500/40 bg-amber-500/10 text-amber-100 hover:border-amber-500/70"
                            : "border-cyan-500/35 bg-cyan-500/10 text-cyan-100 hover:border-cyan-500/60"
                        }`}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={optimizeChatLoading}
                      onClick={() => {
                        if (optimizeChatLoading || optimizeQuickLockRef.current) {
                          setOptimizeToast("正在生成回复，请稍候");
                          return;
                        }
                        // Step 1: Strict check - use synchronous ref for fresh data
                        const messages = latestOptimizeMessagesRef.current;
                        const latestAssistant = [...messages]
                          .reverse()
                          .find((msg) => msg.role === "assistant")?.content ?? "";
                        const hasNinetyAnchor = latestAssistant.includes("### ⏱️ 90秒口述版本");
                        if (hasNinetyAnchor) {
                          // Extract content strictly after the anchor
                          const idx = latestAssistant.indexOf("### ⏱️ 90秒口述版本");
                          const extracted = latestAssistant.slice(idx + "### ⏱️ 90秒口述版本".length).trim();
                          if (extracted) {
                            setDerivedPreview({
                              viewKey: STORY_VIEW_90S_KEY,
                              title: "90 秒口述视图",
                              content: extracted,
                            });
                            return;
                          }
                        }
                        // No 90s content yet, trigger AI to generate it first
                        optimizeQuickLockRef.current = true;
                        setIsRiskIgnored(false);
                        setQuickActionPrompt(COMPRESS_90S_PROMPT);
                        setQuickActionNonce((prev) => prev + 1);
                        setOptimizeSyncText("已发送生成指令，正在生成 90 秒口述版本，请等待 AI 回复后再次点击此按钮预览并保存。");
                      }}
                      className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      预览并保存 90 秒口述
                    </button>
                  </div>
                </div>
              }
              onMessagesChange={(messages) => {
                const latestUser = [...messages].reverse().find((m) => m.role === "user");
                if (latestUser && latestUser.id !== lastOptimizeUserMessageIdRef.current) {
                  lastOptimizeUserMessageIdRef.current = latestUser.id;
                  setIsRiskIgnored(false);
                }
                // Update synchronous ref immediately (no async delay)
                latestOptimizeMessagesRef.current = messages;
                schedulePersistOptimizeSession(optimizeStory, messages);
              }}
              onLoadingChange={setOptimizeChatLoading}
              emptyStateText="正在加载故事优化会话..."
              // Keep a 20px bottom gap between the chat UI and the overlay/container bottom.
              heightClassName="h-[calc(100%-20px)]"
            />
            </div>
          </div>
        </div>
      ) : null}
      {derivedPreview && optimizeStory ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="neon-card w-full max-w-3xl rounded-2xl p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-100">
                保存前预览：{derivedPreview.title}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setDerivedPreviewSaveNotice(null);
                  setDerivedPreview(null);
                }}
                className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300"
              >
                关闭
              </button>
            </div>

            {derivedPreviewSaveNotice ? (
              <div
                className={`mb-2 rounded-xl border p-2 text-xs ${
                  derivedPreviewSaveNotice.type === "success"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                    : "border-rose-500/30 bg-rose-500/10 text-rose-200"
                }`}
              >
                {derivedPreviewSaveNotice.text}
              </div>
            ) : null}
            <div className="max-h-[50vh] overflow-auto rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
              {derivedPreviewEditing ? (
                <textarea
                  value={derivedPreviewDraft}
                  onChange={(e) => setDerivedPreviewDraft(e.target.value)}
                  disabled={savingDerivedView}
                  className="min-h-[28vh] w-full resize-y rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              ) : derivedPreview.content ? (
                <div className="prose prose-invert prose-p:my-1 max-w-none text-sm text-zinc-200">
                  <ReactMarkdown>{derivedPreview.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-xs text-zinc-400">未提取到对应分段，将回退保存全文。</p>
              )}
            </div>

            <div className="mt-3 flex justify-end gap-2">
              {derivedPreviewEditing ? (
                <button
                  type="button"
                  onClick={() => {
                    setDerivedPreviewEditing(false);
                    setDerivedPreviewDraft(derivedPreview.content ?? "");
                  }}
                  className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300"
                >
                  取消编辑
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setDerivedPreviewSaveNotice(null);
                    setDerivedPreview(null);
                  }}
                  className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300"
                >
                  取消
                </button>
              )}

              <button
                type="button"
                disabled={savingDerivedView}
                onClick={async () => {
                  const nextContent =
                    derivedPreviewEditing && derivedPreviewDraft.trim().length > 0
                      ? derivedPreviewDraft
                      : derivedPreview.content || latestOptimizeAssistant;
                  // Step 3: Use /api/story/sync with type: '90s_oral'
                  setSavingDerivedView(true);
                  toastFetch(
                    "/api/story/sync",
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        pageId: optimizeStory.id,
                        type: "90s_oral",
                        messages: optimizeSession?.messages ?? [],
                      }),
                    },
                    {
                      loading: "正在同步 90 秒口述版本到 Notion...",
                      success: "✅ 90 秒口述版本已同步到 Notion",
                      error: (err) => `❌ 同步失败：${err.message}`,
                    },
                    () => {
                      // Update local cache
                      const mergedViews = {
                        ...(optimizeStory.aiCachedViews ?? {}),
                        [STORY_VIEW_90S_KEY]: nextContent,
                      };
                      setStories((prev) =>
                        prev.map((row) =>
                          row.id === optimizeStory.id
                            ? { ...row, aiCachedViews: mergedViews }
                            : row,
                        ),
                      );
                      setOptimizeStory({ ...optimizeStory, aiCachedViews: mergedViews });
                      setDerivedPreviewSaveNotice({ type: "success", text: "同步成功" });
                      window.setTimeout(() => {
                        setDerivedPreviewSaveNotice(null);
                        setDerivedPreview(null);
                      }, 900);
                    },
                    () => {
                      setSavingDerivedView(false);
                    },
                  );
                }}
                className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingDerivedView ? "同步中..." : derivedPreviewEditing ? "保存修改" : "确认同步"}
              </button>
            </div>

            <div className="mt-2 flex justify-start">
              <button
                type="button"
                disabled={savingDerivedView}
                onClick={() => {
                  if (!derivedPreview) return;
                  setDerivedPreviewEditing((v) => !v);
                  if (!derivedPreviewEditing) setDerivedPreviewDraft(derivedPreview.content ?? "");
                }}
                className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {derivedPreviewEditing ? "退出编辑" : "编辑"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
