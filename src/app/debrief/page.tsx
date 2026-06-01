"use client";

import { useEffect, useMemo, useState } from "react";
import { LoadingHint } from "@/components/LoadingHint";
import { PageGuide } from "@/components/PageGuide";
import { ModelSelect } from "@/components/ModelSelect";
import VoiceInputButton from "@/components/VoiceInputButton";
import { toastFetch } from "@/lib/toast-utils";
import { INTERVIEW_INTELLIGENCE_KEY } from "@/lib/practice";
import type { ModelType } from "@/lib/llm";
import { readModelSelection, writeModelSelection } from "@/lib/model-selection";

type InterviewType = "Behavioral" | "Case Study" | "Technical" | "Panel";
type DebriefResult = {
  summary: {
    overall_assessment: string;
    hire_signal?: string;
    top_strengths?: string[];
    top_risks?: string[];
    priority_actions?: string[];
  };
  answer_reviews: Array<{
    question: string;
    candidate_answer: string;
    scores: {
      Substance: number;
      Structure: number;
      Relevance: number;
      Credibility: number;
      Differentiation: number;
    };
    strengths: string[];
    weaknesses: string[];
    improved_answer: string;
    coaching_note: string;
  }>;
};

type InterviewRecordOption = {
  id: string;
  title: string;
  company: string;
  role: string;
  date: string;
};

const feedbackResultOptions = [
  { value: "pending", label: "待定（pending）" },
  { value: "advanced", label: "进入下一轮（advanced）" },
  { value: "rejected", label: "未通过（rejected）" },
  { value: "offer", label: "拿到 offer（offer）" },
] as const;

const interviewTypeOptions: Array<{ value: InterviewType; label: string }> = [
  { value: "Behavioral", label: "行为面（Behavioral）" },
  { value: "Case Study", label: "案例分析（Case Study）" },
  { value: "Technical", label: "技术面（Technical）" },
  { value: "Panel", label: "文化匹配（Culture Fit）" },
];

