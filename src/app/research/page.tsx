"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LoadingHint } from "@/components/LoadingHint";
import { PageGuide } from "@/components/PageGuide";
import { ModelSelect } from "@/components/ModelSelect";
import { toastFetch } from "@/lib/toast-utils";
import type { ModelType } from "@/lib/llm";
import { readModelSelection, writeModelSelection } from "@/lib/model-selection";
import ReactMarkdown from "react-markdown";

type ResearchResult = {
  snapshot: string[];
  cultureSignals: string[];
  interviewStylePrediction: string[];
  fitAssessment: string[];
  verdict: string;
  recommendedNextSteps: string[];
  sources: string[];
};

function renderVerdict(verdict?: string) {
  if (!verdict) return "-";
  const map: Record<string, string> = {
    "Strong Fit": "高度匹配（Strong Fit）",
    "Investable Stretch": "可投入冲刺（Investable Stretch）",
    "Long-Shot Stretch": "高难度冲刺（Long-Shot Stretch）",
    "Weak Fit": "匹配较弱（Weak Fit）",
  };
  return map[verdict] ?? verdict;
}

const STORAGE_KEY = "interview-os-research";
const RESEARCH_DRAFT_KEY = "interview-os-research-draft";

export default function ResearchPage() {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (pathname === "/research") {
      router.replace("/job-analysis?tab=research");
    }
  }, [pathname, router]);

  const [initialState] = useState(() => {
    if (typeof window === "undefined") {
      return { company: "OpenAI", depth: "standard" as "quick" | "standard" | "deep", result: null as ResearchResult | null };
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const draftRaw = window.localStorage.getItem(RESEARCH_DRAFT_KEY);
      const draft = draftRaw
        ? (JSON.parse(draftRaw) as { company?: string; depth?: "quick" | "standard" | "deep" })
        : null;
      if (!raw) {
        return {
          company: draft?.company || "OpenAI",
          depth: draft?.depth || ("standard" as "quick" | "standard" | "deep"),
          result: null as ResearchResult | null,
        };
      }
      const saved = JSON.parse(raw) as {
        company?: string;
        depth?: "quick" | "standard" | "deep";
        result?: ResearchResult;
      };
      return {
        company: draft?.company || saved.company || "OpenAI",
        depth: draft?.depth || saved.depth || "standard",
        result: saved.result ?? null,
      };
    } catch {
      return { company: "OpenAI", depth: "standard" as "quick" | "standard" | "deep", result: null as ResearchResult | null };
    }
  });
  const [company, setCompany] = useState(initialState.company);
  const [depth, setDepth] = useState<"quick" | "standard" | "deep">(initialState.depth);
  const [result, setResult] = useState<ResearchResult | null>(initialState.result);
  const [modelType, setModelType] = useState<ModelType>(() => readModelSelection("research", "pro"));
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      RESEARCH_DRAFT_KEY,
      JSON.stringify({
        company,
        depth,
        savedAt: new Date().toISOString(),
      }),
    );
  }, [company, depth]);
  const [loading, setLoading] = useState(false);
  const [savingToNotion, setSavingToNotion] = useState(false);
  const [status, setStatus] = useState("等待公司研究分析");
  const [deepReport, setDeepReport] = useState<string | null>(null);
  const [deepReportLoading, setDeepReportLoading] = useState(false);

  const loadDeepReport = async (companyName: string) => {
    setDeepReportLoading(true);
    try {
      const res = await fetch(`/api/notion?resource=job-research-report&company=${encodeURIComponent(companyName)}`);
      if (!res.ok) {
        setDeepReport(null);
        return;
      }
      const data = (await res.json()) as { report?: string | null };
      setDeepReport(data.report ?? null);
    } catch {
      setDeepReport(null);
    } finally {
      setDeepReportLoading(false);
    }
  };

  const onAnalyze = async () => {
    if (!company.trim()) {
      setStatus("请先填写公司名称。");
      return;
    }
    setLoading(true);
    setStatus("正在使用 Gemini 3.5 Flash 生成公司研究...");
    try {
      const response = await fetch("/api/research/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, depth, modelType }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = (await response.json()) as { result?: ResearchResult };
      if (!payload.result) {
        throw new Error("Missing result");
      }
      setResult(payload.result);
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ company, depth, result: payload.result, savedAt: new Date().toISOString() }),
      );
      setStatus("公司研究完成，已保存到本地。");

      // 同时加载深度背调报告
      loadDeepReport(company);
    } catch {
      setStatus("分析失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  };

  const clearDraft = () => {
    setCompany("");
    setDepth("standard");
    setResult(null);
    setDeepReport(null);
    setStatus("已清空公司研究草稿。");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(RESEARCH_DRAFT_KEY);
    }
  };

  return (
    <main className="flex w-full flex-col gap-4">
      <section className="neon-card rounded-2xl p-6">
        <h1 className="text-2xl font-semibold">公司研究</h1>
        <p className="mt-2 text-sm text-zinc-400">快速了解公司画像、匹配点和面试风格，为正式备面做输入。</p>
      </section>
      <PageGuide
        pageKey="research"
        items={[
          "先用快速扫描（quick）跑一遍，再用深度研究（deep）输出面试准备假设。",
          "研究结果可在面试备战页面作为「研究摘要」继续使用。",
          "重点关注「面试风格预判」，提前匹配你的表达风格
        ]}
      />
      <section className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        <div className="neon-card rounded-2xl p-4">
          <h2 className="mb-3 text-lg font-medium text-zinc-100">输入</h2>
          <div className="grid gap-2">
            <p className="text-xs text-zinc-500">公司名称</p>
            <input
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              placeholder="公司名称"
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            />
            <p className="text-xs text-zinc-500">研究深度</p>
            <select
              value={depth}
              onChange={(event) => setDepth(event.target.value as "quick" | "standard" | "deep")}
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            >
              <option value="quick">快速扫描</option>
              <option value="standard">标准研究（Standard）</option>
              <option value="deep">深度研究</option>
            </select>
            <ModelSelect
              value={modelType}
              onChange={setModelType}
              storageKey="research"
              recommended="pro"
              label="大模型"
              selectClassName="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={onAnalyze}
              disabled={loading}
              className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100 transition hover:bg-cyan-500/20 disabled:opacity-50"
            >
              {loading ? <span className="loading-dots">分析中</span> : "开始研究"}
            </button>
            <button
              type="button"
              onClick={clearDraft}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 transition hover:border-zinc-500"
            >
              清空草稿
            </button>
            <button
              type="button"
              onClick={() => {
                if (!result) return;
                setSavingToNotion(true);
                toastFetch(
                  "/api/notion",
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      resource: "interview",
                      action: "create",
                      title: `Research ${company} ${new Date().toISOString().slice(0, 10)}`,
                      company,
                      type: "Behavioral",
                      date: new Date().toISOString().slice(0, 10),
                      transcript: `Depth=${depth}\nSources:\n${result.sources.join("\n")}`,
                      aiAnalysis: JSON.stringify(result, null, 2),
                    }),
                  },
                  {
                    loading: "正在保存研究结果到 Notion...",
                    success: "✅ 研究结果已保存到 Notion",
                    error: (err) => `❌ Notion 保存失败：${err.message}`,
                  },
                  () => {
                    setStatus("研究结果已保存到 Notion。");
                  },
                );
                setSavingToNotion(false);
              }}
              disabled={!result || savingToNotion}
              className="rounded-lg border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-sm text-violet-100 transition hover:bg-violet-500/20 disabled:opacity-50"
            >
              {savingToNotion ? <span className="loading-dots">保存中</span> : "保存到 Notion"}
            </button>
          </div>
          <LoadingHint active={loading || savingToNotion} text={status} className="mt-2" />
        </div>
        <div className="grid gap-3">
          <div className="neon-card rounded-xl p-4">
            <h3 className="mb-2 text-sm font-semibold text-zinc-100">公司快照</h3>
            <ul className="space-y-1 text-sm text-zinc-300">
              {(result?.snapshot ?? []).map((item, idx) => (
                <li key={idx}>- {item}</li>
              ))}
            </ul>
          </div>
          <div className="neon-card rounded-xl p-4">
            <h3 className="mb-2 text-sm font-semibold text-zinc-100">文化信号</h3>
            <ul className="space-y-1 text-sm text-zinc-300">
              {(result?.cultureSignals ?? []).map((item, idx) => (
                <li key={idx}>- {item}</li>
              ))}
            </ul>
          </div>
          <div className="neon-card rounded-xl p-4">
            <h3 className="mb-2 text-sm font-semibold text-zinc-100">匹配评估</h3>
            <ul className="space-y-1 text-sm text-zinc-300">
              {(result?.fitAssessment ?? []).map((item, idx) => (
                <li key={idx}>- {item}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-cyan-300">结论：{renderVerdict(result?.verdict)}</p>
          </div>
          <div className="neon-card rounded-xl p-4">
            <h3 className="mb-2 text-sm font-semibold text-zinc-100">面试风格预判</h3>
            <ul className="space-y-1 text-sm text-zinc-300">
              {(result?.interviewStylePrediction ?? []).map((item, idx) => (
                <li key={idx}>- {item}</li>
              ))}
            </ul>
          </div>
          <div className="neon-card rounded-xl p-4">
            <h3 className="mb-2 text-sm font-semibold text-zinc-100">建议下一步</h3>
            <ul className="space-y-1 text-sm text-zinc-300">
              {(result?.recommendedNextSteps ?? []).map((item, idx) => (
                <li key={idx}>- {item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 📡 OpenClaw 深度情报卡片 */}
      <section className="neon-card rounded-2xl p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-lg">📡</span>
          <h2 className="text-lg font-semibold text-zinc-100">OpenClaw 深度情报</h2>
          {deepReportLoading && <span className="loading-dots text-sm text-cyan-400">加载中</span>}
        </div>
        {!result && !deepReport && !deepReportLoading && (
          <p className="text-sm text-zinc-500">输入公司名称并点击"开始研究"，将自动从 Notion JobMonitor 数据库加载深度背调报告。</p>
        )}
        {deepReportLoading && (
          <div className="animate-pulse space-y-2">
            <div className="h-4 w-3/4 rounded bg-zinc-800" />
            <div className="h-4 w-1/2 rounded bg-zinc-800" />
            <div className="h-4 w-5/6 rounded bg-zinc-800" />
          </div>
        )}
        {!deepReportLoading && deepReport === null && result && (
          <p className="text-sm text-zinc-500">未在 Notion JobMonitor 数据库中找到该公司的深度背调报告。</p>
        )}
        {deepReport && (
          <div className="prose prose-invert prose-sm max-w-none text-zinc-300">
            <ReactMarkdown
              components={{
                h1: ({ children }) => <h1 className="mb-3 mt-5 text-xl font-bold text-zinc-100">{children}</h1>,
                h2: ({ children }) => <h2 className="mb-2 mt-4 text-lg font-semibold text-zinc-100">{children}</h2>,
                h3: ({ children }) => <h3 className="mb-2 mt-3 text-base font-medium text-zinc-200">{children}</h3>,
                p: ({ children }) => <p className="mb-2 leading-relaxed text-zinc-300">{children}</p>,
                ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5">{children}</ul>,
                ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-5">{children}</ol>,
                li: ({ children }) => <li className="text-zinc-300">{children}</li>,
                blockquote: ({ children }) => (
                  <blockquote className="my-2 border-l-2 border-cyan-500/50 pl-4 italic text-zinc-400">{children}</blockquote>
                ),
                code: ({ children }) => (
                  <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-sm text-cyan-300">{children}</code>
                ),
                pre: ({ children }) => (
                  <pre className="my-3 overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm text-zinc-200">{children}</pre>
                ),
                hr: () => <hr className="my-4 border-zinc-700" />,
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline hover:text-cyan-300">
                    {children}
                  </a>
                ),
                strong: ({ children }) => <strong className="font-semibold text-zinc-100">{children}</strong>,
              }}
            >
              {deepReport}
            </ReactMarkdown>
          </div>
        )}
      </section>
    </main>
  );
}
