"use client";

import { useEffect, useState } from "react";
import DecodePage from "@/app/decode/page";
import ResearchPage from "@/app/research/page";
import { MergedPageTabs } from "@/components/MergedPageTabs";
import { PageGuide } from "@/components/PageGuide";
import { parseDecodeJsonObject, parseDecodeResultSections } from "@/lib/jd-decode-format";
import { persistTab, readInitialTab } from "@/lib/tab-state";

const JOB_ANALYSIS_TAB_KEY = "interview-os-job-analysis-active-tab";
const DECODE_DRAFT_KEY = "interview-os-decode-draft";

type JdRecord = {
  id: string;
  title: string;
  jdText: string;
  company?: string;
  role?: string;
  matchScore?: number;
  notes?: string;
  decodeSummary?: string;
  coreResponsibilities?: string;
  implicitExpectations?: string;
  fitSummary?: string;
  keyGaps?: string;
  fitScore?: number;
  gapAnalysis?: string;
};

type PrepPlan = {
  goal: string;
  daily_plan: Array<{ day: number; focus: string; tasks: string[] }>;
  checkpoints: string[];
};

type DecodeParseDebug = {
  mode: "json" | "section" | "empty";
  lengths: {
    core: number;
    mustHave: number;
    plus: number;
    culture: number;
    implicit: number;
  };
};

function parseListText(input?: string) {
  if (!input) return [] as string[];
  return input
    .split(/[\n;；]/)
    .map((item) => item.replace(/^[\-•\d.\s]+/, "").trim())
    .filter(Boolean);
}

function parseDecodeResultJson(text: string) {
  const parsed = parseDecodeJsonObject(text);
  if (!parsed) return null;
  try {
    const fit = parsed.fit_analysis !== null && typeof parsed.fit_analysis === "object"
      ? (parsed.fit_analysis as Record<string, unknown>)
      : {};
    const toList = (value: unknown) =>
      Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
    const fitScoreRaw =
      typeof parsed.match_score === "number"
        ? parsed.match_score
        : typeof fit.fit_score_1_to_10 === "number"
          ? fit.fit_score_1_to_10
          : 0;
    return {
      core: toList(parsed.core_responsibilities),
      mustHave: toList(parsed.must_have_skills),
      plus: toList(parsed.plus_points),
      culture: toList(parsed.culture_signals),
      implicit: toList(parsed.implicit_expectations),
      fitSummary: typeof fit.fit_summary === "string" ? fit.fit_summary.trim() : "",
      keyGaps: toList(fit.key_gaps),
      prepPriorities: toList(fit.prep_priorities),
      fitScore: Number(fitScoreRaw || 0),
    };
  } catch {
    return null;
  }
}

function splitDecodeContent(rawContent: string) {
  let cardData: Record<string, unknown> = {};
  let markdownPlan = rawContent;

  try {
    const jsonMatch = rawContent.match(/```json\s*([\s\S]*?)\s*```/i);
    if (jsonMatch?.[1]) {
      cardData = JSON.parse(jsonMatch[1]) as Record<string, unknown>;
      markdownPlan = rawContent.replace(jsonMatch[0], "").trim();
    } else {
      const firstBrace = rawContent.indexOf("{");
      const lastBrace = rawContent.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const jsonStr = rawContent.substring(firstBrace, lastBrace + 1);
        cardData = JSON.parse(jsonStr) as Record<string, unknown>;
        markdownPlan = rawContent.substring(lastBrace + 1).trim();
      }
    }
  } catch (e) {
    console.error("解析混合数据失败:", e);
  }

  return { cardData, markdownPlan };
}