export default function DebriefPage() {
  const [selectedRecordId, setSelectedRecordId] = useState("");
  const [recordOptions, setRecordOptions] = useState<InterviewRecordOption[]>([]);
  const [prepContext, setPrepContext] = useState("");
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [company, setCompany] = useState("");
  const [round, setRound] = useState("");
  const [interviewType, setInterviewType] = useState<InterviewType>("Behavioral");
  const [transcript, setTranscript] = useState("");
  const [normalizedTranscript, setNormalizedTranscript] = useState("");
  const [result, setResult] = useState<DebriefResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("等待分析");
  const [usedStories, setUsedStories] = useState("");
  const [signalNotes, setSignalNotes] = useState("");
  const [feedbackResult, setFeedbackResult] = useState("pending");
  const [feedbackText, setFeedbackText] = useState("");
  const [modelType, setModelType] = useState<ModelType>(() => readModelSelection("debrief", "practice"));
  const [syncingQuestionBank, setSyncingQuestionBank] = useState(false);
  useEffect(() => {
    writeModelSelection("debrief", modelType);
  }, [modelType]);

  useEffect(() => {
    let mounted = true;
    async function loadInterviewRecords() {
      setLoadingRecords(true);
      try {
        const response = await fetch("/api/notion?resource=hype-records", { cache: "no-store" });
        const payload = (await response.json()) as {
          records?: InterviewRecordOption[];
          error?: string;
          detail?: string;
        };
        if (!response.ok) {
          throw new Error(payload.detail || payload.error || `HTTP ${response.status}`);
        }
        if (!mounted) return;
        setRecordOptions(Array.isArray(payload.records) ? payload.records : []);
      } catch (error) {
        if (!mounted) return;
        setStatus(error instanceof Error ? error.message : "加载面试记录失败。");
      } finally {
        if (mounted) setLoadingRecords(false);
      }
    }
    void loadInterviewRecords();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadPrepContext() {
      if (!selectedRecordId) {
        setPrepContext("");
        return;
      }
      try {
        const selected = recordOptions.find((item) => item.id === selectedRecordId);
        if (selected?.company) {
          setCompany(selected.company);
        }
        const response = await fetch(
          `/api/notion?resource=hype-record-content&pageId=${encodeURIComponent(selectedRecordId)}`,
          { cache: "no-store" },
        );
        const payload = (await response.json()) as { content?: string; error?: string; detail?: string };
        if (!response.ok) {
          throw new Error(payload.detail || payload.error || `HTTP ${response.status}`);
        }
        if (!mounted) return;
        setPrepContext(String(payload.content ?? "").trim());
      } catch (error) {
        if (!mounted) return;
        setPrepContext("");
        setStatus(error instanceof Error ? error.message : "加载备战上下文失败。");
      }
    }
    void loadPrepContext();
    return () => {
      mounted = false;
    };
  }, [selectedRecordId, recordOptions]);

  const scoreAverages = useMemo(() => {
    if (!result || result.answer_reviews.length === 0) {
      return null;
    }
    const totals = result.answer_reviews.reduce(
      (acc, item) => {
        acc.substance += item.scores.Substance;
        acc.structure += item.scores.Structure;
        acc.relevance += item.scores.Relevance;
        acc.credibility += item.scores.Credibility;
        acc.differentiation += item.scores.Differentiation;
        return acc;
      },
      { substance: 0, structure: 0, relevance: 0, credibility: 0, differentiation: 0 },
    );
    const count = result.answer_reviews.length;
    return {
      Substance: Number((totals.substance / count).toFixed(1)),
      Structure: Number((totals.structure / count).toFixed(1)),
      Relevance: Number((totals.relevance / count).toFixed(1)),
      Credibility: Number((totals.credibility / count).toFixed(1)),
      Differentiation: Number((totals.differentiation / count).toFixed(1)),
    };
  }, [result]);

  const onAnalyze = async () => {
    if (!company.trim() || !round.trim() || !transcript.trim()) {
      setStatus("请完整填写顶部表单并粘贴面试记录。");
      return;
    }
    setLoading(true);
    setStatus("正在使用 DeepSeek V4-Pro 整理逐字稿并生成复盘...");
    try {
      const response = await fetch("/api/debrief/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, round, interviewType, transcript, prepContext, modelType }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = (await response.json()) as { result?: DebriefResult; normalizedTranscript?: string };
      if (!payload.result?.answer_reviews) {
        throw new Error("复盘结果格式错误");
      }
      setResult(payload.result);
      setNormalizedTranscript(String(payload.normalizedTranscript ?? "").trim());
      setStatus("复盘分析完成。");
    } catch {
      setStatus("分析失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  };

  const onSave = async () => {
    if (!result || !scoreAverages) {
      setStatus("请先完成复盘分析。");
      return;
    }
    if (!selectedRecordId) {
      setStatus("请先选择一条关联的面试记录。");
      return;
    }
    setSaving(true);

    const today = new Date().toISOString().slice(0, 10);
    const analysisText = [
      "## 复盘总评",
      result.summary.overall_assessment,
      "",
      `- Hire Signal: ${result.summary.hire_signal ?? "n/a"}`,
      `- 五维平均分: Substance ${scoreAverages.Substance} / Structure ${scoreAverages.Structure} / Relevance ${scoreAverages.Relevance} / Credibility ${scoreAverages.Credibility} / Differentiation ${scoreAverages.Differentiation}`,
      "",
      "## 关键优势",
      ...(result.summary.top_strengths?.length ? result.summary.top_strengths.map((item) => `- ${item}`) : ["- 暂无"]),
      "",
      "## 关键风险",
      ...(result.summary.top_risks?.length ? result.summary.top_risks.map((item) => `- ${item}`) : ["- 暂无"]),
      "",
      "## 下一步动作",
      ...(result.summary.priority_actions?.length ? result.summary.priority_actions.map((item) => `- ${item}`) : ["- 暂无"]),
      "",
      "## 面试官信号",
      signalNotes.trim() || "暂无补充",
      "",
      "## 逐题复盘",
      ...result.answer_reviews.flatMap((item, index) => [
        `### Q${index + 1}: ${item.question}`,
        `- 优势: ${item.strengths.join("；") || "暂无"}`,
        `- 不足: ${item.weaknesses.join("；") || "暂无"}`,
        `- 教练建议: ${item.coaching_note || "暂无"}`,
        `- 改写答案: ${item.improved_answer || "暂无"}`,
        "",
      ]),
    ].join("\n");
    const questionBankSummary = result.answer_reviews.map((item) => item.question).filter(Boolean).join(" | ");
    const recruiterFeedback = feedbackText.trim()
      ? `${feedbackResult}: ${feedbackText.trim()}`
      : feedbackResult;
    const outcomeLog = `${company} ${round} -> ${feedbackResult}`;

    toastFetch(
      "/api/notion",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resource: "interview",
          action: "update",
          pageId: selectedRecordId,
          title: `[备战简报] ${company} - ${round} - 复盘更新 ${today}`,
          questionBank: questionBankSummary,
          recruiterFeedback,
          outcomeLog,
          intelligenceJson: JSON.stringify({ usedStories, signalNotes, feedbackResult, feedbackText }, null, 2),
          analysisInPageBodyMarkdown: analysisText,
        }),
      },
      {
        loading: "正在保存到面试记录（Interview Records）...",
        success: "✅ 已更新到原始 Notion 面试记录",
        error: (err) => `❌ 保存失败：${err.message}`,
      },
      () => {
        const ids = usedStories
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean);
        if (ids.length > 0) {
          void (async () => {
            const storiesResponse = await fetch("/api/notion/stories", { cache: "no-store" });
            const storyPayload = (await storiesResponse.json()) as {
              stories?: Array<{ id: string; title: string; useCount: number }>;
            };
            const stories = storyPayload.stories ?? [];
            await Promise.all(
              ids.map(async (rawKey) => {
                const key = rawKey.toLowerCase();
                const matched =
                  stories.find((s) => s.id.toLowerCase() === key) ??
                  stories.find((s) => s.title.toLowerCase().includes(key));
                if (!matched) return;
                toastFetch(
                  "/api/notion/stories",
                  {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "usage",
                      pageId: matched.id,
                      useCount: (matched.useCount ?? 0) + 1,
                      lastUsed: new Date().toISOString().slice(0, 10),
                    }),
                  },
                  {
                    loading: `正在更新故事「${matched.title}」使用次数...`,
                    success: `✅ 故事「${matched.title}」使用次数已更新`,
                    error: (err) => `❌ 故事更新失败：${err.message}`,
                  },
                );
              }),
            );
          })();
        }
        const questionBankRows = result.answer_reviews.map((item) => ({
          type: "question_bank",
          source: "debrief",
          date: today,
          company,
          role: "AI Product Manager",
          roundType: interviewType,
          question: item.question,
          competency: item.coaching_note,
          score: Number(
            (
              (item.scores.Substance +
                item.scores.Structure +
                item.scores.Relevance +
                item.scores.Credibility +
                item.scores.Differentiation) /
              5
            ).toFixed(1),
          ),
          outcome: feedbackResult,
          ts: new Date().toISOString(),
        }));
        const feedbackRow = {
          type: "feedback",
          source: "debrief",
          date: today,
          company,
          feedback: feedbackText,
          linkedDimension: result.summary.top_risks?.[0] ?? "n/a",
          outcome: feedbackResult,
          ts: new Date().toISOString(),
        };
        const outcomeRow = {
          type: "outcome",
          source: "debrief",
          date: today,
          company,
          role: "AI Product Manager",
          round,
          result: feedbackResult,
          notes: signalNotes || result.summary.overall_assessment,
          ts: new Date().toISOString(),
        };
        try {
          const raw = window.localStorage.getItem(INTERVIEW_INTELLIGENCE_KEY);
          const prev = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
          const merged = [
            ...questionBankRows,
            ...(feedbackText.trim() ? [feedbackRow] : []),
            outcomeRow,
            ...prev,
          ].slice(0, 300);
          window.localStorage.setItem(INTERVIEW_INTELLIGENCE_KEY, JSON.stringify(merged));
        } catch {
          const boot = [...questionBankRows, ...(feedbackText.trim() ? [feedbackRow] : []), outcomeRow].slice(0, 300);
          window.localStorage.setItem(INTERVIEW_INTELLIGENCE_KEY, JSON.stringify(boot));
        }
        void (async () => {
          try {
            setSyncingQuestionBank(true);
            const questions = result.answer_reviews
              .map((item) => item.question?.trim())
              .filter(Boolean);
            await Promise.all(
              questions.map(async (question) => {
                toastFetch(
                  "/api/question-bank",
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "create",
                      item: {
                        title: question,
                        category:
                          interviewType === "Technical"
                            ? "Technical"
                            : interviewType === "Case Study"
                              ? "Case Study"
                              : "Behavioral",
                        source: "真实面试",
                        company: company.trim(),
                        role: "AI Product Manager",
                        difficulty: "中等",
                        myAnswer: "",
                        aiFeedback: "来源：Debrief 真实面试题自动入库",
                        bestStory: "",
                        tags: [],
                        practiceCount: 0,
                        lastScore: 0,
                        lastPracticed: "",
                        status: "未练习",
                      },
                    }),
                  },
                  {
                    loading: `正在将面试题「${question.slice(0, 30)}」加入题库...`,
                    success: `✅ 面试题已加入题库`,
                    error: (err) => `❌ 加入题库失败：${err.message}`,
                  },
                );
              }),
            );
          } finally {
            setSyncingQuestionBank(false);
          }
        })();
        setStatus("已更新到原始 Notion 面试记录（Interview Records）。");
      },
    );

    setSaving(false);
  };

  const onBatchAddToQuestionBank = async () => {
    if (!result?.answer_reviews?.length) {
      setStatus("暂无可导入题目。");
      return;
    }
    setSyncingQuestionBank(true);
    const items = result.answer_reviews
      .map((item) => item.question?.trim())
      .filter(Boolean)
      .map((question) => ({
        title: question,
        category:
          interviewType === "Technical"
            ? "Technical"
            : interviewType === "Case Study"
              ? "Case Study"
              : "Behavioral",
        source: "真实面试",
        company: company.trim(),
        role: "AI Product Manager",
        difficulty: "中等",
        myAnswer: "",
        aiFeedback: "来源：Debrief 批量加入题库",
        bestStory: "",
        tags: [],
        practiceCount: 0,
        lastScore: 0,
        lastPracticed: "",
        status: "未练习",
      }));
    toastFetch(
      "/api/questions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      },
      {
        loading: `正在批量导入 ${items.length} 道题至题库...`,
        success: `✅ 已批量加入题库 ${items.length} 道题`,
        error: (err) => `❌ 批量加入题库失败：${err.message}`,
      },
      () => {
        setStatus(`已批量加入题库 ${items.length} 道题。`);
      },
    );
    setSyncingQuestionBank(false);
  };

  return (
    <main className="flex w-full flex-col gap-4">
      <section className="neon-card rounded-2xl p-6">
        <h1 className="text-2xl font-semibold">面试复盘</h1>
        <p className="mt-2 text-sm text-zinc-400">
          面试结束后趁热复盘。粘贴对话记录或回忆要点，AI 帮你逐题分析优缺点。
        </p>
      </section>
      <PageGuide
        pageKey="debrief"
        items={[
          "填写公司名、轮次、面试类型。",
          "在文本框中尽可能详细地回忆面试问题和你的回答。",
          "点“AI 复盘分析”获取逐题分析和整体建议。",
          "点“保存到记录”存档，在成长进度中追踪变化。",
          "补充使用故事、面试官信号、招聘方反馈（recruiter feedback），供成长进度情报使用。",
        ]}
      />
      <section className="neon-card rounded-2xl p-6">
        <div className="grid gap-2 md:grid-cols-2">
          <div className="grid gap-1 md:col-span-2">
            <p className="text-xs text-zinc-500">关联已有面试安排</p>
            <select
              value={selectedRecordId}
              onChange={(event) => setSelectedRecordId(event.target.value)}
              disabled={loadingRecords}
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm disabled:opacity-50"
            >
              <option value="">
                {loadingRecords ? "加载 Interview Records 中..." : "选择已有 Interview Record（自动回填公司与备战上下文）"}
              </option>
              {recordOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  [{(item.date || "").slice(0, 10) || "无日期"}] {item.company || "未知公司"} - {item.role || item.title}
                </option>
              ))}
            </select>
          </div>
          {prepContext ? (
            <div className="md:col-span-2">
              <details className="group rounded-lg border border-zinc-700/50 bg-zinc-800/30 transition-colors open:bg-zinc-800/50">
                <summary className="flex cursor-pointer list-none items-center p-3 text-xs font-medium text-zinc-400 hover:text-zinc-300">
                  <span className="mr-2">👁️</span>
                  查看当前用于复盘对比的备战简报上下文
                  <span className="ml-auto transition group-open:rotate-180">▼</span>
                </summary>
                <div className="max-h-48 overflow-y-auto whitespace-pre-wrap border-t border-zinc-700/50 p-3 font-mono text-xs leading-relaxed text-zinc-500">
                  {prepContext}
                </div>
              </details>
            </div>
          ) : null}
          <div className="grid gap-1">
            <p className="text-xs text-zinc-500">公司名</p>
            <input
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              placeholder="公司名"
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid gap-1">
            <p className="text-xs text-zinc-500">面试轮次</p>
            <input
              value={round}
              onChange={(event) => setRound(event.target.value)}
              placeholder="面试轮次（如：一面 / HM round）"
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid gap-1">
            <p className="text-xs text-zinc-500">面试类型</p>
            <select
              value={interviewType}
              onChange={(event) => setInterviewType(event.target.value as InterviewType)}
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            >
              {interviewTypeOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1">
            <ModelSelect
              value={modelType}
              onChange={setModelType}
              storageKey="debrief"
              recommended="practice"
              label="大模型"
              selectClassName="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </section>

      <section className="neon-card rounded-2xl p-4">
        <div className="mb-2 grid gap-2 md:grid-cols-2">
          <div className="grid gap-1">
            <p className="text-xs text-zinc-500">本场使用故事 ID</p>
            <textarea
              value={usedStories}
              onChange={(e) => setUsedStories(e.target.value)}
              placeholder="输入使用的核心项目/故事（支持直接描述或输入编号）"
              className="min-h-20 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid gap-1">
            <p className="text-xs text-zinc-500">面试官信号</p>
            <input value={signalNotes} onChange={(e) => setSignalNotes(e.target.value)} placeholder="面试官信号（参与度/怀疑/兴趣）" className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" />
          </div>
          <div className="grid gap-1">
            <p className="text-xs text-zinc-500">结果状态</p>
            <select value={feedbackResult} onChange={(e) => setFeedbackResult(e.target.value)} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
              {feedbackResultOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1">
            <p className="text-xs text-zinc-500">招聘方反馈（可选）</p>
            <input value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} placeholder="招聘方反馈内容（recruiter，可选）" className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" />
          </div>
        </div>
        <p className="mb-1 text-xs text-zinc-500">面试记录/回忆要点</p>
        <textarea
          value={transcript}
          onChange={(event) => setTranscript(event.target.value)}
          placeholder={`可直接粘贴整场面试逐字稿（推荐）：\n- Zoom/飞书/腾讯会议转录全文\n- 你和面试官的完整 Q&A 对话\n\nAI 会先自动整理为结构化要点，再进行复盘分析。\n\n也可手动回忆：\n1. 哪个问题最难答？\n2. 面试官反复追问了什么？\n3. 有哪些意外提问？`}
          className="h-56 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm"
        />
        <div className="mt-2 flex items-center justify-end">
          <VoiceInputButton
            compact
            onTranscribe={(text) => {
              setTranscript((prev) => (prev.trim() ? `${prev}\n${text}` : text));
              setStatus("已将语音识别内容追加到复盘文本。");
            }}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onAnalyze}
            disabled={loading}
            className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100 transition hover:bg-cyan-500/20 disabled:opacity-50"
          >
            {loading ? <span className="loading-dots">分析中</span> : "AI 复盘分析"}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!result || saving || !selectedRecordId}
            className="rounded-lg border border-fuchsia-500/40 bg-fuchsia-500/10 px-3 py-2 text-sm text-fuchsia-100 transition hover:bg-fuchsia-500/20 disabled:opacity-50"
          >
            {saving ? <span className="loading-dots">保存中</span> : "保存到记录"}
          </button>
          <button
            type="button"
            onClick={onBatchAddToQuestionBank}
            disabled={!result || syncingQuestionBank}
            className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100 transition hover:bg-emerald-500/20 disabled:opacity-50"
          >
            {syncingQuestionBank ? <span className="loading-dots">导入中</span> : "批量加入题库"}
          </button>
        </div>
        <LoadingHint active={loading || saving || syncingQuestionBank} text={status} className="mt-2" />
      </section>

      {normalizedTranscript ? (
        <section className="neon-card rounded-2xl p-4">
          <details className="group rounded-lg border border-zinc-700/50 bg-zinc-900/30 transition-colors open:bg-zinc-900/50">
            <summary className="flex cursor-pointer list-none items-center p-3 text-xs font-medium text-zinc-400 hover:text-zinc-300">
              <span className="mr-2">🧾</span>
              查看 AI 自动整理后的逐字稿要点（用于本轮复盘）
              <span className="ml-auto transition group-open:rotate-180">▼</span>
            </summary>
            <div className="max-h-72 overflow-y-auto whitespace-pre-wrap border-t border-zinc-700/50 p-3 font-mono text-xs leading-relaxed text-zinc-300">
              {normalizedTranscript}
            </div>
          </details>
        </section>
      ) : null}

      {result ? (
        <section className="grid gap-3">
          <div className="neon-card rounded-2xl p-4">
            <h2 className="text-lg font-medium text-zinc-100">五维平均评分</h2>
            {scoreAverages ? (
              <div className="mt-2 grid gap-2 sm:grid-cols-5 text-sm text-zinc-300">
                <p>表达力（Substance）：{scoreAverages.Substance}</p>
                <p>结构性（Structure）：{scoreAverages.Structure}</p>
                <p>相关性（Relevance）：{scoreAverages.Relevance}</p>
                <p>可信度（Credibility）：{scoreAverages.Credibility}</p>
                <p>差异化（Differentiation）：{scoreAverages.Differentiation}</p>
              </div>
            ) : null}
          </div>
          {result.answer_reviews.map((item, index) => (
            <article key={index} className="neon-card rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-zinc-100">Q{index + 1}: {item.question}</h3>
              <p className="mt-2 text-xs text-zinc-500">
                五维评分 - S:{item.scores.Substance} / St:{item.scores.Structure} / R:
                {item.scores.Relevance} / C:{item.scores.Credibility} / D:
                {item.scores.Differentiation}
              </p>
              <p className="mt-2 text-sm text-zinc-300">优势：{item.strengths.join("；")}</p>
              <p className="mt-1 text-sm text-zinc-400">不足：{item.weaknesses.join("；")}</p>
              <p className="mt-1 text-sm text-zinc-300">改进建议：{item.coaching_note}</p>
            </article>
          ))}
        </section>
      ) : null}
    </main>
  );
}
