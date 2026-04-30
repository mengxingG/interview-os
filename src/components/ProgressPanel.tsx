"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  EVALUATE_TRIAGE_HISTORY_KEY,
  INTERVIEW_INTELLIGENCE_KEY,
  PRACTICE_HISTORY_KEY,
  PRACTICE_STAGES,
} from "@/lib/practice";
import { userProfile } from "@/lib/user-profile";

type ProgressPayload = {
  metrics: {
    storyCount: number;
    strongStories: number;
    jdCount: number;
    interviewCount: number;
    interviewsThisWeek: number;
    dueCount: number;
    totalKnowledge: number;
    reviewedThisWeek: number;
    readiness: number;
  };
  radar: {
    stories: number;
    practice: number;
    knowledge: number;
    targeting: number;
    consistency: number;
  };
  interviewTrend: Array<{
    session: number;
    Substance: number;
    Structure: number;
    Relevance: number;
    Credibility: number;
    Differentiation: number;
  }>;
  masteryDistribution: Array<{
    domain: string;
    avgMastery: number;
    count: number;
  }>;
  jdStatusBoard: Record<string, number>;
  dashboard: {
    stories: number;
    jd: number;
    mocks: number;
    knowledgeMastery: number;
  };
  warnings?: string[];
  diagnostics?: Array<{
    source: string;
    envKey: string;
    detail: string;
  }>;
};

const fallback: ProgressPayload = {
  metrics: {
    storyCount: 0,
    strongStories: 0,
    jdCount: 0,
    interviewCount: 0,
    interviewsThisWeek: 0,
    dueCount: 0,
    totalKnowledge: 0,
    reviewedThisWeek: 0,
    readiness: 0,
  },
  radar: {
    stories: 0,
    practice: 0,
    knowledge: 0,
    targeting: 0,
    consistency: 0,
  },
  interviewTrend: [],
  masteryDistribution: [],
  jdStatusBoard: {},
  dashboard: {
    stories: 8,
    jd: 6,
    mocks: 12,
    knowledgeMastery: 3.2,
  },
  warnings: [],
  diagnostics: [],
};

const resultFilterOptions = ["all", "pending", "advanced", "rejected", "offer", "unknown"] as const;

function renderOutcomeLabel(value: string) {
  const map: Record<string, string> = {
    pending: "待定（pending）",
    advanced: "进入下一轮（advanced）",
    rejected: "未通过（rejected）",
    offer: "拿到 offer（offer）",
    unknown: "未知（unknown）",
  };
  return map[value] ?? value;
}

function renderBiasLabel(value: string) {
  const map: Record<string, string> = {
    over: "偏高（over）",
    under: "偏低（under）",
    accurate: "准确（accurate）",
  };
  return map[value] ?? value;
}

