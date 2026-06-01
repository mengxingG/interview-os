"use client";

import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { LoadingHint } from "@/components/LoadingHint";
import { PageGuide } from "@/components/PageGuide";
import { ModelSelect } from "@/components/ModelSelect";
import { UpcomingInterviewFocus } from "@/components/UpcomingInterviewFocus";
import VoiceInputButton from "@/components/VoiceInputButton";
import { readModelSelection, writeModelSelection } from "@/lib/model-selection";
import type { ModelType } from "@/lib/llm";
import { getUpcomingInterview, readInterviewSchedule } from "@/lib/interview-schedule";

type QuestionBankCategory =
  | "Behavioral"
  | "Product Sense"
  | "Technical"
  | "Case Study"
  | "System Design"
  | "Culture Fit";
type Difficulty = "简单" | "中等" | "困难";
type QuestionStatus = "未练习" | "已练习" | "已掌握" | "需加强";

type QuestionBankRow = {
  id: string;
  title: string;
  category: QuestionBankCategory;
  source: string;
  company: string;
  role: string;
  difficulty: Difficulty;
  myAnswer: string;
  aiFeedback: string;
  bestStory: string;
  tags: string[];
  practiceCount: number;
  lastScore: number;
  lastPracticed: string;
  status: QuestionStatus;
  knowledge: Array<{ id: string }>;
};

type SmartQuestionExtractResult = {
  title?: string;
  category?: string;
  company?: string;
  role?: string;
  difficulty?: string;
};

const categories: Array<QuestionBankCategory> = [
  "Behavioral",
  "Product Sense",
  "Technical",
  "Case Study",
  "System Design",
  "Culture Fit",
];
const categoryLabels: Record<QuestionBankCategory, string> = {
  Behavioral: "行为面（Behavioral）",
  "Product Sense": "产品感（Product Sense）",
  Technical: "技术面（Technical）",
  "Case Study": "案例题（Case Study）",
  "System Design": "系统设计（System Design）",
  "Culture Fit": "文化匹配（Culture Fit）",
};

function renderCategoryLabel(category: string) {
  return categoryLabels[category as QuestionBankCategory] ?? category;
}
const sources = ["其他", "手动输入", "牛客网", "模拟面试", "小红书", "真实面试", "AI生成"];
const difficulties: Array<Difficulty> = ["简单", "中等", "困难"];
const statuses: Array<QuestionStatus> = ["未练习", "已练习", "已掌握", "需加强"];
const DASHBOARD_PRACTICE_START_KEY = "dashboard-practice-started";

const defaultDraft: Omit<QuestionBankRow, "id"> = {
  title: "",
  category: "Behavioral",
  source: "手动输入",
  company: "",
  role: "",
  difficulty: "中等",
  myAnswer: "",
  aiFeedback: "",
  bestStory: "",
  tags: [],
  practiceCount: 0,
  lastScore: 0,
  lastPracticed: "",
  status: "未练习",
  knowledge: [],
};

