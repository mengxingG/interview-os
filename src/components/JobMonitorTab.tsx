"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JobRow } from "@/types/notion";

// ==========================================
// 类型定义
// ==========================================
type JobStatus = "新发现" | "已查看" | "已解码" | "已投递" | "已放弃";

const STATUS_COLUMNS: JobStatus[] = ["新发现", "已查看", "已解码", "已投递", "已放弃"];

const STATUS_META: Record<JobStatus, { icon: string; color: string; border: string; bg: string; header: string; accent: string }> = {
  "新发现": { icon: "🆕", color: "text-blue-300", border: "border-blue-500/30", bg: "bg-blue-500/[0.03]", header: "text-blue-300", accent: "bg-blue-500/10" },
  "已查看": { icon: "👁️", color: "text-amber-300", border: "border-amber-500/30", bg: "bg-amber-500/[0.03]", header: "text-amber-300", accent: "bg-amber-500/10" },
  "已解码": { icon: "🔓", color: "text-emerald-300", border: "border-emerald-500/30", bg: "bg-emerald-500/[0.03]", header: "text-emerald-300", accent: "bg-emerald-500/10" },
  "已投递": { icon: "📤", color: "text-violet-300", border: "border-violet-500/30", bg: "bg-violet-500/[0.03]", header: "text-violet-300", accent: "bg-violet-500/10" },
  "已放弃": { icon: "💤", color: "text-zinc-400", border: "border-zinc-600/30", bg: "bg-zinc-500/[0.02]", header: "text-zinc-400", accent: "bg-zinc-500/10" },
};

