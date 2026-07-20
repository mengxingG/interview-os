"use client";

import { useEffect, useMemo, useState } from "react";
import { LoadingHint } from "@/components/LoadingHint";
import { PageGuide } from "@/components/PageGuide";
import { ModelSelect } from "@/components/ModelSelect";
import { UpcomingInterviewFocus } from "@/components/UpcomingInterviewFocus";
import VoiceInputButton from "@/components/VoiceInputButton";
import { QuestionBankGlossary } from "@/components/QuestionBankGlossary";
import { QuestionBankByCompany } from "@/components/QuestionBankByCompany";
import { readModelSelection, writeModelSelection } from "@/lib/model-selection";
import {
  readQuestionBankManualDefaults,
  writeQuestionBankManualDefaults,
} from "@/lib/question-bank-form-defaults";
import { persistTab, readInitialTab } from "@/lib/tab-state";
import type { ModelType } from "@/lib/llm";
import { getUpcomingInterview, readInterviewSchedule } from "@/lib/interview-schedule";
import {
  DEFAULT_QUESTION_BANK_CATEGORY,
  QUESTION_BANK_CATEGORIES,
  isQuestionBankCategory,
  normalizeQuestionBankCategory,
  type QuestionBankCategory,
} from "@/lib/question-bank-categories";

type ResumeBaseOption = {
  id: string;
  title: string;
  version?: string;
  optimizedText: string;
  isActive?: boolean;
};

type Difficulty = "简单" | "中等" | "困难";
type QuestionStatus = "未练习" | "已练习" | "已掌握" | "需加强";

