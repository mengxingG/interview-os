"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JobRow } from "@/lib/notion";

// ==========================================
// 类型定义
// ==========================================
type JobStatus = "新发现" | "已查看" | "已解码" | "已投递" | "已放弃";

const STATUS_COLUMNS: JobStatus[] = ["新发现", "已查看", "已解码", "已投递", "已放弃"];

const STATUS_COLORS: Record<JobStatus, string> = {
  "新发现": "border-l-blue-500",
  "已查看": "border-l-amber-500",
  "已解码": "border-l-emerald-500",
  "已投递": "border-l-violet-500",
  "已放弃": "border-l-zinc-500",
};

const STATUS_BG: Record<JobStatus, string> = {
  "新发现": "bg-blue-500/5",
  "已查看": "bg-amber-500/5",
  "已解码": "bg-emerald-500/5",
  "已投递": "bg-violet-500/5",
  "已放弃": "bg-zinc-500/5",
};

// ==========================================
// Props
// ==========================================
type JobMonitorTabProps = {
  onNavigateToDecode?: (job: JobRow) => void;
};

// ==========================================
// 主组件
// ==========================================
export function JobMonitorTab({ onNavigateToDecode }: JobMonitorTabProps) {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [dragJobId, setDragJobId] = useState<string | null>(null);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  // 加载数据
  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/notion?resource=jobs&sortBy=createdAt&sortOrder=descending", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { jobs?: JobRow[] };
      setJobs(data.jobs ?? []);
      setLastUpdated(new Date().toLocaleString("zh-CN"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
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

  // 拖拽处理
  const handleDragStart = (jobId: string) => {
    setDragJobId(jobId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (targetStatus: JobStatus) => {
    if (!dragJobId) return;
    const job = jobs.find((j) => j.id === dragJobId);
    if (!job || job.status === targetStatus) {
      setDragJobId(null);
      return;
    }

    // 乐观更新
    setJobs((prev) =>
      prev.map((j) => (j.id === dragJobId ? { ...j, status: targetStatus } : j)),
    );
    setDragJobId(null);

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
        // 回滚
        void loadJobs();
      }
    } catch {
      void loadJobs();
    }
  };

  // 删除
  const handleDelete = async (jobId: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== jobId));
    try {
      await fetch("/api/notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource: "jobs", action: "delete", pageId: jobId }),
      });
    } catch {
      void loadJobs();
    }
  };

  // 匹配度颜色
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

  return (
    <div className="flex flex-col gap-4">
      {/* ===== StatsBar ===== */}
      <section className="neon-card rounded-2xl p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <StatCard label="本周新增" value={stats.thisWeek} color="text-blue-300" />
          <StatCard label="高匹配 (80+)" value={stats.highMatch} color="text-emerald-300" />
          <StatCard label="待查看" value={stats.pending} color="text-amber-300" />
          <StatCard label="已解码" value={stats.decoded} color="text-cyan-300" />
          <StatCard label="已投递" value={stats.applied} color="text-violet-300" />
        </div>
      </section>

      {/* ===== ManualEntry ===== */}
      <ManualEntry onSaved={() => void loadJobs()} />

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
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {STATUS_COLUMNS.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              jobs={grouped[status]}
              bg={STATUS_BG[status]}
              onDragOver={handleDragOver}
              onDrop={() => void handleDrop(status)}
              onDragStart={handleDragStart}
              expandedJobId={expandedJobId}
              setExpandedJobId={setExpandedJobId}
              matchColor={matchColor}
              matchBorder={matchBorder}
              onDelete={handleDelete}
              onNavigateToDecode={onNavigateToDecode}
            />
          ))}
        </div>
      )}

      {/* ===== Footer ===== */}
      <footer className="text-center text-xs text-zinc-600">
        <p>
          数据来源：Notion Jobs Database
          {lastUpdated ? ` · 最后更新：${lastUpdated}` : ""}
        </p>
        <p className="mt-0.5">
          拖拽卡片可更改状态 · 点击卡片展开操作栏 · 匹配度基于 AI 分析
        </p>
      </footer>
    </div>
  );
}

// ==========================================
// 统计卡片
// ==========================================
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="mt-0.5 text-xs text-zinc-500">{label}</p>
    </div>
  );
}

