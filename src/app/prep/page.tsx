"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { LoadingHint } from "@/components/LoadingHint";
import { PageGuide } from "@/components/PageGuide";
import { ModelSelect } from "@/components/ModelSelect";
import { UpcomingInterviewFocus } from "@/components/UpcomingInterviewFocus";
import { toastFetch } from "@/lib/toast-utils";
import { getUpcomingInterview, readInterviewSchedule } from "@/lib/interview-schedule";
import type { ModelType } from "@/lib/llm";
import { readModelSelection, writeModelSelection } from "@/lib/model-selection";

type PrepResult = {
  interviewFormatGuide: string[];
  cultureJudgement: string[];
  interviewerIntel: string[];
  bestPositioningStrategy: string[];
  concernsAndCounters: string[];
  predictedQuestions: string[];
  storyMapping: string[];
  reverseQuestions: string[];
  dayOfChecklist: string[];
  selfIntroScript?: string;
};
type PrepResultTab = "strategy" | "qa" | "pitch";
type ResumeBaseRecord = {
  id: string;
  title: string;
  version: string;
  optimizedText: string;
  createdAt: string;
  isActive?: boolean;
};
type PositioningSessionRecord = {
  id: string;
  entityId?: string;
  messageJson?: string;
  createdDate?: string;
};

const RESEARCH_STORAGE_KEY = "interview-os-research";
const PREP_STORAGE_KEY = "interview-os-prep";
const PREP_DRAFT_KEY = "interview-os-prep-draft";

function fingerprintPrepResult(result: PrepResult | null) {
  if (!result) return "";
  return JSON.stringify({
    interviewFormatGuide: result.interviewFormatGuide ?? [],
    cultureJudgement: result.cultureJudgement ?? [],
    interviewerIntel: result.interviewerIntel ?? [],
    bestPositioningStrategy: result.bestPositioningStrategy ?? [],
    concernsAndCounters: result.concernsAndCounters ?? [],
    predictedQuestions: result.predictedQuestions ?? [],
    storyMapping: result.storyMapping ?? [],
    reverseQuestions: result.reverseQuestions ?? [],
    dayOfChecklist: result.dayOfChecklist ?? [],
    selfIntroScript: result.selfIntroScript ?? "",
  });
}

