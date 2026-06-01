"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PageGuide } from "@/components/PageGuide";
import { ModelSelect } from "@/components/ModelSelect";
import type { ModelType } from "@/lib/llm";
import { readModelSelection, writeModelSelection } from "@/lib/model-selection";

type HypeResult = {
  highlightReplay60s: string[];
  threeByThree: {
    mustLandPoints: string[];
    likelyQuestions: string[];
  };
  recoveryManual: string[];
  focusCue: string;
};

type HypeSourceRecord = {
  id: string;
  title: string;
  company: string;
  role: string;
  date: string;
};

export default function HypePage() {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (pathname === "/hype") {
      router.replace("/warm-up");
    }
  }, [pathname, router]);

  const [result, setResult] = useState<HypeResult | null>(null);
  const [recordOptions, setRecordOptions] = useState<HypeSourceRecord[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState("");
  const [selectedPrepContext, setSelectedPrepContext] = useState("");
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [loadingContext, setLoadingContext] = useState(false);
  const [modelType, setModelType] = useState<ModelType>(() => readModelSelection("hype", "pro"));
  useEffect(() => {
    writeModelSelection("hype", modelType);
  }, [modelType]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("等待生成赛前提振包");
  useEffect(() => {
    let mounted = true;
    async function loadHypeRecords() {
      setLoadingRecords(true);
      try {
        const response = await fetch("/api/notion?resource=hype-records", { cache: "no-store" });
        const payload = (await response.json()) as { records?: HypeSourceRecord[]; error?: string; detail?: string };
        if (!response.ok) {
          throw new Error(payload.detail || payload.error || `HTTP ${response.status}`);
        }
        if (!mounted) return;
        const rows = Array.isArray(payload.records) ? payload.records : [];
        setRecordOptions(rows);
        setSelectedRecordId((prev) => prev || rows[0]?.id || "");
        setStatus(rows.length > 0 ? `已加载 ${rows.length} 条备战记录。` : "暂无可用的备战记录，请先在 Prep 中保存到 Notion。");
      } catch (error) {
        if (!mounted) return;
        setStatus(error instanceof Error ? error.message : "加载备战记录失败。");
      } finally {
        if (mounted) setLoadingRecords(false);
      }
    }
    void loadHypeRecords();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadSelectedPrepContext() {
      if (!selectedRecordId) {
        setSelectedPrepContext("");
        return;
      }
      setLoadingContext(true);
      try {
        const response = await fetch(
          `/api/notion?resource=hype-record-content&pageId=${encodeURIComponent(selectedRecordId)}`,
          { cache: "no-store" },
        );
        const payload = (await response.json()) as { content?: string; error?: string; detail?: string };
        if (!response.ok) {
          throw new Error(payload.detail || payload.error || `HTTP ${response.status}`);
        }
        if (!mounted) return;
        setSelectedPrepContext(String(payload.content ?? "").trim());
      } catch (error) {
        if (!mounted) return;
        setSelectedPrepContext("");
        setStatus(error instanceof Error ? error.message : "加载备战正文失败。");
      } finally {
        if (mounted) setLoadingContext(false);
      }
    }
    void loadSelectedPrepContext();
    return () => {
      mounted = false;
    };
  }, [selectedRecordId]);

  const normalizeResult = (payload: Partial<HypeResult>): HypeResult => ({
    highlightReplay60s: Array.isArray(payload.highlightReplay60s) ? payload.highlightReplay60s.filter(Boolean) : [],
    threeByThree: {
      mustLandPoints: Array.isArray(payload.threeByThree?.mustLandPoints)
        ? payload.threeByThree.mustLandPoints.filter(Boolean)
        : [],
      likelyQuestions: Array.isArray(payload.threeByThree?.likelyQuestions)
        ? payload.threeByThree.likelyQuestions.filter(Boolean)
        : [],
    },
    recoveryManual: Array.isArray(payload.recoveryManual) ? payload.recoveryManual.filter(Boolean) : [],
    focusCue: payload.focusCue?.trim() || "",
  });

  const canGenerate = Boolean(selectedRecordId);

  const onGenerate = async () => {
    if (!canGenerate) {
      setStatus("请先选择一条备战记录。");
      return;
    }
    if (!selectedPrepContext.trim()) {
      setStatus("当前备战记录正文为空，请先检查该记录内容。");
      return;
    }
    setLoading(true);
    setStatus(modelType === "pro" ? "正在使用 Gemini Pro 深度生成（约 10-30 秒）..." : "正在生成提振包...");
    try {
      const response = await fetch("/api/hype/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prepFullContent: selectedPrepContext, modelType }),
      });
      const payload = (await response.json()) as { result?: HypeResult; error?: string; detail?: string };
      if (!response.ok) {
        throw new Error(payload.error || payload.detail || `HTTP ${response.status}`);
      }
      if (!payload.result) {
        throw new Error("Missing result");
      }
      const normalized = normalizeResult(payload.result);
      setResult(normalized);
      setStatus("提振包生成完成，出发前再读一遍。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "生成失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  };

  const clearDraft = () => {
    setResult(null);
    setStatus("已清空热身草稿。");
  };

  return (
    <main className="flex w-full flex-col gap-4">
      <PageGuide
        pageKey="hype"
        items={[
          "面试前 5-10 分钟使用：先看 60 秒高光，再看 3x3 核心要点。",
          "重点记住失误恢复手册中的兜底句，避免现场卡壳。",
          "若有即将面试，优先按该岗位上下文生成热身简报。",
        ]}
      />
      <section className="neon-card rounded-2xl p-4">
        <div className="mb-3 flex items-center gap-2">
          <button
            type="button"
            onClick={onGenerate}
            disabled={loading || !canGenerate}
            className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100 transition hover:bg-cyan-500/20 disabled:opacity-50"
          >
            {loading ? "生成中..." : "生成今日热身简报"}
          </button>
          <button
            type="button"
            onClick={clearDraft}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 transition hover:border-zinc-500"
          >
            清空草稿
          </button>
          <span className="text-xs text-zinc-500">{status}</span>
        </div>
        <ModelSelect
          value={modelType}
          onChange={setModelType}
          storageKey="hype"
          recommended="pro"
          label="大模型"
          className="mb-2"
          selectClassName="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
        />
        <div className="mb-3">
          <p className="mb-1 text-xs text-zinc-500">备战记录（自动默认选中最新一条）</p>
          <select
            value={selectedRecordId}
            onChange={(event) => setSelectedRecordId(event.target.value)}
            disabled={loadingRecords || recordOptions.length === 0}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm disabled:opacity-50"
          >
            {recordOptions.length === 0 ? (
              <option value="">{loadingRecords ? "加载备战记录中..." : "暂无备战记录"}</option>
            ) : null}
            {recordOptions.map((record) => (
              <option key={record.id} value={record.id}>
                [{(record.date || "").slice(0, 10) || "无日期"}] {record.company || "未知公司"} - {record.role || record.title}
              </option>
            ))}
          </select>
        </div>
        {selectedPrepContext ? (
          <div className="mt-3">
            <details className="group rounded-lg border border-zinc-700/50 bg-zinc-800/30 transition-colors open:bg-zinc-800/50">
              <summary className="flex cursor-pointer list-none items-center p-3 text-xs font-medium text-zinc-400 hover:text-zinc-300">
                <span className="mr-2">👁️</span>
                查看将发送给大模型的底层上下文 (Context Preview)
                <span className="ml-auto transition group-open:rotate-180">▼</span>
              </summary>
              <div className="max-h-48 overflow-y-auto whitespace-pre-wrap border-t border-zinc-700/50 p-3 font-mono text-xs leading-relaxed text-zinc-500">
                {selectedPrepContext}
              </div>
            </details>
          </div>
        ) : null}
        {loadingContext ? <p className="mb-3 text-xs text-zinc-500">正在加载上下文预览...</p> : null}
        <div className="grid gap-3 lg:grid-cols-2">
          <ParagraphCard title="60 秒高光回放" items={result?.highlightReplay60s ?? []} />
          <ResultCard title="3x3：必须传达的 3 个要点" items={result?.threeByThree.mustLandPoints ?? []} />
          <ResultCard title="3x3：可能被问到的 3 个问题" items={result?.threeByThree.likelyQuestions ?? []} />
          <ResultCard title="失误恢复手册" items={result?.recoveryManual ?? []} />
        </div>
        <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-sm text-cyan-200">
          聚焦提示：{result?.focusCue ?? "生成后显示"}
        </div>
      </section>
    </main>
  );
}

function ParagraphCard({ title, items }: { title: string; items: string[] }) {
  const paragraph = items.length > 0 ? items.join(" ") : "生成后显示";
  return (
    <div className="neon-card rounded-xl p-4">
      <h3 className="mb-2 text-sm font-semibold text-zinc-100">{title}</h3>
      <p className="text-sm leading-relaxed text-zinc-300">
        {paragraph === "生成后显示" ? (
          <span className="text-zinc-500">{paragraph}</span>
        ) : (
          renderInlineBold(paragraph)
        )}
      </p>
    </div>
  );
}

function ResultCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="neon-card rounded-xl p-4">
      <h3 className="mb-2 text-sm font-semibold text-zinc-100">{title}</h3>
      <ul className="space-y-1 text-sm text-zinc-300">
        {items.length > 0 ? (
          items.map((item, idx) => (
            <li key={idx}>
              <span className="mr-1">-</span>
              {renderInlineBold(item)}
            </li>
          ))
        ) : (
          <li className="text-zinc-500">生成后显示</li>
        )}
      </ul>
    </div>
  );
}

function renderInlineBold(text: string) {
  const chunks = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <span>
      {chunks.map((chunk, idx) => {
        const boldMatch = chunk.match(/^\*\*([^*]+)\*\*$/);
        if (boldMatch) {
          return <strong key={`${chunk}-${idx}`}>{boldMatch[1]}</strong>;
        }
        return <span key={`${chunk}-${idx}`}>{chunk}</span>;
      })}
    </span>
  );
}

