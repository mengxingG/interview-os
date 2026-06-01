"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { PageGuide } from "@/components/PageGuide";
import { ModelSelect } from "@/components/ModelSelect";
import { toastFetch } from "@/lib/toast-utils";
import type { ModelType } from "@/lib/llm";
import { readModelSelection, writeModelSelection } from "@/lib/model-selection";

type PositioningResult = {
  company_fit: string[];
  advantages: string[];
  interviewer_concerns: string[];
  strategy: string[];
  elevator_pitch_zh: string;
  elevator_pitch_en: string;
};

type ResumeBaseRecord = {
  id: string;
  title: string;
  optimizedText: string;
  isActive?: boolean;
};

type PositioningPersistedPayload = {
  currentRole?: string;
  targetRole?: string;
  years?: string;
  coreSkills?: string;
  transitionStory?: string;
  company_fit?: string[];
  advantages?: string[];
  interviewer_concerns?: string[];
  strategy?: string[];
  elevator_pitch_zh?: string;
  elevator_pitch_en?: string;
};

const POSITIONING_STORAGE_KEY = "interview-os-positioning";

export default function PositioningPage() {
  const [form, setForm] = useState({
    currentRole: "花旗 4 年交易系统开发",
    targetRole: "AI Product Manager",
    years: "4",
    coreSkills: "交易系统、PRD、UI 设计、全流程落地、AI 产品开发",
    transitionStory:
      "核心项目 CITI COMPLY AI 合规智能助手（0→1 独立设计 PRD+UI，P2 试点），独立开发 2 个 AI 产品（AI News Radar + AI Knowledge Learning System）",
  });
  const [result, setResult] = useState<PositioningResult | null>(null);
  const [editableResult, setEditableResult] = useState<PositioningResult | null>(null);
  const [resumeBases, setResumeBases] = useState<ResumeBaseRecord[]>([]);
  const [selectedBaseId, setSelectedBaseId] = useState("");
  const [loadingResumeBases, setLoadingResumeBases] = useState(false);
  const [extractingBase, setExtractingBase] = useState(false);
  const [editing, setEditing] = useState({
    advantages: false,
    concerns: false,
    companyFit: false,
    strategy: false,
    pitchZh: false,
    pitchEn: false,
  });
  const [modelType, setModelType] = useState<ModelType>(() => readModelSelection("positioning", "pro"));
  useEffect(() => {
    writeModelSelection("positioning", modelType);
  }, [modelType]);
  const [status, setStatus] = useState("等待生成定位分析");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const lastExtractedBaseIdRef = useRef("");
  const lastInitializedBaseIdRef = useRef("");

  useEffect(() => {
    let mounted = true;
    async function loadResumeBases() {
      setLoadingResumeBases(true);
      try {
        const response = await fetch("/api/notion?resource=resume-bases", { cache: "no-store" });
        const payload = (await response.json()) as { records?: ResumeBaseRecord[]; error?: string; detail?: string };
        if (!response.ok) {
          throw new Error(payload.detail || payload.error || `HTTP ${response.status}`);
        }
        if (!mounted) return;
        const rows = Array.isArray(payload.records) ? payload.records : [];
        setResumeBases(rows);
        const activeBaseId = rows.find((item) => item.isActive)?.id ?? "";
        if (activeBaseId) {
          setSelectedBaseId((prev) => prev || activeBaseId);
        }
      } catch (error) {
        if (!mounted) return;
        setStatus(error instanceof Error ? error.message : "加载底本失败。");
      } finally {
        if (mounted) setLoadingResumeBases(false);
      }
    }
    void loadResumeBases();
    return () => {
      mounted = false;
    };
  }, []);

  const canAnalyze = useMemo(
    () => Object.values(form).every((value) => value.trim().length > 0),
    [form],
  );

  const applyResumeBaseToForm = (text: string) => {
    const raw = text.trim();
    if (!raw) return;
    const lines = raw.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    const firstLine = lines[0] ?? "";
    const yearsMatch = raw.match(/(\d+)\s*(年|years?)/i);
    const inferredCurrentRole = firstLine.replace(/^#+\s*/, "").slice(0, 60) || form.currentRole;
    setForm((prev) => ({
      ...prev,
      currentRole: inferredCurrentRole || prev.currentRole,
      years: yearsMatch?.[1] || prev.years,
    }));
  };

  const extractResumeBaseFields = async (text: string) => {
    const response = await fetch("/api/positioning/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeText: text }),
    });
    const payload = (await response.json()) as {
      result?: { coreSkills?: string; transformationStory?: string };
      error?: string;
      detail?: string;
    };
    if (!response.ok || !payload.result) {
      throw new Error(payload.detail || payload.error || `HTTP ${response.status}`);
    }
    return payload.result;
  };

  const extractAndApplyResumeBase = async (baseId: string, options?: { force?: boolean }) => {
    const selected = resumeBases.find((item) => item.id === baseId);
    if (!selected?.optimizedText) {
      return;
    }
    if (!options?.force && lastExtractedBaseIdRef.current === baseId) {
      return;
    }
    lastExtractedBaseIdRef.current = baseId;
    const previousCoreSkills = form.coreSkills;
    const previousTransitionStory = form.transitionStory;
    applyResumeBaseToForm(selected.optimizedText);
    setExtractingBase(true);
    setForm((prev) => ({
      ...prev,
      coreSkills: "🤖 正在智能解析底本...",
      transitionStory: "🤖 正在智能解析底本...",
    }));
    setStatus(`正在智能解析底本：${selected.title}`);
    try {
      const extracted = await extractResumeBaseFields(selected.optimizedText);
      setForm((prev) => ({
        ...prev,
        coreSkills: extracted.coreSkills?.trim() || prev.coreSkills,
        transitionStory: extracted.transformationStory?.trim() || prev.transitionStory,
      }));
      setStatus(`已从底本智能回填：${selected.title}`);
    } catch (error) {
      setForm((prev) => ({
        ...prev,
        coreSkills: previousCoreSkills,
        transitionStory: previousTransitionStory,
      }));
      setStatus(error instanceof Error ? error.message : "底本智能解析失败。");
      lastExtractedBaseIdRef.current = "";
    } finally {
      setExtractingBase(false);
    }
  };

  const normalizeResultFromPayload = (payload: PositioningPersistedPayload): PositioningResult => ({
    company_fit: Array.isArray(payload.company_fit) ? payload.company_fit.filter(Boolean) : [],
    advantages: Array.isArray(payload.advantages) ? payload.advantages.filter(Boolean) : [],
    interviewer_concerns: Array.isArray(payload.interviewer_concerns)
      ? payload.interviewer_concerns.filter(Boolean)
      : [],
    strategy: Array.isArray(payload.strategy) ? payload.strategy.filter(Boolean) : [],
    elevator_pitch_zh: String(payload.elevator_pitch_zh ?? "").trim(),
    elevator_pitch_en: String(payload.elevator_pitch_en ?? "").trim(),
  });

  const loadSavedPositioningForBase = async (baseId: string) => {
    try {
      const response = await fetch("/api/notion?resource=coaching-session&module=positioning&limit=20", {
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        records?: Array<{ entityId?: string; messageJson?: string; createdDate?: string }>;
      };
      if (!response.ok || !Array.isArray(payload.records)) return;
      const records = payload.records;
      const targetRecord =
        records.find((item) => String(item.entityId ?? "").trim() === baseId) ??
        records.find((item) => String(item.entityId ?? "").trim() === "global-positioning") ??
        records.find((item) => String(item.entityId ?? "").trim() === "0") ??
        null;
      if (!targetRecord?.messageJson) return { hasCoreAndStory: false };
      let parsed: PositioningPersistedPayload | null = null;
      try {
        parsed = JSON.parse(targetRecord.messageJson) as PositioningPersistedPayload;
      } catch {
        parsed = null;
      }
      if (!parsed) return { hasCoreAndStory: false };
      const savedCoreSkills = String(parsed.coreSkills ?? "").trim();
      const savedTransitionStory = String(parsed.transitionStory ?? "").trim();
      const hasCoreAndStory = Boolean(savedCoreSkills && savedTransitionStory);

      setForm((prev) => ({
        ...prev,
        currentRole: String(parsed.currentRole ?? prev.currentRole),
        targetRole: String(parsed.targetRole ?? prev.targetRole),
        years: String(parsed.years ?? prev.years),
        coreSkills: savedCoreSkills || prev.coreSkills,
        transitionStory: savedTransitionStory || prev.transitionStory,
      }));

      const normalizedResult = normalizeResultFromPayload(parsed);
      const hasAnyResult =
        normalizedResult.company_fit.length > 0 ||
        normalizedResult.advantages.length > 0 ||
        normalizedResult.interviewer_concerns.length > 0 ||
        normalizedResult.strategy.length > 0 ||
        normalizedResult.elevator_pitch_zh.length > 0 ||
        normalizedResult.elevator_pitch_en.length > 0;
      if (hasAnyResult) {
        setResult(normalizedResult);
        setEditableResult(normalizedResult);
        setStatus("已加载该底本对应的历史定位结果。");
      }
      return { hasCoreAndStory };
    } catch {
      // ignore saved-session load failures
      return { hasCoreAndStory: false };
    }
  };

  const initializeBaseData = async (baseId: string) => {
    const selected = resumeBases.find((item) => item.id === baseId);
    if (!selected?.optimizedText) return;
    applyResumeBaseToForm(selected.optimizedText);
    const saved = await loadSavedPositioningForBase(baseId);
    if (!saved?.hasCoreAndStory) {
      await extractAndApplyResumeBase(baseId);
    }
  };

  useEffect(() => {
    if (!selectedBaseId) {
      lastInitializedBaseIdRef.current = "";
      lastExtractedBaseIdRef.current = "";
      return;
    }
    if (!resumeBases.some((item) => item.id === selectedBaseId)) return;
    if (lastInitializedBaseIdRef.current === selectedBaseId) return;
    lastInitializedBaseIdRef.current = selectedBaseId;
    void initializeBaseData(selectedBaseId);
  }, [selectedBaseId, resumeBases]);

  const onAnalyze = async () => {
    if (!canAnalyze) {
      setStatus("请先完整填写背景信息。");
      return;
    }
    setLoading(true);
    setStatus(modelType === "pro" ? "正在使用 Gemini Pro 深度分析（约 10-30 秒）..." : "正在生成求职定位分析...");
    try {
      const response = await fetch("/api/positioning/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, modelType }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = (await response.json()) as { result?: PositioningResult };
      if (!payload.result) {
        throw new Error("Missing result");
      }
      setResult(payload.result);
      setEditableResult(payload.result);
      setStatus("定位分析完成。");
    } catch {
      setStatus("分析失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  };

  const onSave = async () => {
    const finalResult = editableResult ?? result;
    if (!finalResult) {
      setStatus("请先生成定位分析。");
      return;
    }

    setSaving(true);
    const savedPayload = {
      ...form,
      ...finalResult,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(POSITIONING_STORAGE_KEY, JSON.stringify(savedPayload));

    const combinedMarkdown = [
      "## 背景信息",
      `- 当前角色：${form.currentRole}`,
      `- 目标岗位：${form.targetRole}`,
      `- 年资：${form.years}`,
      `- 核心技能：${form.coreSkills}`,
      "",
      "## 转型故事",
      form.transitionStory,
      "",
      "## 定位建议（公司类型）",
      ...(finalResult.company_fit.map((item) => `- ${item}`) || []),
      "",
      "## 竞争优势分析",
      ...(finalResult.advantages.map((item) => `- ${item}`) || []),
      "",
      "## 潜在面试官顾虑",
      ...(finalResult.interviewer_concerns.map((item) => `- ${item}`) || []),
      "",
      "## 推荐求职策略",
      ...(finalResult.strategy.map((item) => `- ${item}`) || []),
      "",
      "## Elevator Pitch（中文）",
      finalResult.elevator_pitch_zh,
      "",
      "## Elevator Pitch（English）",
      finalResult.elevator_pitch_en,
    ].join("\n");

    toastFetch(
      "/api/notion",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resource: "coaching-session",
          action: "create",
          title: `[求职定位] ${form.targetRole} ${new Date().toISOString().slice(0, 10)}`,
          module: "positioning",
          entityId: selectedBaseId || "global-positioning",
          entityTitle: form.targetRole,
          sessionType: "career-positioning",
          messageJson: JSON.stringify(savedPayload, null, 2),
          lastAssistantReply: combinedMarkdown,
          applied: true,
        }),
      },
      {
        loading: "正在保存定位结果到 Notion...",
        success: "✅ 定位结果已保存（本地 + Notion 配置表）",
        error: (err) => `❌ Notion 配置表保存失败：${err.message}（已保存到本地）`,
      },
      () => {
        setStatus("定位结果已保存（本地 + Notion 配置表）。");
      },
    );

    setSaving(false);
  };

  const markdownList = (items: string[]) => items.map((item) => `- ${item}`).join("\n");

  const MarkdownCard = ({
    title,
    content,
    editingKey,
    onChange,
  }: {
    title: string;
    content: string;
    editingKey?: keyof typeof editing;
    onChange?: (value: string) => void;
  }) => (
    <div className="neon-card rounded-xl p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
        {editingKey ? (
          <button
            type="button"
            onClick={() => setEditing((prev) => ({ ...prev, [editingKey]: !prev[editingKey] }))}
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-300"
          >
            {editing[editingKey] ? "完成编辑" : "编辑"}
          </button>
        ) : null}
      </div>
      {editingKey && editing[editingKey] && onChange ? (
        <textarea
          value={content}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-24 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
        />
      ) : (
        <article className="prose prose-invert max-w-none text-sm prose-p:my-2 prose-li:my-1">
          <ReactMarkdown>{content || "暂无内容"}</ReactMarkdown>
        </article>
      )}
    </div>
  );

  return (
    <main className="flex w-full flex-col gap-4">
      <section className="neon-card rounded-2xl p-6">
        <h1 className="text-2xl font-semibold">求职定位</h1>
        <p className="mt-2 text-sm text-zinc-400">
          在投递前先明确你的求职叙事：目标公司、竞争优势、潜在顾虑与主攻策略。
        </p>
      </section>
      <PageGuide
        pageKey="positioning"
        items={[
          "先补全背景信息，再生成定位分析。",
          "重点看“面试官顾虑”并提前准备反证故事。",
          "保存后的定位结果会被后续模块引用，保持叙事一致。",
        ]}
      />
      <section className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        <div className="neon-card rounded-2xl p-4">
          <div className="mb-3 flex items-center gap-[6px]">
            <h2 className="text-lg font-medium text-zinc-100">背景信息</h2>
            <button
              type="button"
              title="强制重新解析当前底本"
              onClick={() => {
                if (!selectedBaseId) {
                  setStatus("请先选择一个底本。");
                  return;
                }
                lastExtractedBaseIdRef.current = "";
                void extractAndApplyResumeBase(selectedBaseId, { force: true });
              }}
              disabled={!selectedBaseId || extractingBase}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 text-sm text-zinc-300 transition hover:border-cyan-400/60 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              ↻
            </button>
          </div>
          <div className="grid gap-2">
            <p className="text-xs text-zinc-500">选择简历底本（自动回填）</p>
            <select
              value={selectedBaseId}
              onChange={(event) => {
                const baseId = event.target.value;
                setSelectedBaseId(baseId);
                lastInitializedBaseIdRef.current = "";
                if (!baseId) {
                  lastExtractedBaseIdRef.current = "";
                }
              }}
              disabled={loadingResumeBases || extractingBase}
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm disabled:opacity-50"
            >
              <option value="">
                {loadingResumeBases ? "加载底本中..." : extractingBase ? "🤖 正在智能解析底本..." : "选择简历底本（自动回填）"}
              </option>
              {resumeBases.map((base) => (
                <option key={base.id} value={base.id}>
                  {base.title}
                </option>
              ))}
            </select>
            <p className="text-xs text-zinc-500">当前角色</p>
            <input
              value={form.currentRole}
              onChange={(event) => setForm((prev) => ({ ...prev, currentRole: event.target.value }))}
              placeholder="当前角色"
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            />
            <p className="text-xs text-zinc-500">目标岗位</p>
            <input
              value={form.targetRole}
              onChange={(event) => setForm((prev) => ({ ...prev, targetRole: event.target.value }))}
              placeholder="目标岗位"
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            />
            <p className="text-xs text-zinc-500">年资</p>
            <input
              value={form.years}
              onChange={(event) => setForm((prev) => ({ ...prev, years: event.target.value }))}
              placeholder="年资"
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            />
            <p className="text-xs text-zinc-500">核心技能</p>
            <textarea
              value={form.coreSkills}
              onChange={(event) => setForm((prev) => ({ ...prev, coreSkills: event.target.value }))}
              placeholder="核心技能"
              className="min-h-28 max-h-56 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm leading-relaxed"
            />
            <p className="text-xs text-zinc-500">转型故事</p>
            <textarea
              value={form.transitionStory}
              onChange={(event) => setForm((prev) => ({ ...prev, transitionStory: event.target.value }))}
              placeholder="转型故事"
              className="min-h-40 max-h-80 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm leading-relaxed"
            />
            <ModelSelect
              value={modelType}
              onChange={setModelType}
              storageKey="positioning"
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
              {loading ? "分析中..." : "生成定位分析"}
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={!result || saving}
              className="rounded-lg border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-sm text-violet-100 transition hover:bg-violet-500/20 disabled:opacity-50"
            >
              {saving ? "保存中..." : "保存定位结果"}
            </button>
            <span className="text-xs text-zinc-500">{status}</span>
          </div>
        </div>

        <div className="grid gap-3">
          {loading && !result ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="neon-card animate-pulse rounded-xl p-4">
                <div className="h-4 w-40 rounded bg-zinc-800" />
                <div className="mt-3 h-3 w-full rounded bg-zinc-800" />
                <div className="mt-2 h-3 w-11/12 rounded bg-zinc-800" />
              </div>
            ))
          ) : null}
          <MarkdownCard
            title="定位建议（公司类型）"
            content={markdownList(editableResult?.company_fit ?? result?.company_fit ?? [])}
            editingKey="companyFit"
            onChange={(value) =>
              setEditableResult((prev) =>
                prev
                  ? { ...prev, company_fit: value.split("\n").map((line) => line.replace(/^- /, "").trim()).filter(Boolean) }
                  : prev,
              )
            }
          />
          <MarkdownCard
            title="竞争优势分析"
            content={markdownList(editableResult?.advantages ?? result?.advantages ?? [])}
            editingKey="advantages"
            onChange={(value) =>
              setEditableResult((prev) =>
                prev
                  ? { ...prev, advantages: value.split("\n").map((line) => line.replace(/^- /, "").trim()).filter(Boolean) }
                  : prev,
              )
            }
          />
          <MarkdownCard
            title="潜在面试官顾虑"
            content={markdownList(editableResult?.interviewer_concerns ?? result?.interviewer_concerns ?? [])}
            editingKey="concerns"
            onChange={(value) =>
              setEditableResult((prev) =>
                prev
                  ? {
                      ...prev,
                      interviewer_concerns: value.split("\n").map((line) => line.replace(/^- /, "").trim()).filter(Boolean),
                    }
                  : prev,
              )
            }
          />
          <MarkdownCard
            title="推荐求职策略"
            content={markdownList(editableResult?.strategy ?? result?.strategy ?? [])}
            editingKey="strategy"
            onChange={(value) =>
              setEditableResult((prev) =>
                prev
                  ? { ...prev, strategy: value.split("\n").map((line) => line.replace(/^- /, "").trim()).filter(Boolean) }
                  : prev,
              )
            }
          />
          <MarkdownCard
            title="45 秒 Elevator Pitch（中文）"
            content={editableResult?.elevator_pitch_zh ?? result?.elevator_pitch_zh ?? ""}
            editingKey="pitchZh"
            onChange={(value) =>
              setEditableResult((prev) => (prev ? { ...prev, elevator_pitch_zh: value } : prev))
            }
          />
          <MarkdownCard
            title="45 秒 Elevator Pitch（English）"
            content={editableResult?.elevator_pitch_en ?? result?.elevator_pitch_en ?? ""}
            editingKey="pitchEn"
            onChange={(value) =>
              setEditableResult((prev) => (prev ? { ...prev, elevator_pitch_en: value } : prev))
            }
          />
        </div>
      </section>
    </main>
  );
}