// ==========================================
// 🎯 Mock 数据 — 赛博朋克风格看板演示
// ==========================================
const MOCK_JOBS: JobRow[] = [
  {
    id: "mock-1",
    title: "AI产品经理（大模型方向）",
    company: "字节跳动",
    role: "AI产品经理",
    matchScore: 92,
    status: "新发现",
    location: "北京 · 海淀",
    url: "https://jobs.bytedance.com",
    jdText: "负责AI产品规划与落地，深入理解大模型技术...",
    platform: "Boss直聘",
    salaryRange: "50K-80K·15薪",
    notes: "重点跟进，匹配度极高",
    jdSummary: "负责AI产品规划与落地，深入理解大模型技术，推动AI能力在各业务线的应用",
    createdAt: "2026-05-11T08:00:00Z",
    updatedAt: "2026-05-11T08:00:00Z",
  },
  {
    id: "mock-2",
    title: "高级AI产品专家",
    company: "阿里巴巴",
    role: "AI产品专家",
    matchScore: 85,
    status: "新发现",
    location: "杭州 · 余杭",
    url: "https://talent.alibaba.com",
    jdText: "负责AI平台产品设计，推动智能化解决方案落地...",
    platform: "猎聘",
    salaryRange: "60K-90K·16薪",
    notes: "",
    jdSummary: "负责AI平台产品设计，推动智能化解决方案在电商场景的落地",
    createdAt: "2026-05-10T10:30:00Z",
    updatedAt: "2026-05-10T10:30:00Z",
  },
  {
    id: "mock-3",
    title: "AI产品负责人（Agent方向）",
    company: "腾讯",
    role: "AI产品负责人",
    matchScore: 78,
    status: "已查看",
    location: "深圳 · 南山",
    url: "https://careers.tencent.com",
    jdText: "负责AI Agent产品线规划，带领产品团队...",
    platform: "内推",
    salaryRange: "70K-100K·15薪",
    notes: "需要进一步了解团队情况",
    jdSummary: "负责AI Agent产品线规划，带领产品团队探索智能体应用场景",
    createdAt: "2026-05-09T14:00:00Z",
    updatedAt: "2026-05-10T09:00:00Z",
  },
  {
    id: "mock-4",
    title: "大模型应用产品经理",
    company: "百度",
    role: "产品经理",
    matchScore: 72,
    status: "已查看",
    location: "北京 · 西二旗",
    url: "https://talent.baidu.com",
    jdText: "负责文心一言应用层产品设计...",
    platform: "Boss直聘",
    salaryRange: "40K-65K·16薪",
    notes: "",
    jdSummary: "负责文心一言应用层产品设计，探索大模型在搜索场景的创新",
    createdAt: "2026-05-08T11:00:00Z",
    updatedAt: "2026-05-09T16:00:00Z",
  },
  {
    id: "mock-5",
    title: "AI产品经理（智能助手）",
    company: "小米",
    role: "AI产品经理",
    matchScore: 68,
    status: "已解码",
    location: "北京 · 亦庄",
    url: "https://xiaomi.jobs",
    jdText: "负责小爱同学AI能力建设...",
    platform: "猎聘",
    salaryRange: "35K-55K·14薪",
    notes: "解码完成，匹配度中等",
    jdSummary: "负责小爱同学AI能力建设，提升语音助手的智能化水平",
    createdAt: "2026-05-07T09:00:00Z",
    updatedAt: "2026-05-08T14:00:00Z",
  },
  {
    id: "mock-6",
    title: "AI产品经理（出海方向）",
    company: "字节跳动",
    role: "AI产品经理",
    matchScore: 88,
    status: "已解码",
    location: "上海 · 漕河泾",
    url: "https://jobs.bytedance.com",
    jdText: "负责国际化AI产品设计...",
    platform: "内推",
    salaryRange: "50K-75K·15薪",
    notes: "解码完成，准备投递",
    jdSummary: "负责国际化AI产品设计，面向海外市场的AI应用创新",
    createdAt: "2026-05-06T15:00:00Z",
    updatedAt: "2026-05-07T10:00:00Z",
  },
  {
    id: "mock-7",
    title: "资深AI产品经理",
    company: "美团",
    role: "资深产品经理",
    matchScore: 65,
    status: "已投递",
    location: "北京 · 望京",
    url: "https://zhaopin.meituan.com",
    jdText: "负责AI在本地生活场景的应用...",
    platform: "Boss直聘",
    salaryRange: "45K-70K·15薪",
    notes: "已投递，等待反馈",
    jdSummary: "负责AI在本地生活场景的应用，推动智能化服务升级",
    createdAt: "2026-05-05T10:00:00Z",
    updatedAt: "2026-05-06T09:00:00Z",
  },
  {
    id: "mock-8",
    title: "AI产品经理（搜索方向）",
    company: "小红书",
    role: "AI产品经理",
    matchScore: 58,
    status: "已投递",
    location: "上海 · 黄浦",
    url: "https://job.xiaohongshu.com",
    jdText: "负责搜索场景AI产品优化...",
    platform: "猎聘",
    salaryRange: "40K-60K·15薪",
    notes: "",
    jdSummary: "负责搜索场景AI产品优化，提升搜索体验和推荐精准度",
    createdAt: "2026-05-04T08:00:00Z",
    updatedAt: "2026-05-05T11:00:00Z",
  },
  {
    id: "mock-9",
    title: "AI产品经理（NLP方向）",
    company: "科大讯飞",
    role: "AI产品经理",
    matchScore: 45,
    status: "已放弃",
    location: "合肥 · 高新区",
    url: "https://www.iflytek.com",
    jdText: "负责NLP技术产品化...",
    platform: "Boss直聘",
    salaryRange: "30K-50K·14薪",
    notes: "地点不合适，已放弃",
    jdSummary: "负责NLP技术产品化，推动语音识别技术在行业中的应用",
    createdAt: "2026-05-03T12:00:00Z",
    updatedAt: "2026-05-04T08:00:00Z",
  },
  {
    id: "mock-10",
    title: "AI产品经理（教育方向）",
    company: "网易",
    role: "AI产品经理",
    matchScore: 82,
    status: "新发现",
    location: "杭州 · 滨江",
    url: "https://hr.163.com",
    jdText: "负责AI在教育场景的产品创新...",
    platform: "内推",
    salaryRange: "45K-65K·16薪",
    notes: "朋友内推，尽快查看",
    jdSummary: "负责AI在教育场景的产品创新，推动个性化学习体验",
    createdAt: "2026-05-11T06:00:00Z",
    updatedAt: "2026-05-11T06:00:00Z",
  },
  {
    id: "mock-11",
    title: "AI产品总监（智能客服方向）",
    company: "京东",
    role: "AI产品总监",
    matchScore: 76,
    status: "新发现",
    location: "北京 · 亦庄",
    url: "https://zhaopin.jd.com",
    jdText: "负责智能客服AI产品规划，带领产品团队...",
    platform: "官网",
    salaryRange: "80K-120K·16薪",
    notes: "官网直投，关注中",
    jdSummary: "负责智能客服AI产品规划，带领产品团队提升客服智能化水平",
    createdAt: "2026-05-12T09:00:00Z",
    updatedAt: "2026-05-12T09:00:00Z",
  },
  {
    id: "mock-12",
    title: "AI产品经理（推荐方向）",
    company: "快手",
    role: "AI产品经理",
    matchScore: 70,
    status: "已查看",
    location: "北京 · 西二旗",
    url: "https://zhaopin.kuaishou.cn",
    jdText: "负责推荐系统AI产品优化...",
    platform: "官网",
    salaryRange: "45K-70K·15薪",
    notes: "官网投递，等待HR联系",
    jdSummary: "负责推荐系统AI产品优化，提升推荐效果和用户体验",
    createdAt: "2026-05-11T14:00:00Z",
    updatedAt: "2026-05-12T10:00:00Z",
  },
  {
    id: "mock-13",
    title: "高级AI产品经理（语音方向）",
    company: "字节跳动",
    role: "高级AI产品经理",
    matchScore: 90,
    status: "已解码",
    location: "深圳 · 南山",
    url: "https://jobs.bytedance.com",
    jdText: "负责语音AI产品能力建设...",
    platform: "官网",
    salaryRange: "55K-85K·15薪",
    notes: "官网投递，解码完成准备跟进",
    jdSummary: "负责语音AI产品能力建设，推动语音技术在内容场景的应用",
    createdAt: "2026-05-10T08:00:00Z",
    updatedAt: "2026-05-11T16:00:00Z",
  },
];

