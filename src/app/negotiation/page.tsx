"use client";

import { useEffect, useMemo, useState } from "react";
import ChatPanel from "@/components/ChatPanel";
import { PageGuide } from "@/components/PageGuide";
import { ModelSelect } from "@/components/ModelSelect";
import type { ModelType } from "@/lib/llm";
import { readModelSelection, writeModelSelection } from "@/lib/model-selection";

type NegotiationResult = {
  market_range: string;
  strategy: string[];
  scripts: {
    email: string;
    phone: string;
    meeting: string;
  };
  non_salary_points: string[];
};
const NEGOTIATION_HISTORY_KEY = "interview-os-negotiation-history";
const NEGOTIATION_DRAFT_KEY = "interview-os-negotiation-draft";

export default function NegotiationPage() {
  const [initialForm] = useState(() => {
    if (typeof window === "undefined") {
      return { role: "", currentSalary: "", offerSalary: "", competingOffers: "", location: "" };
    }
    try {
      const raw = window.localStorage.getItem(NEGOTIATION_DRAFT_KEY);
      if (!raw) return { role: "", currentSalary: "", offerSalary: "", competingOffers: "", location: "" };
      const parsed = JSON.parse(raw) as Partial<{
        role: string;
        currentSalary: string;
        offerSalary: string;
        competingOffers: string;
        location: string;
      }>;
      return {
        role: parsed.role ?? "",
        currentSalary: parsed.currentSalary ?? "",
        offerSalary: parsed.offerSalary ?? "",
        competingOffers: parsed.competingOffers ?? "",
        location: parsed.location ?? "",
      };
    } catch {
      return { role: "", currentSalary: "", offerSalary: "", competingOffers: "", location: "" };
    }
  });
  const [form, setForm] = useState(initialForm);
  const [result, setResult] = useState<NegotiationResult | null>(null);
  const [modelType, setModelType] = useState<ModelType>(() => readModelSelection("negotiation", "practice"));
  useEffect(() => {
    writeModelSelection("negotiation", modelType);
  }, [modelType]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      NEGOTIATION_DRAFT_KEY,
      JSON.stringify({
        ...form,
        savedAt: new Date().toISOString(),
      }),
    );
  }, [form]);
  const [status, setStatus] = useState("等待谈判分析");
  const [loading, setLoading] = useState(false);
  const [ttsMuted, setTtsMuted] = useState(false);

  const negotiationPrompt = useMemo(
    () => `
You are an HR in a compensation negotiation call.
Role: ${form.role || "AI Product Manager"}
Candidate current salary: ${form.currentSalary || "unknown"}
Candidate offer: ${form.offerSalary || "unknown"}
Competing offers: ${form.competingOffers || "none"}
Location: ${form.location || "unknown"}
Act as realistic HR and challenge the candidate with pressure.
Output strict JSON only:
{
  "spoken_text": "你要对候选人说的话（压价/追问）",
  "inner_thoughts": "HR 内部策略与评估"
}
`.trim(),
    [form],
  );

  const onAnalyze = async () => {
    if (!form.role.trim() || !form.offerSalary.trim() || !form.location.trim()) {
      setStatus("请至少填写目标岗位、offer 金额和地点。");
      return;
    }
    setLoading(true);
    setStatus("正在使用 DeepSeek V4-Pro 生成谈判策略...");
    try {
      const response = await fetch("/api/negotiation/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, modelType }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = (await response.json()) as { result?: NegotiationResult };
      if (!payload.result) {
        throw new Error("Missing result");
      }
      setResult(payload.result);
      try {
        const prev = JSON.parse(window.localStorage.getItem(NEGOTIATION_HISTORY_KEY) || "[]") as Array<{
          role?: string;
          ts?: string;
        }>;
        const next = [
          { role: form.role, ts: new Date().toISOString() },
          ...prev,
        ].slice(0, 100);
        window.localStorage.setItem(NEGOTIATION_HISTORY_KEY, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      setStatus("谈判分析已生成。");
    } catch {
      setStatus("生成失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  };

  const clearDraft = () => {
    setForm({
      role: "",
      currentSalary: "",
      offerSalary: "",
      competingOffers: "",
      location: "",
    });
    setResult(null);
    setStatus("已清空薪资谈判草稿。");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(NEGOTIATION_DRAFT_KEY);
    }
  };

  return (
    <main className="flex w-full flex-col gap-4">
      <section className="neon-card rounded-2xl p-6">
        <h1 className="text-2xl font-semibold">薪资谈判</h1>
        <p className="mt-2 text-sm text-zinc-400">
          面试后阶段的关键动作：判断区间、制定策略、准备话术，并通过模拟谈判演练应对。
        </p>
      </section>
      <PageGuide
        pageKey="negotiation"
        items={[
          "先填 offer 与地点，生成市场区间和策略建议。",
          "优先明确你的目标区间与可接受底线，再进入沟通。",
          "除了 base salary，也要同步争取 RSU、签字费、title、远程与假期。",
        ]}
      />
      <section className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        <div className="neon-card rounded-2xl p-4">
          <h2 className="mb-3 text-lg font-medium text-zinc-100">输入信息</h2>
          <div className="grid gap-2">
            <p className="text-xs text-zinc-500">目标岗位</p>
            <input
              value={form.role}
              onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}
              placeholder="目标岗位"
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            />
            <p className="text-xs text-zinc-500">当前薪资</p>
            <input
              value={form.currentSalary}
              onChange={(event) => setForm((prev) => ({ ...prev, currentSalary: event.target.value }))}
              placeholder="当前薪资"
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            />
            <p className="text-xs text-zinc-500">拿到的 offer 金额</p>
            <input
              value={form.offerSalary}
              onChange={(event) => setForm((prev) => ({ ...prev, offerSalary: event.target.value }))}
              placeholder="拿到的 offer 金额"
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            />
            <p className="text-xs text-zinc-500">其他 offer（Competing Offers）</p>
            <input
              value={form.competingOffers}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, competingOffers: event.target.value }))
              }
              placeholder="其他 offer（Competing Offers，如有）"
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            />
            <p className="text-xs text-zinc-500">地点</p>
            <input
              value={form.location}
              onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
              placeholder="地点"
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            />
            <ModelSelect
              value={modelType}
              onChange={setModelType}
              storageKey="negotiation"
              recommended="practice"
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
              {loading ? "分析中..." : "生成谈判策略"}
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
        </div>

        {result ? (
          <div className="grid gap-3">
            <div className="neon-card rounded-xl p-4">
              <h3 className="mb-2 text-sm font-semibold text-zinc-100">市场薪资参考范围</h3>
              <p className="text-sm text-zinc-300">{result.market_range}</p>
            </div>
            <div className="neon-card rounded-xl p-4">
              <h3 className="mb-2 text-sm font-semibold text-zinc-100">谈判策略建议</h3>
              <ul className="space-y-1 text-sm text-zinc-300">
                {result.strategy.map((item, idx) => (
                  <li key={idx}>- {item}</li>
                ))}
              </ul>
            </div>
            <div className="neon-card rounded-xl p-4">
              <h3 className="mb-2 text-sm font-semibold text-zinc-100">谈判话术模板（邮件）</h3>
              <p className="whitespace-pre-wrap text-sm text-zinc-300">{result.scripts.email}</p>
            </div>
            <div className="neon-card rounded-xl p-4">
              <h3 className="mb-2 text-sm font-semibold text-zinc-100">谈判话术模板（电话）</h3>
              <p className="whitespace-pre-wrap text-sm text-zinc-300">{result.scripts.phone}</p>
            </div>
            <div className="neon-card rounded-xl p-4">
              <h3 className="mb-2 text-sm font-semibold text-zinc-100">谈判话术模板（面谈）</h3>
              <p className="whitespace-pre-wrap text-sm text-zinc-300">{result.scripts.meeting}</p>
            </div>
            <div className="neon-card rounded-xl p-4">
              <h3 className="mb-2 text-sm font-semibold text-zinc-100">非薪资谈判点</h3>
              <ul className="space-y-1 text-sm text-zinc-300">
                {result.non_salary_points.map((item, idx) => (
                  <li key={idx}>- {item}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="neon-card rounded-xl p-4">
            <p className="mb-3 text-sm text-zinc-400">等待生成谈判分析...</p>
            <div className="space-y-3 animate-pulse">
              <div className="h-16 rounded-lg bg-zinc-800/70" />
              <div className="h-24 rounded-lg bg-zinc-800/70" />
              <div className="h-20 rounded-lg bg-zinc-800/70" />
              <div className="h-20 rounded-lg bg-zinc-800/70" />
            </div>
          </div>
        )}
      </section>
      <section className="neon-card rounded-2xl p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-medium text-zinc-100">模拟谈判对话（AI 扮演 HR）</h2>
          <label className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-300">
            <input type="checkbox" checked={!ttsMuted} onChange={(e) => setTtsMuted(!e.target.checked)} />
            🔊 HR 自动语音播报
          </label>
        </div>
        <p className="mb-3 text-xs text-amber-300">训练规则：当前模式强制语音回击。请点击麦克风录音作答。</p>
        <ChatPanel
          systemPrompt={negotiationPrompt}
          modelType="mock"
          recommendedModel="mock"
          modelStorageKey="negotiation-chat"
          apiEndpoint="/api/mock/chat"
          requestBody={{ mockFormat: "Compensation Negotiation" }}
          assistantName="HR"
          renderInterviewerJson
          autoPlayTts
          ttsMuted={ttsMuted}
          disableTextInput
          voiceAutoSend
          emptyStateText="HR 已入场。请使用语音回答，例如：我理解预算约束，但希望基于我的业务影响讨论总包结构。"
        />
      </section>
    </main>
  );
}
