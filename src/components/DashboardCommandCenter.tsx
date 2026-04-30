"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getUpcomingInterview, readInterviewSchedule } from "@/lib/interview-schedule";
import { UpcomingInterviewFocus } from "@/components/UpcomingInterviewFocus";

type ProgressPayload = {
  dashboard?: {
    stories?: number;
    strongStories?: number;
    questions?: number;
    practicedQuestions?: number;
    practicedQuestionsToday?: number;
    jd?: number;
    jdDecoded?: number;
    prepCount?: number;
    mocks?: number;
    mocksToday?: number;
    reviewedKnowledge?: number;
    reviewedKnowledgeToday?: number;
    totalKnowledge?: number;
    knowledgeMastery?: number;
  };
  interviewTrend?: Array<{
    Substance: number;
    Structure: number;
    Relevance: number;
    Credibility: number;
    Differentiation: number;
  }>;
};
type KnowledgeCard = {
  id: string;
  title?: string;
  interval?: number;
  nextReview?: string;
};

type ActionItem = {
  priority: number;
  text: string;
  href: string;
  cta: string;
  goalKey?: "stories" | "questions" | "knowledge" | "mock";
  tone: "warn" | "ok" | "tip";
};

const fallback = {
  stories: 0,
  strongStories: 0,
  questions: 0,
  practicedQuestions: 0,
  practicedQuestionsToday: 0,
  jd: 0,
  jdDecoded: 0,
  prepCount: 0,
  mocks: 0,
  mocksToday: 0,
  reviewedKnowledge: 0,
  reviewedKnowledgeToday: 0,
  totalKnowledge: 0,
  knowledgeMastery: 0,
};
const DISMISSED_ACTIONS_KEY = "dashboard-dismissed-actions";
const DASHBOARD_FOCUS_GOAL_KEY = "dashboard-focus-goal";
const DASHBOARD_PRACTICE_START_KEY = "dashboard-practice-started";

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getDaysUntilInterview(date: string, time?: string) {
  const target = new Date(`${date}T${time || "09:00"}:00`);
  if (Number.isNaN(target.getTime())) return null;
  const diff = target.getTime() - Date.now();
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

function StatCardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-3 w-16 rounded bg-zinc-800" />
      <div className="mt-3 h-8 w-14 rounded bg-zinc-800" />
    </div>
  );
}

