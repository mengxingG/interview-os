"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import EvaluatePage from "@/app/evaluate/page";
import ChatPanel from "@/components/ChatPanel";
import type { ChatMessageView } from "@/components/ChatPanel";
import { PageGuide } from "@/components/PageGuide";
import { UpcomingInterviewFocus } from "@/components/UpcomingInterviewFocus";
import { toastFetch } from "@/lib/toast-utils";
import { MOCK_REPORT_SELECTED_KEY, PRACTICE_HISTORY_KEY, PRACTICE_PROGRESS_KEY, PRACTICE_STAGES } from "@/lib/practice";
import { userProfile } from "@/lib/user-profile";

type QuickMockStage = "product_sense" | "technical" | "execution" | "behavioral";

type ResumeBaseOption = {
  id: string;
  title: string;
  optimizedText: string;
  isActive?: boolean;
};

type JdOption = {
  id: string;
  title: string;
  jdText: string;
  source?: "jd" | "prep";
};

type FullLoopStageKey = "product_sense" | "technical" | "execution" | "behavioral";
type StageTransitionPayload = { notice: string; currentStage?: string; nextStage?: string };
type MockTrack = "full-loop" | "quick";

const FULL_LOOP_STAGES: Array<{
  key: FullLoopStageKey;
  label: string;
  kickoff: string;
}> = [
  { key: "product_sense", label: "产品思维", kickoff: "候选人已准备好，请开始产品思维考察。" },
  { key: "technical", label: "技术与架构", kickoff: "候选人已准备好，请开始技术与架构深度面。" },
  { key: "execution", label: "执行与数据指标", kickoff: "候选人已准备好，请开始执行与数据指标考察。" },
  { key: "behavioral", label: "行为与领导力", kickoff: "候选人已准备好，请开始行为与领导力考察。" },
];

const QUICK_MOCK_OPTIONS: Array<{ key: QuickMockStage; label: string }> = [
  { key: "product_sense", label: "产品思维与业务嗅觉 (Product Sense)" },
  { key: "technical", label: "技术深度与架构 (Technical & System)" },
  { key: "execution", label: "执行力与数据指标 (Execution & Analytics)" },
  { key: "behavioral", label: "行为面与领导力 (Behavioral & Leadership)" },
];

