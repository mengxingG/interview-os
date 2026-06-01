"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LoadingHint } from "@/components/LoadingHint";
import { PageGuide } from "@/components/PageGuide";
import { ModelSelect } from "@/components/ModelSelect";
import { UpcomingInterviewFocus } from "@/components/UpcomingInterviewFocus";
import { getUpcomingInterview, readInterviewSchedule } from "@/lib/interview-schedule";
import type { ModelType } from "@/lib/llm";
import { readModelSelection, writeModelSelection } from "@/lib/model-selection";

type DecodeResult = {
  core_responsibilities: string[];
  must_have_skills: string[];
  plus_points: string[];
  culture_signals: string[];
  implicit_expectations: string[];
  fit_analysis: {
    fit_summary: string;
    fit_score_1_to_10: number;
    key_gaps: string[];
    prep_priorities: string[];
  };
};

type PrepPlan = {
  goal: string;
  daily_plan: Array<{
    day: number;
    focus: string;
    tasks: string[];
  }>;
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

function buildPrepPlanMarkdown(result: DecodeResult, plan: PrepPlan) {
  const score = result.fit_analysis.fit_score_1_to_10;
  const scoreLabel = score > 10 ? `${score}/100` : `${score}/10`;
  const lines: string[] = [];
  lines.push("# JD 解码与 7 天 Prep 清单");
  lines.push("");
  lines.push("## JD 关键信息");
  lines.push(`- 匹配度：${scoreLabel}`);
  lines.push(`- 核心职责：${result.core_responsibilities.join("；") || "-"}`);
  lines.push(`- 隐含期望：${result.implicit_expectations.join("；") || "-"}`);
  lines.push(`- 关键差距：${result.fit_analysis.key_gaps.join("；") || "-"}`);
  lines.push("");
  lines.push("## 7 天 Prep 清单");
  lines.push(`- 总目标：${plan.goal}`);
  lines.push("");
  for (const day of plan.daily_plan) {
    lines.push(`### Day ${day.day} - ${day.focus}`);
    for (const task of day.tasks) {
      lines.push(`- ${task}`);
    }
    lines.push("");
  }
  lines.push("## 检查点");
  for (const point of plan.checkpoints) {
    lines.push(`- ${point}`);
  }
  lines.push("");
  return lines.join("\n");
}

function parsePrepPlanToCards(rawText: string) {
  if (!rawText) return [] as Array<{ id: number; title: string; content: string }>;
  const chunks = rawText.split(/(?=(?:###\s+|-?\s*\*\*)?Day\s*\d+)/i);
  return chunks
    .map((chunk, index) => {
      const lines = chunk.trim().split("\n").filter(Boolean);
      if (lines.length === 0) return null;
      const titleLine = lines[0].replace(/^[#\-\*\s]+/, "").replace(/\*\*$/, "").trim();
      const contentLines = lines.slice(1).join("\n").trim();
      return { id: index, title: titleLine, content: contentLines };
    })
    .filter((item): item is { id: number; title: string; content: string } => Boolean(item?.title))
    .filter((item) => item.title.toLowerCase().startsWith("day"));
}

const JD_HISTORY_KEY = "interview-os-jd-history";
const DECODE_DRAFT_KEY = "interview-os-decode-draft";

function toList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function normalizeResult(raw: unknown): DecodeResult {
  const obj = raw !== null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const fit = obj.fit_analysis !== null && typeof obj.fit_analysis === "object"
    ? (obj.fit_analysis as Record<string, unknown>)
    : {};
  return {
    core_responsibilities: toList(obj.core_responsibilities),
    must_have_skills: toList(obj.must_have_skills),
    plus_points: toList(obj.plus_points),
    culture_signals: toList(obj.culture_signals),
    implicit_expectations: toList(obj.implicit_expectations),
    fit_analysis: {
      fit_summary: typeof fit.fit_summary === "string" ? fit.fit_summary : "",
      fit_score_1_to_10:
        typeof fit.fit_score_1_to_10 === "number" ? fit.fit_score_1_to_10 : 0,
      key_gaps: toList(fit.key_gaps),
      prep_priorities: toList(fit.prep_priorities),
    },
  };
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="neon-card rounded-xl p-4">
      <h3 className="mb-2 text-sm font-semibold text-zinc-100">{title}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-zinc-500">暂无数据</p>
      ) : (
        <ul className="space-y-1 text-sm text-zinc-300">
          {items.map((item, index) => (
            <li key={`${title}-${index}`}>- {item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function DecodePage({ jdRecordPicker }: { jdRecordPicker?: ReactNode } = {}) {
  const [hydrated, setHydrated] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (pathname === "/decode") {
      router.replace("/job-analysis?tab=decode");
    }
  }, [pathname, router]);
  useEffect(() => {
    setHydrated(true);
  }, []);

  const [initialDraft] = useState(() => {
    if (typeof window === "undefined") {
      return {
        jdText: "",
        scheduleChoice: "pending" as "pending" | "applied" | "new",
        loadedFromHistory: false,
        company: "",
        role: "",
        result: null as DecodeResult | null,
        plan: null as PrepPlan | null,
      };
    }
    try {
      const raw = window.localStorage.getItem(DECODE_DRAFT_KEY);
      if (!raw) {
        return {
          jdText: "",
          scheduleChoice: "pending" as "pending" | "applied" | "new",
          loadedFromHistory: false,
          company: "",
          role: "",
          result: null as DecodeResult | null,
          plan: null as PrepPlan | null,
        };
      }
      const parsed = JSON.parse(raw) as {
        jdRecordId?: string;
        jdText?: string;
        scheduleChoice?: "pending" | "applied" | "new";
        loadedFromHistory?: boolean;
        parseDebug?: DecodeParseDebug;
        company?: string;
        role?: string;
        decodePrepMarkdown?: string;
        result?: DecodeResult | null;
        plan?: PrepPlan | null;
      };
      return {
        jdText: parsed.jdText ?? "",
        jdRecordId: parsed.jdRecordId ?? "",
        scheduleChoice: parsed.scheduleChoice ?? "pending",
        loadedFromHistory: Boolean(parsed.loadedFromHistory),
        parseDebug: parsed.parseDebug,
        company: parsed.company ?? "",
        role: parsed.role ?? "",
        decodePrepMarkdown: parsed.decodePrepMarkdown ?? "",
        result: parsed.result ?? null,
        plan: parsed.plan ?? null,
      };
    } catch {
      return {
        jdText: "",
        jdRecordId: "",
        scheduleChoice: "pending" as "pending" | "applied" | "new",
        loadedFromHistory: false,
        parseDebug: undefined,
        company: "",
        role: "",
        decodePrepMarkdown: "",
        result: null as DecodeResult | null,
        plan: null as PrepPlan | null,
      };
    }
  });
  const [jdText, setJdText] = useState(initialDraft.jdText);
  const [jdRecordId, setJdRecordId] = useState(String(initialDraft.jdRecordId ?? ""));
  const [loadedFromHistory, setLoadedFromHistory] = useState(Boolean(initialDraft.loadedFromHistory));
  const [parseDebug] = useState<DecodeParseDebug | undefined>(initialDraft.parseDebug);
  const [loadedCompany, setLoadedCompany] = useState(String(initialDraft.company ?? ""));
  const [loadedRole, setLoadedRole] = useState(String(initialDraft.role ?? ""));
  const [upcoming] = useState(() => {
    if (typeof window === "undefined") return null;
    return getUpcomingInterview(readInterviewSchedule());
  });
  const [scheduleChoice, setScheduleChoice] = useState<"pending" | "applied" | "new">(initialDraft.scheduleChoice);
  const [result, setResult] = useState<DecodeResult | null>(initialDraft.result);
  const [decodeRawText, setDecodeRawText] = useState("");
  const [decodePrepMarkdown, setDecodePrepMarkdown] = useState(String(initialDraft.decodePrepMarkdown ?? ""));
  const [plan, setPlan] = useState<PrepPlan | null>(initialDraft.plan);
  const [loading, setLoading] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [isNewlyDecoded, setIsNewlyDecoded] = useState(false);
  const [isNewlyPrepGenerated, setIsNewlyPrepGenerated] = useState(false);
  const [prepSyncStatus, setPrepSyncStatus] = useState<"idle" | "pending" | "saving" | "synced" | "failed">("idle");
  const [prepSyncError, setPrepSyncError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [toast, setToast] = useState("");
  const [status, setStatus] = useState("等待解码");
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [lastSavedMeta, setLastSavedMeta] = useState<{
    title: string;
    company: string;
    role: string;
    matchScore: number | null;
    priority: string;
    keyRequirements: string[];
    savedAt: string;
  } | null>(null);
  const [modelType, setModelType] = useState<ModelType>(() => readModelSelection("decode", "pro"));
  useEffect(() => {
    writeModelSelection("decode", modelType);
  }, [modelType]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      DECODE_DRAFT_KEY,
      JSON.stringify({
        jdText,
        jdRecordId,
        scheduleChoice,
        loadedFromHistory,
        company: loadedCompany,
        role: loadedRole,
        decodePrepMarkdown,
        result,
        plan,
        savedAt: new Date().toISOString(),
      }),
    );
  }, [jdText, jdRecordId, scheduleChoice, loadedFromHistory, loadedCompany, loadedRole, decodePrepMarkdown, result, plan]);
  useEffect(() => {
    if (loadedFromHistory && (plan || decodePrepMarkdown.trim()) && prepSyncStatus === "idle") {
      setPrepSyncStatus("synced");
    }
  }, [loadedFromHistory, plan, decodePrepMarkdown, prepSyncStatus]);

  const scoreDisplay = useMemo(() => {
    const score = result?.fit_analysis.fit_score_1_to_10 ?? 0;
    return score > 10 ? `${score}/100` : `${score}/10`;
  }, [result]);

  const decodeSummary = useMemo(() => {
    if (!result) {
      return "";
    }
    return [
      `核心职责（Core Responsibilities）: ${result.core_responsibilities.join("; ")}`,
      `必备技能（Must Have Skills）: ${result.must_have_skills.join("; ")}`,
      `加分项（Plus Points）: ${result.plus_points.join("; ")}`,
      `文化信号（Culture Signals）: ${result.culture_signals.join("; ")}`,
      `隐含期望（Implicit Expectations）: ${result.implicit_expectations.join("; ")}`,
      `匹配总结（Fit Summary）: ${result.fit_analysis.fit_summary}`,
    ].join("\n");
  }, [result]);

  const prepPlanSummary = useMemo(() => {
    if (!plan) {
      return "";
    }
    const days = plan.daily_plan
      .map((day) => `第 ${day.day} 天（Day ${day.day}）- ${day.focus}: ${day.tasks.join(" | ")}`)
      .join("\n");
    const checkpoints = plan.checkpoints.join("; ");
    return `7 天目标（7-Day Prep Goal）: ${plan.goal}\n${days}\n检查点（Checkpoints）: ${checkpoints}`;
  }, [plan]);

  const prepPlanMarkdown = useMemo(() => {
    if (!result || !plan) return "";
    return buildPrepPlanMarkdown(result, plan);
  }, [result, plan]);
  const currentPrepPlan = useMemo(
    () => (prepPlanMarkdown.trim() ? prepPlanMarkdown : decodePrepMarkdown).trim(),
    [prepPlanMarkdown, decodePrepMarkdown],
  );
  const prepMarkdownForRender = useMemo(
    () => (prepPlanMarkdown.trim() ? prepPlanMarkdown : decodePrepMarkdown.trim()),
    [prepPlanMarkdown, decodePrepMarkdown],
  );
  const prepCards = useMemo(() => parsePrepPlanToCards(prepMarkdownForRender), [prepMarkdownForRender]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => {
      setToast((prev) => (prev === message ? "" : prev));
    }, 3000);
  };

  const syncPrepPlanToNotion = async (markdown: string) => {
    const content = markdown.trim();
    if (!content) return;
    if (!jdRecordId) {
      setPrepSyncStatus("failed");
      setPrepSyncError("当前尚未绑定 JD 记录，请先保存到 Notion。");
      return;
    }
    setPrepSyncStatus("saving");
    setPrepSyncError("");
    try {
      const prepResponse = await fetch("/api/jd/prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId: jdRecordId,
          prepMarkdown: content,
          generatedAt: new Date().toLocaleString("zh-CN"),
        }),
      });
      if (!prepResponse.ok) {
        const payload = (await prepResponse.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || `HTTP ${prepResponse.status}`);
      }
      setPrepSyncStatus("synced");
      setPrepSyncError("");
      showToast("✅ Prep 清单已保存到 Notion");
    } catch (error) {
      setPrepSyncStatus("failed");
      setPrepSyncError(error instanceof Error ? error.message : "同步失败");
      showToast("❌ Prep 清单同步失败，请重试");
    }
  };

  const onDecode = async () => {
    if (!jdText.trim()) {
      setStatus("请先粘贴 JD 原文。");
      return;
    }
    setLoading(true);
    setStatus(modelType === "pro" ? "正在使用 Gemini 3.5 Flash 深度解码（约 10-30 秒）..." : "正在解码...");
    try {
      const response = await fetch("/api/decode/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jdText, modelType }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = (await response.json()) as { result?: unknown; rawText?: string; prepPlanMarkdown?: string };
      const normalized = normalizeResult(payload.result);
      setResult(normalized);
      setJdRecordId("");
      setLoadedFromHistory(false);
      setIsNewlyDecoded(true);
      setIsNewlyPrepGenerated(false);
      const prepMarkdown = typeof payload.prepPlanMarkdown === "string" ? payload.prepPlanMarkdown.trim() : "";
      setDecodePrepMarkdown(prepMarkdown);
      const fallbackRawText =
        payload.result && typeof payload.result === "object"
          ? `\`\`\`json\n${JSON.stringify(payload.result, null, 2)}\n\`\`\`${prepMarkdown ? `\n\n${prepMarkdown}` : ""}`
          : "";
      setDecodeRawText(typeof payload.rawText === "string" && payload.rawText.trim() ? payload.rawText : fallbackRawText);
      const historyRaw = window.localStorage.getItem(JD_HISTORY_KEY);
      const history = historyRaw
        ? (JSON.parse(historyRaw) as Array<{ title: string; jdText: string; savedAt?: string }>)
        : [];
      history.unshift({
        title: `JD ${new Date().toISOString().slice(0, 10)} ${history.length + 1}`,
        jdText: jdText.slice(0, 4000),
        savedAt: new Date().toISOString(),
      });
      window.localStorage.setItem(JD_HISTORY_KEY, JSON.stringify(history.slice(0, 5)));
      setPlan(null);
      setStatus("解码完成。");
    } catch {
      setStatus("解码失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  };

  const onGeneratePlan = async () => {
    if (!result) {
      setStatus("请先完成解码。");
      return;
    }
    setPlanning(true);
    setStatus(modelType === "pro" ? "正在使用 Gemini 3.5 Flash 生成计划（约 10-30 秒）..." : "正在生成 7 天 prep 清单...");
    try {
      const response = await fetch("/api/decode/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decodeResult: result, modelType }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = (await response.json()) as { plan?: PrepPlan };
      if (!payload.plan?.daily_plan) {
        throw new Error("计划结果格式不正确");
      }
      setPlan(payload.plan);
      setIsNewlyPrepGenerated(true);
      const markdownToSave = buildPrepPlanMarkdown(result, payload.plan);
      if (jdRecordId) {
        await syncPrepPlanToNotion(markdownToSave);
      } else {
        setPrepSyncStatus("pending");
        setPrepSyncError("");
      }
      setStatus("7 天 prep 清单已生成。");
    } catch {
      setPrepSyncStatus("failed");
      setStatus("生成失败，请稍后重试。");
    } finally {
      setPlanning(false);
    }
  };

  const doSaveToNotion = async () => {
    if (!result) {
      setStatus("请先完成解码。");
      return;
    }

    const isJustLoaded = loadedFromHistory && !isNewlyDecoded && !isNewlyPrepGenerated;
    if (isJustLoaded) {
      showToast("当前数据已保存在 Notion 中，无需重复保存");
      setStatus("当前为历史记录且未产生新结果，已跳过重复保存。");
      return;
    }

    const inferredMatchScore = (() => {
      const score = result.fit_analysis.fit_score_1_to_10;
      if (!Number.isFinite(score)) return 0;
      return score > 10 ? Math.round(score) : Math.round(score * 10);
    })();
    const inferredTitleSummary =
      loadedCompany || loadedRole ? `${loadedCompany || ""} - ${loadedRole || ""}`.replace(/^- |-$/g, "").trim() : "";
    const payloadDecodeResult =
      decodeRawText ||
      [decodeSummary, decodePrepMarkdown, prepPlanSummary].filter(Boolean).join("\n\n");

    setSaving(true);
    setStatus("正在保存到 Notion JD 记录（JD Records）...");
    try {
      const response = await fetch("/api/jd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `JD 解码（JD Decode） ${new Date().toISOString().slice(0, 10)}`,
          jdText,
          decodeSummary: payloadDecodeResult,
          decodeResult: payloadDecodeResult,
          prepMarkdown: currentPrepPlan,
          company: loadedCompany || "",
          role: loadedRole || "",
          title_summary: inferredTitleSummary,
          match_score: inferredMatchScore,
          priority:
            inferredMatchScore >= 80 ? "高" : inferredMatchScore >= 60 ? "中" : "低",
          fitScore: result.fit_analysis.fit_score_1_to_10,
          gapAnalysis: [
            `关键差距（Key Gaps）: ${result.fit_analysis.key_gaps.join("; ")}`,
            `准备优先级（Prep Priorities）: ${result.fit_analysis.prep_priorities.join("; ")}`,
          ].join("\n"),
          coreResponsibilities: result.core_responsibilities.join("; "),
          implicitExpectations: result.implicit_expectations.join("; "),
          fitSummary: result.fit_analysis.fit_summary,
          keyGaps: result.fit_analysis.key_gaps.join("; "),
        }),
      });
      const data = (await response.json()) as {
        success?: boolean;
        warning?: string;
        extracted?: boolean;
        parsedData?: {
          title?: string;
          company?: string;
          role?: string;
          match_score?: number | null;
          priority?: string;
          key_requirements?: string[];
        };
        pageId?: string;
        prepSaved?: boolean;
        prepWarning?: string;
        error?: string;
      };
      if (!response.ok || !data.success || !data.parsedData) {
        console.error("❌ 前端接收数据失败:", data);
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      setSavedSuccess(true);
      if (typeof data.pageId === "string" && data.pageId) {
        setJdRecordId(data.pageId);
      }
      if (plan) {
        if (data.prepSaved) {
          setPrepSyncStatus("synced");
          setPrepSyncError("");
        } else if (data.prepWarning) {
          setPrepSyncStatus("failed");
          setPrepSyncError(data.prepWarning);
        } else if (prepSyncStatus === "pending") {
          setPrepSyncStatus("synced");
          setPrepSyncError("");
        }
      }
      window.setTimeout(() => setSavedSuccess(false), 2200);
      showToast(data.warning ? `✅ 已保存，但${data.warning}` : "✅ JD 已保存到 Notion（JD Records）");
      const parsedTitle =
        data.parsedData.title ||
        `${data.parsedData.company || ""} - ${data.parsedData.role || ""}`.replace(/^- |-$/g, "").trim() ||
        `JD 解码 ${new Date().toLocaleDateString()}`;
      const parsedCompany = data.parsedData.company || "(空)";
      const parsedRole = data.parsedData.role || "(空)";
      const parsedPriority = data.parsedData.priority || "中";
      const parsedRequirements = Array.isArray(data.parsedData.key_requirements) ? data.parsedData.key_requirements : [];
      setLastSavedMeta({
        title: parsedTitle,
        company: parsedCompany,
        role: parsedRole,
        matchScore:
          typeof data.parsedData?.match_score === "number" && Number.isFinite(data.parsedData.match_score)
            ? data.parsedData.match_score
            : null,
        priority: parsedPriority,
        keyRequirements: parsedRequirements,
        savedAt: new Date().toLocaleString("zh-CN"),
      });
      setStatus(
        `${plan ? "解码结果 + 7天清单已保存到 Notion。" : "已保存到 Notion JD 记录（JD Records）。"} 标题：${parsedTitle}`,
      );
    } catch {
      setStatus("保存失败，请检查 Notion 数据库字段。");
    } finally {
      setSaving(false);
    }
  };

  const onSave = async () => {
    if (!result) {
      setStatus("请先完成解码。");
      return;
    }

    if (!currentPrepPlan.trim()) {
      setShowSaveConfirm(true);
      return;
    }
    await doSaveToNotion();
  };

  const clearDraft = () => {
    setJdText("");
    setJdRecordId("");
    setScheduleChoice("pending");
    setResult(null);
    setLoadedFromHistory(false);
    setLoadedCompany("");
    setLoadedRole("");
    setDecodeRawText("");
    setDecodePrepMarkdown("");
      setIsNewlyDecoded(false);
      setIsNewlyPrepGenerated(false);
    setPlan(null);
    setPrepSyncStatus("idle");
    setPrepSyncError("");
    setShowSaveConfirm(false);
    setStatus("已清空 JD 解码草稿。");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(DECODE_DRAFT_KEY);
    }
  };

  if (!hydrated) {
    return (
      <main className="flex w-full flex-col gap-4">
        <section className="neon-card rounded-2xl p-6">
          <h1 className="text-2xl font-semibold">JD 解码</h1>
          <p className="mt-2 text-sm text-zinc-400">正在加载页面状态...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="flex w-full flex-col gap-4">
      <section className="neon-card rounded-2xl p-6">
        <h1 className="text-2xl font-semibold">JD 解码</h1>
        <p className="mt-2 text-sm text-zinc-400">
          用 AI 把 JD 拆解成六个维度，精准识别匹配度和差距，让每次投递都有的放矢。
        </p>
        {loadedFromHistory && (loadedCompany || loadedRole) ? (
          <p className="mt-2 text-xs text-cyan-200">
            当前历史岗位：{loadedCompany || "（未识别公司）"} · {loadedRole || "（未识别岗位）"}
          </p>
        ) : null}
        {loadedFromHistory && parseDebug ? (
          <p className="mt-1 text-[11px] text-zinc-500">
            历史解析：{parseDebug.mode}（core {parseDebug.lengths.core} / must {parseDebug.lengths.mustHave} / plus {parseDebug.lengths.plus} / culture {parseDebug.lengths.culture} / implicit {parseDebug.lengths.implicit}）
          </p>
        ) : null}
      </section>
      <PageGuide
        pageKey="decode"
        items={[
          "完整粘贴 JD 原文到左侧文本框。",
          "点击“开始解码”，等待 AI 分析（使用 Gemini 深度模型，约 10-15 秒）。",
          "右侧会显示：核心职责、必备技能、加分项、文化信号、隐含期望、匹配度分析。",
          "底部的差距分析告诉你需要重点准备什么。",
          "点“保存到 Notion”留档，方便后续对比。",
          "点“生成 7 天 Prep 清单”获取针对性备战计划。",
        ]}
      />
      <UpcomingInterviewFocus />
      {upcoming && scheduleChoice === "pending" ? (
        <section className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-sm">
          <p className="text-cyan-100">
            检测到最近面试：{upcoming.company} · {upcoming.role}。是否填入该面试的 JD 摘要？
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              onClick={() => {
                if (upcoming.jdSummary?.trim()) setJdText(upcoming.jdSummary.trim());
                setScheduleChoice("applied");
                setStatus(`已填入最近面试信息：${upcoming.company} · ${upcoming.role}`);
              }}
              className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-cyan-100"
            >
              填入最近面试信息
            </button>
            <button
              type="button"
              onClick={() => {
                setScheduleChoice("new");
                setStatus("已选择新建输入。");
              }}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1 text-zinc-200"
            >
              使用新信息
            </button>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        <div className="neon-card rounded-2xl p-4">
          <h2 className="mb-3 text-lg font-medium text-zinc-100">JD 原文</h2>
          <p className="mb-1 text-xs text-zinc-500">JD 文本</p>
          <textarea
            value={jdText}
            onChange={(event) => setJdText(event.target.value)}
            placeholder="在此粘贴完整 JD 文本..."
            className="h-[520px] w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-zinc-200"
          />
          <div className="mt-2 flex w-full items-end gap-2">
            <div className="w-[220px] shrink-0">
              <ModelSelect
                value={modelType}
                onChange={setModelType}
                storageKey="decode"
                recommended="pro"
                label="大模型"
                selectClassName="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
              />
            </div>
            {jdRecordPicker ? <div className="min-w-0 flex-1">{jdRecordPicker}</div> : null}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={onDecode}
              disabled={loading}
              className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100 transition hover:bg-cyan-500/20 disabled:opacity-50"
            >
              {loading ? <span className="loading-dots">解码中</span> : loadedFromHistory ? "重新解码" : "开始解码"}
            </button>
            <button
              type="button"
              onClick={onGeneratePlan}
              disabled={!result || planning}
              className="rounded-lg border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-sm text-violet-100 transition hover:bg-violet-500/20 disabled:opacity-50"
            >
              {planning ? "生成中..." : "生成 7 天 Prep 清单"}
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={!result || saving}
              className="rounded-lg border border-fuchsia-500/40 bg-fuchsia-500/10 px-3 py-2 text-sm text-fuchsia-100 transition hover:bg-fuchsia-500/20 disabled:opacity-50"
            >
              {saving ? "保存中..." : savedSuccess ? "✅ 已保存" : "保存到 Notion"}
            </button>
            <button
              type="button"
              onClick={clearDraft}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-500"
            >
              清空草稿
            </button>
          </div>
          <LoadingHint active={loading} text={status} className="mt-2" />
          {lastSavedMeta ? (
            <div className="mt-3 rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-3 text-xs text-emerald-100">
              <p className="font-semibold">✅ 已保存：{lastSavedMeta.title}</p>
              <p className="mt-1 text-zinc-200">
                匹配度：
                {typeof lastSavedMeta.matchScore === "number" ? `${lastSavedMeta.matchScore}/100` : "（空）"}
                （优先级：{lastSavedMeta.priority}）
              </p>
              <p className="mt-1 text-zinc-200">
                关键要求：
                {lastSavedMeta.keyRequirements.length > 0 ? lastSavedMeta.keyRequirements.join(" | ") : "（空）"}
              </p>
              <p className="mt-1 text-zinc-400">保存时间：{lastSavedMeta.savedAt}</p>
            </div>
          ) : null}
        </div>

        <div className="grid gap-3">
          <Section title="核心职责" items={result?.core_responsibilities ?? []} />
          <Section title="必备技能" items={result?.must_have_skills ?? []} />
          <Section title="加分项" items={result?.plus_points ?? []} />
          <Section title="文化信号" items={result?.culture_signals ?? []} />
          <Section title="隐含期望" items={result?.implicit_expectations ?? []} />
          <div className="neon-card rounded-xl p-4">
            <h3 className="mb-2 text-sm font-semibold text-zinc-100">匹配度分析</h3>
            <p className="text-sm text-zinc-300">{result?.fit_analysis.fit_summary ?? "暂无结果"}</p>
          </div>
        </div>
      </section>

      <section className="neon-card rounded-2xl p-4">
        <h2 className="mb-2 text-lg font-medium text-zinc-100">匹配度分数与差距分析</h2>
        <p className="text-sm text-zinc-300">
          匹配度：
          <span className="ml-1 font-semibold text-cyan-200">
            {scoreDisplay}
          </span>
        </p>
        <div className="mt-2 grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
            <p className="mb-1 text-xs text-zinc-500">关键差距</p>
            <ul className="space-y-1 text-sm text-zinc-300">
              {(result?.fit_analysis.key_gaps ?? []).map((gap, index) => (
                <li key={`gap-${index}`}>- {gap}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
            <p className="mb-1 text-xs text-zinc-500">准备优先级</p>
            <ul className="space-y-1 text-sm text-zinc-300">
              {(result?.fit_analysis.prep_priorities ?? []).map((item, index) => (
                <li key={`prep-${index}`}>- {item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {prepMarkdownForRender ? (
        <section className="neon-card rounded-2xl p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-medium text-zinc-100">7 天 Prep 清单</h2>
              <span
                title={prepSyncStatus === "pending" ? "点击“保存到 Notion”后将与 JD 一起入库" : undefined}
                className={`rounded-md border px-2 py-0.5 text-[11px] ${
                  prepSyncStatus === "synced"
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                    : prepSyncStatus === "saving"
                      ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-200"
                      : prepSyncStatus === "pending"
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                      : prepSyncStatus === "failed"
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                        : "border-zinc-700 bg-zinc-900 text-zinc-400"
                }`}
              >
                {prepSyncStatus === "synced"
                  ? "✅ 已同步"
                  : prepSyncStatus === "saving"
                    ? "同步中..."
                    : prepSyncStatus === "pending"
                      ? "待保存"
                    : prepSyncStatus === "failed"
                      ? "❌ 同步失败"
                      : "未同步"}
              </span>
              {prepSyncStatus === "failed" && plan ? (
                <button
                  type="button"
                  onClick={async () => {
                    const markdown = buildPrepPlanMarkdown(result!, plan);
                    await syncPrepPlanToNotion(markdown);
                  }}
                  className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-200"
                >
                  重试
                </button>
              ) : null}
            </div>
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={async () => {
                  if (!prepMarkdownForRender) return;
                  try {
                    await navigator.clipboard.writeText(prepMarkdownForRender);
                    showToast("已复制 Prep Markdown");
                  } catch {
                    setStatus("复制失败，请手动复制。");
                  }
                }}
                className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2 py-1 text-cyan-100"
              >
                一键复制 Markdown
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!prepMarkdownForRender) return;
                  const blob = new Blob([prepMarkdownForRender], { type: "text/markdown;charset=utf-8" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `prep-${new Date().toISOString().slice(0, 10)}.md`;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  URL.revokeObjectURL(url);
                  showToast("已导出 Markdown 文件");
                }}
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-200"
              >
                导出 Markdown
              </button>
            </div>
          </div>
          {plan ? <p className="mb-3 text-sm text-zinc-400">{plan.goal}</p> : null}
          {prepSyncStatus === "failed" && prepSyncError ? (
            <p className="mb-2 text-xs text-amber-300">同步失败原因：{prepSyncError}</p>
          ) : null}
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {prepCards.length > 0 ? (
              prepCards.map((card) => (
                <div
                  key={card.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3 transition-colors hover:border-violet-500/40"
                >
                  <h4 className="mb-2 text-sm font-semibold text-zinc-200">
                    {card.title}
                  </h4>
                  <div className="space-y-1 whitespace-pre-wrap text-sm text-zinc-400">
                    {card.content.split("\n").map((line, i) => (
                      <p key={i} className="flex items-start">
                        {line.trim().startsWith("-") ? (
                          <>
                            <span className="mr-2 mt-0.5 text-violet-400">•</span>
                            <span>{line.replace(/^-/, "").trim()}</span>
                          </>
                        ) : (
                          line
                        )}
                      </p>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-zinc-500">暂无 Prep 清单数据</div>
            )}
          </div>
        </section>
      ) : null}
      {toast ? (
        <div className="fixed bottom-4 right-4 z-[60] rounded-xl border border-emerald-500/40 bg-zinc-950/95 px-3 py-2 text-xs text-zinc-100 shadow-xl">
          {toast}
        </div>
      ) : null}

      {showSaveConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="neon-card w-full max-w-md rounded-2xl p-5">
            <h3 className="text-lg font-semibold text-zinc-100">保存前确认</h3>
            <p className="mt-2 text-sm text-zinc-400">
              当前还未生成 7 天 Prep 清单。你可以先生成清单再保存，或仅保存解码结果。
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={async () => {
                  setShowSaveConfirm(false);
                  await onGeneratePlan();
                  setStatus("清单生成完成后，请再次点击保存到 Notion。");
                }}
                className="rounded-lg border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-sm text-violet-100 transition hover:bg-violet-500/20"
              >
                先生成清单
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowSaveConfirm(false);
                  await doSaveToNotion();
                }}
                className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100 transition hover:bg-cyan-500/20"
              >
                仅保存解码
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSaveConfirm(false);
                  setStatus("已取消保存。");
                }}
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 transition hover:border-zinc-500"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