export function DashboardCommandCenter() {
  const [stats, setStats] = useState(fallback);
  const [loading, setLoading] = useState(true);
  const [dismissedActions, setDismissedActions] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(DISMISSED_ACTIONS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as string[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [todayPlan, setTodayPlan] = useState<KnowledgeCard[]>([]);
  const [focusGoal] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      const raw = window.localStorage.getItem(DASHBOARD_FOCUS_GOAL_KEY) || "";
      if (raw) window.localStorage.removeItem(DASHBOARD_FOCUS_GOAL_KEY);
      return raw;
    } catch {
      return "";
    }
  });
  const [startedPracticeToday, setStartedPracticeToday] = useState<number>(0);
  const [lastScore, setLastScore] = useState({
    Substance: 0,
    Structure: 0,
    Relevance: 0,
    Credibility: 0,
    Differentiation: 0,
  });
  const [hasUpcomingInterview, setHasUpcomingInterview] = useState(false);
  const [upcomingInterviewInfo, setUpcomingInterviewInfo] = useState<{
    company: string;
    days: number;
  } | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [progressRes, knowledgeRes] = await Promise.all([
          fetch("/api/notion/progress", { cache: "no-store" }),
          fetch("/api/notion/knowledge", { cache: "no-store" }),
        ]);
        if (!progressRes.ok) return;
        const payload = (await progressRes.json()) as ProgressPayload;
        const knowledgePayload = knowledgeRes.ok
          ? ((await knowledgeRes.json()) as { cards?: KnowledgeCard[] })
          : { cards: [] };
        if (!mounted || !payload.dashboard) return;
        setStats({
          stories: Number(payload.dashboard.stories ?? 0),
          strongStories: Number(payload.dashboard.strongStories ?? 0),
          questions: Number(payload.dashboard.questions ?? 0),
          practicedQuestions: Number(payload.dashboard.practicedQuestions ?? 0),
          practicedQuestionsToday: Number(payload.dashboard.practicedQuestionsToday ?? 0),
          jd: Number(payload.dashboard.jd ?? 0),
          jdDecoded: Number(payload.dashboard.jdDecoded ?? 0),
          prepCount: Number(payload.dashboard.prepCount ?? 0),
          mocks: Number(payload.dashboard.mocks ?? 0),
          mocksToday: Number(payload.dashboard.mocksToday ?? 0),
          reviewedKnowledge: Number(payload.dashboard.reviewedKnowledge ?? 0),
          reviewedKnowledgeToday: Number(payload.dashboard.reviewedKnowledgeToday ?? 0),
          totalKnowledge: Number(payload.dashboard.totalKnowledge ?? 0),
          knowledgeMastery: Number(payload.dashboard.knowledgeMastery ?? 0),
        });
        const cards = Array.isArray(knowledgePayload.cards) ? knowledgePayload.cards : [];
        const sorted = [...cards].sort((a, b) => {
          const da = String(a.nextReview ?? "9999-12-31");
          const db = String(b.nextReview ?? "9999-12-31");
          return da.localeCompare(db);
        });
        setTodayPlan(sorted.slice(0, 6));
        const trend = Array.isArray(payload.interviewTrend) ? payload.interviewTrend : [];
        if (trend.length > 0) {
          const latest = trend[trend.length - 1];
          setLastScore({
            Substance: Number(latest.Substance ?? 0),
            Structure: Number(latest.Structure ?? 0),
            Relevance: Number(latest.Relevance ?? 0),
            Credibility: Number(latest.Credibility ?? 0),
            Differentiation: Number(latest.Differentiation ?? 0),
          });
        }
      } catch {
        // keep fallback
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const upcoming = getUpcomingInterview(readInterviewSchedule());
    setHasUpcomingInterview(Boolean(upcoming));
    if (upcoming) {
      const days = getDaysUntilInterview(upcoming.date, upcoming.time);
      if (typeof days === "number") {
        setUpcomingInterviewInfo({
          company: upcoming.company,
          days,
        });
      }
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(DISMISSED_ACTIONS_KEY, JSON.stringify(dismissedActions));
    } catch {
      // ignore storage errors
    }
  }, [dismissedActions]);

  useEffect(() => {
    function readStartedCount() {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const raw = window.localStorage.getItem(DASHBOARD_PRACTICE_START_KEY);
        const parsed = raw ? (JSON.parse(raw) as { date?: string; ids?: string[] }) : {};
        if (parsed.date === today && Array.isArray(parsed.ids)) {
          setStartedPracticeToday(parsed.ids.length);
          return;
        }
        setStartedPracticeToday(0);
      } catch {
        setStartedPracticeToday(0);
      }
    }
    readStartedCount();
    const onFocus = () => readStartedCount();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const actions = useMemo(() => {
    if (loading) return [] as ActionItem[];
    const list: ActionItem[] = [];
    if (stats.stories < 5) {
      list.push({
        priority: stats.stories === 0 ? 0 : 1,
        tone: "warn",
        text: `⚠️ 故事不足，建议补充到 5 条以上（当前 ${stats.stories} 条）`,
        href: "/stories",
        cta: stats.stories === 0 ? "去添加故事" : "去故事库补充故事",
        goalKey: "stories",
      });
    } else {
      list.push({
        priority: 4,
        tone: "ok",
        text: `✅ 故事库已有 ${stats.stories} 条故事（${stats.strongStories} 条高强度）`,
        href: "/stories",
        cta: "去故事库复查高强度故事",
        goalKey: "stories",
      });
    }
    if (stats.practicedQuestions === 0) {
      list.push({
        priority: stats.questions === 0 ? 1 : 2,
        tone: "warn",
        text: `⚠️ 面试题库 ${stats.questions} 题中 0 题已练习，建议先练 5 道高频题`,
        href: "/question-bank",
        cta: stats.questions === 0 ? "去生成面试题" : "去面试题库开始练习",
        goalKey: "questions",
      });
    }
    if (stats.reviewedKnowledge === 0) {
      list.push({
        priority: 3,
        tone: "warn",
        text: `⚠️ 知识点 ${stats.totalKnowledge} 个中 0 个已复习，今日建议先复习`,
        href: "/train",
        cta: "去知识训练开始复习",
        goalKey: "knowledge",
      });
    }
    if (stats.jdDecoded > 0 && stats.prepCount === 0) {
      list.push({
        priority: 5,
        tone: "tip",
        text: `💡 已有 ${stats.jdDecoded} 条 JD 已解码，建议生成面试备战简报`,
        href: "/prep",
        cta: "去面试备战生成简报",
        goalKey: "stories",
      });
    }
    if (upcomingInterviewInfo && upcomingInterviewInfo.days >= 0 && upcomingInterviewInfo.days <= 7) {
      list.push({
        priority: 0,
        tone: "warn",
        text: `⚡ ${upcomingInterviewInfo.days} 天后有 ${upcomingInterviewInfo.company} 面试，建议去面试备战生成 Prep 简报`,
        href: "/prep",
        cta: "去面试备战生成 Prep 简报",
        goalKey: "stories",
      });
    }
    if (hasUpcomingInterview) {
      list.push({
        priority: 1,
        tone: "tip",
        text: "⏰ 检测到即将到来的面试，建议优先完成面试备战简报",
        href: "/prep",
        cta: "去面试备战",
        goalKey: "stories",
      });
      list.push({
        priority: 2,
        tone: "tip",
        text: "⏰ 面试临近，建议做一轮热身简报和高频问题过稿",
        href: "/mock?tab=hype",
        cta: "去面试热身",
        goalKey: "mock",
      });
    }
    if (list.every((item) => item.tone !== "warn")) {
      list.push({
        priority: 6,
        tone: "ok",
        text: "✅ 基础准备完成，建议做一次完整模拟面试",
        href: "/mock",
        cta: "去模拟面试开练",
        goalKey: "mock",
      });
    }
    return list
      .sort((a, b) => a.priority - b.priority)
      .filter((item) => !dismissedActions.includes(`${item.href}|${item.text}`))
      .slice(0, 3);
  }, [dismissedActions, hasUpcomingInterview, loading, stats, upcomingInterviewInfo]);

  const readiness = useMemo(() => {
    const storyPct = clampPercent((stats.strongStories / 5) * 100);
    const questionPct = clampPercent(
      stats.questions > 0 ? (stats.practicedQuestions / stats.questions) * 100 : 0,
    );
    const knowledgePct = clampPercent(
      stats.totalKnowledge > 0 ? (stats.reviewedKnowledge / stats.totalKnowledge) * 100 : 0,
    );
    const mockPct = clampPercent((stats.mocks / 5) * 100);
    const jdPct = clampPercent((stats.jdDecoded / 3) * 100);
    return [
      { label: "故事库", value: storyPct },
      { label: "题库", value: questionPct },
      { label: "知识点", value: knowledgePct },
      { label: "模拟面试", value: mockPct },
      { label: "JD解码", value: jdPct },
    ];
  }, [stats]);

  const scoreRows = [
    { label: "表达力", value: lastScore.Substance },
    { label: "结构性", value: lastScore.Structure },
    { label: "相关性", value: lastScore.Relevance },
    { label: "可信度", value: lastScore.Credibility },
    { label: "差异化", value: lastScore.Differentiation },
  ];
  const todayGoals = useMemo(() => {
    const questionTarget = 5;
    const knowledgeTarget = 3;
    const mockTarget = 1;
    return [
      {
        label: "练题",
        done: Math.max(stats.practicedQuestionsToday, startedPracticeToday),
        target: questionTarget,
        key: "questions",
      },
      {
        label: "复习",
        done: stats.reviewedKnowledgeToday,
        target: knowledgeTarget,
        key: "knowledge",
      },
      {
        label: "模拟",
        done: stats.mocksToday,
        target: mockTarget,
        key: "mock",
      },
    ];
  }, [startedPracticeToday, stats.mocksToday, stats.practicedQuestionsToday, stats.reviewedKnowledgeToday]);

  return (
    <section className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="neon-card rounded-xl p-4">
          <p className="text-xs text-zinc-500">故事数</p>
          {loading ? <StatCardSkeleton /> : <p className="mt-2 text-2xl font-semibold text-violet-200">{stats.stories}</p>}
        </div>
        <div className="neon-card rounded-xl p-4">
          <p className="text-xs text-zinc-500">题库总数</p>
          {loading ? <StatCardSkeleton /> : <p className="mt-2 text-2xl font-semibold text-cyan-200">{stats.questions}</p>}
        </div>
        <div className="neon-card rounded-xl p-4">
          <p className="text-xs text-zinc-500">模拟面试次数</p>
          {loading ? <StatCardSkeleton /> : <p className="mt-2 text-2xl font-semibold text-fuchsia-200">{stats.mocks}</p>}
        </div>
        <div className="neon-card rounded-xl p-4">
          <p className="text-xs text-zinc-500">知识掌握</p>
          {loading ? (
            <StatCardSkeleton />
          ) : (
            <p className="mt-2 text-2xl font-semibold text-emerald-200">
              {`${stats.reviewedKnowledge}/${stats.totalKnowledge}`}
            </p>
          )}
        </div>
      </section>

      <UpcomingInterviewFocus />

      <section className="neon-card rounded-2xl p-4">
        <h2 className="text-lg font-semibold text-zinc-100">✅ 今日任务总览</h2>
        <p className="mt-1 text-xs text-zinc-500">建议目标：练题 5 / 复习 3 / 模拟 1</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {todayGoals.map((item) => {
            const pct = clampPercent((item.done / item.target) * 100);
            const active = focusGoal === item.key;
            return (
              <div
                key={item.label}
                className={`rounded-xl border p-3 transition ${
                  active ? "border-cyan-400/60 bg-cyan-500/10" : "border-zinc-800 bg-zinc-950/60"
                }`}
              >
                <div className="mb-1 flex items-center justify-between text-sm text-zinc-300">
                  <span>{item.label}</span>
                  <span>
                    {loading ? "…/…" : `${item.done}/${item.target}`}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-zinc-800">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400"
                    style={{ width: `${loading ? 0 : pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="neon-card rounded-2xl p-4">
        <h2 className="text-lg font-semibold text-zinc-100">📅 今日复习计划（来自知识训练）</h2>
        {loading ? (
          <p className="mt-2 text-sm text-zinc-500">正在同步今日计划...</p>
        ) : todayPlan.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">今日暂无待复习卡片，可去知识训练新增知识点。</p>
        ) : (
          <div className="mt-3 space-y-1 text-sm text-zinc-300">
            {todayPlan.map((card) => (
              <p key={card.id}>
                - {card.title || "未命名知识点"}：间隔 {card.interval ?? 1} 天（next {card.nextReview || "-"})
              </p>
            ))}
          </div>
        )}
      </section>

      <section className="neon-card rounded-2xl p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-zinc-100">🎯 下一步行动建议</h2>
          <button
            type="button"
            onClick={() => setDismissedActions([])}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-300 transition hover:border-zinc-500"
          >
            重置建议
          </button>
        </div>
        <p className="mt-1 text-xs text-zinc-500">按优先级排序（最多 3 条），建议从上到下执行。完成后可“标记完成”。</p>
        <div className="mt-3 space-y-3 text-sm">
          {loading ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-zinc-500">正在计算行动建议...</div>
          ) : actions.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-emerald-200">
              ✅ 当前建议都已完成。可点击“重置建议”重新查看。
            </div>
          ) : (
            actions.map((item) => (
            <div key={item.text} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
              <p className={item.tone === "warn" ? "text-amber-200" : item.tone === "ok" ? "text-emerald-200" : "text-cyan-200"}>
                {item.text}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <Link
                  href={item.href}
                  onClick={() => {
                    try {
                      if (item.goalKey) {
                        window.localStorage.setItem(DASHBOARD_FOCUS_GOAL_KEY, item.goalKey);
                      }
                    } catch {
                      // ignore storage errors
                    }
                  }}
                  className="inline-block rounded-lg border border-violet-500/35 bg-violet-500/10 px-3 py-1 text-xs text-violet-200 transition hover:bg-violet-500/20"
                >
                  {item.cta}
                </Link>
                <button
                  type="button"
                  onClick={() =>
                    setDismissedActions((prev) => [...prev, `${item.href}|${item.text}`])
                  }
                  className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-300 transition hover:border-zinc-500"
                >
                  标记完成
                </button>
              </div>
            </div>
          ))
          )}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="neon-card rounded-2xl p-4">
          <h3 className="mb-2 text-sm font-semibold text-zinc-100">五维评分（最近一次）</h3>
          <div className="space-y-2 text-sm text-zinc-300">
            {scoreRows.map((row) => (
              <p key={row.label}>
                {row.label} {Number(row.value || 0).toFixed(1)}
              </p>
            ))}
          </div>
        </div>
        <div className="neon-card rounded-2xl p-4">
          <h3 className="mb-2 text-sm font-semibold text-zinc-100">准备度雷达</h3>
          <div className="space-y-2">
            {readiness.map((item) => (
              <div key={item.label}>
                <div className="mb-1 flex justify-between text-xs text-zinc-400">
                  <span>{item.label}</span>
                  <span>{item.value}%</span>
                </div>
                <div className="h-2 rounded-full bg-zinc-800">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
                    style={{ width: `${item.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </section>
  );
}