export default function MockPage() {
  const [mode, setMode] = useState<"mock" | "practice">(() => {
    if (typeof window === "undefined") return "mock";
    const queryMode = new URLSearchParams(window.location.search).get("mode");
    return queryMode === "practice" ? "practice" : "mock";
  });
  const [mockTrack, setMockTrack] = useState<MockTrack>("full-loop");
  const [quickMockStage, setQuickMockStage] = useState<QuickMockStage>("product_sense");
  const [practiceStage, setPracticeStage] = useState<number>(() => {
    if (typeof window === "undefined") return userProfile.drillProgress.currentStage;
    const stageParam = Number(new URLSearchParams(window.location.search).get("stage"));
    return Number.isFinite(stageParam) && stageParam >= 1 && stageParam <= 8
      ? stageParam
      : userProfile.drillProgress.currentStage;
  });
  const [practiceQuestion, setPracticeQuestion] = useState("");
  const [practiceQuestionId, setPracticeQuestionId] = useState("");
  const [questionSource, setQuestionSource] = useState<"ai" | "question-bank">("ai");
  const [questionBankCompany, setQuestionBankCompany] = useState("");
  const [practiceAnswer, setPracticeAnswer] = useState("");
  const [practiceChatMessages, setPracticeChatMessages] = useState<ChatMessageView[]>([]);
  const [mockChatMessages, setMockChatMessages] = useState<ChatMessageView[]>([]);
  const [mockStageIndex, setMockStageIndex] = useState(0);
  const [mockStageTransitioning, setMockStageTransitioning] = useState(false);
  const [mockKickoffPrompt, setMockKickoffPrompt] = useState("");
  const [mockKickoffNonce, setMockKickoffNonce] = useState(0);
  const [selfScore, setSelfScore] = useState(3);
  const [practiceResult, setPracticeResult] = useState<Record<string, unknown> | null>(null);
  const [status, setStatus] = useState("");
  const [archivingMockReport, setArchivingMockReport] = useState(false);
  const [progressStage, setProgressStage] = useState<number>(() => {
    if (typeof window === "undefined") return userProfile.drillProgress.currentStage;
    const raw = window.localStorage.getItem(PRACTICE_PROGRESS_KEY);
    if (!raw) return userProfile.drillProgress.currentStage;
    try {
      const parsed = JSON.parse(raw) as { stage?: number };
      return parsed.stage ?? userProfile.drillProgress.currentStage;
    } catch {
      return userProfile.drillProgress.currentStage;
    }
  });
  const [stageStreak, setStageStreak] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    try {
      const raw = window.localStorage.getItem(PRACTICE_PROGRESS_KEY);
      const parsed = raw ? (JSON.parse(raw) as { streak?: number }) : {};
      return parsed.streak ?? 0;
    } catch {
      return 0;
    }
  });
  const [storyCount, setStoryCount] = useState<number>(0);
  const [ttsMuted, setTtsMuted] = useState(false);
  const [ttsVoice, setTtsVoice] = useState("Ethan");
  const [resumeBaseOptions, setResumeBaseOptions] = useState<ResumeBaseOption[]>([]);
  const [jdOptions, setJdOptions] = useState<JdOption[]>([]);
  const [selectedResumeBaseId, setSelectedResumeBaseId] = useState("");
  const [selectedJdContextId, setSelectedJdContextId] = useState("");
  const [loadingResumeBases, setLoadingResumeBases] = useState(false);
  const [loadingJdOptions, setLoadingJdOptions] = useState(false);
  const [dynamicGreeting, setDynamicGreeting] = useState("正在准备面试官开场...");
  const autoEndedMessageIdRef = useRef("");
  const reportsSectionRef = useRef<HTMLDivElement | null>(null);
  const currentMockStage = FULL_LOOP_STAGES[mockStageIndex] ?? FULL_LOOP_STAGES[0];
  const resolvedMockStage: FullLoopStageKey =
    mockTrack === "full-loop" ? currentMockStage.key : quickMockStage;
  const resolvedMockFormatText =
    mockTrack === "full-loop"
      ? "全真连面（Full Loop）"
      : QUICK_MOCK_OPTIONS.find((item) => item.key === quickMockStage)?.label ?? "单项突击（Quick Mock）";
  const selectedResumeBaseText = useMemo(
    () => resumeBaseOptions.find((item) => item.id === selectedResumeBaseId)?.optimizedText ?? "",
    [resumeBaseOptions, selectedResumeBaseId],
  );
  const selectedJdContextText = useMemo(
    () => jdOptions.find((item) => item.id === selectedJdContextId)?.jdText ?? "",
    [jdOptions, selectedJdContextId],
  );

  const loadResumeBaseOptions = async () => {
    setLoadingResumeBases(true);
    try {
      const response = await fetch("/api/notion?resource=resume-bases", { cache: "no-store" });
      const payload = (await response.json()) as { records?: Array<{ id: string; title: string; optimizedText: string }>; error?: string };
      if (!response.ok) throw new Error(payload.error || "加载简历底本失败");
      const rows = (payload.records ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        optimizedText: row.optimizedText || "",
        isActive: Boolean((row as { isActive?: unknown }).isActive),
      }));
      setResumeBaseOptions(rows);
      const activeBaseId = rows.find((item) => item.isActive)?.id ?? "";
      if (activeBaseId) {
        setSelectedResumeBaseId((prev) => prev || activeBaseId);
      }
    } catch {
      setStatus("加载简历底本失败。");
    } finally {
      setLoadingResumeBases(false);
    }
  };

  const loadJdContextOptions = async () => {
    setLoadingJdOptions(true);
    try {
      const [jdResponse, prepResponse] = await Promise.all([
        fetch("/api/notion?resource=jd", { cache: "no-store" }),
        fetch("/api/notion?resource=hype-records", { cache: "no-store" }),
      ]);
      const jdPayload = (await jdResponse.json()) as { records?: Array<{ id: string; title: string; jdText: string }>; error?: string };
      if (!jdResponse.ok) throw new Error(jdPayload.error || "加载 JD 记录失败");
      const prepPayload = (await prepResponse.json()) as {
        records?: Array<{ id: string; company?: string; role?: string; date?: string; title?: string }>;
        error?: string;
      };
      if (!prepResponse.ok) throw new Error(prepPayload.error || "加载备战简报失败");

      const jdRows: JdOption[] = (jdPayload.records ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        jdText: row.jdText || "",
        source: "jd",
      }));

      const prepRows = Array.isArray(prepPayload.records) ? prepPayload.records : [];
      const prepRowsResolved = await Promise.all(
        prepRows.slice(0, 10).map(async (row) => {
          try {
            const contentResp = await fetch(`/api/notion?resource=hype-record-content&pageId=${encodeURIComponent(row.id)}`, {
              cache: "no-store",
            });
            const contentPayload = (await contentResp.json()) as { content?: string; error?: string };
            if (!contentResp.ok) throw new Error(contentPayload.error || "加载备战正文失败");
            const title = [row.date ? `[${row.date}]` : "", row.company || "未知公司", row.role || "未知岗位"]
              .filter(Boolean)
              .join(" ");
            return {
              id: row.id,
              title: title.trim() || row.title || "Notion 备战记录",
              jdText: contentPayload.content || "",
              source: "prep" as const,
            };
          } catch {
            return null;
          }
        }),
      );
      const prepRowsValid = prepRowsResolved.filter((item): item is NonNullable<typeof item> => Boolean(item));
      setJdOptions([...prepRowsValid, ...jdRows]);
    } catch {
      setStatus("加载备战简报/JD 失败。");
    } finally {
      setLoadingJdOptions(false);
    }
  };
  const effectiveUnlockedStage = Math.max(progressStage, practiceStage);

  useEffect(() => {
    if (resumeBaseOptions.length === 0) void loadResumeBaseOptions();
    if (jdOptions.length === 0) void loadJdContextOptions();
  }, [resumeBaseOptions.length, jdOptions.length]);

  useEffect(() => {
    if (mode !== "mock") return;
    let mounted = true;
    async function loadDynamicGreeting() {
      setDynamicGreeting("正在准备面试官开场...");
      try {
        const response = await fetch("/api/mock/greeting", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mockFormat: resolvedMockFormatText,
            resumeContext: selectedResumeBaseText,
            prepOrJdContext: selectedJdContextText,
          }),
        });
        const payload = (await response.json()) as { greeting?: string; error?: string; detail?: string };
        if (!response.ok) {
          throw new Error(payload.detail || payload.error || `HTTP ${response.status}`);
        }
        if (!mounted) return;
        setDynamicGreeting(payload.greeting?.trim() || "你好，我们先从一个简短的自我介绍开始。");
      } catch {
        if (!mounted) return;
        setDynamicGreeting("你好，我们先从一个简短的自我介绍开始。");
      }
    }
    void loadDynamicGreeting();
    return () => {
      mounted = false;
    };
  }, [mode, resolvedMockFormatText, selectedResumeBaseText, selectedJdContextText]);

  useEffect(() => {
    if (mode !== "mock") return;
    setMockStageIndex(0);
    setMockStageTransitioning(false);
  }, [mockTrack, quickMockStage, mode]);

  useEffect(() => {
    let mounted = true;
    async function loadStoryCount() {
      try {
        const response = await fetch("/api/notion/progress", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as { dashboard?: { stories?: number } };
        if (!mounted) return;
        setStoryCount(Number(payload.dashboard?.stories ?? 0));
      } catch {
        // keep 0
      }
    }
    void loadStoryCount();
    return () => {
      mounted = false;
    };
  }, []);

  const mockSystem = useMemo(() => "你是面试官。输出严格 JSON。", []);
  const practiceSystem = useMemo(
    () =>
      questionSource === "question-bank"
        ? `You are a practice coach. Current stage=${practiceStage}. Candidate uses fixed question from QuestionBank; do not generate a new question. Focus on concise coaching after answer.

Candidate resume base context:
${selectedResumeBaseText || "(none)"}

Candidate prep/JD context:
${selectedJdContextText || "(none)"}
`
        : `You are a practice coach. Current stage=${practiceStage}.
Run one question at a time for the selected stage and ask candidate to answer concisely.

Candidate resume base context:
${selectedResumeBaseText || "(none)"}

Candidate prep/JD context:
${selectedJdContextText || "(none)"}
`,
    [practiceStage, questionSource, selectedResumeBaseText, selectedJdContextText],
  );

  const loadQuestionFromBank = async (mode: "random" | "weak" | "company") => {
    try {
      const params = new URLSearchParams();
      if (mode === "weak") params.set("status", "需加强");
      if (mode === "company" && questionBankCompany.trim()) params.set("company", questionBankCompany.trim());
      const res = await fetch(`/api/question-bank?${params.toString()}`);
      const payload = (await res.json()) as { rows?: Array<{ id: string; title: string; company?: string }>; error?: string };
      if (!res.ok) throw new Error(payload.error ?? "加载题库失败");
      const pool = payload.rows ?? [];
      if (pool.length === 0) {
        setStatus("题库中暂无符合条件的题目。");
        return;
      }
      const picked = pool[Math.floor(Math.random() * pool.length)];
      setPracticeQuestion(picked.title);
      setPracticeQuestionId(picked.id);
      setStatus(`已从题库抽题${picked.company ? `（${picked.company}）` : ""}。`);
    } catch {
      setStatus("从题库抽题失败。");
    }
  };

  function handleMockStageComplete(payload: StageTransitionPayload) {
    if (mockStageTransitioning) return;
    const nextByPayload = payload.nextStage
      ? FULL_LOOP_STAGES.findIndex((item) => item.key === payload.nextStage)
      : -1;
    const fallback = Math.min(FULL_LOOP_STAGES.length - 1, mockStageIndex + 1);
    const nextIndex = nextByPayload >= 0 ? nextByPayload : fallback;
    if (nextIndex === mockStageIndex || nextIndex >= FULL_LOOP_STAGES.length) {
      return;
    }
    setMockStageTransitioning(true);
    const nextStage = FULL_LOOP_STAGES[nextIndex];
    const kickoff = nextStage?.kickoff ?? "候选人已准备好，请继续下一轮考察。";
    window.setTimeout(() => {
      setMockStageIndex(nextIndex);
      setMockKickoffPrompt(kickoff);
      setMockKickoffNonce((prev) => prev + 1);
      setMockStageTransitioning(false);
    }, 2200);
  }

  function extractInterviewerQuestion(content: string) {
    const text = String(content ?? "").trim();
    if (!text) return "";
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(text.slice(start, end + 1)) as { spoken_text?: string };
        if (parsed?.spoken_text?.trim()) {
          return parsed.spoken_text.trim();
        }
      } catch {
        // fallback to raw text
      }
    }
    return text;
  }

  function toTranscriptMarkdown(messages: ChatMessageView[]) {
    return messages
      .map((message) => {
        const role = message.role === "assistant" ? "考官" : "我";
        const content =
          message.role === "assistant" ? extractInterviewerQuestion(message.content) : String(message.content ?? "").trim();
        if (!content) return "";
        return `**${role}**：${content}`;
      })
      .filter(Boolean)
      .join("\n\n");
  }

  async function handleEndMockAndGenerateReport(options?: { source?: "manual" | "auto" }) {
    if (archivingMockReport) return;
    const qaPairs: Array<{ question: string; answer: string }> = [];
    let pendingQuestion = "";
    for (const message of mockChatMessages) {
      if (message.role === "assistant") {
        pendingQuestion = extractInterviewerQuestion(message.content);
      } else if (message.role === "user" && pendingQuestion) {
        qaPairs.push({ question: pendingQuestion, answer: message.content.trim() });
        pendingQuestion = "";
      }
    }

    if (qaPairs.length === 0) {
      setStatus("请至少完成一轮问答后再生成报告。");
      return;
    }

    setArchivingMockReport(true);
    setStatus("正在生成报告并归档到 Notion...");
    const lastPair = qaPairs[qaPairs.length - 1];
    let result: Record<string, unknown> | null = null;
    try {
      const res = await fetch("/api/practice/round", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: "mock-session",
          question: lastPair.question,
          answer: lastPair.answer,
          selfScore: 3,
        }),
      });
      const payload = (await res.json()) as { result?: Record<string, unknown> };
      if (res.ok && payload.result) {
        result = payload.result;
      }
    } catch {
      // keep report without score details
    }

    const reportId = `mock-report-${Date.now()}`;
    const nowIso = new Date().toISOString();
    const prev = JSON.parse(window.localStorage.getItem(PRACTICE_HISTORY_KEY) || "[]") as unknown[];
    const reportRow = {
      id: reportId,
      stage: "mock",
      track: mockTrack,
      stageKey: resolvedMockStage,
      selfScore: 3,
      question: lastPair.question,
      answer: lastPair.answer,
      result,
      chatMessages: mockChatMessages,
      ts: nowIso,
    };
    window.localStorage.setItem(PRACTICE_HISTORY_KEY, JSON.stringify([reportRow, ...prev].slice(0, 50)));
    window.localStorage.setItem(MOCK_REPORT_SELECTED_KEY, reportId);
    const dateText = nowIso.slice(0, 10).replace(/-/g, "/");
    const sessionTypeLabel = mockTrack === "full-loop" ? "Full Loop" : "Quick Mock";
    const stageLabel =
      mockTrack === "quick"
        ? QUICK_MOCK_OPTIONS.find((item) => item.key === quickMockStage)?.label ?? quickMockStage
        : currentMockStage.label;
    const title =
      mockTrack === "full-loop"
        ? `全真连面 (Full Loop) - ${dateText}`
        : `单项突击 - ${stageLabel} - ${dateText}`;
    const transcriptMarkdown = toTranscriptMarkdown(mockChatMessages);
    const scoreObj = (result?.coachScores as Record<string, number> | undefined) ?? {};
    const avg =
      (Number(scoreObj.Substance ?? 0) +
        Number(scoreObj.Structure ?? 0) +
        Number(scoreObj.Relevance ?? 0) +
        Number(scoreObj.Credibility ?? 0) +
        Number(scoreObj.Differentiation ?? 0)) /
      5;
    const aiAnalysisText = [
      `## Mock Session`,
      `- Session Type: ${sessionTypeLabel}`,
      `- Stage: ${stageLabel}`,
      `- Source: ${options?.source === "auto" ? "Auto [INTERVIEW_OVER]" : "Manual End Button"}`,
      "",
      "## 五维评分",
      `- Substance: ${Number(scoreObj.Substance ?? 0).toFixed(1)}`,
      `- Structure: ${Number(scoreObj.Structure ?? 0).toFixed(1)}`,
      `- Relevance: ${Number(scoreObj.Relevance ?? 0).toFixed(1)}`,
      `- Credibility: ${Number(scoreObj.Credibility ?? 0).toFixed(1)}`,
      `- Differentiation: ${Number(scoreObj.Differentiation ?? 0).toFixed(1)}`,
      `- Avg: ${Number.isFinite(avg) ? avg.toFixed(1) : "0.0"}`,
      "",
      "## 评估摘要",
      `- Gaps: ${Array.isArray(result?.gaps) ? (result?.gaps as string[]).join("；") || "暂无" : "暂无"}`,
      `- Next Round Adjustment: ${String(result?.nextRoundAdjustment ?? "暂无")}`,
      "",
      "## Raw JSON",
      "```json",
      JSON.stringify(result ?? {}, null, 2),
      "```",
    ].join("\n");
    const reportArchiveMarkdown = [
      "## 模拟面试对话记录",
      transcriptMarkdown || "暂无",
      "",
      aiAnalysisText,
    ].join("\n\n");
    toastFetch(
      "/api/notion",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resource: "interview",
          action: "create",
          title,
          company: "模拟仿真 (Mock)",
          role: "AI Product Manager",
          type: `模拟面试（${sessionTypeLabel}）`,
          date: nowIso.slice(0, 10),
          transcript: transcriptMarkdown,
          aiAnalysis: aiAnalysisText,
          analysisInPageBodyMarkdown: reportArchiveMarkdown,
          questionBank: qaPairs.map((item) => item.question).filter(Boolean).join(" | "),
          outcomeLog: `${sessionTypeLabel} / ${stageLabel}`,
          intelligenceJson: JSON.stringify({
            mode: sessionTypeLabel,
            sessionType: sessionTypeLabel,
            stage: resolvedMockStage,
            source: options?.source ?? "manual",
            question: lastPair.question,
            answer: lastPair.answer,
            coachScores: scoreObj,
            gaps: Array.isArray(result?.gaps) ? result.gaps : [],
            nextRoundAdjustment: String(result?.nextRoundAdjustment ?? ""),
          }),
        }),
      },
      {
        loading: "正在生成报告并归档到 Notion...",
        success: "✅ 报告生成完成，已归档到 Notion",
        error: (err) => `❌ 归档到 Notion 失败：${err.message}（已保存在本地）`,
      },
    );
    setArchivingMockReport(false);
    reportsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  useEffect(() => {
    if (mockTrack !== "full-loop") return;
    if (archivingMockReport) return;
    const latestAssistant = [...mockChatMessages].reverse().find((item) => item.role === "assistant");
    if (!latestAssistant) return;
    if (!latestAssistant.content.includes("[INTERVIEW_OVER]")) return;
    if (autoEndedMessageIdRef.current === latestAssistant.id) return;
    autoEndedMessageIdRef.current = latestAssistant.id;
    void handleEndMockAndGenerateReport({ source: "auto" });
  }, [archivingMockReport, mockChatMessages, mockTrack]);

  return (
    <main className="flex w-full flex-col gap-4">
      <section className="neon-card rounded-2xl p-6">
        <h1 className="text-2xl font-semibold">模拟面试</h1>
        <p className="mt-2 text-sm text-zinc-400">完整模拟 + 模拟报告，一页联动。</p>
      </section>
      <PageGuide
        pageKey="mock"
        items={
          [
            "模式A（完整模拟）：像真实面试一样连续问答，练临场反应与整体发挥。",
            "模式B（训练模式）：单题闯关+五维评分，专门修复结构、相关性、可信度等短板。",
            "Quick Mock（模式A内）：单维度连续追问，练“被追问时怎么打”；模式B：单轮评分纠偏，练“答案怎么改到高分”。",
            "推荐顺序：先用模式B补短板，再回模式A实战；结束后点“结束并生成报告”复盘。",
          ]
        }
      />
      <UpcomingInterviewFocus />
      <div>
        <section className="neon-card rounded-2xl p-4">
          <div className="flex gap-2 text-xs">
            <button onClick={() => setMode("mock")} className={`rounded-full border px-3 py-1 ${mode === "mock" ? "border-cyan-400 text-cyan-200" : "border-zinc-700 text-zinc-400"}`}>模式A：完整模拟（Mock）</button>
            <button onClick={() => setMode("practice")} className={`rounded-full border px-3 py-1 ${mode === "practice" ? "border-cyan-400 text-cyan-200" : "border-zinc-700 text-zinc-400"}`}>模式B：训练（Practice）</button>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <div className="grid gap-1">
              <p className="text-xs text-zinc-500">选择简历底本</p>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <select
                  value={selectedResumeBaseId}
                  onChange={(e) => setSelectedResumeBaseId(e.target.value)}
                  className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200"
                >
                  <option value="">不使用底本上下文</option>
                  {resumeBaseOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void loadResumeBaseOptions()}
                  disabled={loadingResumeBases}
                  className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-300 disabled:opacity-50"
                >
                  {loadingResumeBases ? "加载中..." : "加载底本"}
                </button>
              </div>
            </div>
            <div className="grid gap-1">
              <p className="text-xs text-zinc-500">选择备战简报/JD</p>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <select
                  value={selectedJdContextId}
                  onChange={(e) => setSelectedJdContextId(e.target.value)}
                  className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200"
                >
                  <option value="">不使用备战简报/JD 上下文</option>
                  {jdOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.source === "prep" ? `📝 ${item.title}` : `📄 ${item.title}`}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void loadJdContextOptions()}
                  disabled={loadingJdOptions}
                  className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-300 disabled:opacity-50"
                >
                  {loadingJdOptions ? "加载中..." : "加载JD"}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
      <div>
        {mode === "mock" ? (
          <>
          <section className="neon-card rounded-2xl p-4">
            <div className="mb-3 flex gap-2 text-xs">
              <button
                type="button"
                onClick={() => setMockTrack("full-loop")}
                className={`rounded-full border px-3 py-1 ${mockTrack === "full-loop" ? "border-cyan-400 text-cyan-200" : "border-zinc-700 text-zinc-400"}`}
              >
                全真连面（Full Loop）
              </button>
              <button
                type="button"
                onClick={() => setMockTrack("quick")}
                className={`rounded-full border px-3 py-1 ${mockTrack === "quick" ? "border-cyan-400 text-cyan-200" : "border-zinc-700 text-zinc-400"}`}
              >
                单项突击（Quick Mock）
              </button>
            </div>
            {mockTrack === "full-loop" ? (
              <>
                <p className="mb-2 text-xs text-zinc-500">
                  Full Loop 阶段：{mockStageIndex + 1}/{FULL_LOOP_STAGES.length}（当前：{currentMockStage.label}）
                </p>
                <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-cyan-400 transition-all duration-500"
                    style={{ width: `${((mockStageIndex + 1) / FULL_LOOP_STAGES.length) * 100}%` }}
                  />
                </div>
                <p className="mb-1 text-xs text-zinc-500">模拟形式</p>
                <div className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-300">
                  🔒 连面模式进行中（当前：阶段 {mockStageIndex + 1} - {currentMockStage.label}）
                </div>
              </>
            ) : (
              <>
                <p className="mb-1 text-xs text-zinc-500">模拟形式</p>
                <select
                  value={quickMockStage}
                  onChange={(e) => setQuickMockStage(e.target.value as QuickMockStage)}
                  className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                >
                  {QUICK_MOCK_OPTIONS.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-300">
                <input
                  type="checkbox"
                  checked={!ttsMuted}
                  onChange={(e) => setTtsMuted(!e.target.checked)}
                />
                🔊 自动播报面试官问题
              </label>
              <select
                value={ttsVoice}
                onChange={(e) => setTtsVoice(e.target.value)}
                className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200"
              >
                <option value="Ethan">男声 · Ethan（更严肃）</option>
                <option value="Serena">女声 · Serena（稳重）</option>
              </select>
            </div>
          </section>
          <ChatPanel
            systemPrompt={mockSystem}
            modelType="deep"
            apiEndpoint="/api/mock/chat"
            requestBody={{
              mockFormat: resolvedMockFormatText,
              resumeContext: selectedResumeBaseText,
              prepOrJdContext: selectedJdContextText,
              currentStage: resolvedMockStage,
              fullLoop: mockTrack === "full-loop",
            }}
            assistantName="面试官"
            initialAssistantMessage={dynamicGreeting}
            emptyStateText="完整模拟（Mock）：将按 5 段流程提问 4-6 题。"
            renderInterviewerJson
            enableVoiceInput
            voiceAutoSend={false}
            autoPlayTts
            ttsMuted={ttsMuted}
            ttsVoice={ttsVoice}
            onMessagesChange={(messages) => setMockChatMessages(messages)}
            stageCompleteToken={mockTrack === "full-loop" ? "[STAGE_COMPLETE]" : undefined}
            onStageComplete={mockTrack === "full-loop" ? handleMockStageComplete : undefined}
            programmaticUserMessage={mockTrack === "full-loop" ? mockKickoffPrompt : undefined}
            programmaticMessageNonce={mockTrack === "full-loop" ? mockKickoffNonce : undefined}
            disableTextInput={mockTrack === "full-loop" && mockStageTransitioning}
          />
          <section className="neon-card rounded-2xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-zinc-500">
                完成当前模拟后，点击生成报告并跳转到「回答评分」查看成绩单与复盘。
              </p>
              <button
                type="button"
                onClick={() => {
                  void handleEndMockAndGenerateReport({ source: "manual" });
                }}
                disabled={archivingMockReport}
                className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100"
              >
                {archivingMockReport ? <span className="loading-dots">正在生成报告并归档到 Notion...</span> : "结束并生成报告 →"}
              </button>
            </div>
          </section>
          </>
        ) : (
          <>
          <section className="neon-card rounded-2xl p-4">
            <p className="text-sm text-zinc-300">当前进度：第 {progressStage} 阶段（当前阶段连过 {stageStreak}/3）</p>
            <p className="mt-1 text-xs text-cyan-200">
              你当前在 Stage {practiceStage}（{PRACTICE_STAGES.find((s) => s.id === practiceStage)?.label ?? "训练"}）。
              我会给你一个面试问题，你的回答需要在问题偏离你准备的内容时重新定向。准备好了输入“开始”。
            </p>
            {storyCount <= 0 ? (
              <p className="mt-1 text-xs text-amber-300">建议先去故事库添加故事，模拟面试会基于你的故事出题。</p>
            ) : null}
            <div className="mt-2 grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
              <select
                value={questionSource}
                onChange={(e) => setQuestionSource(e.target.value as "ai" | "question-bank")}
                className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs"
              >
                <option value="ai">出题来源：AI 随机出题</option>
                <option value="question-bank">出题来源：面试题库</option>
              </select>
              <input
                value={questionBankCompany}
                onChange={(e) => setQuestionBankCompany(e.target.value)}
                placeholder="公司专练（可选）"
                className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void loadQuestionFromBank("random");
                  }}
                  disabled={questionSource !== "question-bank"}
                  className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-xs text-zinc-300 disabled:opacity-40"
                >
                  随机抽题
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void loadQuestionFromBank("weak");
                  }}
                  disabled={questionSource !== "question-bank"}
                  className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-xs text-zinc-300 disabled:opacity-40"
                >
                  弱项抽题
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  void loadQuestionFromBank("company");
                }}
                disabled={questionSource !== "question-bank" || !questionBankCompany.trim()}
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-xs text-zinc-300 disabled:opacity-40"
              >
                公司抽题
              </button>
            </div>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {PRACTICE_STAGES.map((s) => {
                const unlocked = s.id <= effectiveUnlockedStage + 1;
                const remainingPasses = Math.max(0, 3 - stageStreak);
                const lockHint = unlocked
                  ? ""
                  : s.id === effectiveUnlockedStage + 2
                    ? `还差 ${remainingPasses} 次达标可解锁`
                    : "先解锁前一阶段后可进入";
                return (
                  <button
                    key={s.id}
                    disabled={!unlocked}
                    onClick={() => setPracticeStage(s.id)}
                    title={lockHint}
                    className={`rounded-lg border px-3 py-2 text-left text-xs ${practiceStage === s.id ? "border-cyan-400 text-cyan-200" : "border-zinc-700 text-zinc-400"} disabled:opacity-40`}
                  >
                    {s.label} · {s.gate}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              灰色阶段表示未解锁；需在当前进度阶段连续达标 3 次后自动解锁后续阶段。
            </p>
          </section>
          <ChatPanel
            systemPrompt={practiceSystem}
            modelType="fast"
            assistantName="训练教练"
            initialAssistantMessage={`你当前在 Stage ${practiceStage}（${PRACTICE_STAGES.find((s) => s.id === practiceStage)?.label ?? "训练"}）。我会给你一个面试问题，你的回答需要在问题偏离你准备的内容时重新定向。准备好了输入“开始”。`}
            emptyStateText="训练模式：先让 AI 出题，再在下方提交自评与教练评分。"
            enableVoiceInput
            voiceAutoSend={false}
            onMessagesChange={(messages) => setPracticeChatMessages(messages)}
          />
          <section className="neon-card rounded-2xl p-4">
            <p className="mb-1 text-xs text-zinc-500">本轮题目</p>
            <input value={practiceQuestion} onChange={(e) => setPracticeQuestion(e.target.value)} placeholder="本轮题目（可从上方复制）" className="mb-2 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" />
            <p className="mb-1 text-xs text-zinc-500">你的回答</p>
            <textarea value={practiceAnswer} onChange={(e) => setPracticeAnswer(e.target.value)} placeholder="你的回答" className="mb-2 h-28 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" />
            <div className="flex items-center gap-2">
              <label className="text-xs text-zinc-400">自评(1-5)</label>
              <input type="range" min={1} max={5} value={selfScore} onChange={(e) => setSelfScore(Number(e.target.value))} />
              <span className="text-xs text-zinc-400">{selfScore}</span>
              <button
                onClick={async () => {
                  try {
                    const res = await fetch("/api/practice/round", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ stage: `stage-${practiceStage}`, question: practiceQuestion, answer: practiceAnswer, selfScore }),
                    });
                    const payload = (await res.json()) as { result?: Record<string, unknown> };
                    setPracticeResult(payload.result ?? null);
                    const reportId = `mock-report-${Date.now()}`;
                    const nowIso = new Date().toISOString();
                    const prev = JSON.parse(window.localStorage.getItem(PRACTICE_HISTORY_KEY) || "[]") as unknown[];
                    const reportRow = {
                      id: reportId,
                      stage: practiceStage,
                      selfScore,
                      question: practiceQuestion,
                      answer: practiceAnswer,
                      result: payload.result,
                      chatMessages: practiceChatMessages,
                      ts: nowIso,
                    };
                    window.localStorage.setItem(PRACTICE_HISTORY_KEY, JSON.stringify([reportRow, ...prev].slice(0, 50)));
                    window.localStorage.setItem(MOCK_REPORT_SELECTED_KEY, reportId);
                    const scores = (payload.result?.coachScores as Record<string, number> | undefined) ?? {};
                    const gatePassed =
                      practiceStage === 1
                        ? (scores.Structure ?? 0) >= 3
                        : practiceStage === 2
                          ? (scores.Credibility ?? 0) >= 3
                          : practiceStage === 3
                            ? (scores.Relevance ?? 0) >= 3
                            : practiceStage === 4
                              ? (scores.Credibility ?? 0) >= 3
                              : practiceStage === 5
                                ? (scores.Substance ?? 0) >= 3
                                : ["Substance", "Structure", "Relevance", "Credibility", "Differentiation"].every(
                                    (k) => (scores[k] ?? 0) >= 3,
                                  );
                    if (practiceStage === progressStage) {
                      const nextStreak = gatePassed ? stageStreak + 1 : 0;
                      setStageStreak(nextStreak);
                      if (nextStreak >= 3 && progressStage < 8) {
                        const next = Math.min(8, progressStage + 1);
                        setProgressStage(next);
                        setStageStreak(0);
                        window.localStorage.setItem(
                          PRACTICE_PROGRESS_KEY,
                          JSON.stringify({ stage: next, streak: 0, updatedAt: new Date().toISOString() }),
                        );
                      } else {
                        window.localStorage.setItem(
                          PRACTICE_PROGRESS_KEY,
                          JSON.stringify({ stage: progressStage, streak: nextStreak, updatedAt: new Date().toISOString() }),
                        );
                      }
                    }
                    toastFetch(
                      "/api/notion",
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          resource: "interview",
                          action: "create",
                          title: `训练阶段（Practice Stage）${practiceStage} - ${new Date().toISOString().slice(0, 10)}`,
                          company: "训练场景（Practice）",
                          type: "行为面（Behavioral）",
                          date: new Date().toISOString().slice(0, 10),
                          transcript: `题目（Q）: ${practiceQuestion}\n回答（A）: ${practiceAnswer}\n自评（SelfScore）: ${selfScore}`,
                          aiAnalysis: JSON.stringify(payload.result ?? {}, null, 2),
                          intelligenceJson: JSON.stringify(
                            {
                              mode: "Practice",
                              sessionType: "Practice",
                              stage: practiceStage,
                              question: practiceQuestion,
                              answer: practiceAnswer,
                              ...(payload.result ?? {}),
                            },
                            null,
                            2,
                          ),
                        }),
                      },
                      {
                        loading: "正在保存训练记录到 Notion...",
                        success: "✅ 训练记录已保存到 Notion",
                        error: (err) => `❌ 保存训练记录失败：${err.message}`,
                      },
                    );
                    if (questionSource === "question-bank" && practiceQuestionId && payload.result?.coachScores) {
                      const scores = payload.result.coachScores as Record<string, number>;
                      const avg =
                        (Number(scores.Substance ?? 0) +
                          Number(scores.Structure ?? 0) +
                          Number(scores.Relevance ?? 0) +
                          Number(scores.Credibility ?? 0) +
                          Number(scores.Differentiation ?? 0)) /
                        5;
                      const statusLabel = avg >= 4 ? "已掌握" : avg >= 3 ? "已练习" : "需加强";
                      await fetch("/api/questions", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          pageId: practiceQuestionId,
                          data: {
                            myAnswer: practiceAnswer,
                            aiFeedback: JSON.stringify(payload.result ?? {}, null, 2),
                            lastScore: Number(avg.toFixed(1)),
                            lastPracticed: new Date().toISOString().slice(0, 10),
                            status: statusLabel,
                          },
                        }),
                      });
                    }
                    setStatus(
                      res.ok
                        ? gatePassed
                          ? `本轮达标，当前阶段连过 ${practiceStage === progressStage ? (gatePassed ? stageStreak + 1 : 0) : stageStreak}/3`
                          : "本轮未达标，连过计数已重置"
                        : "评分失败",
                    );
                  } catch {
                    setStatus("评分失败");
                  }
                }}
                className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-100"
              >
                提交本轮训练
              </button>
              <span className="text-xs text-zinc-500">{status}</span>
            </div>
            {practiceResult ? (
              <pre className="mt-2 max-h-72 overflow-auto rounded-lg border border-zinc-800 bg-zinc-950 p-2 text-xs text-zinc-300">{JSON.stringify(practiceResult, null, 2)}</pre>
            ) : null}
            <div className="mt-3">
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    const raw = window.localStorage.getItem(PRACTICE_HISTORY_KEY);
                    const rows = raw ? (JSON.parse(raw) as Array<{ id?: string }>) : [];
                    if (rows[0]?.id) {
                      window.localStorage.setItem(MOCK_REPORT_SELECTED_KEY, rows[0].id);
                    }
                  }
                  reportsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100"
              >
                结束并生成报告 →
              </button>
            </div>
          </section>
          </>
        )}
      </div>
      <div ref={reportsSectionRef} id="mock-reports">
        <section className="neon-card rounded-2xl p-4">
          <h2 className="text-lg font-semibold text-zinc-100">模拟报告</h2>
          <p className="mt-1 text-sm text-zinc-400">查看历史场次成绩单、逐题回顾与改进建议。</p>
        </section>
        <EvaluatePage />
      </div>
    </main>
  );
}