export function ProgressPanel() {
  const [insights] = useState(() => {
    if (typeof window === "undefined") {
      return { selfBias: "暂无数据", practiceStageStatus: [] as Array<{ label: string; unlocked: boolean }> };
    }
    try {
      const history = JSON.parse(window.localStorage.getItem(PRACTICE_HISTORY_KEY) || "[]") as Array<{
        selfScore?: number;
        result?: { recommendedSelfScore?: number };
      }>;
      const deltas = history
        .map((row) => {
          const coach = Number(row.result?.recommendedSelfScore ?? row.selfScore ?? 0);
          return Number(row.selfScore ?? 0) - coach;
        })
        .filter((n) => Number.isFinite(n));
      const avg = deltas.length > 0 ? deltas.reduce((a, b) => a + b, 0) / deltas.length : 0;
      const selfBias = deltas.length > 0 ? (avg > 0.5 ? "over" : avg < -0.5 ? "under" : "accurate") : "暂无数据";
      const current = userProfile.drillProgress.currentStage;
      const practiceStageStatus = PRACTICE_STAGES.map((stage) => ({
        label: stage.label,
        unlocked: stage.id <= current + 1,
      }));
      return { selfBias, practiceStageStatus };
    } catch {
      return { selfBias: "暂无数据", practiceStageStatus: [] as Array<{ label: string; unlocked: boolean }> };
    }
  });
  const [triageInsights] = useState(() => {
    const empty = {
      last20Total: 0,
      stageDistribution: [] as Array<{ stage: number; label: string; count: number }>,
      topRecommendation: "暂无数据",
    };
    if (typeof window === "undefined") return empty;
    try {
      const raw = window.localStorage.getItem(EVALUATE_TRIAGE_HISTORY_KEY);
      const rows = raw
        ? (JSON.parse(raw) as Array<{
            stage?: number;
            stageLabel?: string;
            ts?: string;
          }>)
        : [];
      const recent = rows.slice(0, 20);
      if (recent.length === 0) return empty;
      const bucket = new Map<number, { label: string; count: number }>();
      for (const row of recent) {
        const stage = Number(row.stage ?? 0);
        if (!Number.isFinite(stage) || stage < 1 || stage > 8) continue;
        const label = row.stageLabel || `第${stage}阶段`;
        const found = bucket.get(stage);
        if (found) {
          found.count += 1;
        } else {
          bucket.set(stage, { label, count: 1 });
        }
      }
      const stageDistribution = Array.from(bucket.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([stage, value]) => ({ stage, label: value.label, count: value.count }));
      const top = [...stageDistribution].sort((a, b) => b.count - a.count)[0];
      return {
        last20Total: recent.length,
        stageDistribution,
        topRecommendation: top ? `${top.label}（${top.count}次）` : "暂无数据",
      };
    } catch {
      return empty;
    }
  });
  const [intelligence] = useState(() => {
    const empty = {
      questionBank: [] as Array<{ question: string; company: string; score: number; outcome: string }>,
      feedbacks: [] as Array<{ company: string; feedback: string; outcome: string }>,
      outcomes: [] as Array<{ company: string; round: string; result: string; notes: string }>,
    };
    if (typeof window === "undefined") return empty;
    try {
      const raw = window.localStorage.getItem(INTERVIEW_INTELLIGENCE_KEY);
      const rows = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
      return {
        questionBank: rows
          .filter((r) => r.type === "question_bank")
          .slice(0, 8)
          .map((r) => ({
            question: String(r.question ?? ""),
            company: String(r.company ?? "-"),
            score: Number(r.score ?? 0),
            outcome: String(r.outcome ?? "unknown"),
          })),
        feedbacks: rows
          .filter((r) => r.type === "feedback")
          .slice(0, 5)
          .map((r) => ({
            company: String(r.company ?? "-"),
            feedback: String(r.feedback ?? ""),
            outcome: String(r.outcome ?? "pending"),
          })),
        outcomes: rows
          .filter((r) => r.type === "outcome")
          .slice(0, 6)
          .map((r) => ({
            company: String(r.company ?? "-"),
            round: String(r.round ?? "-"),
            result: String(r.result ?? "pending"),
            notes: String(r.notes ?? ""),
          })),
      };
    } catch {
      return empty;
    }
  });
  const [data, setData] = useState<ProgressPayload>(fallback);
  const isProgressEmpty =
    data.metrics.interviewCount === 0 &&
    data.metrics.interviewsThisWeek === 0 &&
    data.interviewTrend.length === 0;
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("正在同步 Notion 进度数据...");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [resultFilter, setResultFilter] = useState("all");
  const chartsReady = true;
  const companyOptions = useMemo(() => {
    const set = new Set<string>();
    intelligence.questionBank.forEach((r) => set.add(r.company));
    intelligence.feedbacks.forEach((r) => set.add(r.company));
    intelligence.outcomes.forEach((r) => set.add(r.company));
    return ["all", ...Array.from(set).filter(Boolean)];
  }, [intelligence]);
  const filteredQuestionBank = useMemo(
    () =>
      intelligence.questionBank.filter(
        (q) =>
          (companyFilter === "all" || q.company === companyFilter) &&
          (resultFilter === "all" || q.outcome === resultFilter),
      ),
    [companyFilter, intelligence.questionBank, resultFilter],
  );
  const filteredFeedbacks = useMemo(
    () =>
      intelligence.feedbacks.filter(
        (f) =>
          (companyFilter === "all" || f.company === companyFilter) &&
          (resultFilter === "all" || f.outcome === resultFilter),
      ),
    [companyFilter, intelligence.feedbacks, resultFilter],
  );
  const filteredOutcomes = useMemo(
    () =>
      intelligence.outcomes.filter(
        (o) =>
          (companyFilter === "all" || o.company === companyFilter) &&
          (resultFilter === "all" || o.result === resultFilter),
      ),
    [companyFilter, intelligence.outcomes, resultFilter],
  );
  const radarChartData = useMemo(
    () => [
      { dimension: "Stories", score: data.radar.stories, fullMark: 10 },
      { dimension: "Practice", score: data.radar.practice, fullMark: 10 },
      { dimension: "Knowledge", score: data.radar.knowledge, fullMark: 10 },
      { dimension: "Targeting", score: data.radar.targeting, fullMark: 10 },
      { dimension: "Consistency", score: data.radar.consistency, fullMark: 10 },
    ],
    [data.radar],
  );
  const sortedInterviewTrend = useMemo(() => {
    const normalized = [...(data.interviewTrend ?? [])]
      .map((item, index) => ({
        ...item,
        session: Number.isFinite(Number(item.session)) ? Number(item.session) : index + 1,
      }))
      .sort((a, b) => a.session - b.session);
    return normalized.map((item, index) => ({
      ...item,
      xLabel: `Session ${index + 1}`,
    }));
  }, [data.interviewTrend]);

  useEffect(() => {
    let mounted = true;
    async function loadProgress() {
      try {
        const response = await fetch("/api/notion/progress");
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const payload = (await response.json()) as ProgressPayload;
        if (mounted) {
          setData(payload);
          setNote("已连接 Notion 进度数据");
        }
      } catch {
        if (mounted) {
          setNote("Notion 不可用，显示本地进度示例");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadProgress();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <>
      {isProgressEmpty ? (
        <section className="rounded-2xl border border-cyan-500/35 bg-cyan-500/10 p-4 text-sm text-cyan-100">
          开始你的第一次模拟面试，数据会自动出现在这里。
        </section>
      ) : null}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="neon-card rounded-2xl p-4">
          <p className="text-xs text-zinc-400">本周训练活跃度</p>
          <p className="mt-2 text-3xl font-semibold text-violet-200">
            {data.metrics.reviewedThisWeek + data.metrics.interviewsThisWeek}
          </p>
          <p className="mt-1 text-xs text-zinc-500">复习 + 模拟面试次数</p>
        </div>
        <div className="neon-card rounded-2xl p-4">
          <p className="text-xs text-zinc-400">知识待办</p>
          <p className="mt-2 text-3xl font-semibold text-cyan-200">
            {data.metrics.dueCount}/{data.metrics.totalKnowledge}
          </p>
          <p className="mt-1 text-xs text-zinc-500">到期复习卡片</p>
        </div>
        <div className="neon-card rounded-2xl p-4">
          <p className="text-xs text-zinc-400">准备度</p>
          <p className="mt-2 text-3xl font-semibold text-fuchsia-200">{data.metrics.readiness}%</p>
          <p className="mt-1 text-xs text-zinc-500">故事/JD/模拟/训练 综合估算</p>
        </div>
      </section>

      {(data.warnings?.length ?? 0) > 0 ? (
        <section className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="text-sm font-medium text-amber-200">Notion 配置诊断</p>
          <p className="mt-1 text-xs text-amber-100/80">
            部分数据库不可访问，当前页面使用可用数据继续渲染。请检查下列环境变量对应数据库是否分享给 Notion Integration。
          </p>
          <ul className="mt-2 space-y-1 text-xs text-amber-100">
            {(data.diagnostics ?? []).map((item, index) => (
              <li key={`${item.source}-${index}`}>
                - {item.source}（`{item.envKey}`）：{item.detail}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        <div className="neon-card rounded-2xl p-4">
          <p className="mb-2 text-sm text-zinc-300">关键漏斗</p>
          <div className="space-y-2 text-sm text-zinc-400">
            <p>故事库条目：{data.metrics.storyCount}</p>
            <p>高强度故事（4+）：{data.metrics.strongStories}</p>
            <p>JD 解码条目：{data.metrics.jdCount}</p>
            <p>累计面试记录：{data.metrics.interviewCount}</p>
            <p>本周面试复盘：{data.metrics.interviewsThisWeek}</p>
          </div>
          <p className="mt-3 text-xs text-zinc-500">{loading ? "加载中..." : note}</p>
        </div>
        <div className="neon-card rounded-2xl p-4">
          <h3 className="mb-2 text-sm text-zinc-200">五维能力雷达</h3>
          <div className="h-72">
            {chartsReady ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={320} minHeight={240}>
                <RadarChart data={radarChartData}>
                  <PolarGrid stroke="#3f3f46" />
                  <PolarAngleAxis dataKey="dimension" tick={{ fill: "#a1a1aa", fontSize: 12 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fill: "#71717a", fontSize: 11 }} />
                  <Radar
                    name="当前能力覆盖"
                    dataKey="score"
                    stroke="#22d3ee"
                    fill="#22d3ee"
                    fillOpacity={0.28}
                    strokeWidth={2}
                  />
                  <Tooltip />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-zinc-500">
                图表加载中...
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="neon-card rounded-2xl p-4">
          <h3 className="mb-2 text-sm text-zinc-200">五维评分趋势</h3>
          <div className="h-64">
            {chartsReady ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={320} minHeight={240}>
                <LineChart data={sortedInterviewTrend}>
                  <CartesianGrid stroke="#3f3f46" strokeDasharray="3 3" />
                  <XAxis dataKey="xLabel" stroke="#a1a1aa" />
                  <YAxis stroke="#a1a1aa" domain={[0, 5]} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="Substance" name="表达力" stroke="#22d3ee" strokeWidth={2} />
                  <Line type="monotone" dataKey="Structure" name="结构性" stroke="#a78bfa" strokeWidth={2} />
                  <Line type="monotone" dataKey="Relevance" name="相关性" stroke="#34d399" strokeWidth={2} />
                  <Line type="monotone" dataKey="Credibility" name="可信度" stroke="#f59e0b" strokeWidth={2} />
                  <Line type="monotone" dataKey="Differentiation" name="差异化" stroke="#f472b6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-zinc-500">
                图表加载中...
              </div>
            )}
          </div>
        </div>

        <div className="neon-card rounded-2xl p-4">
          <h3 className="mb-2 text-sm text-zinc-200">知识掌握度分布（按 Domain）</h3>
          <div className="h-64">
            {chartsReady ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={320} minHeight={240}>
                <BarChart data={data.masteryDistribution}>
                  <CartesianGrid stroke="#3f3f46" strokeDasharray="3 3" />
                  <XAxis dataKey="domain" stroke="#a1a1aa" />
                  <YAxis stroke="#a1a1aa" domain={[0, 5]} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="avgMastery" fill="#22d3ee" name="平均掌握度" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-zinc-500">
                图表加载中...
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="neon-card rounded-2xl p-4">
        <h3 className="mb-2 text-sm text-zinc-200">JD 投递状态看板</h3>
        <div className="grid gap-2 sm:grid-cols-4">
          {["待投", "已投", "面试中", "结束"].map((statusKey) => (
            <div key={statusKey} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
              <p className="text-xs text-zinc-500">{statusKey}</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-200">
                {data.jdStatusBoard[statusKey] ?? 0}
              </p>
            </div>
          ))}
        </div>
      </section>
      <section className="grid gap-4 xl:grid-cols-2">
        <div className="neon-card rounded-2xl p-4">
          <h3 className="mb-2 text-sm text-zinc-200">自评偏差追踪</h3>
          <p className="text-sm text-zinc-300">当前判定：{renderBiasLabel(insights.selfBias)}</p>
          <p className="mt-1 text-xs text-zinc-500">基于训练历史中的自评分与教练评分差值。</p>
        </div>
        <div className="neon-card rounded-2xl p-4">
          <h3 className="mb-2 text-sm text-zinc-200">训练 8 阶段进度</h3>
          <div className="grid gap-1 text-xs text-zinc-300">
            {insights.practiceStageStatus.map((item) => (
              <p key={item.label} className={item.unlocked ? "text-cyan-200" : "text-zinc-500"}>
                {item.unlocked ? "✓" : "·"} {item.label}
              </p>
            ))}
          </div>
        </div>
      </section>
      <section className="neon-card rounded-2xl p-4">
        <h3 className="mb-2 text-sm text-zinc-200">面试情报 · 分诊建议分布（最近20次）</h3>
        <p className="text-xs text-zinc-400">总样本：{triageInsights.last20Total}，最高频建议：{triageInsights.topRecommendation}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {triageInsights.stageDistribution.length > 0 ? (
            triageInsights.stageDistribution.map((item) => (
              <div key={item.stage} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
                <p className="text-xs text-zinc-500">第 {item.stage} 阶段</p>
                <p className="mt-1 text-sm text-zinc-200">{item.label}</p>
                <p className="mt-2 text-xl font-semibold text-cyan-200">{item.count}</p>
              </div>
            ))
          ) : (
            <p className="text-xs text-zinc-500">暂无分诊历史。先去回答评分的转录模式跑几次分析。</p>
          )}
        </div>
      </section>
      <section className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-3 flex flex-wrap gap-2 text-xs">
          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-300"
          >
            {companyOptions.map((name) => (
              <option key={name} value={name}>
                {name === "all" ? "全部公司" : name}
              </option>
            ))}
          </select>
          <select
            value={resultFilter}
            onChange={(e) => setResultFilter(e.target.value)}
            className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-300"
          >
            {resultFilterOptions.map((result) => (
              <option key={result} value={result}>
                {result === "all" ? "全部结果" : renderOutcomeLabel(result)}
              </option>
            ))}
          </select>
        </div>
        <div className="neon-card rounded-2xl p-4">
          <h3 className="mb-2 text-sm text-zinc-200">问题题库（最近）</h3>
          <div className="space-y-2 text-xs text-zinc-300">
            {filteredQuestionBank.length > 0 ? (
              filteredQuestionBank.map((q, idx) => (
                <p key={`${q.question}-${idx}`} className="rounded border border-zinc-800 bg-zinc-950/70 p-2">
                  [{q.company}] {q.question || "（空）"} · {q.score.toFixed(1)} · {renderOutcomeLabel(q.outcome)}
                </p>
              ))
            ) : (
              <p className="text-zinc-500">暂无题库记录。</p>
            )}
          </div>
        </div>
        <div className="neon-card rounded-2xl p-4">
          <h3 className="mb-2 text-sm text-zinc-200">招聘方反馈</h3>
          <div className="space-y-2 text-xs text-zinc-300">
            {filteredFeedbacks.length > 0 ? (
              filteredFeedbacks.map((f, idx) => (
                <p key={`${f.company}-${idx}`} className="rounded border border-zinc-800 bg-zinc-950/70 p-2">
                  [{f.company}] {renderOutcomeLabel(f.outcome)} · {f.feedback || "（空）"}
                </p>
              ))
            ) : (
              <p className="text-zinc-500">暂无反馈记录。</p>
            )}
          </div>
        </div>
        <div className="neon-card rounded-2xl p-4">
          <h3 className="mb-2 text-sm text-zinc-200">结果日志</h3>
          <div className="space-y-2 text-xs text-zinc-300">
            {filteredOutcomes.length > 0 ? (
              filteredOutcomes.map((o, idx) => (
                <p key={`${o.company}-${idx}`} className="rounded border border-zinc-800 bg-zinc-950/70 p-2">
                  [{o.company}] {o.round} · {renderOutcomeLabel(o.result)} · {o.notes || "（无备注）"}
                </p>
              ))
            ) : (
              <p className="text-zinc-500">暂无结果记录。</p>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