type QuestionBankRow = {
  id: string;
  title: string;
  category: QuestionBankCategory;
  source: string;
  company: string;
  role: string;
  round: string;
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

const categories: Array<QuestionBankCategory> = [...QUESTION_BANK_CATEGORIES];

function renderCategoryLabel(category: string) {
  return category;
}
const sources = ["其他", "手动输入", "牛客网", "模拟面试", "小红书", "真实面试", "AI生成"];
const difficulties: Array<Difficulty> = ["简单", "中等", "困难"];
const statuses: Array<QuestionStatus> = ["未练习", "已练习", "已掌握", "需加强"];
const DEFAULT_ROUND_SUGGESTIONS = [
  "一面 · 业务面",
  "二面 · 业务面",
  "三面 · 终面",
  "HR面",
  "CEO面",
  "交叉面",
];
const MAIN_TABS = ["questions", "by-company", "glossary"] as const;
type MainTab = (typeof MAIN_TABS)[number];
const MAIN_TAB_STORAGE_KEY = "question-bank:main-tab";
const RESUME_BASE_STORAGE_KEY = "question-bank:resume-base-id";
const DASHBOARD_PRACTICE_START_KEY = "dashboard-practice-started";

function resolveMainTabFromQuery(tab: string | null): MainTab | null {
  if (tab === "glossary") return "glossary";
  if (tab === "company" || tab === "by-company") return "by-company";
  if (tab === "questions") return "questions";
  return null;
}

function readInitialMainTab(): MainTab {
  if (typeof window === "undefined") return "questions";
  const params = new URLSearchParams(window.location.search);
  const fromQuery = resolveMainTabFromQuery(params.get("tab"));
  if (fromQuery) return fromQuery;
  return readInitialTab({
    queryParam: null,
    validTabs: MAIN_TABS,
    storageKey: MAIN_TAB_STORAGE_KEY,
    fallback: "questions",
  });
}

function persistManualFormDefaults(form: Omit<QuestionBankRow, "id">) {
  writeQuestionBankManualDefaults({
    category: form.category,
    source: form.source,
    company: form.company,
    role: form.role,
    round: form.round.trim(),
    difficulty: form.difficulty,
    status: form.status,
  });
}

function RoundSuggestInput({
  value,
  onChange,
  suggestions,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return suggestions;
    return suggestions.filter((item) => item.toLowerCase().includes(q));
  }, [value, suggestions]);

  return (
    <div className="mt-1">
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
      />
      {open && filtered.length > 0 ? (
        <ul className="mt-1 max-h-48 overflow-auto rounded-lg border border-zinc-600 bg-zinc-900 py-1 shadow-lg">
          {filtered.map((item) => (
            <li key={item}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(item);
                  setOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-sm text-zinc-200 transition hover:bg-zinc-800"
              >
                {item}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

const defaultDraft: Omit<QuestionBankRow, "id"> = {
  title: "",
  category: DEFAULT_QUESTION_BANK_CATEGORY,
  source: "手动输入",
  company: "",
  role: "",
  round: "",
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

function buildNewQuestionDraft(): Omit<QuestionBankRow, "id"> {
  const saved = readQuestionBankManualDefaults();
  const category = saved.category
    ? isQuestionBankCategory(saved.category)
      ? saved.category
      : normalizeQuestionBankCategory(saved.category)
    : defaultDraft.category;
  const source = saved.source && sources.includes(saved.source) ? saved.source : defaultDraft.source;
  const difficulty =
    saved.difficulty === "简单" || saved.difficulty === "中等" || saved.difficulty === "困难"
      ? saved.difficulty
      : defaultDraft.difficulty;
  const status = statuses.includes(saved.status as QuestionStatus)
    ? (saved.status as QuestionStatus)
    : defaultDraft.status;
  return {
    ...defaultDraft,
    category,
    source,
    company: saved.company ?? "",
    role: saved.role ?? "",
    round: saved.round ?? "",
    difficulty,
    status,
  };
}

export default function QuestionBankPage() {
  const [rows, setRows] = useState<QuestionBankRow[]>([]);
  const [knowledgeTitleMap, setKnowledgeTitleMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showManualModal, setShowManualModal] = useState(false);
  const [draft, setDraft] = useState(() => buildNewQuestionDraft());
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
  const [practiceStatus, setPracticeStatus] = useState("选中题目后可生成 AI 模拟回答");
  const [isPracticeSubmitting, setIsPracticeSubmitting] = useState(false);
  const [isGeneratingAnswer, setIsGeneratingAnswer] = useState(false);
  const [isRefiningAnswer, setIsRefiningAnswer] = useState(false);
  const [refineInstruction, setRefineInstruction] = useState("");
  const [practiceModelType, setPracticeModelType] = useState<ModelType>(() =>
    readModelSelection("question-bank-practice", "mock"),
  );
  const [resumeBaseOptions, setResumeBaseOptions] = useState<ResumeBaseOption[]>([]);
  const [selectedResumeBaseId, setSelectedResumeBaseId] = useState("");
  const [loadingResumeBases, setLoadingResumeBases] = useState(false);
  const [moduleOpen, setModuleOpen] = useState(true);
  const [mainTab, setMainTab] = useState<MainTab>(readInitialMainTab);
  const [query, setQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [focusCompany, setFocusCompany] = useState("");
  const [tagFilter, setTagFilter] = useState("all");
  const [listSort, setListSort] = useState<"frequency" | "category">("frequency");
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

  function switchMainTab(next: MainTab) {
    setMainTab(next);
    persistTab({
      next,
      storageKey: MAIN_TAB_STORAGE_KEY,
      clearQueryWhen: "questions",
      queryParamName: "tab",
    });
  }

  useEffect(() => {
    if (!showManualModal || currentEditingId) return;
    persistManualFormDefaults(draft);
  }, [
    showManualModal,
    currentEditingId,
    draft.category,
    draft.source,
    draft.company,
    draft.role,
    draft.round,
    draft.difficulty,
    draft.status,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const fromQuery = resolveMainTabFromQuery(params.get("tab"));
    if (fromQuery) setMainTab(fromQuery);
    const company = (params.get("company") || "").trim();
    if (company) {
      setCompanyFilter(company);
      setFocusCompany(company);
      setStatusText(`已按公司聚焦：${company}`);
      return;
    }
    const upcoming = getUpcomingInterview(readInterviewSchedule());
    if (upcoming?.company) {
      setCompanyFilter(upcoming.company);
      setFocusCompany(upcoming.company);
      setStatusText(`已按最近面试公司聚焦：${upcoming.company}`);
    }
  }, []);

  const selectedResumeBaseText = useMemo(
    () => resumeBaseOptions.find((item) => item.id === selectedResumeBaseId)?.optimizedText ?? "",
    [resumeBaseOptions, selectedResumeBaseId],
  );

  async function loadResumeBaseOptions() {
    setLoadingResumeBases(true);
    try {
      const response = await fetch("/api/notion?resource=resume-bases", { cache: "no-store" });
      const payload = (await response.json()) as { records?: ResumeBaseOption[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "加载简历底本失败");
      const records = Array.isArray(payload.records) ? payload.records : [];
      setResumeBaseOptions(records);
      let preferredId = "";
      try {
        preferredId = window.localStorage.getItem(RESUME_BASE_STORAGE_KEY) ?? "";
      } catch {
        preferredId = "";
      }
      const activeId = records.find((item) => item.isActive)?.id ?? records[0]?.id ?? "";
      const resolvedId = records.some((item) => item.id === preferredId) ? preferredId : activeId;
      setSelectedResumeBaseId((prev) => prev || resolvedId);
      if (records.length === 0) {
        setPracticeStatus("未找到简历底本，请先到「简历底本管理」创建。");
      }
    } catch (error) {
      setPracticeStatus(error instanceof Error ? error.message : "加载简历底本失败");
    } finally {
      setLoadingResumeBases(false);
    }
  }

  useEffect(() => {
    void loadResumeBaseOptions();
  }, []);

  function selectQuestionForPractice(row: QuestionBankRow) {
    setSelectedQuestion(row);
    markPracticeStarted(row.id);
    setPracticeAnswer(row.myAnswer || "");
    setRefineInstruction("");
    setPracticeStatus(row.myAnswer?.trim() ? `已选中：${row.title}（已载入参考回答，可编辑后提交）` : `已选中：${row.title}`);
  }

  async function loadRows() {
    setLoading(true);
    setLoadingHint("正在读取题库");
    try {
      const queryParams = new URLSearchParams({
        category: "all",
        source: "all",
        company: "all",
        status: "all",
        q: "",
        tags: "",
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
  }, []);

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
              round: draft.round.trim(),
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

      persistManualFormDefaults(draft);
      setShowManualModal(false);
      setCurrentEditingId(null);
      setDraft(buildNewQuestionDraft());
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
        category: isQuestionBankCategory(String(payload.result?.category ?? "").trim())
          ? (payload.result?.category as QuestionBankCategory)
          : normalizeQuestionBankCategory(payload.result?.category),
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
            round: "",
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

  async function generateMockAnswer(options?: { force?: boolean; regenerate?: boolean }) {
    if (!selectedQuestion) {
      setPracticeStatus("请先在左侧选择一道题目。");
      return;
    }
    const force = options?.force ?? false;
    const regenerate = options?.regenerate ?? false;
    if (!force && practiceAnswer.trim()) {
      const ok = window.confirm("当前已有回答内容，确定要用 AI 重新生成并覆盖吗？");
      if (!ok) return;
    }
    if (!selectedResumeBaseText.trim() && resumeBaseOptions.length === 0) {
      await loadResumeBaseOptions();
    }
    setIsGeneratingAnswer(true);
    setPracticeStatus(regenerate ? "正在重新生成模拟回答..." : "正在生成 AI 模拟回答...");
    try {
      const response = await fetch("/api/questions/mock-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: selectedQuestion.title,
          category: selectedQuestion.category,
          company: selectedQuestion.company,
          role: selectedQuestion.role,
          round: selectedQuestion.round,
          difficulty: selectedQuestion.difficulty,
          modelType: practiceModelType,
          resumeBaseId: selectedResumeBaseId || undefined,
          resumeContext: selectedResumeBaseText || undefined,
          regenerate,
        }),
      });
      const payload = (await response.json()) as { answer?: string; error?: string };
      if (!response.ok || !payload.answer?.trim()) {
        throw new Error(payload.error ?? "生成模拟回答失败");
      }
      setPracticeAnswer(payload.answer.trim());
      setPracticeStatus(regenerate ? "已刷新生成一版新回答，可继续编辑后提交。" : "已生成模拟回答，可继续编辑后提交。");
    } catch (error) {
      setPracticeStatus(error instanceof Error ? error.message : "生成模拟回答失败。");
    } finally {
      setIsGeneratingAnswer(false);
    }
  }

  async function refineMockAnswer() {
    if (!selectedQuestion) {
      setPracticeStatus("请先在左侧选择一道题目。");
      return;
    }
    if (!practiceAnswer.trim()) {
      setPracticeStatus("请先生成或填写一份回答，再进行微调。");
      return;
    }
    if (!refineInstruction.trim()) {
      setPracticeStatus("请先填写微调建议。");
      return;
    }
    if (!selectedResumeBaseText.trim() && resumeBaseOptions.length === 0) {
      await loadResumeBaseOptions();
    }
    setIsRefiningAnswer(true);
    setPracticeStatus("正在按建议微调现有回答...");
    try {
      const response = await fetch("/api/questions/refine-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: selectedQuestion.title,
          currentAnswer: practiceAnswer,
          instruction: refineInstruction.trim(),
          category: selectedQuestion.category,
          company: selectedQuestion.company,
          role: selectedQuestion.role,
          modelType: practiceModelType,
          resumeBaseId: selectedResumeBaseId || undefined,
          resumeContext: selectedResumeBaseText || undefined,
        }),
      });
      const payload = (await response.json()) as { answer?: string; error?: string };
      if (!response.ok || !payload.answer?.trim()) {
        throw new Error(payload.error ?? "微调回答失败");
      }
      setPracticeAnswer(payload.answer.trim());
      setPracticeStatus("已按建议完成微调，可继续修改建议再次微调，或提交到 Notion。");
    } catch (error) {
      setPracticeStatus(error instanceof Error ? error.message : "微调回答失败。");
    } finally {
      setIsRefiningAnswer(false);
    }
  }

  async function submitAnswerToNotion() {
    if (!selectedQuestion) return;
    if (!practiceAnswer.trim()) {
      setPracticeStatus("请先生成或填写回答再提交。");
      return;
    }
    setIsPracticeSubmitting(true);
    setPracticeStatus("正在提交回答到 Notion...");
    try {
      const updateRes = await fetch("/api/questions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId: selectedQuestion.id,
          data: {
            myAnswer: practiceAnswer,
          },
        }),
      });
      const updatePayload = (await updateRes.json()) as { error?: string };
      if (!updateRes.ok) throw new Error(updatePayload.error ?? "写回题库失败");
      setSelectedQuestion((prev) => (prev ? { ...prev, myAnswer: practiceAnswer } : prev));
      setPracticeStatus("回答已提交到 Notion。");
      await loadRows();
    } catch (error) {
      setPracticeStatus(error instanceof Error ? error.message : "提交回答失败。");
    } finally {
      setIsPracticeSubmitting(false);
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

  const tagStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rows) {
      for (const tag of row.tags) {
        const name = tag.trim();
        if (!name) continue;
        map.set(name, (map.get(name) ?? 0) + 1);
      }
    }
    // 若题库尚无 Tags，则退化为按分类展示 chips，避免筛选区空白
    if (map.size === 0) {
      for (const row of rows) {
        const name = renderCategoryLabel(row.category);
        map.set(name, (map.get(name) ?? 0) + 1);
      }
    }
    const list = Array.from(map.entries()).map(([name, count]) => ({ name, count }));
    if (listSort === "frequency") {
      list.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "zh"));
    } else {
      list.sort((a, b) => a.name.localeCompare(b.name, "zh"));
    }
    return list;
  }, [rows, listSort]);

  const displayedRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = rows.filter((row) => {
      if (companyFilter !== "all" && row.company !== companyFilter) return false;
      if (tagFilter !== "all") {
        const inTags = row.tags.includes(tagFilter);
        const inCategory = renderCategoryLabel(row.category) === tagFilter;
        if (!inTags && !inCategory) return false;
      }
      if (!q) return true;
      const haystack = [row.title, row.company, row.role, row.source, row.category, ...row.tags]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
    if (listSort === "frequency") {
      list = [...list].sort(
        (a, b) => b.practiceCount - a.practiceCount || a.title.localeCompare(b.title, "zh"),
      );
    } else {
      list = [...list].sort(
        (a, b) => a.category.localeCompare(b.category, "zh") || a.title.localeCompare(b.title, "zh"),
      );
    }
    return list;
  }, [rows, query, tagFilter, listSort, companyFilter]);

  const roundSuggestions = useMemo(() => {
    const set = new Set(DEFAULT_ROUND_SUGGESTIONS);
    for (const row of rows) {
      const round = row.round?.trim();
      if (round) set.add(round);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "zh"));
  }, [rows]);

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
            <p className="mt-1 text-sm text-zinc-400">维护高频题，用 AI 结合简历底本生成口语化参考回答并写回 Notion。</p>
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
              setDraft(buildNewQuestionDraft());
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
          "先用搜索或标签 chips 聚焦题目，再在左侧选中进入答案整理面板。",
          "可用 AI 批量生成 10 道高频题，自动入库。",
          "答案整理面板可基于简历底本生成口语化 AI 模拟回答，不满意可点刷新重生成。",
          "也可填写微调建议，对现有回答做局部调整（不会整段重写）。",
          "编辑满意后点「提交到 Notion」，仅写回参考回答（My Answer）。",
          "看题时遇到陌生术语，可切到「术语速查」Tab 快速对照。",
          "「按公司看」可将同一公司题目合并成卡片；Tag 含「高频」的会标为必刷题。",
        ]}
      />
      <UpcomingInterviewFocus />

      <div className="inline-flex rounded-full border border-zinc-700 bg-zinc-950/80 p-0.5">
        <button
          type="button"
          onClick={() => switchMainTab("questions")}
          className={`rounded-full px-4 py-1.5 text-sm transition ${
            mainTab === "questions" ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          题目列表
        </button>
        <button
          type="button"
          onClick={() => switchMainTab("by-company")}
          className={`rounded-full px-4 py-1.5 text-sm transition ${
            mainTab === "by-company" ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          按公司看
        </button>
        <button
          type="button"
          onClick={() => switchMainTab("glossary")}
          className={`rounded-full px-4 py-1.5 text-sm transition ${
            mainTab === "glossary" ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          术语速查
        </button>
      </div>

      {mainTab === "glossary" ? (
        <QuestionBankGlossary />
      ) : mainTab === "by-company" ? (
        <QuestionBankByCompany
          rows={rows}
          focusCompany={focusCompany}
          onSelectQuestion={(row) => {
            const full = rows.find((item) => item.id === row.id);
            if (!full) return;
            switchMainTab("questions");
            selectQuestionForPractice(full);
            setCompanyFilter(full.company.trim() || "all");
            setStatusText(`已从按公司看选中：${full.title}`);
          }}
        />
      ) : (
      <section className="grid gap-4 xl:grid-cols-[11fr_9fr]">
        {moduleOpen ? (
          <div className="neon-card rounded-2xl p-4">
            <p className="mb-3 text-sm font-medium text-zinc-200">筛选与题库列表</p>

            <div className="relative">
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" strokeLinecap="round" />
              </svg>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索面试题或考察点关键词，如 RAG、离职、商业化..."
                className="w-full rounded-2xl border border-zinc-700 bg-zinc-900 py-3 pl-10 pr-4 text-sm text-zinc-100 placeholder:text-zinc-500"
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setTagFilter("all")}
                className={`rounded-full px-3 py-1.5 text-xs transition ${
                  tagFilter === "all"
                    ? "bg-zinc-100 font-medium text-zinc-900"
                    : "border border-zinc-700 bg-zinc-900/70 text-zinc-300 hover:border-zinc-500"
                }`}
              >
                全部 {rows.length}
              </button>
              {tagStats.map((tag) => {
                const active = tagFilter === tag.name;
                return (
                  <button
                    key={tag.name}
                    type="button"
                    onClick={() => setTagFilter(active ? "all" : tag.name)}
                    className={`rounded-full px-3 py-1.5 text-xs transition ${
                      active
                        ? "bg-zinc-100 font-medium text-zinc-900"
                        : "border border-zinc-700 bg-zinc-900/70 text-zinc-300 hover:border-zinc-500"
                    }`}
                  >
                    {tag.name} {tag.count}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-zinc-400">共 {displayedRows.length} 道题</p>
              <div className="inline-flex rounded-full border border-zinc-700 bg-zinc-950/80 p-0.5">
                <button
                  type="button"
                  onClick={() => setListSort("frequency")}
                  className={`rounded-full px-3 py-1.5 text-xs transition ${
                    listSort === "frequency"
                      ? "bg-zinc-700 text-zinc-100"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  按频次
                </button>
                <button
                  type="button"
                  onClick={() => setListSort("category")}
                  className={`rounded-full px-3 py-1.5 text-xs transition ${
                    listSort === "category"
                      ? "bg-zinc-700 text-zinc-100"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  按类别
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {displayedRows.length === 0 && !loading ? (
                <div className="flex h-48 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950/60 text-center text-sm text-zinc-400">
                  {rows.length === 0
                    ? "还没有面试题？点击「AI 批量生成」一键生成 10 道高频题"
                    : "当前筛选条件下没有题目，试试清空搜索或切换标签"}
                </div>
              ) : null}
              {displayedRows.map((row) => (
                <article key={row.id} className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-zinc-100">{row.title}</h3>
                    <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-zinc-300">
                      {renderCategoryLabel(row.category)}
                    </span>
                    <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-zinc-300">{row.source}</span>
                    {row.round.trim() ? (
                      <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-100">
                        {row.round.trim()}
                      </span>
                    ) : null}
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
                    <button type="button" onClick={() => selectQuestionForPractice(row)} className="rounded-lg border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-xs text-violet-100">整理答案</button>
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
                      <p>轮次：{row.round.trim() || "-"}</p>
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
            题库列表已收起，右侧答案整理面板可继续使用。
          </div>
        )}

        <aside className="neon-card sticky top-4 flex max-h-[calc(100vh-2rem)] flex-col rounded-2xl p-4">
          <h2 className="text-lg font-semibold text-zinc-100">答案整理面板</h2>
          <div className="mt-2 rounded-xl border border-cyan-500/25 bg-cyan-500/10 p-3 text-xs text-cyan-100">
            <p className="font-medium">使用说明</p>
            <p className="mt-1 text-cyan-100/90">
              左侧选中题目后，可基于简历底本生成口语化参考回答；可用建议局部微调，或刷新重生成，编辑满意后提交到 Notion。
            </p>
          </div>

          <div className="mt-3 space-y-2">
            <div>
              <p className="mb-1 text-xs text-zinc-400">简历底本</p>
              <div className="flex gap-2">
                <select
                  value={selectedResumeBaseId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setSelectedResumeBaseId(nextId);
                    try {
                      window.localStorage.setItem(RESUME_BASE_STORAGE_KEY, nextId);
                    } catch {
                      // ignore storage failures
                    }
                  }}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
                  disabled={loadingResumeBases || resumeBaseOptions.length === 0}
                >
                  {resumeBaseOptions.length === 0 ? <option value="">暂无底本</option> : null}
                  {resumeBaseOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                      {item.isActive ? "（当前活跃）" : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void loadResumeBaseOptions()}
                  disabled={loadingResumeBases}
                  className="shrink-0 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-300 disabled:opacity-60"
                >
                  {loadingResumeBases ? "加载中" : "刷新底本"}
                </button>
              </div>
            </div>
            <ModelSelect
              value={practiceModelType}
              onChange={setPracticeModelType}
              storageKey="question-bank-practice"
              recommended="mock"
              label="模拟回答大模型"
              selectClassName="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
            />
          </div>
          <LoadingHint
            active={isPracticeSubmitting || isGeneratingAnswer || isRefiningAnswer}
            text={practiceStatus}
            className="mt-2"
          />

          {selectedQuestion ? (
            <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-auto rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
              <p className="text-xs text-zinc-500">当前题目</p>
              <p className="mt-1 text-sm text-zinc-100">{selectedQuestion.title}</p>
              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-xs text-zinc-500">参考回答（可编辑，右下角可拖拽调整高度）</p>
                <VoiceInputButton
                  compact
                  onTranscribe={(text, actualDuration) => {
                    setPracticeAnswer((prev) => (prev.trim() ? `${prev}\n${text}` : text));
                    setPracticeStatus(
                      actualDuration && actualDuration > 0
                        ? `已追加 ${actualDuration} 秒语音识别内容，请检查后提交。`
                        : "已将语音识别内容追加到回答中，请检查后提交。",
                    );
                  }}
                  disabled={isPracticeSubmitting || isGeneratingAnswer || isRefiningAnswer}
                  maxDuration={120}
                />
              </div>
              <textarea
                value={practiceAnswer}
                onChange={(event) => setPracticeAnswer(event.target.value)}
                className="mt-2 min-h-[22rem] w-full resize-y rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-sm leading-6 text-zinc-100"
                placeholder="点击下方「AI 模拟回答」生成，或直接手写/粘贴后编辑..."
                disabled={isGeneratingAnswer || isPracticeSubmitting || isRefiningAnswer}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void generateMockAnswer({ regenerate: false })}
                  disabled={isGeneratingAnswer || isPracticeSubmitting || isRefiningAnswer}
                  className="rounded-lg border border-cyan-500/45 bg-cyan-500/15 px-3 py-2 text-xs text-cyan-100 disabled:opacity-60"
                >
                  {isGeneratingAnswer ? <span className="loading-dots">生成中</span> : "AI 模拟回答"}
                </button>
                <button
                  type="button"
                  onClick={() => void generateMockAnswer({ force: true, regenerate: true })}
                  disabled={isGeneratingAnswer || isPracticeSubmitting || isRefiningAnswer}
                  className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 disabled:opacity-60"
                >
                  刷新
                </button>
                <button
                  type="button"
                  onClick={() => void submitAnswerToNotion()}
                  disabled={isPracticeSubmitting || isGeneratingAnswer || isRefiningAnswer}
                  className="rounded-lg border border-violet-500/45 bg-violet-500/15 px-3 py-2 text-xs text-violet-100 disabled:opacity-60"
                >
                  {isPracticeSubmitting ? <span className="loading-dots">提交中</span> : "提交到 Notion"}
                </button>
              </div>
              <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                <p className="text-xs text-zinc-500">微调建议（基于现有回答局部调整，不会整段重写）</p>
                <textarea
                  value={refineInstruction}
                  onChange={(event) => setRefineInstruction(event.target.value)}
                  className="mt-2 min-h-[5rem] w-full resize-y rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                  placeholder="例如：少提技术细节，多讲业务结果；语气再口语一点；别提那个项目，改成合规助手"
                  disabled={isGeneratingAnswer || isPracticeSubmitting || isRefiningAnswer}
                />
                <button
                  type="button"
                  onClick={() => void refineMockAnswer()}
                  disabled={
                    isRefiningAnswer ||
                    isGeneratingAnswer ||
                    isPracticeSubmitting ||
                    !practiceAnswer.trim() ||
                    !refineInstruction.trim()
                  }
                  className="mt-2 rounded-lg border border-amber-500/45 bg-amber-500/15 px-3 py-2 text-xs text-amber-100 disabled:opacity-60"
                >
                  {isRefiningAnswer ? <span className="loading-dots">微调中</span> : "按建议微调"}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-zinc-700 bg-zinc-950/40 p-6 text-center text-sm text-zinc-400">
              请从左侧题库点击「整理答案」选中一道题。
            </div>
          )}

          <div className="mt-4 border-t border-zinc-800 pt-3">
            <p className="text-sm font-medium text-zinc-200">最近整理记录</p>
            <div className="mt-2 space-y-2 text-xs text-zinc-400">
              {recentPracticeRows.length === 0 ? (
                <p>暂无记录</p>
              ) : (
                recentPracticeRows.map((row) => (
                  <button
                    key={`recent-${row.id}`}
                    type="button"
                    onClick={() => selectQuestionForPractice(row)}
                    className="block w-full truncate text-left hover:text-zinc-200"
                  >
                    - {row.title.slice(0, 28)}
                    {row.title.length > 28 ? "..." : ""}
                    {row.myAnswer?.trim() ? " · 已有答案" : ""}
                  </button>
                ))
              )}
            </div>
          </div>
        </aside>
      </section>
      )}

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
              <div className="md:col-span-2">
                <p className="text-sm text-zinc-300">面试轮次（Round）</p>
                <RoundSuggestInput
                  value={draft.round}
                  onChange={(round) => setDraft((prev) => ({ ...prev, round }))}
                  suggestions={roundSuggestions}
                  placeholder="如：一面 · 业务面"
                />
                <p className="mt-1 text-xs text-zinc-500">
                  用于「按公司看」分轮展示。需在 Notion 题库表添加 Round 或 轮次 字段（Text / Select）后才会写入。
                </p>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowManualModal(false);
                  setCurrentEditingId(null);
                  setDraft(buildNewQuestionDraft());
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
