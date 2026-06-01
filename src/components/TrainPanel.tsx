"use client";

import { useEffect, useMemo, useState } from "react";
import { nextSm2 } from "@/lib/sm2";
import type { ModelType } from "@/lib/llm";
import { ModelSelect } from "@/components/ModelSelect";
import { readModelSelection, writeModelSelection } from "@/lib/model-selection";
import { toastFetch } from "@/lib/toast-utils";

type Card = {
  id: string;
  title: string;
  domain: string;
  content: string;
  interval: number;
  easeFactor: number;
  mastery: number;
  nextReview: string;
  questions: Array<{ id: string }>;
};

type KnowledgeCardPayload = {
  id: string;
  title?: string;
  domain?: string;
  content?: string;
  answer?: string;
  prompt?: string;
  interval?: number;
  easeFactor?: number;
  mastery?: number;
  nextReview?: string;
  questions?: Array<{ id: string }>;
};

type GeneratedKnowledgeItem = {
  title: string;
  domain: string;
  content: string;
};

function getTodayISO() {
  return new Date().toISOString().slice(0, 10);
}

const qualityButtons = [
  { score: 0, label: "完全忘记" },
  { score: 2, label: "模糊" },
  { score: 3, label: "犹豫" },
  { score: 4, label: "记得" },
  { score: 5, label: "熟练" },
];