// ==========================================
// 手动录入区
// ==========================================
function ManualEntry({ onSaved }: { onSaved: () => void }) {
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
      // 调用已有的大模型 API 提取关键字段
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
        // fallback: 简单提取
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
      <h3 className="mb-2 text-sm font-medium text-zinc-200">手动录入岗位</h3>
      <div className="flex flex-col gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="粘贴岗位 URL 或 JD 文本..."
          rows={3}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-950/70 p-3 text-sm text-zinc-100 placeholder-zinc-600 focus:border-cyan-500/50 focus:outline-none"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleAnalyze()}
            disabled={!input.trim() || analyzing}
            className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100 disabled:opacity-50"
          >
            {analyzing ? "AI 分析中..." : "AI 分析"}
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!input.trim() || saving}
            className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100 disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存到 Notion"}
          </button>
        </div>
        {showAiResult && aiResult && (
          <div className="mt-2 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3 text-xs text-zinc-300">
            <p>
              <span className="text-zinc-500">岗位：</span>
              {aiResult.title || "-"}
            </p>
            <p>
              <span className="text-zinc-500">公司：</span>
              {aiResult.company || "-"}
            </p>
            <p>
              <span className="text-zinc-500">匹配度：</span>
              {typeof aiResult.matchScore === "number" ? `${aiResult.matchScore}分` : "-"}
            </p>
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
  bg,
  onDragOver,
  onDrop,
  onDragStart,
  expandedJobId,
  setExpandedJobId,
  matchColor,
  matchBorder,
  onDelete,
  onNavigateToDecode,
}: {
  status: JobStatus;
  jobs: JobRow[];
  bg: string;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragStart: (jobId: string) => void;
  expandedJobId: string | null;
  setExpandedJobId: (id: string | null) => void;
  matchColor: (score: number) => string;
  matchBorder: (score: number) => string;
  onDelete: (jobId: string) => void;
  onNavigateToDecode?: (job: JobRow) => void;
}) {
  const columnRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={columnRef}
      onDragOver={onDragOver}
      onDrop={() => onDrop()}
      className={`flex flex-col gap-2 rounded-xl border border-zinc-800 p-3 ${bg}`}
    >
      <div className="mb-1 flex items-center justify-between">
        <h4 className="text-sm font-medium text-zinc-300">{status}</h4>
        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-500">
          {jobs.length}
        </span>
      </div>
      {jobs.length === 0 ? (
        <div className="flex items-center justify-center py-6 text-xs text-zinc-600">
          拖拽卡片到此
        </div>
      ) : (
        jobs.map((job) => (
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
            onNavigateToDecode={onNavigateToDecode}
          />
        ))
      )}
    </div>
  );
}

// ==========================================
// 岗位卡片
// ==========================================
function JobCard({
  job,
  onDragStart,
  isExpanded,
  onToggle,
  matchColor,
  matchBorder,
  onDelete,
  onNavigateToDecode,
}: {
  job: JobRow;
  onDragStart: (jobId: string) => void;
  isExpanded: boolean;
  onToggle: () => void;
  matchColor: (score: number) => string;
  matchBorder: (score: number) => string;
  onDelete: (jobId: string) => void;
  onNavigateToDecode?: (job: JobRow) => void;
}) {
  const hasHighMatch = job.matchScore >= 80;

  return (
    <div
      draggable
      onDragStart={() => onDragStart(job.id)}
      onClick={onToggle}
      className={`cursor-grab rounded-lg border border-zinc-700/50 bg-zinc-950/80 p-3 text-xs transition active:cursor-grabbing ${matchBorder(job.matchScore)} ${
        hasHighMatch ? "border-emerald-500/40" : ""
      } hover:border-zinc-600`}
    >
      {/* 头部：公司 + 匹配度 */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {/* 占位 Logo */}
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[10px] text-zinc-500">
            {(job.company || "?")[0]}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-zinc-100">
              {job.company || "未知公司"}
            </p>
            <p className="truncate text-zinc-400">{job.title}</p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${matchColor(job.matchScore)}`}
        >
          {job.matchScore > 0 ? `${job.matchScore}%` : "-"}
        </span>
      </div>

      {/* 地点标签 */}
      {job.location && (
        <div className="mt-1.5 flex items-center gap-1 text-zinc-500">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="truncate">{job.location}</span>
        </div>
      )}

      {/* 平台标签 */}
      {job.platform && (
        <div className="mt-1">
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
            {job.platform}
          </span>
        </div>
      )}

      {/* 展开操作栏 */}
      {isExpanded && (
        <div className="mt-2 flex flex-wrap gap-1.5 border-t border-zinc-800 pt-2">
          {onNavigateToDecode && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNavigateToDecode(job);
              }}
              className="rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[11px] text-cyan-200 hover:bg-cyan-500/20"
            >
              去解码
            </button>
          )}
          {job.url && (
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="rounded border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-[11px] text-violet-200 hover:bg-violet-500/20"
            >
              去投递
            </a>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm(`确认将「${job.title}」标记为放弃？`)) {
                onDelete(job.id);
              }
            }}
            className="ml-auto rounded border border-red-500/20 px-2 py-1 text-[11px] text-red-300 hover:bg-red-500/10"
          >
            放弃
          </button>
        </div>
      )}
    </div>
  );
}
