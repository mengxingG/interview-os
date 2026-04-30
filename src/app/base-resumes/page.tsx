"use client";

import { useEffect, useMemo, useState } from "react";
import { toastFetch } from "@/lib/toast-utils";

type BaseResumeRecord = {
  id: string;
  title: string;
  createdAt: string;
  optimizedText: string;
  version?: string;
  isActive?: boolean;
};

function formatDate(value: string) {
  const text = String(value ?? "").trim();
  if (!text) return "-";
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return date.toISOString().slice(0, 10);
}

export default function BaseResumesPage() {
  const [records, setRecords] = useState<BaseResumeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("正在加载 Notion 底本...");
  const [activeId, setActiveId] = useState("");

  const [editing, setEditing] = useState<{
    id?: string;
    title: string;
    content: string;
    createdAt?: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [newPreviewSnapshot, setNewPreviewSnapshot] = useState("");
  const [toast, setToast] = useState("");

  const statusIsError = /失败|错误|HTTP\\s*5\\d\\d|timed out/i.test(status);

  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }, [records]);

  async function loadRecords() {
    setLoading(true);
    try {
      const response = await fetch("/api/notion?resource=resume-bases", { cache: "no-store" });
      let payload: { records?: BaseResumeRecord[]; error?: string; detail?: string } = {};
      try {
        payload = (await response.json()) as typeof payload;
      } catch {
        // ignore JSON parse errors for error bodies
      }
      if (!response.ok) {
        throw new Error(payload.error ?? payload.detail ?? `HTTP ${response.status}`);
      }
      const rows = Array.isArray(payload.records) ? payload.records : [];
      setRecords(rows);
      const active = rows.find((item) => item.isActive)?.id ?? "";
      setActiveId(active);
      setStatus("已连接 Notion Resume（Base）库");
    } catch (error) {
      setRecords([]);
      setStatus(error instanceof Error ? error.message : "加载底本失败，请检查 Notion 配置");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRecords();
  }, []);

  async function setAsActive(id: string) {
    toastFetch(
      "/api/notion",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource: "resume", action: "set-active", pageId: id }),
      },
      {
        loading: "正在设置默认底本...",
        success: "✅ 已切换为默认底本",
        error: (err) => `❌ 切换失败：${err.message}`,
      },
      () => {
        setActiveId(id);
        setStatus("已设为当前活跃底本（其他模块可复用）。");
        void loadRecords();
      },
    );
  }

  async function saveEditing() {
    if (!editing) return;
    const title = editing.title.trim();
    const content = editing.content.trim();
    if (!content) {
      setStatus("底本文本不能为空。");
      return;
    }
    setSaving(true);

    const createdDate = new Date().toISOString().slice(0, 10);
    const body = editing.id
      ? {
          resource: "resume",
          action: "update",
          pageId: editing.id,
          type: "Base",
          title: title || undefined,
          afterText: content,
        }
      : {
          resource: "resume",
          action: "create",
          type: "Base",
          title: title || `底本 ${createdDate}`,
          version: `BASE-${createdDate}-${Date.now().toString().slice(-4)}`,
          afterText: content,
          beforeText: "",
          targetCompany: "",
          targetJD: "",
          aiSuggestions: "",
          createdDate,
        };

    toastFetch(
      "/api/notion",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      {
        loading: "正在保存底本到 Notion...",
        success: "✅ 底本已保存到 Notion",
        error: (err) => `❌ 保存失败：${err.message}`,
      },
      () => {
        setEditing(null);
        setNewPreviewSnapshot("");
        setStatus("底本已保存。");
        void loadRecords();
      },
    );

    setSaving(false);
  }

  async function archiveEditing() {
    if (!editing?.id) return;
    if (typeof window !== "undefined") {
      const confirmed = window.confirm("确定要删除这份底本吗？此操作不可逆。");
      if (!confirmed) return;
    }
    setArchiving(true);

    toastFetch(
      "/api/notion",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource: "resume", action: "archive", pageId: editing.id }),
      },
      {
        loading: "正在归档底本...",
        success: "✅ 底本已删除",
        error: (err) => `❌ 删除失败：${err.message}`,
      },
      () => {
        if (activeId === editing.id) setActiveId("");
        const targetId = editing.id;
        setRecords((prev) => prev.filter((row) => row.id !== targetId));
        setEditing(null);
        setNewPreviewSnapshot("");
        setStatus("底本已归档。");
      },
    );

    setArchiving(false);
  }

  async function archiveFromList(item: BaseResumeRecord) {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm("确定要删除这份底本吗？此操作不可逆。");
      if (!confirmed) return;
    }

    toastFetch(
      "/api/notion",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource: "resume", action: "archive", pageId: item.id }),
      },
      {
        loading: "正在删除底本...",
        success: "✅ 底本已删除",
        error: (err) => `❌ 删除失败：${err.message}`,
      },
      () => {
        if (activeId === item.id) setActiveId("");
        setRecords((prev) => prev.filter((row) => row.id !== item.id));
        setStatus("底本已删除（软删除）。");
      },
    );
  }

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return (
    <main className="flex w-full flex-col gap-4">
      <section className="neon-card rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold">简历底本管理</h1>
            <p className="mt-2 text-sm text-zinc-400">这里管理“可复用的基础简历底本”，而不是针对单个 JD 的优化版本。</p>
          </div>
          <button
            type="button"
            onClick={() =>
              {
                setEditing({
                  title: "",
                  content: "",
                });
                setNewPreviewSnapshot("");
              }
            }
            className="rounded-lg border border-violet-500/45 bg-violet-500/15 px-3 py-2 text-sm text-violet-100 transition hover:bg-violet-500/25"
          >
            新建底本
          </button>
        </div>
        <p className={`mt-3 text-xs ${statusIsError ? "text-red-300" : "text-zinc-500"}`}>{status}</p>
      </section>

      <section className="grid gap-3">
        <article className="neon-card rounded-xl p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-100">Base Resumes 列表</h2>
            <button
              type="button"
              onClick={() => void loadRecords()}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-zinc-500"
            >
              刷新
            </button>
          </div>
          {loading ? (
            <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 text-sm text-zinc-400">
              正在加载底本...
            </div>
          ) : sortedRecords.length === 0 ? (
            <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 text-sm text-zinc-400">
              暂无底本记录。点击右上角「新建底本」开始建立资产。
            </div>
          ) : (
            <div className="mt-3 grid gap-2">
              {sortedRecords.map((item) => {
                const isActive = item.id === activeId;
                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left transition ${
                      isActive
                        ? "border-cyan-400/60 bg-cyan-500/10 shadow-[0_0_24px_rgba(34,211,238,0.25)]"
                        : "border-zinc-800 bg-zinc-950/70 hover:border-zinc-700"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-100">{item.title || "未命名底本"}</p>
                      <p className="mt-1 text-xs text-zinc-500">日期：{formatDate(item.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isActive ? (
                        <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 text-[11px] text-cyan-100">
                          活跃
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          setEditing({
                            id: item.id,
                            title: item.title,
                            content: item.optimizedText || "",
                            createdAt: item.createdAt,
                          });
                          setNewPreviewSnapshot(item.optimizedText.trim());
                        }}
                        className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 transition hover:border-zinc-500"
                      >
                        查看/编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void archiveFromList(item);
                        }}
                        className="rounded-md border border-rose-500/35 bg-rose-500/10 px-2 py-1 text-xs text-rose-200 transition hover:bg-rose-500/20"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </article>
      </section>

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="neon-card w-full max-w-5xl rounded-2xl p-5">
            {editing.id ? (
              <div className="sr-only" aria-live="polite">
                {editing.id === activeId ? "当前活跃底本" : "非活跃底本"}
              </div>
            ) : null}
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-zinc-100">{editing.id ? "编辑底本" : "新建底本"}</h2>
                <p className="mt-1 text-xs text-zinc-500">
                  {editing.createdAt ? `创建日期：${formatDate(editing.createdAt)}` : "建议使用 Markdown 维护全文。"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {editing.id ? (
                  editing.id === activeId ? (
                    <button
                      type="button"
                      disabled
                      className="cursor-not-allowed rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-sm text-emerald-100 opacity-85"
                    >
                      🟢 当前活跃底本
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        void setAsActive(editing.id!);
                      }}
                      className="rounded-lg border border-cyan-500/60 bg-transparent px-3 py-2 text-sm text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.2)] transition hover:bg-cyan-500/15"
                    >
                      设为当前活跃底本
                    </button>
                  )
                ) : null}
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 transition hover:border-zinc-500"
                >
                  关闭
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              <p className="text-xs text-zinc-500">Title</p>
              <input
                value={editing.title}
                onChange={(e) => setEditing((prev) => (prev ? { ...prev, title: e.target.value } : prev))}
                className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                placeholder="底本标题（例如：AI PM 基础简历底本）"
              />
              <p className="text-xs text-zinc-500">{editing.id ? "Markdown 全文" : "智能粘贴内容"}</p>
              <textarea
                value={editing.content}
                onChange={(e) => {
                  const next = e.target.value;
                  setEditing((prev) => (prev ? { ...prev, content: next } : prev));
                  if (!editing.id) {
                    setNewPreviewSnapshot("");
                  }
                }}
                className="min-h-96 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100"
                placeholder={
                  editing.id
                    ? "在此编辑 Markdown 全文..."
                    : "提示：建议直接粘贴您的核心经历、教育背景及项目数据，无需排版排版，系统会在下游模块自动解析。"
                }
              />
              {!editing.id ? (
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="text-xs text-zinc-500">新建底本建议先预览效果，再保存。</p>
                  <button
                    type="button"
                    onClick={() => {
                      const content = editing.content.trim();
                      if (!content) {
                        setStatus("请先粘贴内容再预览。");
                        return;
                      }
                      setNewPreviewSnapshot(content);
                      setStatus("预览已生成，请确认后保存。");
                    }}
                    className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-100 transition hover:bg-cyan-500/20"
                  >
                    预览效果
                  </button>
                </div>
              ) : null}
              {!editing.id && newPreviewSnapshot ? (
                <div className="mt-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3">
                  <p className="text-xs text-cyan-200">预览效果（可滚动）</p>
                  <div className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-cyan-50">
                    {newPreviewSnapshot}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                {editing.id ? (
                  <button
                    type="button"
                    onClick={() => void archiveEditing()}
                    disabled={archiving || saving}
                    className="rounded-lg border border-rose-500/45 bg-rose-500/10 px-3 py-2 text-sm text-rose-100 transition hover:bg-rose-500/20 disabled:opacity-50"
                  >
                    {archiving ? <span className="loading-dots">归档中</span> : "归档"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void saveEditing()}
                  disabled={
                    saving ||
                    archiving ||
                    (!editing.id && (newPreviewSnapshot.length === 0 || newPreviewSnapshot !== editing.content.trim()))
                  }
                  className="rounded-lg border border-violet-500/45 bg-violet-500/15 px-3 py-2 text-sm text-violet-100 transition hover:bg-violet-500/25 disabled:opacity-50"
                >
                  {saving ? <span className="loading-dots">保存中</span> : "保存"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {toast ? (
        <div className="fixed right-4 top-4 z-[80] rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 text-sm text-emerald-100 shadow-[0_8px_30px_rgba(16,185,129,0.25)]">
          {toast}
        </div>
      ) : null}
    </main>
  );
}