function parsePrepPlanFromMarkdown(notes?: string): PrepPlan | null {
  const source = String(notes ?? "");
  if (!source.includes("7 天 Prep 清单")) return null;
  const lines = source.split(/\r?\n/).map((line) => line.trim());
  const goalLine = lines.find((line) => line.startsWith("- 总目标：")) || "";
  const goal = goalLine.replace(/^- 总目标：/, "").trim();
  const dayRegex = /^###\s*Day\s*(\d+)\s*-\s*(.+)$/i;
  const checkpointIndex = lines.findIndex((line) => /^##\s*检查点/.test(line));
  const dailyPlan: Array<{ day: number; focus: string; tasks: string[] }> = [];
  let idx = 0;
  while (idx < lines.length) {
    const match = lines[idx].match(dayRegex);
    if (!match) {
      idx += 1;
      continue;
    }
    const day = Number(match[1]);
    const focus = String(match[2] ?? "").trim();
    const tasks: string[] = [];
    idx += 1;
    while (idx < lines.length && !lines[idx].match(dayRegex) && !(checkpointIndex >= 0 && idx >= checkpointIndex)) {
      if (lines[idx].startsWith("- ")) tasks.push(lines[idx].slice(2).trim());
      idx += 1;
    }
    dailyPlan.push({ day, focus, tasks });
  }
  const checkpoints: string[] = [];
  if (checkpointIndex >= 0) {
    for (let i = checkpointIndex + 1; i < lines.length; i += 1) {
      if (lines[i].startsWith("- ")) checkpoints.push(lines[i].slice(2).trim());
    }
  }
  if (!goal && dailyPlan.length === 0 && checkpoints.length === 0) return null;
  return {
    goal: goal || "7 天备战计划",
    daily_plan: dailyPlan,
    checkpoints,
  };
}

export default function JobAnalysisPage() {
  const [tab, setTab] = useState<"research" | "decode">("research");
  const [decodeMountKey, setDecodeMountKey] = useState(0);
  const [savedJdRecords, setSavedJdRecords] = useState<JdRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [recordsError, setRecordsError] = useState("");
  const [selectedRecordId, setSelectedRecordId] = useState("");
  const [pendingSwitchId, setPendingSwitchId] = useState("");
  const [isSwitching, setIsSwitching] = useState(false);
  const loadSavedRecords = async () => {
    setLoadingRecords(true);
    setRecordsError("");
    try {
      const response = await fetch("/api/notion?resource=jd", { cache: "no-store" });
      if (!response.ok) {
        setRecordsError(`历史岗位加载失败（HTTP ${response.status}）`);
        return;
      }
      const payload = (await response.json()) as { records?: JdRecord[] };
      setSavedJdRecords(payload.records ?? []);
      if (!payload.records || payload.records.length === 0) {
        setRecordsError("未读取到可复用的 JD 记录");
      }
    } catch (error) {
      setRecordsError(error instanceof Error ? `历史岗位加载失败：${error.message}` : "历史岗位加载失败");
    } finally {
      setLoadingRecords(false);
    }
  };
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("tab");
    const resolved = readInitialTab({
      queryParam: q,
      validTabs: ["research", "decode"],
      storageKey: JOB_ANALYSIS_TAB_KEY,
      fallback: "research",
    });
    setTab(resolved);
    void loadSavedRecords();
  }, []);

  const onChangeTab = (next: "research" | "decode") => {
    setTab(next);
    persistTab({
      next,
      storageKey: JOB_ANALYSIS_TAB_KEY,
      queryParamName: "tab",
    });
  };

  const [researchSummary] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      const raw = window.localStorage.getItem("interview-os-research");
      if (!raw) return "";
      const parsed = JSON.parse(raw) as { company?: string; result?: { fitAssessment?: string[] } };
      const fit = parsed.result?.fitAssessment?.[0] ?? "";
      if (!parsed.company && !fit) return "";
      return `${parsed.company ?? "目标公司"}：${fit || "已有研究记录，可用于解码时参考。"}`;
    } catch {
      return "";
    }
  });

  const selectedRecord = savedJdRecords.find((row) => row.id === selectedRecordId) ?? null;
  const pendingRecord = savedJdRecords.find((row) => row.id === pendingSwitchId) ?? null;

  const applySavedRecordToDecode = (record: JdRecord) => {
    const rawContent = record.decodeSummary || "";
    const { cardData, markdownPlan } = splitDecodeContent(rawContent);
    const parsedJson = parseDecodeResultJson(JSON.stringify(cardData || {})) || parseDecodeResultJson(rawContent);
    const parsedFromDecodeResult = parseDecodeResultSections(markdownPlan || rawContent);
    const core = parsedJson?.core ?? parseListText(record.coreResponsibilities || parsedFromDecodeResult.core);
    const mustHaveSkills = parsedJson?.mustHave ?? parseListText(parsedFromDecodeResult.mustHave);
    const plusPoints = parsedJson?.plus ?? parseListText(parsedFromDecodeResult.plus);
    const cultureSignals = parsedJson?.culture ?? parseListText(parsedFromDecodeResult.culture);
    const implicit = parsedJson?.implicit ?? parseListText(record.implicitExpectations || parsedFromDecodeResult.implicit);
    const keyGaps = parsedJson?.keyGaps ?? parseListText(record.keyGaps || parsedFromDecodeResult.keyGaps || record.gapAnalysis);
    const prepPriorities = parsedJson?.prepPriorities ?? parseListText(parsedFromDecodeResult.prepPriorities || record.gapAnalysis);
    const fitSummaryText =
      parsedJson?.fitSummary ||
      record.fitSummary ||
      parsedFromDecodeResult.fitSummary ||
      (record.decodeSummary ? record.decodeSummary.slice(0, 240) : "");
    const fitScore = Number(parsedJson?.fitScore ?? record.matchScore ?? record.fitScore ?? 0);
    const prepPlan = parsePrepPlanFromMarkdown(markdownPlan) || parsePrepPlanFromMarkdown(record.notes);
    const parseDebug: DecodeParseDebug = {
      mode: parsedJson
        ? "json"
        : [core, mustHaveSkills, plusPoints, cultureSignals, implicit].some((list) => list.length > 0)
          ? "section"
          : "empty",
      lengths: {
        core: core.length,
        mustHave: mustHaveSkills.length,
        plus: plusPoints.length,
        culture: cultureSignals.length,
        implicit: implicit.length,
      },
    };

    const nextDraft = {
      jdRecordId: record.id,
      jdText: (record.jdText || record.decodeSummary || "").trim(),
      scheduleChoice: "new" as const,
      loadedFromHistory: true,
      decodePrepMarkdown: markdownPlan,
      parseDebug,
      company: record.company || "",
      role: record.role || "",
      result: {
        core_responsibilities: core,
        must_have_skills: mustHaveSkills,
        plus_points: plusPoints,
        culture_signals: cultureSignals,
        implicit_expectations: implicit,
        fit_analysis: {
          fit_summary: fitSummaryText,
          fit_score_1_to_10: fitScore,
          key_gaps: keyGaps,
          prep_priorities: prepPriorities,
        },
      },
      plan: prepPlan,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(DECODE_DRAFT_KEY, JSON.stringify(nextDraft));
    onChangeTab("decode");
    setDecodeMountKey((prev) => prev + 1);
  };

  return (
    <main className="flex w-full flex-col gap-4">
      <section className="neon-card rounded-2xl p-6">
        <h1 className="text-2xl font-semibold">岗位分析</h1>
        <p className="mt-2 text-sm text-zinc-400">研究目标公司 + 解码 JD，为投递做好准备</p>
      </section>
      <MergedPageTabs
        tabs={[
          { id: "research", label: "公司研究" },
          { id: "decode", label: "JD 解码" },
        ]}
        activeTab={tab}
        onChange={(next) => onChangeTab(next as "research" | "decode")}
      />
      <PageGuide pageKey="job-analysis" items={["先做公司研究，再进入 JD 解码。", "Tab 内切换不会刷新页面。"]} />

      <div className={tab === "research" ? "block space-y-3" : "hidden"}>
        <div className="space-y-3">
          <ResearchPage />
          <section className="neon-card rounded-xl p-4">
            <button
              type="button"
              onClick={() => onChangeTab("decode")}
              className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100"
            >
              去解码该公司 JD →
            </button>
          </section>
        </div>
      </div>
      <div className={tab === "decode" ? "block" : "hidden"}>
        {researchSummary ? (
          <section className="mb-3 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-sm text-cyan-100">
            研究摘要：{researchSummary}
          </section>
        ) : null}
        <DecodePage
          key={decodeMountKey}
          jdRecordPicker={
            <div className="w-full">
              <p className="mb-1 text-xs text-zinc-500">复用历史岗位资料（Notion JD Records）</p>
              <div className="flex w-full items-center gap-2">
                <select
                  value={selectedRecordId}
                  onChange={(event) => setSelectedRecordId(event.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                >
                  <option value="">{loadingRecords ? "加载中..." : "选择历史岗位资料"}</option>
                  {savedJdRecords.map((record) => (
                    <option key={record.id} value={record.id}>
                      {record.title || "未命名 JD 记录"}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!selectedRecord || isSwitching}
                  onClick={() => {
                    if (!selectedRecord) return;
                    setPendingSwitchId(selectedRecord.id);
                  }}
                  className="shrink-0 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100 disabled:opacity-50"
                >
                  {isSwitching ? "切换中..." : "切换并加载到 JD 解码"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void loadSavedRecords();
                  }}
                  disabled={loadingRecords || isSwitching}
                  className="shrink-0 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 disabled:opacity-50"
                >
                  {loadingRecords ? "重试中..." : "重试加载"}
                </button>
              </div>
              {recordsError ? <p className="mt-1 text-xs text-amber-300">{recordsError}</p> : null}
            </div>
          }
        />
      </div>
      {pendingRecord ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
          <div className="neon-card w-full max-w-md rounded-2xl p-5">
            <h3 className="text-lg font-semibold text-zinc-100">确认切换岗位资料</h3>
            <p className="mt-2 text-sm text-zinc-300">
              你将切换到：{pendingRecord.title || "未命名 JD 记录"}。当前 JD 解码编辑内容可能被覆盖，确认继续吗？
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (isSwitching) return;
                  setPendingSwitchId("");
                }}
                disabled={isSwitching}
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
              >
                取消
              </button>
              <button
                type="button"
                disabled={isSwitching}
                onClick={() => {
                  setIsSwitching(true);
                  window.setTimeout(() => {
                    applySavedRecordToDecode(pendingRecord);
                    setPendingSwitchId("");
                    setIsSwitching(false);
                  }, 320);
                }}
                className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100 disabled:opacity-50"
              >
                {isSwitching ? "切换中..." : "确认切换"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