// ==========================================
// Props
// ==========================================
type JobMonitorTabProps = {
  onNavigateToDecode?: (job: JobRow) => void;
  onNavigateToResearch?: (job: JobRow) => void;
};

// ==========================================
// 主组件
// ==========================================
export function JobMonitorTab({ onNavigateToDecode, onNavigateToResearch }: JobMonitorTabProps) {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [dragJobId, setDragJobId] = useState<string | null>(null);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [useMock, setUseMock] = useState(false);
  const [activePlatform, setActivePlatform] = useState("全部");
  const [visibleColumns, setVisibleColumns] = useState<Set<number>>(new Set([0, 1, 2]));
  const kanbanRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef<number | null>(null);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/notion?resource=jobs&sortBy=createdAt&sortOrder=descending", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { jobs?: JobRow[] };
      if (data.jobs && data.jobs.length > 0) {
        setJobs(data.jobs);
        setUseMock(false);
      } else {
        setJobs(MOCK_JOBS);
        setUseMock(true);
      }
      setLastUpdated(new Date().toLocaleString("zh-CN"));
    } catch {
      setJobs(MOCK_JOBS);
      setUseMock(true);
      setLastUpdated(new Date().toLocaleString("zh-CN"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  // ==========================================
  // 平台筛选逻辑
  // ==========================================
  const platformList = useMemo(() => {
    const platforms = Array.from(new Set(jobs.map((j) => j.platform).filter(Boolean)));
    return ["全部", ...platforms.sort()];
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    if (activePlatform === "全部") return jobs;
    return jobs.filter((j) => j.platform === activePlatform);
  }, [jobs, activePlatform]);

  const stats = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisWeek = filteredJobs.filter((j) => {
      const d = new Date(j.createdAt);
      return !isNaN(d.getTime()) && d >= weekAgo;
    }).length;
    const highMatch = filteredJobs.filter((j) => j.matchScore >= 80).length;
    const pending = filteredJobs.filter((j) => j.status === "新发现" || j.status === "已查看").length;
    const decoded = filteredJobs.filter((j) => j.status === "已解码").length;
    const applied = filteredJobs.filter((j) => j.status === "已投递").length;
    return { thisWeek, highMatch, pending, decoded, applied, total: filteredJobs.length };
  }, [filteredJobs]);

  const grouped = useMemo(() => {
    const map: Record<string, JobRow[]> = {};
    for (const status of STATUS_COLUMNS) map[status] = [];
    for (const job of filteredJobs) {
      const s = STATUS_COLUMNS.includes(job.status as JobStatus) ? job.status : "新发现";
      map[s].push(job);
    }
    return map;
  }, [filteredJobs]);

  const columnCounts = useMemo(() => {
    return STATUS_COLUMNS.map((s) => grouped[s].length);
  }, [grouped]);

  const updateVisibleColumns = useCallback(() => {
    const el = kanbanRef.current;
    if (!el) return;
    const containerRect = el.getBoundingClientRect();
    const columns = el.querySelectorAll<HTMLElement>("[data-column-index]");
    const visible = new Set<number>();
    columns.forEach((col) => {
      const idx = parseInt(col.dataset.columnIndex ?? "", 10);
      if (!isNaN(idx)) {
        const colRect = col.getBoundingClientRect();
        const overlap = Math.min(colRect.right, containerRect.right) - Math.max(colRect.left, containerRect.left);
        if (overlap > 50) visible.add(idx);
      }
    });
    setVisibleColumns(visible);
  }, []);

  useEffect(() => {
    const el = kanbanRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => updateVisibleColumns());
    observer.observe(el);
    el.addEventListener("scroll", updateVisibleColumns, { passive: true });
    updateVisibleColumns();
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", updateVisibleColumns);
    };
  }, [updateVisibleColumns, jobs]);

  const handleDragStart = (jobId: string) => {
    setDragJobId(jobId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    const el = kanbanRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX;
    const threshold = 50;
    if (autoScrollRef.current !== null) cancelAnimationFrame(autoScrollRef.current);
    const scroll = () => {
      if (x < rect.left + threshold) {
        el.scrollLeft -= 12;
      } else if (x > rect.right - threshold) {
        el.scrollLeft += 12;
      }
      autoScrollRef.current = requestAnimationFrame(scroll);
    };
    autoScrollRef.current = requestAnimationFrame(scroll);
  };

  const handleDragEnd = () => {
    if (autoScrollRef.current !== null) {
      cancelAnimationFrame(autoScrollRef.current);
      autoScrollRef.current = null;
    }
  };

  const handleDrop = async (targetStatus: JobStatus) => {
    handleDragEnd();
    if (!dragJobId) return;
    const job = jobs.find((j) => j.id === dragJobId);
    if (!job || job.status === targetStatus) {
      setDragJobId(null);
      return;
    }
    setJobs((prev) =>
      prev.map((j) => (j.id === dragJobId ? { ...j, status: targetStatus } : j)),
    );
    setDragJobId(null);
    if (!useMock) {
      try {
        const res = await fetch("/api/notion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resource: "jobs", action: "update-status", pageId: dragJobId, status: targetStatus }),
        });
        if (!res.ok) void loadJobs();
      } catch { void loadJobs(); }
    }
  };

  const handleDelete = async (jobId: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== jobId));
    if (!useMock) {
      try { await fetch("/api/notion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resource: "jobs", action: "delete", pageId: jobId }) }); }
      catch { void loadJobs(); }
    }
  };

  const handleAbandon = async (jobId: string) => {
    setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status: "已放弃" as JobStatus } : j)));
    if (!useMock) {
      try {
        const res = await fetch("/api/notion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resource: "jobs", action: "update-status", pageId: jobId, status: "已放弃" }) });
        if (!res.ok) void loadJobs();
      } catch { void loadJobs(); }
    }
  };

  const matchColor = (score: number) => {
    if (score >= 80) return "text-emerald-300 border-emerald-500/50";
    if (score >= 60) return "text-amber-300 border-amber-500/30";
    return "text-zinc-400 border-zinc-600/30";
  };

  const matchBorder = (score: number) => {
    if (score >= 80) return "ring-1 ring-emerald-500/30";
    if (score >= 60) return "ring-1 ring-amber-500/20";
    return "";
  };

  const scrollToColumn = (index: number) => {
    const el = kanbanRef.current;
    if (!el) return;
    const columns = el.querySelectorAll<HTMLElement>("[data-column-index]");
    const target = columns[index];
    if (target) target.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="neon-card relative overflow-hidden rounded-2xl p-5">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(transparent_0%,rgba(168,85,247,0.03)_50%,transparent_100%)] bg-[length:100%_4px]" />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h2 className="neon-text text-lg font-bold text-purple-200">⚡ 岗位监控看板</h2>
            <p className="mt-1 text-xs text-zinc-500">{useMock ? "🔄 演示模式 · 使用 Mock 数据展示" : "📡 实时同步 Notion 数据库"}</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void loadJobs()} disabled={loading} className="rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-xs text-purple-200 transition hover:bg-purple-500/20 disabled:opacity-50">{loading ? "⟳ 刷新中" : "↻ 刷新"}</button>
          </div>
        </div>
      </section>
      <section className="neon-card rounded-2xl px-4 py-2.5">
        <div className="grid grid-cols-5 gap-2">
          <StatCard label="本周新增" value={stats.thisWeek} color="text-blue-300" icon="🆕" />
          <StatCard label="高匹配 (80+)" value={stats.highMatch} color="text-emerald-300" icon="🎯" />
          <StatCard label="待处理" value={stats.pending} color="text-amber-300" icon="⏳" />
          <StatCard label="已解码" value={stats.decoded} color="text-cyan-300" icon="🔓" />
          <StatCard label="已投递" value={stats.applied} color="text-violet-300" icon="📤" />
        </div>
      </section>
      <ManualEntry onSaved={() => void loadJobs()} useMock={useMock} />
      {/* 平台筛选 Tab */}
      <section className="neon-card rounded-xl px-3 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[10px] font-medium text-zinc-500">📡 平台</span>
          {platformList.map((platform) => (
            <button
              key={platform}
              type="button"
              onClick={() => setActivePlatform(platform)}
              className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-all ${
                activePlatform === platform
                  ? "border-cyan-500/60 text-cyan-300 shadow-[0_0_6px_rgba(34,211,238,0.15)]"
                  : "border-zinc-700/50 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
              }`}
            >
              {platform}
            </button>
          ))}
        </div>
      </section>
      <section className="neon-card rounded-xl px-3 py-2">
        <div className="flex items-center gap-1">
          {STATUS_COLUMNS.map((status, idx) => {
            const meta = STATUS_META[status];
            const isVisible = visibleColumns.has(idx);
            const count = columnCounts[idx];
            return (
              <button key={status} type="button" onClick={() => scrollToColumn(idx)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition-all ${isVisible ? `${meta.accent} ${meta.header} ring-1 ${meta.border}` : "text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/30"}`}>
                <span>{meta.icon}</span>
                <span className="hidden sm:inline">{status}</span>
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${isVisible ? meta.accent : "bg-zinc-800/50 text-zinc-500"}`}>{count}</span>
                {idx < STATUS_COLUMNS.length - 1 && <span className="ml-1 text-zinc-700">→</span>}
              </button>
            );
          })}
        </div>
      </section>
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
          <button type="button" onClick={() => void loadJobs()} className="ml-2 underline hover:text-red-100">重试</button>
        </div>
      )}
      {loading && jobs.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-sm text-zinc-500"><span className="animate-pulse">加载岗位数据中...</span></div>
      ) : (
        <div className="relative">
          <div ref={kanbanRef} onDragOver={handleDragOver} onDragEnd={handleDragEnd} onMouseUp={handleDragEnd} className="flex flex-nowrap overflow-x-auto pb-6 pt-1 scrollbar-thin scrollbar-track-zinc-900 scrollbar-thumb-zinc-700" style={{ scrollBehavior: "smooth" }}>
            {STATUS_COLUMNS.map((status, idx) => (
              <div key={status} data-column-index={idx} className="min-w-[340px] mr-5 first:ml-0">
                <KanbanColumn status={status} jobs={grouped[status]} onDrop={() => void handleDrop(status)} onDragStart={handleDragStart} expandedJobId={expandedJobId} setExpandedJobId={setExpandedJobId} matchColor={matchColor} matchBorder={matchBorder} onDelete={handleDelete} onAbandon={handleAbandon} onNavigateToDecode={onNavigateToDecode} onNavigateToResearch={onNavigateToResearch} isDragging={dragJobId !== null} />
              </div>
            ))}
          </div>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-zinc-950/60 to-transparent" />
        </div>
      )}
      <footer className="text-center text-xs text-zinc-600">
        <p>{useMock ? "🎮 演示数据 · 拖拽卡片可更改状态" : "📡 数据来源：Notion Jobs Database"}{lastUpdated ? ` · 最后更新：${lastUpdated}` : ""}</p>
        <p className="mt-0.5">点击卡片展开操作栏 · 匹配度基于 AI 分析 · 赛博朋克引擎 v2.0</p>
      </footer>
    </div>
  );
}

function StatCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  return (
    <div className="group relative overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/50 px-2.5 py-2 transition hover:border-purple-500/30">
      <div className="pointer-events-none absolute -right-4 -top-4 h-10 w-10 rounded-full bg-purple-500/5 opacity-0 transition group-hover:opacity-100" />
      <p className={`text-lg font-bold leading-tight ${color}`}>{value}</p>
      <p className="mt-0.5 flex items-center gap-1 text-[10px] text-zinc-500"><span>{icon}</span><span>{label}</span></p>
    </div>
  );
}

function ManualEntry({ onSaved, useMock }: { onSaved: () => void; useMock: boolean }) {
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<{
    title?: string; company?: string; role?: string; matchScore?: number; platform?: string; location?: string; salaryRange?: string;
    jdSummary?: string; requirements?: string[]; advantages?: string[]; disadvantages?: string[]; matchReasons?: string[]; mismatchReasons?: string[];
  } | null>(null);
  const [showAiResult, setShowAiResult] = useState(false);

  const handleAnalyze = async () => {
    const text = input.trim();
    if (!text) return;
    setAnalyzing(true); setAiResult(null); setShowAiResult(false);
    try {
      const res = await fetch("/api/jd/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jdText: text }),
      });
      if (res.ok) {
        const data = await res.json() as typeof aiResult;
        setAiResult(data);
      } else {
        const lines = text.split("\n").filter(Boolean);
        setAiResult({ title: lines[0]?.slice(0, 60) || "未命名岗位", company: "", role: "", matchScore: undefined });
      }
    } catch {
      setAiResult({ title: input.slice(0, 60) || "未命名岗位" });
    } finally { setAnalyzing(false); setShowAiResult(true); }
  };

  const handleSave = async () => {
    const text = input.trim();
    if (!text) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        resource: "jobs", action: "create",
        title: aiResult?.title || text.slice(0, 60), company: aiResult?.company || "", role: aiResult?.role || "",
        matchScore: aiResult?.matchScore, status: "新发现", location: aiResult?.location || "", platform: aiResult?.platform || "",
        salaryRange: aiResult?.salaryRange || "", jdText: text, jdSummary: aiResult?.jdSummary || "",
        requirements: aiResult?.requirements || [], advantages: aiResult?.advantages || [], disadvantages: aiResult?.disadvantages || [],
        matchReasons: aiResult?.matchReasons || [], mismatchReasons: aiResult?.mismatchReasons || [],
      };
      const res = await fetch("/api/notion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (res.ok) { setInput(""); setAiResult(null); setShowAiResult(false); onSaved(); }
    } catch (err) { console.error("保存失败", err); }
    finally { setSaving(false); }
  };

  return (
    <section className="neon-card rounded-2xl p-4">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-200"><span>📝</span> 手动录入岗位{useMock && <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-300">演示模式</span>}</h3>
      <div className="flex flex-col gap-2">
        <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="粘贴岗位 URL 或 JD 文本..." rows={3} className="w-full rounded-lg border border-zinc-800 bg-zinc-950/70 p-3 text-sm text-zinc-100 placeholder-zinc-600 transition focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/20" />
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void handleAnalyze()} disabled={!input.trim() || analyzing} className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100 transition hover:bg-cyan-500/20 disabled:opacity-50">{analyzing ? "⟳ AI 分析中..." : "🔍 AI 分析"}</button>
          <button type="button" onClick={() => void handleSave()} disabled={!input.trim() || saving} className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100 transition hover:bg-emerald-500/20 disabled:opacity-50">{saving ? "⟳ 保存中..." : "💾 保存到 Notion"}</button>
        </div>
        {showAiResult && aiResult && (
          <div className="mt-2 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3 text-xs text-zinc-300">
            <div className="mb-2 flex items-center gap-2"><span className="font-bold text-cyan-200">{aiResult.title || "未命名岗位"}</span>{aiResult.company && <span className="text-zinc-400">@{aiResult.company}</span>}{aiResult.matchScore !== undefined && aiResult.matchScore !== null && <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${aiResult.matchScore >= 80 ? "bg-emerald-500/20 text-emerald-300" : aiResult.matchScore >= 60 ? "bg-amber-500/20 text-amber-300" : "bg-zinc-500/20 text-zinc-400"}`}>{aiResult.matchScore}分</span>}</div>
            {aiResult.salaryRange && <p className="mb-1"><span className="text-zinc-500">💰 薪资：</span><span className="text-emerald-300">{aiResult.salaryRange}</span></p>}
            {aiResult.location && <p className="mb-1"><span className="text-zinc-500">📍 地点：</span>{aiResult.location}</p>}
            {aiResult.platform && <p className="mb-1"><span className="text-zinc-500">📡 平台：</span>{aiResult.platform}</p>}
            {aiResult.jdSummary && <p className="mb-1"><span className="text-zinc-500">📋 摘要：</span>{aiResult.jdSummary}</p>}
            {aiResult.requirements && aiResult.requirements.length > 0 && (
              <div className="mb-1"><span className="text-zinc-500">📌 要求：</span><ul className="ml-3 list-disc">{aiResult.requirements.map((r, i) => <li key={i} className="text-zinc-400">{r}</li>)}</ul></div>
            )}
            {aiResult.advantages && aiResult.advantages.length > 0 && (
              <div className="mb-1"><span className="text-emerald-400">✅ 优点：</span><ul className="ml-3 list-disc">{aiResult.advantages.map((a, i) => <li key={i} className="text-emerald-300/70">{a}</li>)}</ul></div>
            )}
            {aiResult.disadvantages && aiResult.disadvantages.length > 0 && (
              <div className="mb-1"><span className="text-red-400">⚠️ 缺点：</span><ul className="ml-3 list-disc">{aiResult.disadvantages.map((d, i) => <li key={i} className="text-red-300/70">{d}</li>)}</ul></div>
            )}
            {aiResult.matchReasons && aiResult.matchReasons.length > 0 && (
              <div className="mb-1"><span className="text-cyan-400">🎯 匹配理由：</span><ul className="ml-3 list-disc">{aiResult.matchReasons.map((m, i) => <li key={i} className="text-cyan-300/70">{m}</li>)}</ul></div>
            )}
            {aiResult.mismatchReasons && aiResult.mismatchReasons.length > 0 && (
              <div className="mb-1"><span className="text-amber-400">⚠️ 不匹配项：</span><ul className="ml-3 list-disc">{aiResult.mismatchReasons.map((m, i) => <li key={i} className="text-amber-300/70">{m}</li>)}</ul></div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

// ==========================================
// KanbanColumn 组件
// ==========================================
function KanbanColumn({
  status,
  jobs,
  onDrop,
  onDragStart,
  expandedJobId,
  setExpandedJobId,
  matchColor,
  matchBorder,
  onDelete,
  onAbandon,
  onNavigateToDecode,
  onNavigateToResearch,
  isDragging,
}: {
  status: JobStatus;
  jobs: JobRow[];
  onDrop: () => void;
  onDragStart: (id: string) => void;
  expandedJobId: string | null;
  setExpandedJobId: (id: string | null) => void;
  matchColor: (score: number) => string;
  matchBorder: (score: number) => string;
  onDelete: (id: string) => void;
  onAbandon: (id: string) => void;
  onNavigateToDecode?: (job: JobRow) => void;
  onNavigateToResearch?: (job: JobRow) => void;
  isDragging: boolean;
}) {
  const meta = STATUS_META[status];
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={() => { setDragOver(false); onDrop(); }}
      className={`flex h-full flex-col rounded-2xl border ${meta.border} ${meta.bg} transition-all ${dragOver ? "ring-2 ring-purple-500/40" : ""}`}
    >
      {/* 列头 */}
      <div className={`flex items-center justify-between rounded-t-2xl border-b ${meta.border} ${meta.accent} px-4 py-2.5`}>
        <div className="flex items-center gap-2">
          <span className="text-lg">{meta.icon}</span>
          <span className={`text-sm font-bold ${meta.header}`}>{status}</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.accent} ${meta.header}`}>{jobs.length}</span>
        </div>
      </div>

      {/* 卡片列表 */}
      <div className="flex-1 space-y-2 overflow-y-auto p-3 scrollbar-thin scrollbar-track-zinc-900 scrollbar-thumb-zinc-700">
        {jobs.length === 0 && (
          <div className="flex items-center justify-center py-8 text-[10px] text-zinc-600">
            <span>暂无岗位</span>
          </div>
        )}
        {jobs.map((job) => {
          const isExpanded = expandedJobId === job.id;
          return (
            <div
              key={job.id}
              draggable
              onDragStart={() => onDragStart(job.id)}
              onClick={() => setExpandedJobId(isExpanded ? null : job.id)}
              className={`group cursor-grab rounded-xl border border-zinc-800 bg-zinc-950/70 p-3 transition-all hover:border-zinc-700 active:cursor-grabbing ${matchBorder(job.matchScore)} ${isExpanded ? "ring-1 ring-purple-500/40" : ""}`}
            >
              {/* 标题行 */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold leading-snug text-zinc-100">{job.title || "未命名岗位"}</p>
                  {job.company && <p className="mt-0.5 truncate text-xs leading-relaxed text-zinc-500">{job.company}</p>}
                </div>
                {job.matchScore !== undefined && job.matchScore !== null && (
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold ${matchColor(job.matchScore)}`}>{job.matchScore}</span>
                )}
              </div>

              {/* 次要信息 */}
              <div className="mt-2 flex flex-wrap items-center gap-2.5 text-xs leading-relaxed text-zinc-500">
                {job.salaryRange && <span>💰 {job.salaryRange}</span>}
                {job.location && <span>📍 {job.location}</span>}
                {job.platform && <span>📡 {job.platform}</span>}
              </div>

              {/* 展开详情 */}
              {isExpanded && (
                <div className="mt-3 space-y-2.5 border-t border-zinc-800 pt-3 text-sm leading-relaxed">
                  {job.jdSummary && <p className="text-zinc-400 leading-relaxed">📋 {job.jdSummary}</p>}
                  {job.matchReasons && (
                    <div className="rounded-lg bg-emerald-500/5 p-2.5">
                      <span className="text-sm font-bold text-emerald-400">✅ 优点</span>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-emerald-300/80">{job.matchReasons}</p>
                    </div>
                  )}
                  {job.mismatchReasons && (
                    <div className="rounded-lg bg-amber-500/5 p-2.5">
                      <span className="text-sm font-bold text-amber-400">⚠️ 缺点</span>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-amber-300/80">{job.mismatchReasons}</p>
                    </div>
                  )}
                  {job.notes && <p className="text-zinc-500 leading-relaxed">📝 {job.notes}</p>}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {job.url && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); window.open(job.url, '_blank'); }} className="rounded-md border border-purple-500/30 bg-purple-500/10 px-2 py-1 text-[10px] text-purple-200 transition hover:bg-purple-500/20 hover:shadow-[0_0_8px_rgba(168,85,247,0.3)]">🔗 去看看</button>
                    )}
                    {onNavigateToDecode && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); onNavigateToDecode(job); }} className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[10px] text-cyan-200 transition hover:bg-cyan-500/20">🔓 解码</button>
                    )}
                    {onNavigateToResearch && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); onNavigateToResearch(job); }} className="rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-[10px] text-blue-200 transition hover:bg-blue-500/20">🔬 研究</button>
                    )}
                    <button type="button" onClick={(e) => { e.stopPropagation(); onAbandon(job.id); }} className="rounded-md border border-zinc-700/30 bg-zinc-800/50 px-2 py-1 text-[10px] text-zinc-400 transition hover:bg-zinc-700/50">💤 放弃</button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(job.id); }} className="rounded-md border border-red-500/20 bg-red-500/10 px-2 py-1 text-[10px] text-red-300 transition hover:bg-red-500/20">🗑️ 删除</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