export default function QuestionBankPage() {
  const [rows, setRows] = useState<QuestionBankRow[]>([]);
  const [knowledgeTitleMap, setKnowledgeTitleMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showManualModal, setShowManualModal] = useState(false);
  const [draft, setDraft] = useState(defaultDraft);
  const [currentEditingId, setCurrentEditingId] = useState<string | null>(null);
  const [showSmartPasteModal, setShowSmartPasteModal] = useState(false);
  const [smartPasteInput, setSmartPasteInput] = useState("");
  const [smartExtracting, setSmartExtracting] = useState(false);
  const [batchRole, setBatchRole] = useState("AI Product Manager");
  const [batchCompany, setBatchCompany] = useState("");
  const [batchCategories, setBatchCategories] = useState<QuestionBankCategory[]>([...categories]);
  const [batchCount, setBatchCount] = useState<5 | 10 | 15>(10);
  const [batchPreview, setBatchPreview] = useState<Array<{ title: string; category: string; difficulty: string; tags: string[] }>>([]);
  const [batchSelected, setBatchSelected] = useState<Record<number, boolean>>({});
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [importPreviewRows, setImportPreviewRows] = useState<QuestionBankRow[]>([]);
  const [modelType, setModelType] = useState<ModelType>(() => readModelSelection("question-bank", "practice"));
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionBankRow | null>(null);
  const [practiceAnswer, setPracticeAnswer] = useState("");
  const [practiceFeedback, setPracticeFeedback] = useState("");
  const [practiceStatus, setPracticeStatus] = useState("等待练习提交");
  const [isPracticeSubmitting, setIsPracticeSubmitting] = useState(false);
  const [extractingKnowledge, setExtractingKnowledge] = useState(false);
  const [lastPracticeAvgScore, setLastPracticeAvgScore] = useState<number | null>(null);
  const [lastPracticeResultStatus, setLastPracticeResultStatus] = useState<QuestionStatus | null>(null);
  const [knowledgeExtractStatus, setKnowledgeExtractStatus] = useState("");
  const [practiceModelType, setPracticeModelType] = useState<ModelType>(() =>
    readModelSelection("question-bank-practice", "mock"),
  );
  const [moduleOpen, setModuleOpen] = useState(true);
  const [selfScore, setSelfScore] = useState(3);
  const [query, setQuery] = useState("");

  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [categoryPractice, setCategoryPractice] = useState("all");
  const [snapshotNowMs] = useState(() => Date.now());
  const [loadingHint, setLoadingHint] = useState("");
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [isBatchInserting, setIsBatchInserting] = useState(false);

  const statusIsError = /失败|错误|HTTP\\s*5\\d\\d|归档失败|归档题目|timed out/i.test(statusText);

  useEffect(() => {
    writeModelSelection("question-bank", modelType);
  }, [modelType]);
  useEffect(() => {
    writeModelSelection("question-bank-practice", practiceModelType);
  }, [practiceModelType]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const company = (params.get("company") || "").trim();
    if (company) {
      setCompanyFilter(company);
      setStatusText(`已按公司聚焦：${company}`);
      return;
    }
    const upcoming = getUpcomingInterview(readInterviewSchedule());
    if (upcoming?.company) {
      setCompanyFilter(upcoming.company);
      setStatusText(`已按最近面试公司聚焦：${upcoming.company}`);
    }
  }, []);

  const companies = useMemo(
    () => ["all", ...Array.from(new Set(rows.map((row) => row.company).filter(Boolean)))],
    [rows],
  );

  async function loadRows() {
    setLoading(true);
    setLoadingHint("正在读取题库");
    try {
      const queryParams = new URLSearchParams({
        category: categoryFilter,
        source: sourceFilter,
        company: companyFilter,
        status: statusFilter,
        q: query,
        tags: tagFilter === "all" ? "" : tagFilter,
      }).toString();
      const response = await fetch(`/api/questions?${queryParams}`);
      let payload: { rows?: QuestionBankRow[]; error?: string; detail?: string } = {};
      try {
        payload = (await response.json()) as typeof payload;
      } catch {
        // ignore non-json error bodies
      }
      if (!response.ok) {
        throw new Error(payload.detail ?? payload.error ?? `HTTP ${response.status}`);
      }
      setRows(payload.rows ?? []);
      setStatusText(`已加载 ${payload.rows?.length ?? 0} 道题。`);
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "加载题库失败。");
    } finally {
      setLoading(false);
      setLoadingHint("");
    }
  }

  function markPracticeStarted(questionId: string) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const raw = window.localStorage.getItem(DASHBOARD_PRACTICE_START_KEY);
      const parsed = raw ? (JSON.parse(raw) as { date?: string; ids?: string[] }) : {};
      const ids = new Set(parsed.date === today && Array.isArray(parsed.ids) ? parsed.ids : []);
      ids.add(questionId);
      window.localStorage.setItem(
        DASHBOARD_PRACTICE_START_KEY,
        JSON.stringify({ date: today, ids: Array.from(ids) }),
      );
    } catch {
      // ignore storage errors
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter, sourceFilter, companyFilter, difficultyFilter, statusFilter, query, tagFilter]);

  useEffect(() => {
    let mounted = true;
    async function loadKnowledgeTitles() {
      try {
        const response = await fetch("/api/notion/knowledge", { cache: "no-store" });
        const payload = (await response.json()) as {
          cards?: Array<{ id?: string; title?: string }>;
        };
        if (!mounted || !Array.isArray(payload.cards)) return;
        const nextMap: Record<string, string> = {};
        payload.cards.forEach((card) => {
          const id = String(card.id ?? "").trim();
          if (!id) return;
          nextMap[id] = String(card.title ?? "").trim() || "未命名知识点";
        });
        setKnowledgeTitleMap(nextMap);
      } catch {
        // ignore lookup failures
      }
    }
    void loadKnowledgeTitles();
    return () => {
      mounted = false;
    };
  }, []);

  async function submitManualQuestion() {
    if (!draft.title.trim()) {
      setStatusText("请先填写题目内容（Title）。");
      return;
    }
    setLoading(true);
    setLoadingHint("正在写入题目");
    try {
      if (currentEditingId) {
        const response = await fetch("/api/questions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pageId: currentEditingId,
            data: {
              title: draft.title.trim(),
              category: draft.category,
              source: draft.source,
              company: draft.company,
              role: draft.role,
              difficulty: draft.difficulty,
              status: draft.status,
            },
          }),
        });
        const payload = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "更新失败");
        setStatusText("题目已更新到题库。");
      } else {
        const response = await fetch("/api/questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item: draft }),
        });
        const payload = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "添加失败");
        setStatusText("题目已添加到题库。");
      }

      setShowManualModal(false);
      setCurrentEditingId(null);
      setDraft(defaultDraft);
      await loadRows();
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : currentEditingId ? "更新题目失败。" : "添加题目失败。");
    } finally {
      setLoading(false);
      setLoadingHint("");
    }
  }

  async function handleSmartExtractQuestion() {
    if (!smartPasteInput.trim()) {
      setStatusText("请先粘贴一段题目回忆或面试文本，再进行智能解析。");
      return;
    }
    setSmartExtracting(true);
    setStatusText("正在智能解析题目...");
    try {
      const response = await fetch("/api/shared/smart-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "question", rawText: smartPasteInput }),
      });
      const payload = (await response.json()) as { result?: SmartQuestionExtractResult; error?: string; detail?: string };
      if (!response.ok || !payload.result) {
        throw new Error(payload.error ?? payload.detail ?? "题目解析失败");
      }
      setDraft((prev) => ({
        ...prev,
        title: payload.result?.title?.trim() || prev.title,
        category: categories.includes(payload.result?.category as QuestionBankCategory)
          ? (payload.result?.category as QuestionBankCategory)
          : prev.category,
        difficulty:
          payload.result?.difficulty === "简单" ||
          payload.result?.difficulty === "中等" ||
          payload.result?.difficulty === "困难"
            ? payload.result.difficulty
            : prev.difficulty,
        company: payload.result?.company?.trim() || prev.company,
        role: payload.result?.role?.trim() || prev.role,
        source: "AI生成",
      }));
      setShowSmartPasteModal(false);
      setSmartPasteInput("");
      setStatusText("智能解析完成，已回填到题库表单。");
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "题目智能解析失败。");
    } finally {
      setSmartExtracting(false);
    }
  }

  async function handleBatchGenerate() {
    if (!batchRole.trim()) {
      setStatusText("请填写目标岗位（Role）。");
      return;
    }
    if (batchCategories.length === 0) {
      setStatusText("请至少选择一个题目分类。");
      return;
    }
    setLoading(true);
    setIsGeneratingPreview(true);
    setLoadingHint("正在生成题目预览");
    try {
      setStatusText(modelType === "pro" ? "专业模型生成中（10-30 秒）..." : "正在批量生成题目...");
      const response = await fetch("/api/questions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: batchRole.trim(),
          company: batchCompany.trim(),
          count: batchCount,
          categories: batchCategories,
          modelType,
        }),
      });
      const payload = (await response.json()) as {
        items?: Array<{ title: string; category: string; difficulty: string; tags: string[] }>;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? "AI 生成失败");
      const items = payload.items ?? [];
      setBatchPreview(items);
      setBatchSelected(Object.fromEntries(items.map((_, idx) => [idx, true])));
      setStatusText(`AI 已生成 ${items.length} 道题，请勾选后确认入库。`);
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "批量生成失败。");
    } finally {
      setLoading(false);
      setIsGeneratingPreview(false);
      setLoadingHint("");
    }
  }

  async function confirmBatchInsert() {
    const chosen = batchPreview
      .map((item, idx) => ({ item, idx }))
      .filter(({ idx }) => batchSelected[idx])
      .map(({ item }) => item);
    if (chosen.length === 0) {
      setStatusText("请至少选择 1 道题。");
      return;
    }
    setLoading(true);
    setIsBatchInserting(true);
    setLoadingHint("正在批量写入题库");
    try {
      const response = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: chosen.map((item) => ({
            title: item.title,
            category: item.category,
            source: "AI生成",
            company: batchCompany.trim(),
            role: batchRole.trim(),
            difficulty: item.difficulty,
            myAnswer: "",
            aiFeedback: "",
            bestStory: "",
            tags: item.tags ?? [],
            practiceCount: 0,
            lastScore: 0,
            lastPracticed: "",
            status: "未练习",
            knowledge: [],
          })),
        }),
      });
      const payload = (await response.json()) as { error?: string; count?: number };
      if (!response.ok) throw new Error(payload.error ?? "批量入库失败");
      setShowBatchModal(false);
      setBatchPreview([]);
      setStatusText(`已批量写入 ${payload.count ?? chosen.length} 道题。`);
      await loadRows();
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "批量入库失败。");
    } finally {
      setLoading(false);
      setIsBatchInserting(false);
      setLoadingHint("");
    }
  }

  async function handleImportInterviews() {
    setLoading(true);
    setLoadingHint("正在解析复盘记录");
    try {
      const response = await fetch("/api/questions/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "preview", limit: 20 }),
      });
      const payload = (await response.json()) as { rows?: QuestionBankRow[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "导入预览失败");
      setImportPreviewRows(payload.rows ?? []);
      setShowImportPreview(true);
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "导入题目失败。");
    } finally {
      setLoading(false);
      setLoadingHint("");
    }
  }

  function pickRandomQuestion(mode: "random" | "weak" | "company" | "category", targetCompany?: string) {
    let pool = rows;
    if (mode === "weak") {
      pool = rows.filter((row) => row.status === "需加强" || row.status === "未练习");
    } else if (mode === "company" && targetCompany) {
      pool = rows.filter((row) => row.company === targetCompany);
    } else if (mode === "category" && categoryPractice !== "all") {
      pool = rows.filter((row) => row.category === categoryPractice);
    }
    if (pool.length === 0) {
      setStatusText("当前条件下没有可练习的题目。");
      return;
    }
    const picked = pool[Math.floor(Math.random() * pool.length)];
    setSelectedQuestion(picked);
    markPracticeStarted(picked.id);
    setPracticeAnswer("");
    setSelfScore(3);
    setPracticeFeedback("");
    setLastPracticeAvgScore(null);
    setLastPracticeResultStatus(null);
    setKnowledgeExtractStatus("");
    setPracticeStatus(`已抽题：${picked.title}`);
  }

  async function submitPractice() {
    if (!selectedQuestion) return;
    if (!practiceAnswer.trim()) {
      setPracticeStatus("请先填写你的回答。");
      return;
    }
    setIsPracticeSubmitting(true);
    setPracticeStatus(
      practiceModelType === "mock"
        ? "正在使用 Claude Sonnet 4.6 评分并写回..."
        : practiceModelType === "pro"
          ? "正在评分并写回（Gemini Pro，通常 10-30 秒）"
          : "正在评分并写回",
    );
    try {
      const evalRes = await fetch("/api/questions/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: selectedQuestion.title,
          answer: practiceAnswer,
          selfScore,
          modelType: practiceModelType,
        }),
      });
      const evalPayload = (await evalRes.json()) as {
        result?: {
          scores?: Record<string, number>;
          gaps?: string[];
          improvements?: string[];
          avgScore?: number;
          bestStory?: string;
        };
        error?: string;
      };
      if (!evalRes.ok || !evalPayload.result?.scores) {
        throw new Error(evalPayload.error ?? "评分失败");
      }
      const scoreList = Object.values(evalPayload.result.scores);
      const avgScore =
        typeof evalPayload.result.avgScore === "number"
          ? evalPayload.result.avgScore
          : scoreList.reduce((sum, item) => sum + item, 0) / scoreList.length;
      const nextStatus: QuestionStatus = avgScore >= 4 ? "已掌握" : avgScore >= 3 ? "已练习" : "需加强";
      const aiFeedback = [
        `五维评分（1-5）：${Object.entries(evalPayload.result.scores)
          .map(([k, v]) => `${k} ${v}`)
          .join(" / ")}`,
        ...(evalPayload.result.gaps?.length ? [`主要短板：${evalPayload.result.gaps.join("；")}`] : []),
        ...(evalPayload.result.improvements?.length ? [`改进建议：${evalPayload.result.improvements.join("；")}`] : []),
      ]
        .filter(Boolean)
        .join("\n");
      setPracticeFeedback(aiFeedback);
      setLastPracticeAvgScore(avgScore);
      setLastPracticeResultStatus(nextStatus);
      setKnowledgeExtractStatus("");

      const updateRes = await fetch("/api/questions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId: selectedQuestion.id,
          data: {
            myAnswer: practiceAnswer,
            aiFeedback,
            bestStory: evalPayload.result.bestStory ?? "",
            lastScore: avgScore,
            status: nextStatus,
            lastPracticed: new Date().toISOString().slice(0, 10),
            practiceCount: selectedQuestion.practiceCount + 1,
          },
        }),
      });
      const updatePayload = (await updateRes.json()) as { error?: string };
      if (!updateRes.ok) throw new Error(updatePayload.error ?? "写回题库失败");
      setPracticeStatus(`练习已完成，均分 ${avgScore.toFixed(1)}，状态更新为「${nextStatus}」。`);
      await loadRows();
    } catch (error) {
      setPracticeStatus(error instanceof Error ? error.message : "提交练习失败。");
    } finally {
      setIsPracticeSubmitting(false);
    }
  }

  async function extractMissingKnowledge() {
    if (!selectedQuestion || !practiceAnswer.trim()) {
      setKnowledgeExtractStatus("请先完成一次作答。");
      return;
    }
    setExtractingKnowledge(true);
    try {
      const response = await fetch("/api/question-bank/extract-knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionPageId: selectedQuestion.id,
          question: selectedQuestion.title,
          answer: practiceAnswer,
          aiFeedback: practiceFeedback,
          avgScore: lastPracticeAvgScore,
          modelType: practiceModelType,
        }),
      });
      const payload = (await response.json()) as { ok?: boolean; count?: number; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "提取失败");
      setKnowledgeExtractStatus(`已提取并写入 ${payload.count ?? 0} 条知识点，已绑定当前题目关系。`);
    } catch (error) {
      setKnowledgeExtractStatus(error instanceof Error ? error.message : "提取缺失知识点失败");
    } finally {
      setExtractingKnowledge(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("确定要删除这条记录吗？")) return;
    setLoading(true);
    setLoadingHint("正在删除题目");
    try {
      const res = await fetch("/api/questions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId: id }),
      });
      if (!res.ok) throw new Error("归档失败");
      setRows((prev) => prev.filter((row) => row.id !== id));
      setExpandedId((prev) => (prev === id ? null : prev));
      if (selectedQuestion?.id === id) setSelectedQuestion(null);
      if (currentEditingId === id) setCurrentEditingId(null);
      setStatusText("题目已归档。");
    } catch {
      setStatusText("归档失败。");
    } finally {
      setLoading(false);
      setLoadingHint("");
    }
  }

  const stats = useMemo(() => {
    const mastered = rows.filter((row) => row.status === "已掌握").length;
    const weak = rows.filter((row) => row.status === "需加强").length;
    const weekly = rows.filter((row) => {
      if (!row.lastPracticed) return false;
      const t = new Date(row.lastPracticed).getTime();
      return Number.isFinite(t) && snapshotNowMs - t <= 7 * 24 * 3600 * 1000;
    }).length;
    return { total: rows.length, mastered, weak, weekly };
  }, [rows, snapshotNowMs]);
  const recentPracticeRows = useMemo(
    () =>
      rows
        .filter((row) => row.lastPracticed)
        .sort((a, b) => (a.lastPracticed < b.lastPracticed ? 1 : -1))
        .slice(0, 6),
    [rows],
  );

  return (
    <div className="space-y-4">
      <section className="neon-card rounded-2xl p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">面试题库（Question Bank）</h1>
            <p className="mt-1 text-sm text-zinc-400">维护高频题、持续练习并回写五维评分。</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-zinc-200">总题数：{stats.total}</div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-emerald-300">已掌握：{stats.mastered}</div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-rose-300">需加强：{stats.weak}</div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-cyan-300">本周练习：{stats.weekly}</div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setCurrentEditingId(null);
              setDraft(defaultDraft);
              setShowManualModal(true);
            }}
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 hover:border-violet-400/50"
          >
            手动添加
          </button>
          <button
            type="button"
            onClick={() => setShowBatchModal(true)}
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 hover:border-violet-400/50"
          >
            AI 批量生成
          </button>
          <button
            type="button"
            onClick={handleImportInterviews}
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 hover:border-violet-400/50"
          >
            从面试记录导入
          </button>
          <button
            type="button"
            onClick={() => setModuleOpen((prev) => !prev)}
            className="ml-auto rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 hover:border-violet-400/50"
          >
            {moduleOpen ? "收起模块" : "展开模块"}
          </button>
        </div>
        {statusText ? (
          <p className={`mt-3 text-sm ${statusIsError ? "text-red-300" : "text-zinc-300"}`}>{statusText}</p>
        ) : null}
        {loading ? (
          <div className="mt-2 rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-xs text-cyan-300 loading-pulse">
            <span className="loading-dots">{loadingHint || "正在处理中"}</span>
          </div>
        ) : null}
      </section>
      <PageGuide
        pageKey="question-bank"
        title="📖 面试题库使用指南"
        items={[
          "先用筛选器聚焦目标公司/题型，再开始练习。",
          "可用 AI 批量生成 10 道高频题，自动入库。",
          "随机抽题、弱项专练、公司专练都支持练习后自动评分回写。",
          "评分统一采用五维 1-5 分，便于和 Mock/Evaluate 对齐。",
        ]}
      />
      <UpcomingInterviewFocus />

      <section className="grid gap-4 xl:grid-cols-[11fr_9fr]">
        {moduleOpen ? (
          <div className="neon-card rounded-2xl p-4">
            <p className="mb-3 text-sm font-medium text-zinc-200">筛选与题库列表</p>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200">
                <option value="all">分类（全部）</option>
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {renderCategoryLabel(item)}
                  </option>
                ))}
              </select>
              <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200">
                <option value="all">来源（全部）</option>
                {sources.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <select value={companyFilter} onChange={(event) => setCompanyFilter(event.target.value)} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200">
                {companies.map((item) => (
                  <option key={item} value={item}>
                    {item === "all" ? "公司（全部）" : item}
                  </option>
                ))}
              </select>
              <select value={difficultyFilter} onChange={(event) => setDifficultyFilter(event.target.value)} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200">
                <option value="all">难度（全部）</option>
                {difficulties.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200">
                <option value="all">状态（全部）</option>
                {statuses.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索题目/公司/岗位"
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              />
              <input
                value={tagFilter === "all" ? "" : tagFilter}
                onChange={(event) => setTagFilter(event.target.value.trim() || "all")}
                placeholder="标签筛选（Tag）"
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              />
            </div>

            <div className="mt-4 space-y-3">
              {rows.length === 0 && !loading ? (
                <div className="flex h-48 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950/60 text-center text-sm text-zinc-400">
                  还没有面试题？点击「AI 批量生成」一键生成 10 道高频题
                </div>
              ) : null}
              {rows.map((row) => (
                <article key={row.id} className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-zinc-100">{row.title}</h3>
                    <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-zinc-300">
                      {renderCategoryLabel(row.category)}
                    </span>
                    <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-zinc-300">{row.source}</span>
                    <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-zinc-300">{row.difficulty}</span>
                    <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-zinc-300">练习 {row.practiceCount}</span>
                    <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-zinc-300">最近评分 {row.lastScore || "-"}</span>
                    <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-zinc-300">关联知识 {row.knowledge.length}</span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs ${
                        row.status === "已掌握"
                          ? "border-emerald-500/50 text-emerald-300"
                          : row.status === "已练习"
                            ? "border-cyan-500/50 text-cyan-300"
                            : row.status === "需加强"
                              ? "border-rose-500/50 text-rose-300"
                              : "border-zinc-700 text-zinc-300"
                      }`}
                    >
                      {row.status}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => setSelectedQuestion(row)} className="rounded-lg border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-xs text-violet-100">开始练习</button>
                    <button type="button" onClick={() => setExpandedId((prev) => (prev === row.id ? null : row.id))} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200">{expandedId === row.id ? "收起详情" : "查看详情"}</button>
                    <button
                      type="button"
                      onClick={() => {
                        setDraft({ ...row });
                        setCurrentEditingId(row.id);
                        setShowManualModal(true);
                      }}
                      className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200"
                    >
                      编辑
                    </button>
                    <button type="button" onClick={() => { void handleDelete(row.id); }} className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-200">删除</button>
                  </div>
                  {expandedId === row.id ? (
                    <div className="mt-3 space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/70 p-3 text-sm text-zinc-300">
                      <p>公司：{row.company || "-"}</p>
                      <p>岗位：{row.role || "-"}</p>
                      <p>最佳故事：{row.bestStory || "-"}</p>
                      <p>标签：{row.tags.length ? row.tags.join(" / ") : "-"}</p>
                      <p>
                        关联知识卡：
                        {row.knowledge.length ? (
                          row.knowledge.map((item, idx) => {
                            const title = knowledgeTitleMap[item.id] ?? item.id.slice(0, 8);
                            return (
                              <span key={`${row.id}-knowledge-${item.id}`}>
                                {idx > 0 ? " / " : ""}
                                <a
                                  href={`/train?knowledgeId=${encodeURIComponent(item.id)}`}
                                  className="text-cyan-300 underline underline-offset-2"
                                >
                                  {title}
                                </a>
                              </span>
                            );
                          })
                        ) : (
                          "-"
                        )}
                      </p>
                      <p className="whitespace-pre-wrap">我的参考回答：{row.myAnswer || "-"}</p>
                      <p className="whitespace-pre-wrap">AI 反馈：{row.aiFeedback || "-"}</p>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </div>
        ) : (
          <div className="neon-card flex min-h-40 items-center justify-center rounded-2xl p-4 text-sm text-zinc-400">
            题库列表已收起，右侧练习面板可继续使用。
          </div>
        )}

        <aside className="neon-card sticky top-4 h-fit rounded-2xl p-4">
          <h2 className="text-lg font-semibold text-zinc-100">练习面板</h2>
          <div className="mt-2 rounded-xl border border-cyan-500/25 bg-cyan-500/10 p-3 text-xs text-cyan-100">
            <p className="font-medium">练习说明</p>
            <p className="mt-1 text-cyan-100/90">
              先在下方选择练习模式，再根据需要设置公司/分类条件，点击对应按钮开始抽题答题。
            </p>
          </div>

          <div className="mt-3 space-y-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
              <p className="mb-2 text-xs font-medium text-zinc-300">步骤 1：选择练习模式</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => pickRandomQuestion("random")} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200">
                  随机抽题
                </button>
                <button type="button" onClick={() => pickRandomQuestion("weak")} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200">
                  弱项专练
                </button>
                <button type="button" onClick={() => pickRandomQuestion("company", companyFilter !== "all" ? companyFilter : undefined)} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200">
                  公司专练
                </button>
                <button type="button" onClick={() => pickRandomQuestion("category")} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200">
                  分类专练
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
              <p className="mb-2 text-xs font-medium text-zinc-300">步骤 2：设置专练条件（可选）</p>
              <div className="grid gap-2 md:grid-cols-2">
                <select onChange={(event) => pickRandomQuestion("company", event.target.value)} className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-xs text-zinc-200">
                  <option value="">公司专练：选择公司</option>
                  {rows
                    .map((row) => row.company)
                    .filter(Boolean)
                    .filter((value, index, arr) => arr.indexOf(value) === index)
                    .map((company) => (
                      <option key={company} value={company}>
                        {company}
                      </option>
                    ))}
                </select>
                <select value={categoryPractice} onChange={(event) => setCategoryPractice(event.target.value)} className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-xs text-zinc-200">
                  <option value="all">分类专练：选择分类</option>
                  {categories.map((item) => (
                    <option key={item} value={item}>
                      {renderCategoryLabel(item)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="mt-3">
            <ModelSelect
              value={practiceModelType}
              onChange={setPracticeModelType}
              storageKey="question-bank-practice"
              recommended="mock"
              label="练习评分大模型"
              selectClassName="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
            />
          </div>
          <LoadingHint active={isPracticeSubmitting} text={practiceStatus} className="mt-2" />

          {selectedQuestion ? (
            <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
              <p className="text-xs text-zinc-500">当前题目</p>
              <p className="mt-1 text-sm text-zinc-100">{selectedQuestion.title}</p>
              <p className="mt-3 text-xs text-zinc-500">你的回答（My Answer）</p>
              <div className="relative mt-2">
                <textarea
                  value={practiceAnswer}
                  onChange={(event) => setPracticeAnswer(event.target.value)}
                  className="h-28 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 pb-14 pr-28 text-sm text-zinc-100"
                  placeholder="输入你的回答..."
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 rounded-b-xl bg-gradient-to-t from-zinc-900 via-zinc-900/95 to-transparent" />
                <div className="absolute bottom-3 right-3">
                  <VoiceInputButton
                    compact
                    onTranscribe={(text, actualDuration) => {
                      setPracticeAnswer((prev) => (prev.trim() ? `${prev}\n${text}` : text));
                      setPracticeStatus(
                        actualDuration && actualDuration > 0
                          ? `已追加 ${actualDuration} 秒语音识别内容，请检查后提交评分。`
                          : "已将语音识别内容追加到回答中，请检查后提交评分。",
                      );
                    }}
                    disabled={isPracticeSubmitting}
                    maxDuration={120}
                  />
                </div>
              </div>
              <p className="mt-2 text-xs text-zinc-500">你的自评分（1-5）</p>
              <input
                type="number"
                min={1}
                max={5}
                value={selfScore}
                onChange={(event) => setSelfScore(Number(event.target.value))}
                className="mt-1 w-28 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              />
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={submitPractice}
                  disabled={isPracticeSubmitting}
                  className="rounded-lg border border-violet-500/45 bg-violet-500/15 px-3 py-2 text-xs text-violet-100"
                >
                  {isPracticeSubmitting ? <span className="loading-dots">提交中</span> : "提交并写回评分"}
                </button>
                <button
                  type="button"
                  onClick={() => pickRandomQuestion("random")}
                  className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-100"
                >
                  下一题
                </button>
              </div>
              {practiceFeedback ? (
                <div className="prose prose-invert mt-3 max-w-none rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-200">
                  <ReactMarkdown>{practiceFeedback}</ReactMarkdown>
                </div>
              ) : null}
              {practiceFeedback &&
              ((typeof lastPracticeAvgScore === "number" && lastPracticeAvgScore < 3.2) ||
                lastPracticeResultStatus === "需加强" ||
                /基础薄弱|知识薄弱|概念不清/i.test(practiceFeedback)) ? (
                <div className="mt-3 rounded-lg border border-amber-500/35 bg-amber-500/10 p-3">
                  <p className="text-xs text-amber-100">检测到基础薄弱，建议先补知识点再继续刷题。</p>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        void extractMissingKnowledge();
                      }}
                      disabled={extractingKnowledge}
                      className="rounded-lg border border-amber-500/45 bg-amber-500/20 px-3 py-1.5 text-xs text-amber-100 disabled:opacity-60"
                    >
                      {extractingKnowledge ? <span className="loading-dots">提取中</span> : "提取缺失知识点"}
                    </button>
                    <a href="/train" className="text-xs text-cyan-300 underline underline-offset-2">
                      去知识训练
                    </a>
                  </div>
                  {knowledgeExtractStatus ? <p className="mt-2 text-xs text-zinc-300">{knowledgeExtractStatus}</p> : null}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4 border-t border-zinc-800 pt-3">
            <p className="text-sm font-medium text-zinc-200">最近练习记录</p>
            <div className="mt-2 space-y-2 text-xs text-zinc-400">
              {recentPracticeRows.length === 0 ? (
                <p>暂无练习记录</p>
              ) : (
                recentPracticeRows.map((row) => (
                  <p key={`recent-${row.id}`}>
                    - {row.title.slice(0, 22)}
                    {row.title.length > 22 ? "..." : ""} {row.lastScore ? row.lastScore.toFixed(1) : "-"}
                  </p>
                ))
              )}
            </div>
          </div>
        </aside>
      </section>

      {showManualModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="neon-card w-full max-w-2xl rounded-2xl p-5">
            <h2 className="text-lg font-semibold text-zinc-100">手动添加题目</h2>
            <button
              type="button"
              onClick={() => setShowSmartPasteModal((prev) => !prev)}
              className="mt-3 rounded-lg border border-fuchsia-500/45 bg-fuchsia-500/10 px-3 py-2 text-sm font-medium text-fuchsia-100 transition hover:bg-fuchsia-500/20"
            >
              ✨ 智能粘贴解析
            </button>
            {showSmartPasteModal ? (
              <div className="mt-3 rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/5 p-3">
                <textarea
                  value={smartPasteInput}
                  onChange={(e) => setSmartPasteInput(e.target.value)}
                  className="min-h-44 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100"
                  placeholder="粘贴你的面试回忆、面经、或长段文字，AI 将自动帮你拆解填入下方表单..."
                />
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSmartPasteModal(false);
                      setSmartPasteInput("");
                    }}
                    className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300"
                  >
                    收起
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleSmartExtractQuestion();
                    }}
                    disabled={smartExtracting}
                    className="rounded-lg border border-fuchsia-500/45 bg-fuchsia-500/15 px-3 py-2 text-sm text-fuchsia-100 disabled:opacity-50"
                  >
                    {smartExtracting ? <span className="loading-dots">正在智能拆解...</span> : "开始解析"}
                  </button>
                </div>
              </div>
            ) : null}
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <p className="text-sm text-zinc-300">题目（Title）</p>
                <textarea value={draft.title} onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))} className="mt-1 h-20 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100" />
              </div>
              <div>
                <p className="text-sm text-zinc-300">分类（Category）</p>
                <select value={draft.category} onChange={(e) => setDraft((prev) => ({ ...prev, category: e.target.value as QuestionBankCategory }))} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100">
                  {categories.map((item) => (
                    <option key={item} value={item}>
                      {renderCategoryLabel(item)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-sm text-zinc-300">来源（Source）</p>
                <select value={draft.source} onChange={(e) => setDraft((prev) => ({ ...prev, source: e.target.value }))} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100">
                  {sources.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-sm text-zinc-300">公司（Company）</p>
                <input value={draft.company} onChange={(e) => setDraft((prev) => ({ ...prev, company: e.target.value }))} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100" />
              </div>
              <div>
                <p className="text-sm text-zinc-300">岗位（Role）</p>
                <input value={draft.role} onChange={(e) => setDraft((prev) => ({ ...prev, role: e.target.value }))} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100" />
              </div>
              <div>
                <p className="text-sm text-zinc-300">难度（Difficulty）</p>
                <select value={draft.difficulty} onChange={(e) => setDraft((prev) => ({ ...prev, difficulty: e.target.value as Difficulty }))} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100">
                  {difficulties.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-sm text-zinc-300">状态（Status）</p>
                <select value={draft.status} onChange={(e) => setDraft((prev) => ({ ...prev, status: e.target.value as QuestionStatus }))} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100">
                  {statuses.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowManualModal(false);
                  setCurrentEditingId(null);
                  setDraft(defaultDraft);
                }}
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300"
              >
                取消
              </button>
              <button
                type="button"
                onClick={submitManualQuestion}
                className="rounded-lg border border-violet-500/45 bg-violet-500/15 px-3 py-2 text-sm text-violet-100"
              >
                {currentEditingId ? "保存修改" : "添加"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {showBatchModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="neon-card w-full max-w-3xl rounded-2xl p-5">
            <h2 className="text-lg font-semibold text-zinc-100">AI 批量生成面试题</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <p className="mb-1 text-xs text-zinc-400">目标岗位</p>
                <input value={batchRole} onChange={(e) => setBatchRole(e.target.value)} placeholder="AI Product Manager" className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100" />
              </div>
              <div>
                <p className="mb-1 text-xs text-zinc-400">目标公司（可选）</p>
                <input value={batchCompany} onChange={(e) => setBatchCompany(e.target.value)} placeholder="如 字节跳动、阿里巴巴" className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100" />
              </div>
              <div className="md:col-span-2">
                <p className="mb-1 text-xs text-zinc-400">题目分类（可多选）</p>
                <div className="flex flex-wrap gap-2">
                  {categories.map((item) => {
                    const active = batchCategories.includes(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() =>
                          setBatchCategories((prev) =>
                            prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item],
                          )
                        }
                        className={`rounded-full border px-3 py-1 text-xs ${
                          active
                            ? "border-violet-500/60 bg-violet-500/20 text-violet-100"
                            : "border-zinc-700 bg-zinc-900 text-zinc-300"
                        }`}
                      >
                        {renderCategoryLabel(item)}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs text-zinc-400">生成数量</p>
                <select value={batchCount} onChange={(e) => setBatchCount(Number(e.target.value) as 5 | 10 | 15)} className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100">
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                </select>
              </div>
              <div>
                <ModelSelect
                  value={modelType}
                  onChange={setModelType}
                  storageKey="question-bank"
                  recommended="practice"
                  label="批量生成大模型"
                  selectClassName="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
                />
              </div>
              <button
                type="button"
                onClick={handleBatchGenerate}
                disabled={isGeneratingPreview}
                className="md:col-span-2 rounded-lg border border-violet-500/45 bg-violet-500/15 px-3 py-2 text-sm text-violet-100 disabled:opacity-60"
              >
                {isGeneratingPreview ? <span className="loading-dots">正在生成中</span> : "开始生成"}
              </button>
            </div>
            <div className="mt-3 max-h-80 space-y-2 overflow-auto">
              {batchPreview.map((item, idx) => (
                <label key={`${item.title}-${idx}`} className="flex items-start gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 p-2 text-sm text-zinc-200">
                  <input type="checkbox" checked={!!batchSelected[idx]} onChange={(e) => setBatchSelected((prev) => ({ ...prev, [idx]: e.target.checked }))} />
                  <span>{item.title} · {renderCategoryLabel(item.category)} · {item.difficulty}</span>
                </label>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setShowBatchModal(false)} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300">取消</button>
              <button
                type="button"
                onClick={confirmBatchInsert}
                disabled={isBatchInserting}
                className="rounded-lg border border-emerald-500/45 bg-emerald-500/15 px-3 py-2 text-sm text-emerald-100 disabled:opacity-60"
              >
                {isBatchInserting ? <span className="loading-dots">正在加入题库</span> : "加入题库"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {showImportPreview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="neon-card w-full max-w-2xl rounded-2xl p-5">
            <h2 className="text-lg font-semibold text-zinc-100">从复盘导入预览</h2>
            <div className="mt-3 max-h-72 space-y-2 overflow-auto">
              {importPreviewRows.map((row) => (
                <div key={row.id} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-2 text-sm text-zinc-200">{row.title}</div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={async () => {
                  try {
                    const response = await fetch("/api/questions/import", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ mode: "commit", rows: importPreviewRows }),
                    });
                    const payload = (await response.json()) as { count?: number; error?: string };
                    if (!response.ok) throw new Error(payload.error ?? "导入失败");
                    setShowImportPreview(false);
                    setStatusText(`已从复盘批量导入 ${payload.count ?? 0} 道题。`);
                    await loadRows();
                  } catch (error) {
                    setStatusText(error instanceof Error ? error.message : "导入失败");
                  }
                }}
                className="mr-2 rounded-lg border border-emerald-500/45 bg-emerald-500/15 px-3 py-2 text-sm text-emerald-100"
              >
                确认批量导入
              </button>
              <button type="button" onClick={() => setShowImportPreview(false)} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300">关闭</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
