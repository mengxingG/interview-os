"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EVALUATE_TRIAGE_HISTORY_KEY, INTERVIEW_INTELLIGENCE_KEY, PRACTICE_HISTORY_KEY } from "@/lib/practice";

type ModuleHistoryCard = {
  id: string;
  title: string;
  href: string;
  cta: string;
  metricLabel: string;
  count: number;
  lastTitle: string;
  lastAt: string;
  recent: Array<{ title: string; at: string }>;
};

type TimeFilter = "all" | "7d" | "30d";

const emptyCards: ModuleHistoryCard[] = [];

function formatDateTime(input: string) {
  if (!input) return "—";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return input;
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function HistoryCenterPanel() {
  const [cards, setCards] = useState<ModuleHistoryCard[]>(emptyCards);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [query, setQuery] = useState("");

  const filteredCards = cards.filter((card) => {
    const q = query.trim().toLowerCase();
    const matchesQuery = !q || `${card.title} ${card.lastTitle} ${card.metricLabel}`.toLowerCase().includes(q);
    if (!matchesQuery) return false;
    if (timeFilter === "all") return true;
    if (!card.lastAt) return false;
    const ts = new Date(card.lastAt).getTime();
    if (Number.isNaN(ts)) return false;
    const now = Date.now();
    const days = timeFilter === "7d" ? 7 : 30;
    return now - ts <= days * 24 * 60 * 60 * 1000;
  });

  useEffect(() => {
    let mounted = true;
    async function loadHistory() {
      const research = readJSON<{ company?: string; savedAt?: string }>("interview-os-research", {});
      const prep = readJSON<{ company?: string; savedAt?: string }>("interview-os-prep", {});
      const hype = readJSON<{ savedAt?: string }>("interview-os-hype", {});
      const jd = readJSON<Array<{ title?: string; jdText?: string; savedAt?: string }>>("interview-os-jd-history", []);
      const practice = readJSON<Array<{ stage?: string; ts?: string }>>(PRACTICE_HISTORY_KEY, []);
      const debrief = readJSON<Array<{ title?: string; ts?: string; createdAt?: string }>>(INTERVIEW_INTELLIGENCE_KEY, []);
      const evaluate = readJSON<Array<{ sourceQuestion?: string; ts?: string }>>(EVALUATE_TRIAGE_HISTORY_KEY, []);
      const networking = readJSON<Array<{ scene?: string; ts?: string }>>("interview-os-networking-history", []);
      const negotiation = readJSON<Array<{ role?: string; ts?: string }>>("interview-os-negotiation-history", []);

      let resumeCount = 0;
      let resumeTitle = "";
      let resumeAt = "";
      try {
        const response = await fetch("/api/notion?resource=resume", { cache: "no-store" });
        if (response.ok) {
          const payload = (await response.json()) as { records?: Array<{ title?: string; createdDate?: string }> };
          const rows = payload.records ?? [];
          resumeCount = rows.length;
          resumeTitle = rows[0]?.title ?? "";
          resumeAt = rows[0]?.createdDate ?? "";
        }
      } catch {
        // ignore
      }

      const rows: ModuleHistoryCard[] = [
        {
          id: "research",
          title: "公司研究",
          href: "/job-analysis?tab=research",
          cta: "去岗位分析（研究）",
          metricLabel: "最近研究",
          count: research.savedAt ? 1 : 0,
          lastTitle: research.company || "公司研究结果",
          lastAt: research.savedAt || "",
          recent: research.savedAt ? [{ title: research.company || "公司研究结果", at: research.savedAt }] : [],
        },
        {
          id: "decode",
          title: "JD 解码",
          href: "/job-analysis?tab=decode",
          cta: "去岗位分析（JD 解码）",
          metricLabel: "最近解码",
          count: jd.length,
          lastTitle: jd[0]?.title || "JD 解码记录",
          lastAt: jd[0]?.savedAt || "",
          recent: jd.slice(0, 3).map((item) => ({ title: item.title || "JD 解码记录", at: item.savedAt || "" })),
        },
        {
          id: "prep",
          title: "面试备战简报",
          href: "/prep",
          cta: "去面试备战",
          metricLabel: "最近备战",
          count: prep.savedAt ? 1 : 0,
          lastTitle: prep.company ? `${prep.company} 面试备战` : "面试备战简报",
          lastAt: prep.savedAt || "",
          recent: prep.savedAt ? [{ title: prep.company ? `${prep.company} 面试备战` : "面试备战简报", at: prep.savedAt }] : [],
        },
        {
          id: "hype",
          title: "面试热身（Hype）",
          href: "/mock?tab=hype",
          cta: "去面试热身",
          metricLabel: "最近热身",
          count: hype.savedAt ? 1 : 0,
          lastTitle: "热身简报",
          lastAt: hype.savedAt || "",
          recent: hype.savedAt ? [{ title: "热身简报", at: hype.savedAt }] : [],
        },
        {
          id: "mock",
          title: "模拟面试/训练",
          href: "/mock",
          cta: "去模拟面试",
          metricLabel: "最近训练",
          count: practice.length,
          lastTitle: practice[0]?.stage || "模拟面试训练",
          lastAt: practice[0]?.ts || "",
          recent: practice.slice(0, 3).map((item) => ({ title: item.stage || "模拟面试训练", at: item.ts || "" })),
        },
        {
          id: "debrief",
          title: "面试复盘",
          href: "/debrief",
          cta: "去面试复盘",
          metricLabel: "最近复盘",
          count: debrief.length,
          lastTitle: debrief[0]?.title || "复盘记录",
          lastAt: debrief[0]?.ts || debrief[0]?.createdAt || "",
          recent: debrief.slice(0, 3).map((item) => ({ title: item.title || "复盘记录", at: item.ts || item.createdAt || "" })),
        },
        {
          id: "resume",
          title: "简历优化",
          href: "/resume",
          cta: "去简历优化",
          metricLabel: "最近优化",
          count: resumeCount,
          lastTitle: resumeTitle || "简历版本",
          lastAt: resumeAt,
          recent: resumeAt ? [{ title: resumeTitle || "简历版本", at: resumeAt }] : [],
        },
        {
          id: "evaluate",
          title: "回答评分",
          href: "/mock?tab=evaluate",
          cta: "去回答评分",
          metricLabel: "最近评分",
          count: evaluate.length,
          lastTitle: evaluate[0]?.sourceQuestion || "回答评分记录",
          lastAt: evaluate[0]?.ts || "",
          recent: evaluate.slice(0, 3).map((item) => ({ title: item.sourceQuestion || "回答评分记录", at: item.ts || "" })),
        },
        {
          id: "networking",
          title: "求职话术",
          href: "/communication?tab=scripts",
          cta: "去求职沟通（话术）",
          metricLabel: "最近生成",
          count: networking.length,
          lastTitle: networking[0]?.scene || "求职话术",
          lastAt: networking[0]?.ts || "",
          recent: networking.slice(0, 3).map((item) => ({ title: item.scene || "求职话术", at: item.ts || "" })),
        },
        {
          id: "negotiation",
          title: "薪资谈判",
          href: "/negotiation",
          cta: "去薪资谈判",
          metricLabel: "最近记录",
          count: negotiation.length,
          lastTitle: negotiation[0]?.role || "薪资谈判记录",
          lastAt: negotiation[0]?.ts || "",
          recent: negotiation.slice(0, 3).map((item) => ({ title: item.role || "薪资谈判记录", at: item.ts || "" })),
        },
      ];

      const sorted = rows.sort((a, b) => (b.count !== a.count ? b.count - a.count : (b.lastAt || "").localeCompare(a.lastAt || "")));
      if (mounted) {
        setCards(sorted);
        setLoading(false);
      }
    }
    void loadHistory();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section className="grid gap-3 md:grid-cols-2">
      {!loading ? (
        <div className="neon-card md:col-span-2 rounded-xl p-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索模块或最近摘要"
              className="min-w-[220px] flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            />
            <FilterButton active={timeFilter === "all"} onClick={() => setTimeFilter("all")} label="全部" />
            <FilterButton active={timeFilter === "7d"} onClick={() => setTimeFilter("7d")} label="近7天" />
            <FilterButton active={timeFilter === "30d"} onClick={() => setTimeFilter("30d")} label="近30天" />
          </div>
        </div>
      ) : null}
      {loading
        ? Array.from({ length: 10 }).map((_, i) => (
            <article key={i} className="neon-card animate-pulse rounded-xl p-4">
              <div className="h-4 w-32 rounded bg-zinc-800" />
              <div className="mt-2 h-3 w-24 rounded bg-zinc-800" />
              <div className="mt-2 h-3 w-56 rounded bg-zinc-800" />
            </article>
          ))
        : filteredCards.map((card) => (
            <RecordCard
              key={card.id}
              title={card.title}
              value={`${card.metricLabel}: ${card.count} ${card.id === "networking" ? "条" : "次"}`}
              summaryTitle={card.lastTitle}
              summaryDate={card.lastAt}
              recent={card.recent}
              href={card.href}
              cta={card.cta}
            />
          ))}
      {!loading && filteredCards.length === 0 ? (
        <article className="neon-card md:col-span-2 rounded-xl p-4 text-sm text-zinc-400">当前筛选条件下没有匹配记录。</article>
      ) : null}
    </section>
  );
}

function FilterButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-1 text-xs ${
        active ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-100" : "border-zinc-700 bg-zinc-900 text-zinc-300"
      }`}
    >
      {label}
    </button>
  );
}

function RecordCard({
  title,
  value,
  summaryTitle,
  summaryDate,
  recent,
  href,
  cta,
}: {
  title: string;
  value: string;
  summaryTitle: string;
  summaryDate: string;
  recent: Array<{ title: string; at: string }>;
  href: string;
  cta: string;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <article className="neon-card rounded-xl p-4">
      <p className="text-sm text-zinc-100">{title}</p>
      <p className="mt-1 text-xs text-zinc-400">{value}</p>
      <div className="mt-2 rounded-lg border border-zinc-800 bg-zinc-950/60 p-2">
        <p className="truncate text-xs text-zinc-300">{summaryTitle || "暂无摘要"}</p>
        <p className="mt-1 text-[11px] text-zinc-500">{summaryDate ? formatDateTime(summaryDate) : "暂无时间"}</p>
        {recent.length > 1 ? (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-300"
            >
              {expanded ? "收起最近3条" : "展开最近3条"}
            </button>
            {expanded ? (
              <div className="mt-2 space-y-1">
                {recent.slice(0, 3).map((row, idx) => (
                  <div key={`${row.title}-${idx}`} className="rounded border border-zinc-800 bg-zinc-900/70 p-1.5">
                    <p className="truncate text-[11px] text-zinc-300">{row.title}</p>
                    <p className="text-[10px] text-zinc-500">{row.at ? formatDateTime(row.at) : "暂无时间"}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <Link href={href} className="mt-3 inline-block rounded-lg border border-violet-500/35 bg-violet-500/10 px-3 py-1 text-xs text-violet-200">
        {cta}
      </Link>
    </article>
  );
}
