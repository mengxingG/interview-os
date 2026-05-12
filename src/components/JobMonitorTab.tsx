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
  const [visibleColumns, setVisibleColumns] = useState<Set<number>>(new Set([0, 1, 2]));
  const kanbanRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef<number | null>(null);

  // 加载数据 — 先尝试 API，失败则用 Mock
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

  // 统计
  const stats = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisWeek = jobs.filter((j) => {
      const d = new Date(j.createdAt);
      return !isNaN(d.getTime()) && d >= weekAgo;
    }).length;
    const highMatch = jobs.filter((j) => j.matchScore >= 80).length;
    const pending = jobs.filter((j) => j.status === "新发现" || j.status === "已查看").length;
    const decoded = jobs.filter((j) => j.status === "已解码").length;
    const applied = jobs.filter((j) => j.status === "已投递").length;
    return { thisWeek, highMatch, pending, decoded, applied, total: jobs.length };
  }, [jobs]);

  // 按状态分组
  const grouped = useMemo(() => {
    const map: Record<string, JobRow[]> = {};
    for (const status of STATUS_COLUMNS) map[status] = [];
    for (const job of jobs) {
      const s = STATUS_COLUMNS.includes(job.status as JobStatus) ? job.status : "新发现";
      map[s].push(job);
    }
    return map;
  }, [jobs]);

  // 各列数量
  const columnCounts = useMemo(() => {
    return STATUS_COLUMNS.map((s) => grouped[s].length);
  }, [grouped]);

  // 检测可见列
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

  // 拖拽处理
  const handleDragStart = (jobId: string) => {
    setDragJobId(jobId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    // 边缘自动滚动
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
          body: JSON.stringify({
            resource: "jobs",
            action: "update-status",
            pageId: dragJobId,
            status: targetStatus,
          }),
        });
        if (!res.ok) {
          void loadJobs();
        }
      } catch {
        void loadJobs();
      }
    }
  };

  const handleDelete = async (jobId: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== jobId));
    if (!useMock) {
      try {
        await fetch("/api/notion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resource: "jobs", action: "delete", pageId: jobId }),
        });
      } catch {
        void loadJobs();
      }
    }
  };

  const handleAbandon = async (jobId: string) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, status: "已放弃" as JobStatus } : j)),
    );
    if (!useMock) {
      try {
        const res = await fetch("/api/notion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resource: "jobs",
            action: "update-status",
            pageId: jobId,
            status: "已放弃",
          }),
        });
        if (!res.ok) {
          void loadJobs();
        }
      } catch {
        void loadJobs();
      }
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
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ===== 顶部横幅 ===== */}
      <section className="neon-card relative overflow-hidden rounded-2xl p-5">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(transparent_0%,rgba(168,85,247,0.03)_50%,transparent_100%)] bg-[length:100%_4px]" />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h2 className="neon-text text-lg font-bold text-purple-200">
              ⚡ 岗位监控看板
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              {useMock ? "🔄 演示模式 · 使用 Mock 数据展示" : "📡 实时同步 Notion 数据库"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadJobs()}
              disabled={loading}
              className="rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-xs text-purple-200 transition hover:bg-purple-500/20 disabled:opacity-50"
            >
              {loading ? "⟳ 刷新中" : "↻ 刷新"}
            </button>
          </div>
        </div>
      </section>

      {/* ===== StatsBar ===== */}
      <section className="neon-card rounded-2xl px-4 py-2.5">
        <div className="grid grid-cols-5 gap-2">
          <StatCard label="本周新增" value={stats.thisWeek} color="text-blue-300" icon="🆕" />
          <StatCard label="高匹配 (80+)" value={stats.highMatch} color="text-emerald-300" icon="🎯" />
          <StatCard label="待处理" value={stats.pending} color="text-amber-300" icon="⏳" />
          <StatCard label="已解码" value={stats.decoded} color="text-cyan-300" icon="🔓" />
          <StatCard label="已投递" value={stats.applied} color="text-violet-300" icon="📤" />
        </div>
      </section>

      {/* ===== ManualEntry ===== */}
      <ManualEntry onSaved={() => void loadJobs()} useMock={useMock} />

      {/* ===== 状态流转轴 (StatusNavBar) ===== */}
      <section className="neon-card rounded-xl px-3 py-2">
        <div className="flex items-center gap-1">
          {STATUS_COLUMNS.map((status, idx) => {
            const meta = STATUS_META[status];
            const isVisible = visibleColumns.has(idx);
            const count = columnCounts[idx];
            return (
              <button
                key={status}
                type="button"
                onClick={() => scrollToColumn(idx)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition-all ${
                  isVisible
                    ? `${meta.accent} ${meta.header} ring-1 ${meta.border}`
                    : "text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/30"
                }`}
              >
                <span>{meta.icon}</span>
                <span className="hidden sm:inline">{status}</span>
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                  isVisible ? meta.accent : "bg-zinc-800/50 text-zinc-500"
                }`}>
                  {count}
                </span>
                {idx < STATUS_COLUMNS.length - 1 && (
                  <span className="ml-1 text-zinc-700">→</span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* ===== KanbanBoard ===== */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
          <button
            type="button"
            onClick={() => void loadJobs()}
            className="ml-2 underline hover:text-red-100"
          >
            重试
          </button>
        </div>
      )}

      {loading && jobs.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-sm text-zinc-500">
          <span className="animate-pulse">加载岗位数据中...</span>
        </div>
      ) : (
        <div className="relative">
          {/* 看板容器 */}
          <div
            ref={kanbanRef}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onMouseUp={handleDragEnd}
            className="flex flex-nowrap overflow-x-auto pb-6 pt-1 scrollbar-thin scrollbar-track-zinc-900 scrollbar-thumb-zinc-700"
            style={{ scrollBehavior: "smooth" }}
          >
            {STATUS_COLUMNS.map((status, idx) => (
              <div
                key={status}
                data-column-index={idx}
                className="min-w-[340px] mr-5 first:ml-0"
              >
                <KanbanColumn
                  status={status}
                  jobs={grouped[status]}
                  onDragOver={handleDragOver}
                  onDrop={() => void handleDrop(status)}
                  onDragStart={handleDragStart}
                  expandedJobId={expandedJobId}
                  setExpandedJobId={setExpandedJobId}
                  matchColor={matchColor}
                  matchBorder={matchBorder}
                  onDelete={handleDelete}
                  onAbandon={handleAbandon}
                  onNavigateToDecode={onNavigateToDecode}
                  onNavigateToResearch={onNavigateToResearch}
                  isDragging={dragJobId !== null}
                />
              </div>
            ))}
          </div>

          {/* 右侧渐变蒙层 — 提示右侧有更多内容 */}
          <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-zinc-950/60 to-transparent" />
        </div>
      )}

      {/* ===== Footer ===== */}
      <footer className="text-center text-xs text-zinc-600">
        <p>
          {useMock ? "🎮 演示数据 · 拖拽卡片可更改状态" : "📡 数据来源：Notion Jobs Database"}
          {lastUpdated ? ` · 最后更新：${lastUpdated}` : ""}
        </p>
        <p className="mt-0.5">
          点击卡片展开操作栏 · 匹配度基于 AI 分析 · 赛博朋克引擎 v2.0
        </p>
      </footer>
    </div>
  );
}

// ==========================================
// 统计卡片
// ==========================================
function StatCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  return (
    <div className="group relative overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/50 px-2.5 py-2 transition hover:border-purple-500/30">
      <div className="pointer-events-none absolute -right-4 -top-4 h-10 w-10 rounded-full bg-purple-500/5 opacity-0 transition group-hover:opacity-100" />
      <p className={`text-lg font-bold leading-tight ${color}`}>{value}</p>
      <p className="mt-0.5 flex items-center gap-1 text-[10px] text-zinc-500">
        <span>{icon}</span>
        <span>{label}</span>
      </p>
    </div>
  );
}

