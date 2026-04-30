type DecodeJsonShape = {
  core_responsibilities?: unknown;
  must_have_skills?: unknown;
  plus_points?: unknown;
  culture_signals?: unknown;
  implicit_expectations?: unknown;
  match_score?: unknown;
  fit_analysis?: unknown;
};

function toStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

export function parseDecodeJsonObject(text: string): Record<string, unknown> | null {
  const raw = String(text ?? "").trim();
  if (!raw) return null;

  const candidates: string[] = [];
  candidates.push(raw);

  const fenced = raw.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) candidates.push(fenced[1].trim());

  const start = raw.indexOf("{");
  if (start >= 0) {
    let depth = 0;
    let end = -1;
    for (let i = start; i < raw.length; i += 1) {
      const ch = raw[i];
      if (ch === "{") depth += 1;
      if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end > start) candidates.push(raw.slice(start, end + 1).trim());
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      // try next candidate
    }
  }
  return null;
}

export function formatDecodeResultAsReadableText(decodeText: string) {
  const parsed = parseDecodeJsonObject(decodeText) as DecodeJsonShape | null;
  if (!parsed) return String(decodeText ?? "").trim();

  const fit = parsed.fit_analysis !== null && typeof parsed.fit_analysis === "object"
    ? (parsed.fit_analysis as Record<string, unknown>)
    : {};
  const core = toStringArray(parsed.core_responsibilities);
  const must = toStringArray(parsed.must_have_skills);
  const plus = toStringArray(parsed.plus_points);
  const culture = toStringArray(parsed.culture_signals);
  const implicit = toStringArray(parsed.implicit_expectations);
  const keyGaps = toStringArray(fit.key_gaps);
  const prep = toStringArray(fit.prep_priorities);
  const fitSummary = typeof fit.fit_summary === "string" ? fit.fit_summary.trim() : "";
  const score = typeof parsed.match_score === "number"
    ? Math.max(0, Math.min(100, Math.round(parsed.match_score)))
    : typeof fit.fit_score_1_to_10 === "number"
      ? Math.max(0, Math.min(10, Math.round(fit.fit_score_1_to_10)))
      : null;
  const scoreLabel = score === null ? "未提供" : score > 10 ? `${score}/100` : `${score}/10`;
  const section = (title: string, items: string[]) =>
    [`【${title}】`, ...(items.length > 0 ? items.map((item) => `• ${item}`) : ["• 暂无"])].join("\n");

  const lines = [
    section("核心职责", core),
    "",
    section("必备技能", must),
    "",
    section("加分项", plus),
    "",
    section("文化信号", culture),
    "",
    section("隐含期望", implicit),
    "",
    "【匹配度分析】",
    `匹配度：${scoreLabel}`,
    `优势：${fitSummary || "暂无"}`,
    `差距：${keyGaps.length > 0 ? keyGaps.join("；") : "暂无"}`,
    ...(prep.length > 0 ? [`准备优先级：${prep.join("；")}`] : []),
  ];
  return lines.join("\n").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parseDecodeResultSections(text: string) {
  const source = String(text ?? "").trim();
  if (!source) {
    return {
      core: "",
      mustHave: "",
      plus: "",
      culture: "",
      implicit: "",
      fitSummary: "",
      keyGaps: "",
      prepPriorities: "",
    };
  }

  const marks = [
    {
      key: "core",
      tag: "__SEC_CORE__",
      patterns: [/【\s*核心职责\s*】/gi, /#{2,4}\s*核心职责/gi, /核心职责\s*[（(][^）)]*[）)]\s*[：:]?/gi, /Core Responsibilities\s*[：:]?/gi],
    },
    {
      key: "mustHave",
      tag: "__SEC_MUST__",
      patterns: [/【\s*必备技能\s*】/gi, /#{2,4}\s*必备技能/gi, /必备技能\s*[（(][^）)]*[）)]\s*[：:]?/gi, /Must Have Skills\s*[：:]?/gi],
    },
    {
      key: "plus",
      tag: "__SEC_PLUS__",
      patterns: [/【\s*加分项\s*】/gi, /#{2,4}\s*加分项/gi, /加分项\s*[（(][^）)]*[）)]\s*[：:]?/gi, /Plus Points\s*[：:]?/gi],
    },
    {
      key: "culture",
      tag: "__SEC_CULTURE__",
      patterns: [/【\s*文化信号\s*】/gi, /#{2,4}\s*文化信号/gi, /文化信号\s*[（(][^）)]*[）)]\s*[：:]?/gi, /Culture Signals\s*[：:]?/gi],
    },
    {
      key: "implicit",
      tag: "__SEC_IMPLICIT__",
      patterns: [/【\s*隐含期望\s*】/gi, /#{2,4}\s*隐含期望/gi, /隐含期望\s*[（(][^）)]*[）)]\s*[：:]?/gi, /Implicit Expectations\s*[：:]?/gi],
    },
    {
      key: "fitSummary",
      tag: "__SEC_FIT__",
      patterns: [/【\s*匹配总结\s*】/gi, /【\s*匹配度分析\s*】/gi, /#{2,4}\s*匹配总结/gi, /#{2,4}\s*匹配度分析/gi, /匹配总结\s*[（(][^）)]*[）)]\s*[：:]?/gi, /Fit Summary\s*[：:]?/gi],
    },
    {
      key: "keyGaps",
      tag: "__SEC_GAPS__",
      patterns: [/【\s*关键差距\s*】/gi, /#{2,4}\s*关键差距/gi, /关键差距\s*[（(][^）)]*[）)]\s*[：:]?/gi, /Key Gaps\s*[：:]?/gi],
    },
    {
      key: "prepPriorities",
      tag: "__SEC_PREP__",
      patterns: [/【\s*准备优先级\s*】/gi, /#{2,4}\s*准备优先级/gi, /准备优先级\s*[（(][^）)]*[）)]\s*[：:]?/gi, /Prep Priorities\s*[：:]?/gi],
    },
  ] as const;

  let marked = source;
  for (const item of marks) {
    for (const pattern of item.patterns) {
      marked = marked.replace(pattern, `\n${item.tag}\n`);
    }
  }

  const result: Record<string, string> = {
    core: "",
    mustHave: "",
    plus: "",
    culture: "",
    implicit: "",
    fitSummary: "",
    keyGaps: "",
    prepPriorities: "",
  };

  for (let i = 0; i < marks.length; i += 1) {
    const current = marks[i];
    const start = marked.indexOf(current.tag);
    if (start < 0) continue;
    const startContent = start + current.tag.length;
    let end = marked.length;
    for (let j = 0; j < marks.length; j += 1) {
      if (i === j) continue;
      const idx = marked.indexOf(marks[j].tag, startContent);
      if (idx >= 0 && idx < end) end = idx;
    }
    const content = marked
      .slice(startContent, end)
      .replace(new RegExp(`^[:：\\s\\-]+|${escapeRegExp(current.tag)}$`, "g"), "")
      .trim();
    result[current.key] = content;
  }

  return result as {
    core: string;
    mustHave: string;
    plus: string;
    culture: string;
    implicit: string;
    fitSummary: string;
    keyGaps: string;
    prepPriorities: string;
  };
}