export function TrainPanel() {
  const [cards, setCards] = useState<Card[]>([]);
  const [focusedKnowledgeId, setFocusedKnowledgeId] = useState<string | null>(null);
  const [questionTitleMap, setQuestionTitleMap] = useState<Record<string, string>>({});
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncMessage, setSyncMessage] = useState("");
  const [newCardTitle, setNewCardTitle] = useState("");
  const [newCardDomain, setNewCardDomain] = useState("");
  const [newCardContent, setNewCardContent] = useState("");
  const [adding, setAdding] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generationMode, setGenerationMode] = useState<"aipm" | "question-bank" | "jd" | "review-plan">("aipm");
  const [generationCount, setGenerationCount] = useState<15 | 20>(20);
  const [generationModel, setGenerationModel] = useState<ModelType>(() =>
    readModelSelection("knowledge-generate", "practice"),
  );
  const [generationLoading, setGenerationLoading] = useState(false);
  const [generatedItems, setGeneratedItems] = useState<GeneratedKnowledgeItem[]>([]);
  const [selectedGeneratedTitles, setSelectedGeneratedTitles] = useState<string[]>([]);
  const [batchSaving, setBatchSaving] = useState(false);
  const [generatingInterviewQuestion, setGeneratingInterviewQuestion] = useState(false);
  const [quickQuestionModel, setQuickQuestionModel] = useState<ModelType>(() =>
    readModelSelection("train-generate-question", "practice"),
  );
  const [toast, setToast] = useState<{ text: string; href?: string; linkText?: string } | null>(null);

  function showToast(next: { text: string; href?: string; linkText?: string }) {
    setToast(next);
    window.setTimeout(() => {
      setToast((prev) => (prev?.text === next.text ? null : prev));
    }, 3500);
  }

  function normalizeCards(payloadCards: KnowledgeCardPayload[]) {
    return payloadCards.map((card, index) => ({
      id: card.id || `local-${index}`,
      title: card.title?.trim() || "未命名卡片（Untitled Card）",
      domain: card.domain?.trim() || "通用（General）",
      content: card.content || card.answer || card.prompt || "",
      interval: typeof card.interval === "number" ? card.interval : 1,
      easeFactor: typeof card.easeFactor === "number" ? card.easeFactor : 2.5,
      mastery: typeof card.mastery === "number" ? card.mastery : 0,
      nextReview: card.nextReview || getTodayISO(),
      questions: Array.isArray(card.questions) ? card.questions : [],
    }));
  }

  async function reloadCards() {
    const response = await fetch("/api/notion/knowledge");
    if (!response.ok) return;
    const payload = (await response.json()) as { cards?: KnowledgeCardPayload[] };
    if (Array.isArray(payload.cards) && payload.cards.length > 0) {
      setCards(normalizeCards(payload.cards));
    }
  }

  async function onGenerateInterviewQuestion() {
    if (!current) return;
    setGeneratingInterviewQuestion(true);
    try {
      writeModelSelection("train-generate-question", quickQuestionModel);
      const response = await fetch("/api/train/generate-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          knowledgePageId: current.id,
          title: current.title,
          content: current.content,
          modelType: quickQuestionModel,
        }),
      });
      const payload = (await response.json()) as { ok?: boolean; questionTitle?: string; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "生成失败");
      }
      showToast({
        text: `已生成并写入题库：${payload.questionTitle ?? "新面试题"}`,
        href: "/question-bank",
        linkText: "去题库查看",
      });
      setSyncMessage("实战题已写入 QuestionBank，并已绑定当前知识点关系。");
    } catch (error) {
      showToast({ text: error instanceof Error ? error.message : "生成实战面试题失败" });
    } finally {
      setGeneratingInterviewQuestion(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function loadCards() {
      try {
        const response = await fetch("/api/notion/knowledge");
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const payload = (await response.json()) as { cards?: KnowledgeCardPayload[] };
        if (mounted && Array.isArray(payload.cards) && payload.cards.length > 0) {
          const normalizedCards: Card[] = normalizeCards(payload.cards);
          setCards(normalizedCards);
          setSyncMessage("已连接 Notion 知识库");
        } else if (mounted) {
          setCards([]);
          setSyncMessage("Notion 暂无知识点数据");
        }
      } catch {
        if (mounted) {
          setCards([]);
          setSyncMessage("Notion 暂不可用");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadCards();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const knowledgeId = (params.get("knowledgeId") ?? "").trim();
    if (knowledgeId) {
      setFocusedKnowledgeId(knowledgeId);
      setSyncMessage("已按关联知识点定位到指定卡片。");
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadQuestionTitles() {
      try {
        const response = await fetch("/api/questions");
        const payload = (await response.json()) as {
          rows?: Array<{ id?: string; title?: string }>;
        };
        if (!mounted || !Array.isArray(payload.rows)) return;
        const nextMap: Record<string, string> = {};
        payload.rows.forEach((row) => {
          const id = String(row.id ?? "").trim();
          if (!id) return;
          nextMap[id] = String(row.title ?? "").trim() || "未命名题目";
        });
        setQuestionTitleMap(nextMap);
      } catch {
        // ignore lookup failures
      }
    }
    void loadQuestionTitles();
    return () => {
      mounted = false;
    };
  }, []);

  const today = getTodayISO();
  const dueCards = useMemo(
    () => cards.filter((card) => card.nextReview <= today),
    [cards, today],
  );
  const current = useMemo(() => {
    if (focusedKnowledgeId) {
      const focused = cards.find((card) => card.id === focusedKnowledgeId);
      if (focused) return focused;
    }
    return dueCards[0];
  }, [cards, dueCards, focusedKnowledgeId]);
  const remainingAfterCurrent = Math.max(dueCards.length - 1, 0);

  useEffect(() => {
    setFlipped(false);
  }, [current?.id]);

  const onScore = (quality: number) => {
    if (!current || !flipped) {
      return;
    }

    const qualityLabel = qualityButtons.find((item) => item.score === quality)?.label ?? "已评分";
    const updated = nextSm2(current.easeFactor, current.interval, quality);

    const updatedCard = {
      ...current,
      interval: updated.interval,
      easeFactor: updated.easeFactor,
      mastery: quality,
      nextReview: updated.nextReviewDate,
    };

    setCards((prev) =>
      prev.map((card) =>
        card.id === current.id
          ? updatedCard
          : card,
      ),
    );
    setFlipped(false);
    setSyncMessage(
      remainingAfterCurrent > 0
        ? `已评分：${qualityLabel}。已进入下一张卡片，剩余 ${remainingAfterCurrent} 张待复习。`
        : `已评分：${qualityLabel}。今日复习完成，明天继续巩固。`,
    );

    toastFetch(
      "/api/notion/knowledge",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "review",
          pageId: current.id,
          interval: updatedCard.interval,
          easeFactor: updatedCard.easeFactor,
          nextReview: updatedCard.nextReview,
          mastery: updatedCard.mastery,
          lastQuality: quality,
        }),
      },
      {
        loading: "正在同步评分至 Notion...",
        success: "✅ 评分已同步至 Notion 知识库",
        error: (err) => `❌ 评分同步失败：${err.message}`,
      },
    );
  };

  const onAddCard = async () => {
    if (!newCardTitle.trim() || !newCardContent.trim()) {
      setSyncMessage("请填写知识点标题和内容");
      return;
    }
    setAdding(true);
    toastFetch(
      "/api/notion/knowledge",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          title: newCardTitle.trim(),
          domain: newCardDomain.trim() || "通用（General）",
          content: newCardContent.trim(),
        }),
      },
      {
        loading: "正在保存知识点至 Notion...",
        success: "✅ 新知识点已添加至 Notion",
        error: (err) => `❌ 新增失败：${err.message}`,
      },
      () => {
        setCards((prev) => [
          {
            id: crypto.randomUUID(),
            title: newCardTitle.trim(),
            domain: newCardDomain.trim() || "General",
            content: newCardContent.trim(),
            interval: 1,
            easeFactor: 2.5,
            mastery: 0,
            nextReview: getTodayISO(),
            questions: [],
          },
          ...prev,
        ]);
        setNewCardTitle("");
        setNewCardDomain("");
        setNewCardContent("");
        setSyncMessage("新知识点已添加");
      },
    );
    setAdding(false);
  };

  const onGenerateKnowledge = async () => {
    setGenerationLoading(true);
    setGeneratedItems([]);
    setSelectedGeneratedTitles([]);
    try {
      writeModelSelection("knowledge-generate", generationModel);
      const response = await fetch("/api/knowledge/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: generationMode,
          count: generationCount,
          reviewPlanTitles: dueCards.map((card) => card.title),
          modelType: generationModel,
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = (await response.json()) as { items?: GeneratedKnowledgeItem[] };
      const items = Array.isArray(payload.items) ? payload.items : [];
      setGeneratedItems(items);
      setSelectedGeneratedTitles(items.map((item) => item.title));
      setSyncMessage(items.length > 0 ? `已生成 ${items.length} 条候选知识点，请勾选后入库。` : "生成结果为空。");
    } catch {
      setSyncMessage("AI 生成失败，请稍后重试。");
    } finally {
      setGenerationLoading(false);
    }
  };

  const onBatchAddGenerated = async () => {
    const selectedItems = generatedItems.filter((item) => selectedGeneratedTitles.includes(item.title));
    if (selectedItems.length === 0) {
      setSyncMessage("请至少选择 1 条知识点。");
      return;
    }
    setBatchSaving(true);
    toastFetch(
      "/api/notion/knowledge",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-batch",
          items: selectedItems,
        }),
      },
      {
        loading: `正在批量写入 ${selectedItems.length} 条知识点至 Notion...`,
        success: `✅ 已批量写入 ${selectedItems.length} 条知识点`,
        error: (err) => `❌ 批量写入失败：${err.message}`,
      },
      async () => {
        await reloadCards();
        setShowGenerateModal(false);
        setGeneratedItems([]);
        setSelectedGeneratedTitles([]);
        setSyncMessage(`已批量写入 ${selectedItems.length} 条知识点。`);
      },
    );
    setBatchSaving(false);
  };

  return (
    <section className="neon-card rounded-2xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium text-zinc-100">SM-2 训练台</h2>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-violet-400/35 bg-violet-500/10 px-3 py-1 text-xs text-violet-200">
            今日待复习 {dueCards.length}
          </span>
          {current ? (
            <span className="rounded-full border border-zinc-700 bg-zinc-900/80 px-3 py-1 text-xs text-zinc-300">
              当前这张后还剩 {remainingAfterCurrent}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => setShowGenerateModal(true)}
            className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-100 transition hover:bg-cyan-500/20"
          >
            AI 智能生成知识点
          </button>
        </div>
      </div>
      {syncMessage ? <p className="mb-3 text-xs text-zinc-500">{syncMessage}</p> : null}

      {loading ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 text-sm text-zinc-400">
          正在加载训练卡片...
        </div>
      ) : !current ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 text-sm text-zinc-400">
          {cards.length === 0
            ? "还没有知识点？点击「AI 智能生成」基于 AI PM 方向自动生成"
            : "今日复习完成，明天继续巩固。"}
        </div>
      ) : (
        <div className="space-y-3">
          <div
            className={`rounded-2xl border bg-zinc-950/80 p-5 transition-all ${
              focusedKnowledgeId && current.id === focusedKnowledgeId
                ? "border-cyan-400/70 shadow-[0_0_0_1px_rgba(34,211,238,0.35)]"
                : "border-zinc-800 shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
            }`}
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-wider text-zinc-500">Flashcard · {current.domain}</p>
              <span
                className={`rounded-full border px-2.5 py-1 text-[11px] ${
                  flipped
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                    : "border-zinc-700 bg-zinc-900/80 text-zinc-400"
                }`}
              >
                {flipped ? "已翻卡，可评分" : "未翻卡，暂不可评分"}
              </span>
            </div>
            {focusedKnowledgeId && current.id === focusedKnowledgeId ? (
              <p className="mb-2 text-xs text-cyan-300">关联落点卡片（来自题库跳转）</p>
            ) : null}
            <p className="mb-4 text-xs text-zinc-500">关联题库数量：{current.questions.length}</p>
            <div className="rounded-[24px] border border-zinc-800 bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 px-6 py-10 text-center">
              <div className="mx-auto max-w-2xl">
                <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">题面 / Question</p>
                <h3 className="mt-4 text-2xl font-semibold leading-relaxed text-zinc-100 sm:text-3xl">{current.title}</h3>
              </div>
              {!flipped ? (
                <p className="mt-5 text-sm text-zinc-500">先在脑中完整回忆，再点击下方按钮翻卡查看答案。</p>
              ) : null}
            </div>
            <div className={`mt-4 rounded-2xl border px-4 py-4 transition-all ${
              flipped
                ? "border-violet-500/30 bg-violet-500/10"
                : "border-zinc-800 bg-zinc-900/40"
            }`}>
              <p className="mb-2 text-xs uppercase tracking-[0.2em] text-zinc-500">答案 / Answer</p>
              {flipped ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">{current.content}</p>
              ) : (
                <div className="select-none">
                  <div className="pointer-events-none blur-sm">
                    <p className="line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed text-zinc-500">
                      {current.content || "答案将在翻卡后显示"}
                    </p>
                  </div>
                  <div className="mt-2 text-xs text-zinc-500">答案已隐藏，先尝试自行回忆。</div>
                </div>
              )}
            </div>
            {flipped ? (
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <ModelSelect
                  value={quickQuestionModel}
                  onChange={setQuickQuestionModel}
                  storageKey="train-generate-question"
                  recommended="practice"
                  label="出题大模型"
                  selectClassName="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200"
                  className="min-w-[200px]"
                />
                <button
                  type="button"
                  onClick={() => {
                    void onGenerateInterviewQuestion();
                  }}
                  disabled={generatingInterviewQuestion}
                  className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-100 transition hover:bg-emerald-500/20 disabled:opacity-60"
                >
                  {generatingInterviewQuestion ? <span className="loading-dots">生成中</span> : "生成实战面试题"}
                </button>
              </div>
            ) : null}
            {flipped && current.questions.length > 0 ? (
              <div className="mt-2 rounded-lg border border-zinc-800 bg-zinc-900/70 p-2 text-xs text-zinc-300">
                <p className="font-medium text-zinc-200">关联题目</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {current.questions.map((item) => (
                    <a
                      key={`${current.id}-${item.id}`}
                      href={`/question-bank?q=${encodeURIComponent(questionTitleMap[item.id] ?? "")}`}
                      className="rounded-full border border-zinc-700 px-2 py-0.5 text-cyan-300 hover:border-cyan-400/60"
                    >
                      {questionTitleMap[item.id] ?? item.id.slice(0, 8)}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => setFlipped((prev) => !prev)}
            className="w-full rounded-xl border border-violet-500/40 bg-violet-500/10 px-3 py-3 text-sm font-medium text-violet-100 transition hover:bg-violet-500/20"
          >
            {flipped ? "收起答案" : "点击查看答案 (Show Answer)"}
          </button>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {qualityButtons.map(({ score, label }) => (
              <button
                key={label}
                type="button"
                onClick={() => onScore(score)}
                disabled={!flipped}
                className="rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-2 text-xs text-zinc-300 transition hover:border-violet-400/40 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {label}
              </button>
            ))}
          </div>
          {!flipped ? (
            <p className="text-center text-xs text-zinc-500">请先点击“查看答案”后再进行评分。</p>
          ) : (
            <p className="text-center text-xs text-emerald-300">现在请根据真实回忆情况，为自己打分。</p>
          )}
        </div>
      )}

      <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
        <p className="mb-2 text-sm text-zinc-200">手动添加新知识点</p>
        <div className="grid gap-2">
          <p className="text-xs text-zinc-500">标题</p>
          <input
            value={newCardTitle}
            onChange={(event) => setNewCardTitle(event.target.value)}
            placeholder="标题"
            className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
          />
          <p className="text-xs text-zinc-500">领域</p>
          <input
            value={newCardDomain}
            onChange={(event) => setNewCardDomain(event.target.value)}
            placeholder="领域（如 产品 Product / 数据 Data / 技术 Technical）"
            className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
          />
          <p className="text-xs text-zinc-500">知识点内容</p>
          <textarea
            value={newCardContent}
            onChange={(event) => setNewCardContent(event.target.value)}
            placeholder="知识点内容"
            className="min-h-20 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={onAddCard}
            disabled={adding}
            className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100 transition hover:bg-cyan-500/20 disabled:opacity-50"
          >
            {adding ? "添加中..." : "添加知识点"}
          </button>
        </div>
      </div>
      {showGenerateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="neon-card w-full max-w-3xl rounded-2xl p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-zinc-100">AI 智能生成知识点</h3>
              <button
                type="button"
                onClick={() => setShowGenerateModal(false)}
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-300"
              >
                关闭
              </button>
            </div>
            <div className="mt-3 grid gap-2">
              <p className="text-xs text-zinc-500">生成模式</p>
              <select
                value={generationMode}
                onChange={(event) =>
                  setGenerationMode(event.target.value as "aipm" | "question-bank" | "jd" | "review-plan")
                }
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
              >
                <option value="aipm">AI PM 高频面试知识点</option>
                <option value="question-bank">基于面试题库生成</option>
                <option value="jd">基于 JD 生成</option>
                <option value="review-plan">基于今日复习计划生成</option>
              </select>
              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  <p className="text-xs text-zinc-500">生成数量</p>
                  <select
                    value={generationCount}
                    onChange={(event) => setGenerationCount(Number(event.target.value) === 15 ? 15 : 20)}
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
                  >
                    <option value={15}>15</option>
                    <option value={20}>20</option>
                  </select>
                </div>
                <div>
                  <ModelSelect
                    value={generationModel}
                    onChange={setGenerationModel}
                    storageKey="knowledge-generate"
                    recommended="practice"
                    label="大模型"
                    selectClassName="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
                  />
                  {generationModel === "pro" ? (
                    <p className="mt-1 text-xs text-zinc-500">Pro 可能较慢（约 10-30 秒），适合更“成体系”的知识点。</p>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={onGenerateKnowledge}
                disabled={generationLoading}
                className="mt-1 rounded-lg border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-sm text-violet-100 transition hover:bg-violet-500/20 disabled:opacity-50"
              >
                {generationLoading ? "生成中..." : "开始生成"}
              </button>
            </div>

            <div className="mt-4 max-h-[45vh] overflow-auto rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
              <p className="mb-2 text-sm text-zinc-200">预览并勾选入库</p>
              {generatedItems.length === 0 ? (
                <p className="text-xs text-zinc-500">点击“开始生成”后会显示候选知识点列表。</p>
              ) : (
                <div className="space-y-2">
                  {generatedItems.map((item) => {
                    const checked = selectedGeneratedTitles.includes(item.title);
                    return (
                      <label key={item.title} className="block rounded-lg border border-zinc-800 bg-zinc-900/70 p-3">
                        <div className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) =>
                              setSelectedGeneratedTitles((prev) =>
                                event.target.checked ? [...prev, item.title] : prev.filter((title) => title !== item.title),
                              )
                            }
                            className="mt-1"
                          />
                          <div>
                            <p className="text-sm text-zinc-100">{item.title}</p>
                            <p className="mt-1 text-xs text-zinc-400">{item.domain}</p>
                            <p className="mt-1 text-xs text-zinc-300">{item.content}</p>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedGeneratedTitles(generatedItems.map((item) => item.title))}
                disabled={generatedItems.length === 0}
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-300 disabled:opacity-50"
              >
                全选
              </button>
              <button
                type="button"
                onClick={() => setSelectedGeneratedTitles([])}
                disabled={generatedItems.length === 0}
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-300 disabled:opacity-50"
              >
                清空
              </button>
              <button
                type="button"
                onClick={onBatchAddGenerated}
                disabled={batchSaving || generatedItems.length === 0}
                className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100 transition hover:bg-emerald-500/20 disabled:opacity-50"
              >
                {batchSaving ? "写入中..." : "批量写入 Knowledge"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {toast ? (
        <div className="fixed bottom-4 right-4 z-[60] max-w-sm rounded-xl border border-emerald-500/40 bg-zinc-950/95 px-3 py-2 text-xs text-zinc-100 shadow-xl">
          <p>{toast.text}</p>
          {toast.href ? (
            <a href={toast.href} className="mt-1 inline-block text-cyan-300 underline underline-offset-2">
              {toast.linkText ?? "查看"}
            </a>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