export default function PrepPage() {
  const lastSyncedBaseIdRef = useRef("");
  const [hydrated, setHydrated] = useState(false);
  const parseTitleToCompanyRole = (title: string) => {
    const raw = String(title || "")
      .replace(/^\d+\s*[\.、]\s*/, "")
      .trim();
    if (!raw) return { company: "", role: "" };
    const separators = [" - ", "—", "-", "｜", "|"];
    for (const sep of separators) {
      const parts = raw.split(sep).map((item) => item.trim()).filter(Boolean);
      if (parts.length >= 2) {
        return { company: parts[0], role: parts[1] };
      }
    }
    return { company: "", role: "" };
  };
  const initialState = { company: "", jdText: "", role: "", researchSummary: "", result: null as PrepResult | null };
  const [upcoming] = useState(() => {
    if (typeof window === "undefined") return null;
    return getUpcomingInterview(readInterviewSchedule());
  });
  const [scheduleChoice, setScheduleChoice] = useState<"pending" | "applied" | "new">("pending");
  const [company, setCompany] = useState(initialState.company);
  const [jdText, setJdText] = useState(initialState.jdText);
  const [researchSummary, setResearchSummary] = useState(initialState.researchSummary);
  const [role, setRole] = useState(initialState.role || "AI 产品经理（AI Product Manager）");
  const [interviewerInfo, setInterviewerInfo] = useState("");
  const [jdRecords, setJdRecords] = useState<Array<{ id: string; title: string; jdText: string; company?: string; role?: string }>>([]);
  const [selectedJdId, setSelectedJdId] = useState("");
  const [loadingJdRecords, setLoadingJdRecords] = useState(false);
  const [jdLoadError, setJdLoadError] = useState("");
  const [resumeBases, setResumeBases] = useState<ResumeBaseRecord[]>([]);
  const [selectedBaseId, setSelectedBaseId] = useState("");
  const [resumeContext, setResumeContext] = useState("");
  const [elevatorPitch, setElevatorPitch] = useState("");
  const [loadingResumeBases, setLoadingResumeBases] = useState(false);
  const [result, setResult] = useState<PrepResult | null>(initialState.result);
  const [activeResultTab, setActiveResultTab] = useState<PrepResultTab>("strategy");
  const [modelType, setModelType] = useState<ModelType>(() => readModelSelection("prep", "practice"));
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      PREP_DRAFT_KEY,
      JSON.stringify({
        company,
        jdText,
        role,
        researchSummary,
        interviewerInfo,
        selectedJdId,
        selectedBaseId,
        resumeContext,
        savedAt: new Date().toISOString(),
      }),
    );
  }, [company, jdText, role, researchSummary, interviewerInfo, selectedJdId, selectedBaseId, resumeContext]);
  const [loading, setLoading] = useState(false);
  const [savingToNotion, setSavingToNotion] = useState(false);
  const [generatingSelfIntro, setGeneratingSelfIntro] = useState(false);
  const [status, setStatus] = useState("等待生成面试备战简报");
  const [syncingQuestionBank, setSyncingQuestionBank] = useState(false);
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);
  const [retrievedStoryContext, setRetrievedStoryContext] = useState<string[]>([]);
  const [retrievedKnowledgeContext, setRetrievedKnowledgeContext] = useState<string[]>([]);
  const [contextWarnings, setContextWarnings] = useState<string[]>([]);
  const [lastSavedFingerprint, setLastSavedFingerprint] = useState("");
  useEffect(() => {
    if (typeof window === "undefined") {
      setHydrated(true);
      return;
    }
    try {
      const researchRaw = window.localStorage.getItem(RESEARCH_STORAGE_KEY);
      if (researchRaw) {
        const research = JSON.parse(researchRaw) as { company?: string; result?: { snapshot?: string[] } };
        setCompany((prev) => prev || research.company || "");
        if (research.result?.snapshot?.length) {
          setResearchSummary((prev) => prev || research.result!.snapshot!.join("\n"));
        }
      }

      const prepRaw = window.localStorage.getItem(PREP_STORAGE_KEY);
      if (prepRaw) {
        const prep = JSON.parse(prepRaw) as {
          company?: string;
          jdText?: string;
          researchSummary?: string;
          result?: PrepResult;
        };
        setCompany((prev) => prev || prep.company || "");
        setJdText((prev) => prev || prep.jdText || "");
        setResearchSummary((prev) => prev || prep.researchSummary || "");
        setResult((prev) => prev ?? prep.result ?? null);
        if (prep.result) {
          setLastSavedFingerprint(fingerprintPrepResult(prep.result));
        }
      }

      const draftRaw = window.localStorage.getItem(PREP_DRAFT_KEY);
      if (draftRaw) {
        const draft = JSON.parse(draftRaw) as {
          company?: string;
          jdText?: string;
          role?: string;
          researchSummary?: string;
          interviewerInfo?: string;
          selectedJdId?: string;
          selectedBaseId?: string;
          resumeContext?: string;
        };
        setCompany((prev) => prev || draft.company || "");
        setJdText((prev) => prev || draft.jdText || "");
        setRole((prev) => (prev && prev !== "AI 产品经理（AI Product Manager）" ? prev : draft.role || prev));
        setResearchSummary((prev) => prev || draft.researchSummary || "");
        setInterviewerInfo(draft.interviewerInfo ?? "");
        setSelectedJdId(draft.selectedJdId ?? "");
        setSelectedBaseId(draft.selectedBaseId ?? "");
        setResumeContext(draft.resumeContext ?? "");
      }
    } catch {
      // Ignore corrupted local storage data.
    } finally {
      setModelType(readModelSelection("prep", "practice"));
      setHydrated(true);
    }
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    const loadElevatorPitch = async () => {
      try {
        const response = await fetch("/api/notion?resource=coaching-session&module=positioning&limit=10", {
          cache: "no-store",
        });
        if (!response.ok) return;
        const payload = (await response.json()) as { records?: PositioningSessionRecord[] };
        const records = Array.isArray(payload.records) ? payload.records : [];
        const sorted = [...records].sort((a, b) => {
          const aTs = new Date(a.createdDate ?? "").getTime() || 0;
          const bTs = new Date(b.createdDate ?? "").getTime() || 0;
          return bTs - aTs;
        });
        const prioritized = selectedBaseId
          ? [...sorted].sort((a, b) => {
              const aScore = a.entityId === selectedBaseId ? 1 : 0;
              const bScore = b.entityId === selectedBaseId ? 1 : 0;
              return bScore - aScore;
            })
          : sorted;
        const picked = prioritized.find((record) => {
          try {
            const data = JSON.parse(record.messageJson ?? "") as {
              elevator_pitch_zh?: string;
              elevator_pitch_en?: string;
            };
            const pitch = String(data.elevator_pitch_zh || data.elevator_pitch_en || "").trim();
            if (pitch) {
              setElevatorPitch(pitch);
              return true;
            }
            return false;
          } catch {
            return false;
          }
        });
        if (!picked) {
          setElevatorPitch("");
        }
      } catch {
        setElevatorPitch("");
      }
    };
    void loadElevatorPitch();
  }, [hydrated, selectedBaseId]);
  const loadingSteps = [
    "正在匹配 JD 关键信号...",
    "正在检索故事库映射...",
    "正在整理公司研究与面试官线索...",
    "正在预测问题并生成备战简报...",
  ];

  const canGenerate = useMemo(() => company.trim().length > 0 && jdText.trim().length > 0, [company, jdText]);
  const currentFingerprint = useMemo(() => fingerprintPrepResult(result), [result]);
  const canSaveToNotion = Boolean(result && selectedJdId && currentFingerprint !== lastSavedFingerprint);

  const requestPrepGeneration = async () => {
    let storyContext: string[] = [];
    let knowledgeContext: string[] = [];
    setLoadingStepIndex(1);
    setStatus("正在检索故事库映射...");
    const contextResponse = await fetch("/api/prep/context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const contextPayload = (await contextResponse.json()) as {
      storyContext?: string[];
      knowledgeContext?: string[];
      warnings?: string[];
      error?: string;
      detail?: string;
    };
    if (!contextResponse.ok) {
      throw new Error(contextPayload.error || contextPayload.detail || `HTTP ${contextResponse.status}`);
    }
    storyContext = Array.isArray(contextPayload.storyContext) ? contextPayload.storyContext : [];
    knowledgeContext = Array.isArray(contextPayload.knowledgeContext) ? contextPayload.knowledgeContext : [];
    setContextWarnings(Array.isArray(contextPayload.warnings) ? contextPayload.warnings : []);
    setRetrievedStoryContext(storyContext);
    setRetrievedKnowledgeContext(knowledgeContext);

    setLoadingStepIndex(2);
    setStatus("正在整理公司研究与面试官线索...");
    setLoadingStepIndex(3);
    setStatus("正在使用 DeepSeek V4-Pro 生成备战简报...");
    const response = await fetch("/api/prep/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company,
        role,
        jdText,
        researchSummary,
        interviewerInfo,
        resumeContext,
        elevatorPitch,
        storyContext,
        knowledgeContext,
        modelType,
      }),
    });
    const payload = (await response.json()) as { result?: PrepResult; error?: string; detail?: string };
    if (!response.ok) {
      throw new Error(payload.error || payload.detail || `HTTP ${response.status}`);
    }
    if (!payload.result) {
      throw new Error("Missing result");
    }
    return payload.result;
  };

  const onGeneratePrepBrief = async () => {
    if (!canGenerate) {
      setStatus("请先填写公司与 JD 文本。");
      return;
    }
    setLoading(true);
    setLoadingStepIndex(0);
    setRetrievedStoryContext([]);
    setRetrievedKnowledgeContext([]);
    setContextWarnings([]);
    setStatus("正在匹配 JD 关键信号...");
    let hasDetailedError = false;
    try {
      try {
        const generated = await requestPrepGeneration();
        setResult((prev) => ({
          interviewFormatGuide: generated.interviewFormatGuide ?? [],
          cultureJudgement: generated.cultureJudgement ?? [],
          interviewerIntel: generated.interviewerIntel ?? [],
          bestPositioningStrategy: generated.bestPositioningStrategy ?? [],
          concernsAndCounters: generated.concernsAndCounters ?? [],
          predictedQuestions: generated.predictedQuestions ?? [],
          storyMapping: generated.storyMapping ?? [],
          reverseQuestions: generated.reverseQuestions ?? [],
          dayOfChecklist: generated.dayOfChecklist ?? [],
          selfIntroScript: prev?.selfIntroScript ?? generated.selfIntroScript ?? "",
        }));
        setActiveResultTab("strategy");
        window.localStorage.setItem(
          PREP_STORAGE_KEY,
          JSON.stringify({
            company,
            jdText,
            researchSummary,
            result: {
              interviewFormatGuide: generated.interviewFormatGuide ?? [],
              cultureJudgement: generated.cultureJudgement ?? [],
              interviewerIntel: generated.interviewerIntel ?? [],
              bestPositioningStrategy: generated.bestPositioningStrategy ?? [],
              concernsAndCounters: generated.concernsAndCounters ?? [],
              predictedQuestions: generated.predictedQuestions ?? [],
              storyMapping: generated.storyMapping ?? [],
              reverseQuestions: generated.reverseQuestions ?? [],
              dayOfChecklist: generated.dayOfChecklist ?? [],
              selfIntroScript: result?.selfIntroScript ?? generated.selfIntroScript ?? "",
            },
            savedAt: new Date().toISOString(),
          }),
        );
        setStatus("备战简报（策略 + 题库）生成完成。");
      } catch (error) {
        hasDetailedError = true;
        setStatus(`生成失败：${error instanceof Error ? error.message : "unknown"}`);
        throw error;
      }
    } catch {
      if (!hasDetailedError) {
        setStatus("生成失败，请稍后重试。");
      }
    } finally {
      setLoading(false);
      setLoadingStepIndex(0);
    }
  };

  const onGenerateSelfIntro = async () => {
    if (!canGenerate) {
      setStatus("请先填写公司与 JD 文本。");
      return;
    }
    setGeneratingSelfIntro(true);
    setLoadingStepIndex(0);
    setRetrievedStoryContext([]);
    setRetrievedKnowledgeContext([]);
    setContextWarnings([]);
    setStatus("正在生成定制化自我介绍逐字稿...");
    try {
      const generated = await requestPrepGeneration();
      const nextScript = generated.selfIntroScript?.trim() || "";
      setResult((prev) => ({
        interviewFormatGuide: prev?.interviewFormatGuide ?? [],
        cultureJudgement: prev?.cultureJudgement ?? [],
        interviewerIntel: prev?.interviewerIntel ?? [],
        bestPositioningStrategy: prev?.bestPositioningStrategy ?? [],
        concernsAndCounters: prev?.concernsAndCounters ?? [],
        predictedQuestions: prev?.predictedQuestions ?? [],
        storyMapping: prev?.storyMapping ?? [],
        reverseQuestions: prev?.reverseQuestions ?? [],
        dayOfChecklist: prev?.dayOfChecklist ?? [],
        selfIntroScript: nextScript,
      }));
      setActiveResultTab("pitch");
      setStatus("定制化自我介绍逐字稿已生成。");
    } catch (error) {
      setStatus(`生成自我介绍失败：${error instanceof Error ? error.message : "unknown"}`);
    } finally {
      setGeneratingSelfIntro(false);
      setLoadingStepIndex(0);
    }
  };

  const onLoadJDRecords = async (options?: { silent?: boolean }) => {
    setLoadingJdRecords(true);
    setJdLoadError("");
    try {
      const response = await fetch("/api/notion?resource=jd", { cache: "no-store" });
      if (!response.ok) throw new Error("load failed");
      const payload = (await response.json()) as {
        records?: Array<{ id: string; title: string; jdText: string; company?: string; role?: string }>;
      };
      setJdRecords(payload.records ?? []);
      if (!options?.silent) {
        setStatus(`已加载 ${payload.records?.length ?? 0} 条 JD Records。`);
      }
    } catch {
      if (!options?.silent) {
        setStatus("加载 JD Records 失败。");
      }
      setJdLoadError("JD 列表加载失败，请重试。");
    } finally {
      setLoadingJdRecords(false);
    }
  };

  const onLoadResumeBases = async (options?: { silent?: boolean }) => {
    setLoadingResumeBases(true);
    try {
      const response = await fetch("/api/notion?resource=resume-bases", { cache: "no-store" });
      const payload = (await response.json()) as { records?: ResumeBaseRecord[] };
      if (!response.ok) throw new Error("load failed");
      const rows = payload.records ?? [];
      setResumeBases(rows);
      const activeBaseId = rows.find((item) => item.isActive)?.id ?? "";
      if (activeBaseId) {
        setSelectedBaseId((prev) => prev || activeBaseId);
      }
      if (!options?.silent) {
        setStatus(`已加载 ${payload.records?.length ?? 0} 条底本记录。`);
      }
    } catch {
      if (!options?.silent) {
        setStatus("加载底本记录失败。");
      }
    } finally {
      setLoadingResumeBases(false);
    }
  };

  useEffect(() => {
    if (!hydrated) return;
    void Promise.all([onLoadJDRecords({ silent: true }), onLoadResumeBases({ silent: true })]);
  }, [hydrated]);

  useEffect(() => {
    if (!selectedBaseId) {
      lastSyncedBaseIdRef.current = "";
      return;
    }
    const selected = resumeBases.find((item) => item.id === selectedBaseId);
    if (!selected) return;
    if (lastSyncedBaseIdRef.current === selectedBaseId && resumeContext.trim() === (selected.optimizedText || "").trim()) {
      return;
    }
    const text = (selected.optimizedText || "").trim();
    setResumeContext(text);
    lastSyncedBaseIdRef.current = selectedBaseId;
  }, [selectedBaseId, resumeBases]);

  const onPushPredictedQuestions = async () => {
    if (!result?.predictedQuestions?.length) {
      setStatus("暂无可入库的预测问题。");
      return;
    }
    setSyncingQuestionBank(true);
    try {
      const questions = result.predictedQuestions.map((item) => item.trim()).filter(Boolean).slice(0, 20);
      await Promise.all(
        questions.map(async (question) => {
          await fetch("/api/question-bank", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "create",
              item: {
                title: question,
                category: "个人特质",
                source: "AI生成",
                company: company.trim(),
                role: role.trim(),
                round: "",
                difficulty: "中等",
                myAnswer: "",
                aiFeedback: "来源：Prep 预测问题",
                bestStory: "",
                tags: [],
                practiceCount: 0,
                lastScore: 0,
                lastPracticed: "",
                status: "未练习",
              },
            }),
          });
        }),
      );
      setStatus(`已将 ${questions.length} 道预测问题写入面试题库。`);
    } catch {
      setStatus("写入面试题库失败，请检查 QuestionBank 配置。");
    } finally {
      setSyncingQuestionBank(false);
    }
  };

  const onSaveToNotion = async () => {
    if (!result) return;
    if (!selectedJdId) {
      setStatus("请先选择一条已保存 JD 记录，再保存到 Notion。");
      return;
    }
    setSavingToNotion(true);
    const saveDate = new Date().toISOString().slice(0, 10);
    toastFetch(
      "/api/notion",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resource: "interview",
          action: "create",
          title: `[备战简报] ${company || "未知公司"} - ${role || "未知岗位"} ${saveDate}`,
          company,
          role,
          type: "Behavioral",
          date: saveDate,
          jdId: selectedJdId,
          prepReport: result,
        }),
      },
      {
        loading: "正在保存备战简报到 Notion...",
        success: "✅ Prep 简报已保存到 Notion（正文 Blocks）",
        error: (err) => `❌ Notion 保存失败：${err.message}`,
      },
      () => {
        setLastSavedFingerprint(fingerprintPrepResult(result));
        setStatus("Prep 简报已保存到 Notion（正文 Blocks）。");
      },
    );
    setSavingToNotion(false);
  };

  const clearDraft = () => {
    setCompany("");
    setJdText("");
    setRole("AI 产品经理（AI Product Manager）");
    setResearchSummary("");
    setInterviewerInfo("");
    setResult(null);
    setLastSavedFingerprint("");
    setStatus("已清空 Prep 草稿。");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(PREP_DRAFT_KEY);
    }
  };

  if (!hydrated) {
    return (
      <main className="flex w-full flex-col gap-4">
        <section className="neon-card rounded-2xl p-6">
          <h1 className="text-2xl font-semibold">面试备战（Prep）</h1>
          <p className="mt-2 text-sm text-zinc-400">正在加载页面状态...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="flex w-full flex-col gap-4">
      <section className="neon-card rounded-2xl p-6">
        <h1 className="text-2xl font-semibold">面试备战（Prep）</h1>
        <p className="mt-2 text-sm text-zinc-400">把 JD + 公司研究 + 你的故事库合并成一份可执行备面简报。</p>
      </section>
      <PageGuide
        pageKey="prep"
        items={[
          "输入尽量完整的 JD，预测问题会更准确。",
          "研究摘要可以先来自公司研究页面结果。",
          "生成后优先练“预测问题 + 顾虑反制”组合。",
        ]}
      />
      <UpcomingInterviewFocus />
      {upcoming && scheduleChoice === "pending" ? (
        <section className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-sm">
          <p className="text-cyan-100">
            检测到最近面试：{upcoming.company} · {upcoming.role}。是否自动填入为本次备战输入？
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              onClick={() => {
                setCompany((prev) => prev || upcoming.company);
                setRole((prev) => prev || upcoming.role);
                setJdText((prev) => prev || (upcoming.jdSummary ?? ""));
                setScheduleChoice("applied");
                setStatus(`已填入最近面试信息：${upcoming.company} · ${upcoming.role}`);
              }}
              className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-cyan-100"
            >
              填入最近面试信息
            </button>
            <button
              type="button"
              onClick={() => {
                setScheduleChoice("new");
                setStatus("已选择新建输入。");
              }}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1 text-zinc-200"
            >
              使用新信息
            </button>
          </div>
        </section>
      ) : null}
      <section className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        <div className="neon-card rounded-2xl p-4">
          <h2 className="mb-3 text-lg font-medium text-zinc-100">输入</h2>
          <div className="grid gap-2">
            <p className="text-xs text-zinc-500">已保存 JD 记录</p>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <select
                value={selectedJdId}
                onChange={(event) => {
                  const nextJdId = event.target.value;
                  setSelectedJdId(nextJdId);
                  const selected = jdRecords.find((item) => item.id === nextJdId);
                  if (!selected) return;
                  const titleParsed = parseTitleToCompanyRole(selected.title);
                  setCompany(selected.company || titleParsed.company || "");
                  setRole(selected.role || titleParsed.role || "AI 产品经理（AI Product Manager）");
                  setJdText(selected.jdText || "");
                  setStatus(`已从 JD 记录填充：${selected.title}`);
                }}
                className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
              >
                <option value="" disabled>
                  选择已保存 JD（可选）
                </option>
                {jdRecords.map((record) => (
                  <option key={record.id} value={record.id}>
                    {record.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  void onLoadJDRecords();
                }}
                disabled={loadingJdRecords}
                className="h-[42px] min-w-[92px] whitespace-nowrap rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-300 transition hover:border-zinc-500 disabled:opacity-50"
              >
                {loadingJdRecords ? "加载中..." : "加载JD列表"}
              </button>
            </div>
            {jdLoadError ? <p className="text-xs text-rose-300">{jdLoadError}</p> : null}
            <p className="text-xs text-zinc-500">公司名称</p>
            <input
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              placeholder="公司名称"
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            />
            <p className="text-xs text-zinc-500">岗位名称</p>
            <input
              value={role}
              onChange={(event) => setRole(event.target.value)}
              placeholder="岗位名称（如 AI 产品经理 / AI Product Manager）"
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            />
            <ModelSelect
              value={modelType}
              onChange={setModelType}
              storageKey="prep"
              recommended="practice"
              label="大模型"
              selectClassName="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            />
            <p className="text-xs text-zinc-500">个人底本 / 故事上下文（可选但推荐）</p>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <select
                value={selectedBaseId}
                onChange={(event) => {
                  const baseId = event.target.value;
                  setSelectedBaseId(baseId);
                  const selected = resumeBases.find((item) => item.id === baseId);
                  const text = selected?.optimizedText?.trim() || "";
                  setResumeContext(text);
                  if (selected) {
                    setStatus(`已导入底本上下文：${selected.title || "未命名底本"}`);
                  }
                }}
                className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
              >
                <option value="">选择底本（Type=Base）</option>
                {resumeBases.map((base) => (
                  <option key={base.id} value={base.id}>
                    {base.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  void onLoadResumeBases();
                }}
                disabled={loadingResumeBases}
                className="h-[42px] min-w-[92px] whitespace-nowrap rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-300 transition hover:border-zinc-500 disabled:opacity-50"
              >
                {loadingResumeBases ? "加载中..." : "加载底本记录"}
              </button>
            </div>
            <textarea
              value={resumeContext}
              onChange={(event) => setResumeContext(event.target.value)}
              placeholder="底本内容将作为个人经历上下文喂给大模型（可手动补充）"
              className="min-h-24 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            />
            <p className="text-xs text-zinc-500">JD 文本</p>
            <textarea
              value={jdText}
              onChange={(event) => setJdText(event.target.value)}
              placeholder="粘贴 JD 文本"
              className="min-h-32 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            />
            <p className="text-xs text-zinc-500">研究摘要（可选）</p>
            <textarea
              value={researchSummary}
              onChange={(event) => setResearchSummary(event.target.value)}
              placeholder="研究摘要（可选）"
              className="min-h-24 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            />
            <p className="text-xs text-zinc-500">面试官信息（可选）</p>
            <textarea
              value={interviewerInfo}
              onChange={(event) => setInterviewerInfo(event.target.value)}
              placeholder="面试官信息（可选：姓名/职级/背景/领英摘要）"
              className="min-h-20 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={onGeneratePrepBrief}
              disabled={loading || !canGenerate}
              className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100 transition hover:bg-cyan-500/20 disabled:opacity-50"
            >
              {loading ? <span className="loading-dots">生成中</span> : "生成备战简报（备战策略、核心题库）"}
            </button>
            <button
              type="button"
              onClick={onGenerateSelfIntro}
              disabled={generatingSelfIntro || loading || !canGenerate}
              className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100 transition hover:bg-emerald-500/20 disabled:opacity-50"
            >
              {generatingSelfIntro ? <span className="loading-dots">生成中</span> : "生成自我介绍"}
            </button>
            <button
              type="button"
              onClick={() => {
                void onSaveToNotion();
              }}
              disabled={!canSaveToNotion || savingToNotion}
              className="rounded-lg border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-sm text-violet-100 transition hover:bg-violet-500/20 disabled:opacity-50"
            >
              {savingToNotion ? <span className="loading-dots">保存中</span> : "保存到 Notion"}
            </button>
            <button
              type="button"
              onClick={clearDraft}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 transition hover:border-zinc-500"
            >
              清空草稿
            </button>
          </div>
          {!canGenerate ? (
            <p className="mt-2 text-xs text-amber-300">请先补全“公司名称”和“JD 文本”，再生成备战简报。</p>
          ) : null}
          <LoadingHint
            active={loading || generatingSelfIntro || syncingQuestionBank || savingToNotion}
            text={status}
            className="mt-2"
          />
          {loading ? (
            <div className="mt-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs text-cyan-100">
              <p className="font-medium">生成进度</p>
              <p className="mt-1">{loadingSteps[loadingStepIndex]}</p>
              <div className="mt-2 space-y-1 text-zinc-200/90">
                {loadingSteps.map((step, idx) => (
                  <p key={step} className={idx <= loadingStepIndex ? "text-cyan-100" : "text-zinc-400"}>
                    {idx <= loadingStepIndex ? "✓" : "·"} {step}
                  </p>
                ))}
              </div>
              {retrievedStoryContext.length || retrievedKnowledgeContext.length ? (
                <p className="mt-2 text-zinc-300">
                  已载入：故事 {retrievedStoryContext.length} 条，知识点 {retrievedKnowledgeContext.length} 条
                </p>
              ) : null}
              {contextWarnings.length > 0 ? (
                <div className="mt-2 space-y-1 text-amber-200">
                  {contextWarnings.map((warning) => (
                    <p key={warning}>! {warning}</p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="space-y-3">
          <div className="neon-card rounded-xl p-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveResultTab("strategy")}
                className={`rounded-full border px-3 py-1.5 text-xs transition ${
                  activeResultTab === "strategy"
                    ? "border-cyan-400/70 bg-cyan-500/15 text-cyan-100"
                    : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                }`}
              >
                📊 备战策略
              </button>
              <button
                type="button"
                onClick={() => setActiveResultTab("qa")}
                className={`rounded-full border px-3 py-1.5 text-xs transition ${
                  activeResultTab === "qa"
                    ? "border-cyan-400/70 bg-cyan-500/15 text-cyan-100"
                    : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                }`}
              >
                🎯 核心题库
              </button>
              <button
                type="button"
                onClick={() => setActiveResultTab("pitch")}
                className={`rounded-full border px-3 py-1.5 text-xs transition ${
                  activeResultTab === "pitch"
                    ? "border-cyan-400/70 bg-cyan-500/15 text-cyan-100"
                    : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                }`}
              >
                🎤 自我介绍
              </button>
            </div>
          </div>

          <div className="min-h-[420px] space-y-3 transition-all duration-200">
            {activeResultTab === "strategy" ? (
              <>
                <ResultCard title="面试形式指引" items={result?.interviewFormatGuide ?? []} />
                <ResultCard title="文化判断" items={result?.cultureJudgement ?? []} />
                <ResultCard title="面试官情报" items={result?.interviewerIntel ?? []} />
                <ResultCard title="最佳定位策略" items={result?.bestPositioningStrategy ?? []} />
                <ResultCard title="顾虑与反制策略" items={result?.concernsAndCounters ?? []} />
                <ResultCard title="故事映射" items={result?.storyMapping ?? []} />
              </>
            ) : null}

            {activeResultTab === "qa" ? (
              <>
                <ResultCard
                  title="预测问题"
                  items={result?.predictedQuestions ?? []}
                  headerAction={
                    result?.predictedQuestions?.length ? (
                      <button
                        type="button"
                        onClick={onPushPredictedQuestions}
                        disabled={syncingQuestionBank}
                        className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-100 disabled:opacity-50"
                      >
                        {syncingQuestionBank ? <span className="loading-dots">入库中</span> : "预测问题一键加入题库"}
                      </button>
                    ) : null
                  }
                  renderActions={(item) => (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const response = await fetch("/api/questions", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              item: {
                                title: item,
                                category: "个人特质",
                                source: "AI生成",
                                company: company.trim(),
                                role: role.trim(),
                                round: "",
                                difficulty: "中等",
                                myAnswer: "",
                                aiFeedback: "来源：Prep 预测问题",
                                bestStory: "",
                                tags: [],
                                practiceCount: 0,
                                lastScore: 0,
                                lastPracticed: "",
                                status: "未练习",
                              },
                            }),
                          });
                          if (!response.ok) throw new Error("add failed");
                          setStatus("已加入面试题库。");
                        } catch {
                          setStatus("加入题库失败。");
                        }
                      }}
                      className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-100"
                    >
                      加入题库
                    </button>
                  )}
                />
                <ResultCard title="反向提问" items={result?.reverseQuestions ?? []} />
                <ResultCard title="面试当天清单" items={result?.dayOfChecklist ?? []} />
              </>
            ) : null}

            {activeResultTab === "pitch" ? (
              <div className="neon-card rounded-xl p-4">
                <h3 className="mb-2 text-sm font-semibold text-zinc-100">30秒 / 1分钟 / 3分钟 自我介绍逐字稿</h3>
                {/* TODO(mock): 模拟面试模块请从 Notion Interview Record 正文读取该逐字稿，作为唯一事实来源，避免依赖前端内存状态。 */}
                <article className="prose prose-invert max-w-none space-y-4 text-sm leading-7 text-zinc-300 prose-headings:mb-2 prose-headings:mt-4 prose-headings:text-zinc-100 prose-p:my-2 prose-hr:my-5 prose-hr:border-zinc-700 prose-blockquote:my-3 prose-blockquote:border-l-cyan-400/70 prose-blockquote:text-zinc-300">
                  <ReactMarkdown>{result?.selfIntroScript?.trim() || "等待生成备战简报后提取..."}</ReactMarkdown>
                </article>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}

function ResultCard({
  title,
  items,
  headerAction,
  renderActions,
}: {
  title: string;
  items: Array<string | Record<string, unknown> | null | undefined>;
  headerAction?: ReactNode;
  renderActions?: (item: string, idx: number) => ReactNode;
}) {
  const normalizedItems = items
    .map((item) => {
      if (typeof item === "string") return item;
      if (!item) return "";
      try {
        return JSON.stringify(item, null, 2);
      } catch {
        return String(item);
      }
    })
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <div className="neon-card rounded-xl p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
        {headerAction}
      </div>
      <div className="space-y-2">
        {normalizedItems.map((item, idx) => (
          <div key={idx} className="rounded-lg border border-zinc-800/70 bg-zinc-950/40 p-2">
            <div className="flex items-start justify-between gap-2">
              <article className="prose prose-invert max-w-none text-sm leading-6 text-zinc-300 prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-strong:text-zinc-100">
                <ReactMarkdown>{item}</ReactMarkdown>
              </article>
              {renderActions ? renderActions(item, idx) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

