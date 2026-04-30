"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LoadingHint } from "@/components/LoadingHint";
import { PageGuide } from "@/components/PageGuide";
import { ScoreRadar } from "@/components/ScoreRadar";
import { MOCK_REPORT_SELECTED_KEY, PRACTICE_HISTORY_KEY } from "@/lib/practice";

type ReportScores = {
  Substance?: number;
  Structure?: number;
  Relevance?: number;
  Credibility?: number;
  Differentiation?: number;
};

type ReportResult = {
  coachScores?: ReportScores;
  interviewerRead?: string[];
  gaps?: string[];
  nextRoundAdjustment?: string;
  recommendedSelfScore?: number;
  calibrationLabel?: "over" | "under" | "accurate";
};

type ReportMessage = {
  id?: string;
  role?: string;
  content?: string;
};

type MockReportRow = {
  id?: string;
  stage?: number | string;
  stageKey?: string;
  mode?: string;
  type?: string;
  ts?: string;
  selfScore?: number;
  question?: string;
  answer?: string;
  result?: ReportResult;
  chatMessages?: ReportMessage[];
};

export default function EvaluatePage() {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (pathname === "/evaluate") {
      router.replace("/mock?tab=evaluate");
    }
  }, [pathname, router]);
  const [reports, setReports] = useState<MockReportRow[]>([]);
  const [selectedReportId, setSelectedReportId] = useState("");
  const [status, setStatus] = useState("请选择一个历史模拟场次。");
  const [analyzingReportId, setAnalyzingReportId] = useState("");

  const loadReports = useCallback(async () => {
    if (typeof window === "undefined") return;
    try {
      const response = await fetch("/api/notion?resource=mock-reports", { cache: "no-store" });
      const payload = (await response.json()) as { records?: MockReportRow[] };
      const remoteRows = Array.isArray(payload.records) ? payload.records : [];
      if (response.ok && remoteRows.length > 0) {
        setReports(remoteRows);
        const preferred = window.localStorage.getItem(MOCK_REPORT_SELECTED_KEY) ?? "";
        const fallback = (remoteRows[0]?.id as string | undefined) ?? "";
        setSelectedReportId((prev) => prev || preferred || fallback);
        return;
      }
      const raw = window.localStorage.getItem(PRACTICE_HISTORY_KEY);
      const localRows = raw ? (JSON.parse(raw) as MockReportRow[]) : [];
      setReports(Array.isArray(localRows) ? localRows : []);
      const preferred = window.localStorage.getItem(MOCK_REPORT_SELECTED_KEY) ?? "";
      const fallback = (localRows[0]?.id as string | undefined) ?? "";
      setSelectedReportId((prev) => prev || preferred || fallback);
    } catch {
      try {
        const raw = window.localStorage.getItem(PRACTICE_HISTORY_KEY);
        const rows = raw ? (JSON.parse(raw) as MockReportRow[]) : [];
        setReports(Array.isArray(rows) ? rows : []);
      } catch {
        setReports([]);
      }
    }
  }, []);

  useEffect(() => {
    void loadReports();
    const timer = window.setInterval(() => {
      void loadReports();
    }, 8000);
    return () => window.clearInterval(timer);
  }, [loadReports]);

  useEffect(() => {
    if (!selectedReportId || typeof window === "undefined") return;
    window.localStorage.setItem(MOCK_REPORT_SELECTED_KEY, selectedReportId);
  }, [selectedReportId]);

  const selectedReport = useMemo(
    () => reports.find((item) => item.id === selectedReportId) ?? reports[0] ?? null,
    [reports, selectedReportId],
  );

  const scoreMap = selectedReport?.result?.coachScores ?? {};
  const radarScores = [
    Number(scoreMap.Substance ?? 0),
    Number(scoreMap.Structure ?? 0),
    Number(scoreMap.Relevance ?? 0),
    Number(scoreMap.Credibility ?? 0),
    Number(scoreMap.Differentiation ?? 0),
  ];
  const avgScore = radarScores.length ? radarScores.reduce((a, b) => a + b, 0) / radarScores.length : 0;

  const chatRows = Array.isArray(selectedReport?.chatMessages) ? selectedReport.chatMessages : [];

  async function analyzeSingleReport(report: MockReportRow) {
    if (!report.question?.trim() || !report.answer?.trim()) {
      setStatus("当前记录缺少题目或回答，无法分析。");
      return;
    }
    setAnalyzingReportId(report.id ?? "");
    setStatus("正在分析该回答...");
    try {
      const res = await fetch("/api/practice/round", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: `stage-${report.stage ?? 1}`,
          question: report.question,
          answer: report.answer,
          selfScore: report.selfScore ?? 3,
        }),
      });
      const payload = (await res.json()) as { result?: ReportResult; error?: string };
      if (!res.ok || !payload.result) {
        throw new Error(payload.error ?? "分析失败");
      }
      const next = reports.map((item) => (item.id === report.id ? { ...item, result: payload.result } : item));
      setReports(next);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(PRACTICE_HISTORY_KEY, JSON.stringify(next.slice(0, 50)));
      }
      setStatus("已补全该题 AI 点评。");
    } catch {
      setStatus("分析失败，请稍后重试。");
    } finally {
      setAnalyzingReportId("");
    }
  }

  function formatSessionLabel(item: MockReportRow) {
    const dateText = item.ts ? new Date(item.ts).toISOString().slice(0, 10) : "未知日期";
    const scores = item.result?.coachScores;
    const avg = scores
      ? (
          (Number(scores.Substance ?? 0) +
            Number(scores.Structure ?? 0) +
            Number(scores.Relevance ?? 0) +
            Number(scores.Credibility ?? 0) +
            Number(scores.Differentiation ?? 0)) /
          5
        ).toFixed(1)
      : "-";
    const stageText = item.stageKey || item.stage || "-";
    const modeText = item.mode || item.type || "Mock";
    return `${dateText} · ${modeText} · ${stageText} · 综合 ${avg}`;
  }

  return (
    <main className="grid w-full gap-4 xl:grid-cols-[360px_1fr]">
      <section className="space-y-4">
        <PageGuide
          pageKey="evaluate"
          items={[
            "在左侧选择一场历史模拟面试。",
            "右侧自动展示该场综合五维评分与问答回顾。",
            "可对缺失点评的回答补做「分析此回答」。",
          ]}
        />
        <section className="neon-card rounded-2xl p-4">
          <p className="mb-1 text-xs text-zinc-500">历史模拟场次</p>
          <select
            value={selectedReport?.id ?? ""}
            onChange={(event) => setSelectedReportId(event.target.value)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
          >
            {reports.length === 0 ? <option value="">暂无历史场次，请先去模拟面试完成一轮。</option> : null}
            {reports.map((item) => (
              <option key={item.id ?? item.ts} value={item.id ?? ""}>
                {formatSessionLabel(item)}
              </option>
            ))}
          </select>
          <LoadingHint active={Boolean(analyzingReportId)} text={status} className="mt-2" />
        </section>
      </section>
      <section className="space-y-4">
        <section className="neon-card rounded-2xl p-4">
          <h2 className="text-lg font-medium text-zinc-100">全局五维表现</h2>
          <div className="mt-3">
            <ScoreRadar scores={radarScores} hasData={Boolean(selectedReport?.result?.coachScores)} />
          </div>
          <p className="mt-2 text-sm text-zinc-300">
            综合得分：<span className="text-cyan-200">{avgScore.toFixed(1)}</span>
            {" · "}
            自评：<span className="text-zinc-100">{selectedReport?.selfScore ?? "-"}</span>
            {" · "}
            校准：<span className="text-zinc-100">{selectedReport?.result?.calibrationLabel ?? "-"}</span>
          </p>
        </section>

        <section className="neon-card rounded-2xl p-4">
          <h2 className="text-lg font-medium text-zinc-100">逐题回顾（Q&A Transcript）</h2>
          {selectedReport ? (
            <div className="mt-3 space-y-3">
              {chatRows.length > 0 ? (
                <div className="space-y-2">
                  {chatRows.map((msg, idx) => {
                    const isUser = msg.role === "user";
                    return (
                      <div
                        key={msg.id ?? `${msg.role}-${idx}`}
                        className={`max-w-[90%] rounded-xl border px-3 py-2 text-sm ${
                          isUser
                            ? "ml-auto border-cyan-500/40 bg-cyan-500/10 text-cyan-100"
                            : "border-zinc-700 bg-zinc-900 text-zinc-200"
                        }`}
                      >
                        {msg.content}
                      </div>
                    );
                  })}
                </div>
              ) : null}
              <article className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                <p className="text-xs text-zinc-500">面试官问题</p>
                <p className="mt-1 text-sm text-zinc-100">{selectedReport.question || "（缺失）"}</p>
                <p className="mt-3 text-xs text-zinc-500">我的回答</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-300">{selectedReport.answer || "（缺失）"}</p>

                {selectedReport.result ? (
                  <div className="mt-3 rounded-lg border border-zinc-700 bg-zinc-900/60 p-3 text-xs text-zinc-300">
                    <p>
                      五维：S {scoreMap.Substance ?? "-"} / St {scoreMap.Structure ?? "-"} / R {scoreMap.Relevance ?? "-"} / C{" "}
                      {scoreMap.Credibility ?? "-"} / D {scoreMap.Differentiation ?? "-"}
                    </p>
                    {selectedReport.result?.interviewerRead?.length ? (
                      <p className="mt-1">面试官视角：{selectedReport.result.interviewerRead.join("；")}</p>
                    ) : null}
                    {selectedReport.result?.gaps?.length ? (
                      <p className="mt-1">短板：{selectedReport.result.gaps.join("；")}</p>
                    ) : null}
                    {selectedReport.result?.nextRoundAdjustment ? (
                      <p className="mt-1 text-cyan-200">改进建议：{selectedReport.result.nextRoundAdjustment}</p>
                    ) : null}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      void analyzeSingleReport(selectedReport);
                    }}
                    disabled={analyzingReportId === selectedReport.id}
                    className="mt-3 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100 disabled:opacity-50"
                  >
                    {analyzingReportId === selectedReport.id ? <span className="loading-dots">分析中</span> : "分析此回答"}
                  </button>
                )}
              </article>
            </div>
          ) : (
            <p className="mt-3 text-sm text-zinc-500">暂无可展示的历史场次。先在「模拟面试」完成一轮并提交。</p>
          )}
        </section>
      </section>
    </main>
  );
}