// ==========================================
// 手动录入区
// ==========================================
function ManualEntry({ onSaved, useMock }: { onSaved: () => void; useMock: boolean }) {
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<{
    title?: string;
    company?: string;
    role?: string;
    matchScore?: number;
    platform?: string;
    location?: string;
    salaryRange?: string;
  } | null>(null);
  const [showAiResult, setShowAiResult] = useState(false);

  const handleAnalyze = async () => {
    const text = input.trim();
    if (!text) return;
    setAnalyzing(true);
    setAiResult(null);
    setShowAiResult(false);
    try {
      const res = await fetch("/api/jd/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jdText: text }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          title?: string;
          company?: string;
          role?: string;
          matchScore?: number;
          platform?: string;
          location?: string;
          salaryRange?: string;
        };
        setAiResult(data);
      } else {
        const lines = text.split("\n").filter(Boolean);
        setAiResult({
          title: lines[0]?.slice(0, 60) || "未命名岗位",
          company: "",
          role: "",
          matchScore: undefined,
        });
      }
    } catch {
      setAiResult({
        title: input.slice(0, 60) || "未命名岗位",
      });
    } finally {
      setAnalyzing(false);
      setShowAiResult(true);
    }
  };

  const handleSave = async () => {
    const text = input.trim();
    if (!text) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        resource: "jobs",
        action: "create",
        title: aiResult?.title || text.slice(0, 60),
        company: aiResult?.company || "",
        role: aiResult?.role || "",
        matchScore: aiResult?.matchScore,
        status: "新发现",
        location: aiResult?.location || "",
        platform: aiResult?.platform || "",
        salaryRange: aiResult?.salaryRange || "",
        jdText: text,
      };
      const res = await fetch("/api/notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setInput("");
        setAiResult(null);
        setShowAiResult(false);
        onSaved();
      }
    } catch (err) {
      console.error("保存失败", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="neon-card rounded-2xl p-4">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-200">
        <span>📝</span> 手动录入岗位
        {useMock && <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-300">演示模式</span>}
      </h3>
      <div className="flex flex-col gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="粘贴岗位 URL 或 JD 文本..."
          rows={3}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-950/70 p-3 text-sm text-zinc-100 placeholder-zinc-600 transition focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/20"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleAnalyze()}
            disabled={!input.trim() || analyzing}
            className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100 transition hover:bg-cyan-500/20 disabled:opacity-50"
          >
            {analyzing ? "⟳ AI 分析中..." : "🔍 AI 分析"}
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!input.trim() || saving}
            className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100 transition hover:bg-emerald-500/20 disabled:opacity-50"
          >
            {saving ? "⟳ 保存中..." : "💾 保存到 Notion"}
          </button>
        </div>
        {showAiResult && aiResult && (
          <div className="mt-2 animate-in rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3 text-xs text-zinc-300">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-zinc-500">岗位：</span>
                <span className="text-cyan-200">{aiResult.title || "-"}</span>
              </div>
              <div>
                <span className="text-zinc-500">公司：</span>
                <span className="text-cyan-200">{aiResult.company || "-"}</span>
              </div>
              <div>
                <span className="text-zinc-500">匹配度：</span>
                <span className={typeof aiResult.matchScore === "number" && aiResult.matchScore >= 80 ? "text-emerald-300" : "text-amber-300"}>
                  {typeof aiResult.matchScore === "number" ? `${aiResult.matchScore}分` : "-"}
                </span>
              </div>
              <div>
                <span className="text-zinc-500">平台：</span>
                <span>{aiResult.platform || "-"}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ==========================================
// 看板列
// ==========================================
function KanbanColumn({
  status,
  jobs,
  onDragOver,
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
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragStart: (jobId: string) => void;
  expandedJobId: string | null;
  setExpandedJobId: (id: string | null) => void;
  matchColor: (score: number) => string;
  matchBorder: (score: number) => string;
  onDelete: (jobId: string) => void;
  onAbandon: (jobId: string) => void;
  onNavigateToDecode?: (job: JobRow) => void;
  onNavigateToResearch?: (job: JobRow) => void;
  isDragging: boolean;
}) {
  const colors = STATUS_META[status];

  return (
    <div
      onDragOver={onDragOver}
      onDrop={() => onDrop()}
      className={`flex flex-col gap-2 rounded-xl border ${colors.border} ${colors.bg} p-3 backdrop-blur-sm transition-all ${
        isDragging ? "min-h-[200px]" : ""
      }`}
    >
      <div className={`mb-1 flex items-center justify-between rounded-lg ${colors.accent} px-2 py-1.5`}>
        <h4 className={`text-xs font-semibold uppercase tracking-wider ${colors.header}`}>
          {colors.icon} {status}
        </h4>
        <span className={`rounded-full ${colors.accent} px-2 py-0.5 text-xs ${colors.header}`}>
          {jobs.length}
        </span>
      </div>

      {jobs.length === 0 ? (
        <div className="flex items-center justify-center py-8 text-xs text-zinc-600">
          <div className="flex flex-col items-center gap-1">
            <span className="text-lg opacity-30">⬡</span>
            <span>拖拽卡片到此</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onDragStart={onDragStart}
              isExpanded={expandedJobId === job.id}
              onToggle={() =>
                setExpandedJobId(expandedJobId === job.id ? null : job.id)
              }
              matchColor={matchColor}
              matchBorder={matchBorder}
              onDelete={onDelete}
              onAbandon={onAbandon}
              onNavigateToDecode={onNavigateToDecode}
              onNavigateToResearch={onNavigateToResearch}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ==========================================
// 🎴 赛博朋克岗位卡片
// ==========================================
function JobCard({
  job,
  onDragStart,
  isExpanded,
  onToggle,
  matchColor,
  matchBorder,
  onDelete,
  onAbandon,
  onNavigateToDecode,
  onNavigateToResearch,
}: {
  job: JobRow;
  onDragStart: (jobId: string) => void;
  isExpanded: boolean;
  onToggle: () => void;
  matchColor: (score: number) => string;
  matchBorder: (score: number) => string;
  onDelete: (jobId: string) => void;
  onAbandon: (jobId: string) => void;
  onNavigateToDecode?: (job: JobRow) => void;
  onNavigateToResearch?: (job: JobRow) => void;
}) {
  const [isAiExpanded, setIsAiExpanded] = useState(false);
  const hasHighMatch = job.matchScore >= 80;
  const companyInitial = (job.company || "?")[0];
  const hasAiAssessment = !!(job.matchReasons || job.mismatchReasons);

  const matchLabel = (score: number) => {
    if (score >= 80) return { text: "🔥 高匹配", color: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10" };
    if (score >= 60) return { text: "📊 中匹配", color: "text-amber-300 border-amber-500/30 bg-amber-500/10" };
    return { text: "📉 低匹配", color: "text-zinc-400 border-zinc-600/30 bg-zinc-500/10" };
  };

  const ml = matchLabel(job.matchScore);

  return (
    <div
      draggable
      onDragStart={() => onDragStart(job.id)}
      onClick={onToggle}
      className={`group relative cursor-grab overflow-hidden rounded-lg border bg-zinc-950/90 p-5 text-xs transition-all active:cursor-grabbing ${
        hasHighMatch
          ? "border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.08)]"
          : "border-zinc-700/50 hover:border-zinc-600"
      } ${matchBorder(job.matchScore)}`}
    >
      {/* 装饰扫描线 */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(transparent_0%,rgba(168,85,247,0.02)_50%,transparent_100%)] bg-[length:100%_3px] opacity-0 transition group-hover:opacity-100" />

      {/* 高匹配发光角标 */}
      {hasHighMatch && (
        <div className="pointer-events-none absolute -right-6 -top-6 h-12 w-12 rotate-45 bg-emerald-500/10 blur-xl" />
      )}

      <div className="relative z-10">
        {/* 匹配度 - 右上角绝对定位 */}
        <div className={`absolute right-0 top-0 rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${matchColor(job.matchScore)}`}>
          {job.matchScore > 0 ? `${job.matchScore}%` : "—"}
        </div>

        {/* 头部：公司 Logo + 名称 */}
        <div className="flex items-start gap-2 pr-14">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
            hasHighMatch
              ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30"
              : "bg-purple-500/15 text-purple-300 ring-1 ring-purple-500/20"
          }`}>
            {companyInitial}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-100">
              {job.company || "未知公司"}
            </p>
            <p className="truncate text-[11px] text-zinc-400">
              {job.title}
            </p>
          </div>
        </div>

      {/* JD Summary — 默认3行省略，hover 展开完整内容 */}
      {job.jdSummary && (
        <p
          className="mt-3 mb-3 line-clamp-3 text-sm leading-relaxed text-gray-300 transition-all duration-200 hover:line-clamp-none"
          style={{ fontSize: "14px", lineHeight: "1.6" }}
        >
          {job.jdSummary}
        </p>
      )}

        {/* 地点 + 平台 */}
        <div className="mt-2 flex items-center gap-2">
          {job.location && (
            <span className="flex items-center gap-0.5 text-[10px] text-zinc-500">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {job.location}
            </span>
          )}
          {job.platform && (
            <span className="rounded bg-zinc-800/80 px-1.5 py-0.5 text-[9px] text-zinc-500">
              {job.platform}
            </span>
          )}
        </div>

        {/* 薪资 + 匹配度标签 */}
        <div className="mt-2 flex items-center gap-2">
          {job.salaryRange && (
            <span className="flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-200/90">
              <span>💰</span>
              <span>{job.salaryRange}</span>
            </span>
          )}
          <span className={`rounded border px-1.5 py-0.5 text-[9px] ${ml.color}`}>
            {ml.text}
          </span>
        </div>

        {/* ⚡ AI 深度评估 — 折叠展开按钮 */}
        {hasAiAssessment && (
          <div className="mt-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsAiExpanded((prev) => !prev);
              }}
              className="group/ai flex w-full items-center justify-center gap-1.5 rounded-md border border-cyan-500/20 bg-cyan-500/[0.04] px-2 py-1.5 text-[11px] text-cyan-300/70 transition-all hover:border-cyan-500/40 hover:bg-cyan-500/[0.08] hover:text-cyan-200"
            >
              <span className="transition-transform duration-200 group-hover/ai:scale-110">⚡</span>
              <span>AI 深度评估</span>
              <svg
                className={`h-3 w-3 transition-transform duration-200 ${isAiExpanded ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* 展开面板 */}
            {isAiExpanded && (
              <div className="mt-2 space-y-2 rounded-lg bg-black/50 p-3 shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)]">
                {job.matchReasons && (
                  <div className="border-l-2 border-emerald-500/60 pl-3">
                    <p className="mb-1 text-[11px] font-semibold text-emerald-400">✅ 核心优势</p>
                    <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-emerald-100/80">{job.matchReasons}</p>
                  </div>
                )}
                {job.mismatchReasons && (
                  <div className="border-l-2 border-orange-500/60 pl-3">
                    <p className="mb-1 text-[11px] font-semibold text-orange-400">⚠️ 潜在风险</p>
                    <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-orange-100/80">{job.mismatchReasons}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 展开操作栏 */}
        {isExpanded && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-zinc-800 pt-2">
            {onNavigateToDecode && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigateToDecode(job);
                }}
                className="rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[11px] text-cyan-200 transition hover:bg-cyan-500/20"
              >
                🔓 去解码
              </button>
            )}
            {onNavigateToResearch && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigateToResearch(job);
                }}
                className="rounded border border-purple-500/30 bg-purple-500/10 px-2 py-1 text-[11px] text-purple-200 transition hover:bg-purple-500/20"
              >
                🏢 公司研究
              </button>
            )}
            {job.url && (
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="rounded border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-[11px] text-violet-200 transition hover:bg-violet-500/20"
              >
                📤 去投递
              </a>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`确认将「${job.title}」标记为放弃？`)) {
                  onAbandon(job.id);
                }
              }}
              className="ml-auto rounded border border-red-500/20 px-2 py-1 text-[11px] text-red-300 transition hover:bg-red-500/10"
            >
              💤 放弃
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
