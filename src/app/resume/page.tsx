 "use client";

import { useEffect, useMemo, useState } from "react";
import ChatPanel from "@/components/ChatPanel";
import { ModelSelect } from "@/components/ModelSelect";
import { PageGuide } from "@/components/PageGuide";
import { StoryCard } from "@/components/StoryCard";
import { UpcomingInterviewFocus } from "@/components/UpcomingInterviewFocus";
import { toastFetch } from "@/lib/toast-utils";
import { getUpcomingInterview, readInterviewSchedule } from "@/lib/interview-schedule";
import { buildResumeSystemPrompt } from "@/lib/prompts/resume";
import type { ModelType } from "@/lib/llm";
import { readModelSelection } from "@/lib/model-selection";
import { userProfile } from "@/lib/user-profile";

type ResumeVersion = {
  id: string;
  version: string;
  targetCompany: string;
  targetJD: string;
  beforeText: string;
  afterText: string;
  aiSuggestions: string;
  createdDate: string;
};
type ResumeBaseVersion = {
  id: string;
  name: string;
  text: string;
  updatedAt: string;
};
type PlatformOutputs = Partial<Record<ChinaPlatform, string>>;

type ChinaPlatform = "boss" | "liepin" | "lagou" | "zhilian" | "51job";
const RESUME_DRAFT_KEY = "interview-os-resume-draft";
const RESUME_BASE_TEXT_KEY = "interview-os-resume-base-text";
const RESUME_BASE_LIBRARY_KEY = "interview-os-resume-base-library";
const DECODE_DRAFT_KEY = "interview-os-decode-draft";
const JD_HISTORY_KEY = "interview-os-jd-history";

const platformLabels: Record<ChinaPlatform, string> = {
  boss: "BOSS直聘",
  liepin: "猎聘",
  lagou: "拉勾",
  zhilian: "智联招聘",
  "51job": "前程无忧（51job）",
};

const platformRules: Record<ChinaPlatform, string[]> = {
  boss: [
    "首屏关注度高，建议开头 3-5 行直接给“岗位匹配信号 + 核心成果”。",
    "用短句和高信息密度 bullet，减少大段说明文。",
    "强调“可马上上手”的项目和业务场景。",
  ],
  liepin: [
    "更看重履历完整性与层级成长，建议补足职责范围与影响面。",
    "突出跨团队协作、owner 范围、业务结果。",
    "重点呈现职级匹配与稳定输出能力。",
  ],
  lagou: [
    "偏互联网/技术岗位表达，关键词建议覆盖产品方法论 + AI 实战。",
    "项目经历中强调方案取舍、迭代节奏、结果指标。",
    "标题和首段要清楚标注目标方向（如 AI 产品经理）。",
  ],
  zhilian: [
    "简历结构要标准化：个人信息、经历、项目、教育等分区清晰。",
    "尽量避免过多英文缩写，关键术语中英并列更稳妥。",
    "重点突出稳定性、可迁移能力与业务落地成果。",
  ],
  "51job": [
    "兼容传统企业筛选习惯，建议用正式、稳健的项目表达。",
    "强调岗位职责、达成结果与可复用经验。",
    "适当补足团队规模、汇报线、协作部门信息。",
  ],
};

function getDefaultResumeBaseText() {
  return [
    `目标岗位：${userProfile.profile.targetRole}`,
    "",
    "定位优势：",
    userProfile.resumeAnalysis.positioningAdvantages,
    "",
    "主要顾虑：",
    userProfile.resumeAnalysis.interviewConcerns,
    "",
    "叙事主张：",
    userProfile.positioningStatement.coreStatement,
  ].join("\n");
}

function extractTargetCompanyFromJd(jdText: string) {
  const text = jdText.trim();
  if (!text) return "";
  const knownCompanies = ["字节跳动", "阿里巴巴", "腾讯", "美团", "京东", "百度", "小红书", "拼多多", "快手", "滴滴", "蚂蚁集团"];
  const known = knownCompanies.find((name) => text.includes(name));
  if (known) return known;
  const cnMatch = text.match(/([A-Za-z0-9\u4e00-\u9fa5]{2,20}(?:集团|公司|科技|网络|信息|控股))/);
  if (cnMatch?.[1]) return cnMatch[1];
  const bytedanceMatch = text.match(/\b(Bytedance|ByteDance|TikTok)\b/i);
  if (bytedanceMatch) return "字节跳动";
  return "";
}

export default function ResumePage() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);

  const [initialDraft] = useState(() => {
    if (typeof window === "undefined") {
      return {
        scheduleChoice: "pending" as "pending" | "applied" | "new",
        targetCompany: "",
        targetJD: "",
        beforeText: "",
        afterText: "",
        aiSuggestions: "",
        versionLabel: "",
        platform: "boss" as ChinaPlatform,
        platformDraft: "",
        platformOutputs: {} as PlatformOutputs,
      };
    }
    try {
      const raw = window.localStorage.getItem(RESUME_DRAFT_KEY);
      const decodeRaw = window.localStorage.getItem(DECODE_DRAFT_KEY);
      const decodeDraft = decodeRaw
        ? (JSON.parse(decodeRaw) as { jdText?: string })
        : null;
      const historyRaw = window.localStorage.getItem(JD_HISTORY_KEY);
      const jdHistory = historyRaw
        ? (JSON.parse(historyRaw) as Array<{ jdText?: string }>)
        : [];
      const latestDecodedJd = decodeDraft?.jdText?.trim() || jdHistory[0]?.jdText?.trim() || "";
      if (!raw) {
        return {
          scheduleChoice: "pending" as "pending" | "applied" | "new",
          targetCompany: "",
          targetJD: latestDecodedJd,
          beforeText: "",
          afterText: "",
          aiSuggestions: "",
          versionLabel: "",
          platform: "boss" as ChinaPlatform,
          platformDraft: "",
          platformOutputs: {} as PlatformOutputs,
        };
      }
      const d = JSON.parse(raw) as {
        scheduleChoice?: "pending" | "applied" | "new";
        targetCompany?: string;
        targetJD?: string;
        beforeText?: string;
        afterText?: string;
        aiSuggestions?: string;
        versionLabel?: string;
        platform?: ChinaPlatform;
        platformDraft?: string;
        platformOutputs?: PlatformOutputs;
      };
      return {
        scheduleChoice: d.scheduleChoice ?? "pending",
        targetCompany: d.targetCompany ?? "",
        targetJD: d.targetJD || latestDecodedJd,
        beforeText: d.beforeText ?? "",
        afterText: d.afterText ?? "",
        aiSuggestions: d.aiSuggestions ?? "",
        versionLabel: d.versionLabel ?? "",
        platform: d.platform ?? "boss",
        platformDraft: d.platformDraft ?? "",
        platformOutputs: d.platformOutputs ?? {},
      };
    } catch {
      return {
        scheduleChoice: "pending" as "pending" | "applied" | "new",
        targetCompany: "",
        targetJD: "",
        beforeText: "",
        afterText: "",
        aiSuggestions: "",
        versionLabel: "",
        platform: "boss" as ChinaPlatform,
        platformDraft: "",
        platformOutputs: {} as PlatformOutputs,
      };
    }
  });
  const [upcoming] = useState(() => {
    if (typeof window === "undefined") return null;
    return getUpcomingInterview(readInterviewSchedule());
  });
  const [scheduleChoice, setScheduleChoice] = useState<"pending" | "applied" | "new">(initialDraft.scheduleChoice);
  const useUpcoming = Boolean(upcoming) && scheduleChoice === "applied";
  const targetRole = useUpcoming ? (upcoming?.role || "AI Product Manager") : "AI Product Manager";
  const jdFocus = useMemo(() => {
    const fromSchedule = useUpcoming
      ? (upcoming?.jdSummary || "")
      .split(/\n|;|；/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 6)
      : [];
    if (fromSchedule.length > 0) return fromSchedule;
    return [
      "跨团队领导（cross-functional leadership）",
      "AI 产品执行（AI product execution）",
      "利益相关方影响力（stakeholder influence）",
      "可量化业务结果（measurable business outcomes）",
    ];
  }, [upcoming?.jdSummary, useUpcoming]);
  const systemPrompt = useMemo(
    () =>
      buildResumeSystemPrompt({
        targetRole,
        outputLanguage: "zh",
        jdFocus,
      }),
    [jdFocus, targetRole],
  );
  const [targetCompany, setTargetCompany] = useState(initialDraft.targetCompany);
  const [targetJD, setTargetJD] = useState(initialDraft.targetJD);
  const [beforeText, setBeforeText] = useState(initialDraft.beforeText);
  const [afterText, setAfterText] = useState(initialDraft.afterText);
  const [aiSuggestions, setAiSuggestions] = useState(initialDraft.aiSuggestions);
  const [versionLabel, setVersionLabel] = useState(initialDraft.versionLabel);
  const [history, setHistory] = useState<ResumeVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [savingVersion, setSavingVersion] = useState(false);
  const [savingBaseVersion, setSavingBaseVersion] = useState(false);
  const [status, setStatus] = useState(
    initialDraft.targetJD?.trim() ? "已自动载入最近解码 JD，可直接开始简历优化。" : "等待保存简历版本",
  );
  const [showResumeFullscreen, setShowResumeFullscreen] = useState(false);
  const [resumeBaseText, setResumeBaseText] = useState(() => {
    if (typeof window === "undefined") return getDefaultResumeBaseText();
    return window.localStorage.getItem(RESUME_BASE_TEXT_KEY) || getDefaultResumeBaseText();
  });
  const [baseVersionName, setBaseVersionName] = useState("");
  const [baseLibrary, setBaseLibrary] = useState<ResumeBaseVersion[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(RESUME_BASE_LIBRARY_KEY);
      return raw ? (JSON.parse(raw) as ResumeBaseVersion[]) : [];
    } catch {
      return [];
    }
  });
  const [selectedBaseId, setSelectedBaseId] = useState("");
  const [renamingBaseId, setRenamingBaseId] = useState("");
  const [renamingBaseName, setRenamingBaseName] = useState("");
  const [renamingBaseSaving, setRenamingBaseSaving] = useState(false);
  const [platform, setPlatform] = useState<ChinaPlatform>(initialDraft.platform);
  const [platformDraft, setPlatformDraft] = useState(initialDraft.platformDraft);
  const [platformOutputs, setPlatformOutputs] = useState<PlatformOutputs>(initialDraft.platformOutputs ?? {});
  const [optimizingResume, setOptimizingResume] = useState(false);
  const [optimizeModelType, setOptimizeModelType] = useState<ModelType>(() =>
    readModelSelection("resume-optimize", "resume"),
  );
  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  const selectedVersion = useMemo(
    () => history.find((item) => item.id === selectedVersionId) ?? null,
    [history, selectedVersionId],
  );
  const syncedBaseTextSet = useMemo(() => {
    const set = new Set<string>();
    for (const row of history) {
      const hint = row.aiSuggestions || "";
      const isBaseLike = hint.includes("BaseVersion=") || row.targetCompany === "Base Resume";
      if (isBaseLike && row.beforeText?.trim()) {
        set.add(row.beforeText.trim());
      }
    }
    return set;
  }, [history]);
  const selectedBase = useMemo(
    () => baseLibrary.find((item) => item.id === selectedBaseId) ?? null,
    [baseLibrary, selectedBaseId],
  );
  const latestSyncedBaseText = useMemo(() => {
    const latestBase = history.find((row) => {
      const title = (row as ResumeVersion & { title?: string }).title ?? "";
      return title.includes("[底本]") || (row.version || "").toUpperCase().startsWith("BASE-");
    });
    return latestBase?.beforeText?.trim() ?? "";
  }, [history]);
  const currentResumeText = resumeBaseText;
  const chatSystemPrompt = useMemo(() => {
    const jd = targetJD.trim() || "（未提供）";
    const base = beforeText.trim() || resumeBaseText.trim() || "（未提供）";
    return `${systemPrompt}

Auto Context (always apply):
- 目标JD:
${jd}

- 当前简历（优化前文本）:
${base}

When user asks for rewrite/edit, directly use the above context unless user explicitly overrides it.`;
  }, [systemPrompt, targetJD, beforeText, resumeBaseText]);
  const baseDiffPreview = useMemo(() => {
    if (!selectedBase) return null;
    const currentLines = resumeBaseText.split("\n").map((line) => line.trim());
    const selectedLines = selectedBase.text.split("\n").map((line) => line.trim());
    const currentSet = new Set(currentLines.filter(Boolean));
    const selectedSet = new Set(selectedLines.filter(Boolean));
    const added = selectedLines.filter((line) => line && !currentSet.has(line)).slice(0, 5);
    const removed = currentLines.filter((line) => line && !selectedSet.has(line)).slice(0, 5);
    return {
      currentCount: currentSet.size,
      selectedCount: selectedSet.size,
      added,
      removed,
    };
  }, [resumeBaseText, selectedBase]);

  const loadHistory = async (options?: { autoSelectFirst?: boolean }) => {
    setLoadingHistory(true);
    try {
      const response = await fetch("/api/notion?resource=resume", { cache: "no-store" });
      if (!response.ok) throw new Error("load failed");
      const payload = (await response.json()) as { records?: ResumeVersion[] };
      const records = payload.records ?? [];
      setHistory(records);
      if (options?.autoSelectFirst && records.length > 0) {
        setSelectedVersionId(records[0].id);
      }
    } catch {
      setStatus("加载简历版本历史失败，请检查 Notion 配置。");
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    void loadHistory();
  }, []);

  useEffect(() => {
    if (!afterText.trim()) {
      setPlatformDraft("");
      return;
    }
    const lines = afterText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const clipped = lines.slice(0, 18).map((line) => (line.length > 90 ? `${line.slice(0, 90)}...` : line));
    setPlatformDraft(clipped.join("\n"));
  }, [afterText, platform]);
  useEffect(() => {
    if (!targetJD.trim()) return;
    if (targetCompany.trim()) return;
    const inferred = extractTargetCompanyFromJd(targetJD);
    if (inferred) {
      setTargetCompany(inferred);
      setStatus(`已从 JD 自动识别目标公司：${inferred}`);
    }
  }, [targetJD, targetCompany]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      RESUME_DRAFT_KEY,
      JSON.stringify({
        scheduleChoice,
        targetCompany,
        targetJD,
        beforeText,
        afterText,
        aiSuggestions,
        versionLabel,
        platform,
        platformDraft,
        platformOutputs,
        savedAt: new Date().toISOString(),
      }),
    );
  }, [scheduleChoice, targetCompany, targetJD, beforeText, afterText, aiSuggestions, versionLabel, platform, platformDraft, platformOutputs]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(RESUME_BASE_TEXT_KEY, resumeBaseText);
  }, [resumeBaseText]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(RESUME_BASE_LIBRARY_KEY, JSON.stringify(baseLibrary));
  }, [baseLibrary]);

  const showToast = (type: "success" | "error" | "info", message: string) => {
    setToast({ type, message });
    window.setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 2600);
  };

  const clearDraft = () => {
    setScheduleChoice("pending");
    setTargetCompany("");
    setTargetJD("");
    setBeforeText("");
    setAfterText("");
    setAiSuggestions("");
    setVersionLabel("");
    setPlatform("boss");
    setPlatformDraft("");
    setPlatformOutputs({});
    setStatus("已清空简历优化草稿。");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(RESUME_DRAFT_KEY);
    }
  };

  if (!hydrated) {
    return (
      <main className="grid w-full gap-4">
        <section className="neon-card rounded-2xl p-6">
          <h1 className="text-2xl font-semibold">简历优化</h1>
          <p className="mt-2 text-sm text-zinc-400">正在加载页面状态...</p>
        </section>
      </main>
    );
  }

  const onUploadResumeBase = async (file?: File | null) => {
    if (!file) return;
    const lower = file.name.toLowerCase();
    const isTextLike = lower.endsWith(".txt") || lower.endsWith(".md") || file.type.startsWith("text/");
    if (!isTextLike) {
      setStatus("暂仅支持 txt/md 文本文件。docx 请先复制文本后粘贴到底本编辑区。");
      return;
    }
    try {
      const text = await file.text();
      if (!text.trim()) {
        setStatus("上传文件内容为空。");
        return;
      }
      setResumeBaseText(text);
      setStatus(`已导入底本文本：${file.name}`);
    } catch {
      setStatus("读取文件失败，请重试。");
    }
  };

  const saveCurrentBaseAsVersion = async () => {
    if (!resumeBaseText.trim()) {
      setStatus("底本文本为空，无法保存版本。");
      showToast("error", "保存失败：底本文本为空");
      return;
    }
    const normalizedCurrent = resumeBaseText.trim();
    const latestLocal = baseLibrary[0]?.text?.trim() ?? "";
    if (latestLocal && latestLocal === normalizedCurrent) {
      setStatus("当前底本与最近一次保存版本完全一致，无需重复保存。");
      showToast("info", "未保存：内容无变化");
      return;
    }
    if (latestSyncedBaseText && latestSyncedBaseText === normalizedCurrent) {
      setStatus("当前底本与最近一次已同步到底本库的版本一致，无需重复保存。");
      showToast("info", "未保存：内容无变化，无需重复同步");
      return;
    }
    const name = baseVersionName.trim() || `底本 ${new Date().toISOString().slice(0, 10)}`;
    const next: ResumeBaseVersion = {
      id: crypto.randomUUID(),
      name,
      text: resumeBaseText,
      updatedAt: new Date().toISOString(),
    };
    setSavingBaseVersion(true);
    const datePart = new Date().toISOString().slice(0, 10);
    const notionVersion = `BASE-${new Date().toISOString().slice(0, 10)}-${(history.length || 0) + 1}`;
    const baseTitle = baseVersionName.trim() ? `[底本] ${baseVersionName.trim()}` : `[底本] BASE-${datePart}`;

    toastFetch(
      "/api/notion",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resource: "resume",
          action: "create",
          type: "Base",
          title: baseTitle,
          version: notionVersion,
          targetCompany: "",
          targetJD: "",
          beforeText: resumeBaseText.trim(),
          afterText: resumeBaseText.trim(),
          aiSuggestions: "",
          createdDate: new Date().toISOString().slice(0, 10),
        }),
      },
      {
        loading: "正在保存底本到 Notion...",
        success: "✅ 底本版本已保存到本地和 Notion",
        error: (err) => `❌ 保存失败：${err.message}`,
      },
      () => {
        setBaseLibrary((prev) => [next, ...prev].slice(0, 30));
        setBaseVersionName("");
        setStatus(`已保存底本版本：${name}（本地 + Notion Resume）`);
        void loadHistory({ autoSelectFirst: true });
      },
    );

    setSavingBaseVersion(false);
  };

  const onAiOptimize = async () => {
    if (!targetJD.trim()) {
      setStatus("请先确认目标 JD。");
      return;
    }
    if (!beforeText.trim()) {
      setStatus("请先填写优化前文本。");
      return;
    }
    setOptimizingResume(true);
    setStatus("正在生成针对性简历优化结果...");
    try {
      const response = await fetch("/api/resume/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetRole,
          targetJD,
          beforeText,
          targetCompany,
          modelType: optimizeModelType,
        }),
      });
      const payload = (await response.json()) as {
        afterText?: string;
        aiSuggestions?: string;
        error?: string;
      };
      if (!response.ok || !payload.afterText) {
        throw new Error(payload.error ?? "生成失败");
      }
      setAfterText(payload.afterText);
      setAiSuggestions(payload.aiSuggestions ?? "");
      setStatus("✨ 已生成针对性简历，可继续微调后保存版本。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "AI 优化失败，请稍后重试。");
    } finally {
      setOptimizingResume(false);
    }
  };

  const renameBaseVersion = () => {
    if (!renamingBaseId) return;
    const nextName = renamingBaseName.trim();
    if (!nextName) {
      setStatus("版本名不能为空。");
      showToast("info", "请输入新版本名");
      return;
    }
    const current = baseLibrary.find((item) => item.id === renamingBaseId);
    if (current && current.name === nextName) {
      setStatus("版本名未变化。");
      showToast("info", "版本名未变化");
      return;
    }
    setRenamingBaseSaving(true);
    setBaseLibrary((prev) =>
      prev.map((item) => (item.id === renamingBaseId ? { ...item, name: nextName, updatedAt: new Date().toISOString() } : item)),
    );
    setStatus("底本版本已重命名。");
    showToast("success", "✅ 重命名成功");
    setRenamingBaseId("");
    setRenamingBaseName("");
    setRenamingBaseSaving(false);
  };

  return (
    <main className="grid w-full gap-4 2xl:grid-cols-[1.25fr_0.95fr]">
      <div className="space-y-4">
        <section className="neon-card rounded-2xl p-6">
          <h1 className="text-2xl font-semibold">简历优化</h1>
          <p className="mt-2 text-sm text-zinc-400">
            针对目标 JD 优化简历表达。AI 会给出 ATS 友好度、关键词匹配和差异化叙事（Differentiation）建议。
          </p>
        </section>
        <PageGuide
          pageKey="resume"
          items={[
            "先选择是否使用最近面试信息，再开始本次简历优化。",
            "可先点“查看当前简历”，再用“作为优化基础”回填到优化前文本。",
            "在右侧 Chat 产出建议后，把关键改写同步到“优化后文本 + AI建议”。",
            "保存为新版本后，可在底部历史区做前后对比，并一键“以该版本继续优化”。",
            "最后按目标平台（BOSS/猎聘/拉勾/智联/51job）生成投递版并回填。",
          ]}
        />
        <UpcomingInterviewFocus />
        {upcoming && scheduleChoice === "pending" ? (
          <section className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-sm">
            <p className="text-cyan-100">
              检测到最近面试：{upcoming.company} · {upcoming.role}。是否按该目标生成简历优化建议？
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <button
                type="button"
                onClick={() => setScheduleChoice("applied")}
                className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-cyan-100"
              >
                使用最近面试信息
              </button>
              <button
                type="button"
                onClick={() => setScheduleChoice("new")}
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1 text-zinc-200"
              >
                使用新信息
              </button>
            </div>
          </section>
        ) : null}
        <section className="neon-card rounded-2xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-zinc-400">当前简历基线（可展开查看后作为优化前文本）</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowResumeFullscreen(true)}
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-200"
              >
                全屏查看
              </button>
              <button
                type="button"
                onClick={() => {
                  setBeforeText((prev) => prev || currentResumeText);
                  setStatus("已载入当前简历到“优化前文本”。");
                }}
                className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100"
              >
                作为优化基础
              </button>
              <button
                type="button"
                onClick={() => {
                  setResumeBaseText(getDefaultResumeBaseText());
                  setStatus("已恢复系统默认简历底本。");
                }}
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-200"
              >
                重置为系统默认底本
              </button>
            </div>
          </div>
          <div className="mt-3 grid gap-2 rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
            <p className="text-xs text-zinc-400">简历底本编辑区（可直接粘贴/修改）</p>
            <textarea
              value={resumeBaseText}
              onChange={(event) => setResumeBaseText(event.target.value)}
              placeholder="在这里粘贴你的简历 Base 版本文本..."
              className="min-h-36 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200"
            />
            <div className="flex flex-wrap items-center gap-2">
              <label className="cursor-pointer rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-200">
                上传 txt/md
                <input
                  type="file"
                  accept=".txt,.md,text/plain,text/markdown"
                  className="hidden"
                  onChange={(event) => {
                    void onUploadResumeBase(event.target.files?.[0]);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  setBeforeText((prev) => prev || resumeBaseText);
                  setStatus("已从底本编辑区载入到“优化前文本”。");
                }}
                className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100"
              >
                用底本填充优化前文本
              </button>
            </div>
            <div className="mt-2 rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
              <p className="text-xs text-zinc-400">底本版本库（可保存多套：社招版/校招版/AI PM版）</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  value={baseVersionName}
                  onChange={(event) => setBaseVersionName(event.target.value)}
                  placeholder="版本名（如 AI PM-字节版）"
                  className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200"
                />
                <button
                  type="button"
                onClick={() => {
                  void saveCurrentBaseAsVersion();
                }}
                disabled={savingBaseVersion}
                  className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100"
                >
                {savingBaseVersion ? "保存中..." : "保存为新底本版本（本地+Notion）"}
                </button>
                <span className="text-xs text-zinc-400">
                  无修改不会重复保存，避免产生重复版本
                </span>
              </div>
              <div className="mt-2 space-y-2">
                {baseLibrary.length === 0 ? (
                  <p className="text-xs text-zinc-500">暂无底本版本</p>
                ) : (
                  baseLibrary.map((item) => (
                    <div
                      key={item.id}
                      className={`flex flex-wrap items-center gap-2 rounded-lg border p-2 ${
                        selectedBaseId === item.id
                          ? "border-cyan-500/60 bg-cyan-500/10"
                          : "border-zinc-800 bg-zinc-900/70"
                      }`}
                    >
                      <p className="text-xs text-zinc-300">
                        {item.name} · {new Date(item.updatedAt).toLocaleString("zh-CN")}
                      </p>
                      <span
                        className={`rounded-md border px-2 py-1 text-[11px] ${
                          syncedBaseTextSet.has(item.text.trim())
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                            : "border-zinc-700 bg-zinc-900 text-zinc-400"
                        }`}
                      >
                        {syncedBaseTextSet.has(item.text.trim()) ? "已同步 Notion" : "本地"}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedBaseId(item.id);
                          showToast("info", `已选中：${item.name}`);
                        }}
                        className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200"
                      >
                        选中
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setResumeBaseText(item.text);
                          setStatus(`已切换到底本版本：${item.name}`);
                          showToast("success", `✅ 已使用：${item.name}`);
                        }}
                        className="rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-100"
                      >
                        使用
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setResumeBaseText(item.text);
                          setBeforeText(item.text);
                          setStatus(`已设为默认底本并填充优化前文本：${item.name}`);
                          showToast("success", `✅ 已设为默认：${item.name}`);
                        }}
                        className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-100"
                      >
                        设为默认
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRenamingBaseId(item.id);
                          setRenamingBaseName(item.name);
                        }}
                        className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200"
                      >
                        重命名
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!window.confirm("确定要删除这份底本版本吗？此操作不可逆。")) return;
                          setBaseLibrary((prev) => prev.filter((row) => row.id !== item.id));
                          if (selectedBaseId === item.id) setSelectedBaseId("");
                          setStatus(`已删除底本版本：${item.name}`);
                          showToast("info", `已删除：${item.name}`);
                        }}
                        className="rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-xs text-rose-100"
                      >
                        删除
                      </button>
                    </div>
                  ))
                )}
              </div>
              {renamingBaseId ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    value={renamingBaseName}
                    onChange={(event) => setRenamingBaseName(event.target.value)}
                    className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200"
                  />
                  <button
                    type="button"
                    onClick={renameBaseVersion}
                    disabled={renamingBaseSaving}
                    className="rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-100"
                  >
                    {renamingBaseSaving ? "保存中..." : "保存重命名"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRenamingBaseId("");
                      setRenamingBaseName("");
                    }}
                    className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200"
                  >
                    取消
                  </button>
                </div>
              ) : null}
              {selectedBase && baseDiffPreview ? (
                <div className="mt-2 rounded-lg border border-zinc-800 bg-zinc-900/70 p-2 text-xs text-zinc-300">
                  <p>
                    差异预览（当前 vs {selectedBase.name}）：{baseDiffPreview.currentCount} 行 vs {baseDiffPreview.selectedCount} 行
                  </p>
                  <p className="mt-1 text-emerald-300">
                    选中版本新增片段：{baseDiffPreview.added.length ? baseDiffPreview.added.join(" / ") : "无"}
                  </p>
                  <p className="mt-1 text-amber-300">
                    当前版本独有片段：{baseDiffPreview.removed.length ? baseDiffPreview.removed.join(" / ") : "无"}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </section>
        <StoryCard
          title="优化建议方向"
          content={
            useUpcoming && upcoming
              ? `当前已关联目标：${upcoming.company} / ${upcoming.role}。优先改写与该岗位最相关的 2 段经历：补齐量化指标、强调个人贡献、加入 earned secret。`
              : "优先改写最近 2 段经历：补齐量化指标、强调个人贡献、加入 earned secret，提升 recruiter 首屏命中率。"
          }
          tag="ATS + 差异化（Differentiation）"
        />
        <section className="neon-card rounded-2xl p-4">
          <div className="mb-3">
            <ModelSelect
              value={optimizeModelType}
              onChange={setOptimizeModelType}
              storageKey="resume-optimize"
              recommended="resume"
              label="一键优化大模型"
              selectClassName="max-w-md rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-zinc-300">已自动读取上方 JD 与优化前文本，支持一键生成优化稿。</p>
            <button
              type="button"
              onClick={() => {
                void onAiOptimize();
              }}
              disabled={optimizingResume}
              className="rounded-xl border border-emerald-500/55 bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-100 shadow-sm shadow-emerald-900/30 disabled:opacity-60"
            >
              {optimizingResume ? "生成中..." : "✨ 一键生成针对性简历 (AI Optimize)"}
            </button>
          </div>
        </section>
        <section className="neon-card rounded-2xl p-4">
          <h3 className="mb-2 text-sm font-semibold text-zinc-100">版本保存</h3>
          <div className="grid gap-2">
            <input
              value={versionLabel}
              onChange={(event) => setVersionLabel(event.target.value)}
              placeholder="版本号（例如 v1.2）"
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            />
            <input
              value={targetCompany}
              onChange={(event) => setTargetCompany(event.target.value)}
              placeholder="目标公司"
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            />
            <textarea
              value={targetJD}
              onChange={(event) => setTargetJD(event.target.value)}
              placeholder="目标 JD 摘要"
              className="min-h-20 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            />
            <textarea
              value={beforeText}
              onChange={(event) => setBeforeText(event.target.value)}
              placeholder="优化前文本"
              className="min-h-28 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            />
            <textarea
              value={afterText}
              onChange={(event) => setAfterText(event.target.value)}
              placeholder="优化后文本"
              className="min-h-28 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            />
            <textarea
              value={aiSuggestions}
              onChange={(event) => setAiSuggestions(event.target.value)}
              placeholder="AI 建议"
              className="min-h-24 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                if (!beforeText.trim() || !afterText.trim()) {
                  setStatus("请先填写优化前文本和优化后文本。");
                  return;
                }
                setSavingVersion(true);
                toastFetch(
                  "/api/notion",
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      resource: "resume",
                      action: "create",
                      version: versionLabel.trim() || `v${history.length + 1}`,
                      targetCompany: targetCompany.trim(),
                      targetJD: targetJD.trim(),
                      beforeText: beforeText.trim(),
                      afterText: afterText.trim(),
                      aiSuggestions: aiSuggestions.trim(),
                      createdDate: new Date().toISOString().slice(0, 10),
                    }),
                  },
                  {
                    loading: "正在保存简历版本到 Notion...",
                    success: "✅ 简历版本已保存到 Notion",
                    error: (err) => `❌ 保存失败：${err.message}`,
                  },
                  () => {
                    setStatus("简历版本已保存到 Notion。");
                    void loadHistory({ autoSelectFirst: true });
                  },
                );
                setSavingVersion(false);
              }}
              disabled={savingVersion}
              className="rounded-lg border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-xs text-violet-100 disabled:opacity-50"
            >
              {savingVersion ? "保存中..." : "保存为新版本"}
            </button>
            <button
              type="button"
              onClick={() => void loadHistory()}
              disabled={loadingHistory}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 disabled:opacity-50"
            >
              刷新历史
            </button>
            <button
              type="button"
              onClick={clearDraft}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-200"
            >
              清空草稿
            </button>
          </div>
          <p className="mt-2 text-xs text-zinc-500">{status}</p>
        </section>
        <section className="neon-card rounded-2xl p-4">
          <h3 className="mb-2 text-sm font-semibold text-zinc-100">中国招聘平台适配</h3>
          <div className="grid gap-2">
            <select
              value={platform}
              onChange={(event) => setPlatform(event.target.value as ChinaPlatform)}
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            >
              {Object.entries(platformLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
              <p className="mb-1 text-xs text-zinc-500">适配建议</p>
              <ul className="space-y-1 text-xs text-zinc-300">
                {platformRules[platform].map((rule) => (
                  <li key={rule}>- {rule}</li>
                ))}
              </ul>
            </div>
            <textarea
              value={platformDraft}
              onChange={(event) => setPlatformDraft(event.target.value)}
              placeholder="平台投递版简历（可编辑）"
              className="min-h-32 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                if (!platformDraft.trim()) {
                  setStatus("请先生成或填写平台投递版内容。");
                  return;
                }
                setPlatformOutputs((prev) => ({ ...prev, [platform]: platformDraft }));
                setStatus(`已保存为平台专属版本（${platformLabels[platform]}），不会覆盖 ATS 优化稿。`);
              }}
              className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-100"
            >
              保存为平台专属版本（{platformLabels[platform]}）
            </button>
            <button
              type="button"
              onClick={() => {
                const saved = platformOutputs[platform];
                if (!saved?.trim()) {
                  setStatus(`暂无 ${platformLabels[platform]} 平台专属版本。`);
                  return;
                }
                setPlatformDraft(saved);
                setStatus(`已加载 ${platformLabels[platform]} 平台专属版本。`);
              }}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-200"
            >
              加载平台专属版本
            </button>
            <button
              type="button"
              onClick={() => {
                if (!afterText.trim()) {
                  setStatus("请先填写“优化后文本”。");
                  return;
                }
                const short = afterText
                  .split("\n")
                  .map((line) => line.trim())
                  .filter(Boolean)
                  .slice(0, 18)
                  .map((line) => (line.length > 90 ? `${line.slice(0, 90)}...` : line))
                  .join("\n");
                setPlatformDraft(short);
                setStatus(`已按 ${platformLabels[platform]} 规则重新生成投递版草稿。`);
              }}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-200"
            >
              重新生成草稿
            </button>
          </div>
        </section>
      </div>
      <ChatPanel
        systemPrompt={chatSystemPrompt}
        modelType="resume"
        recommendedModel="resume"
        modelStorageKey="resume-chat"
        onMessagesChange={(messages) => {
          const latestAssistant = [...messages].reverse().find((item) => item.role === "assistant");
          if (latestAssistant?.content?.trim()) {
            setAiSuggestions((prev) => prev || latestAssistant.content.slice(0, 5000));
          }
        }}
        initialAssistantMessage={
          useUpcoming && upcoming
            ? `已读取即将面试安排：**${upcoming.company} / ${upcoming.role}**。请先粘贴你的简历文本，我会按该岗位的 JD 信号给出可直接替换的 bullet 改写建议。`
            : undefined
        }
        inputPlaceholder="已自动加载 JD 与简历上下文，直接输入你的改写指令..."
        emptyStateText="已自动读取上方 JD 与当前简历。直接输入指令（如：帮我把第二段经历写得更符合字节的数据驱动要求）。"
      />
      <section className="neon-card col-span-full rounded-2xl p-4">
        <h2 className="text-lg font-semibold text-zinc-100">历史版本</h2>
        {loadingHistory ? (
          <p className="mt-2 text-sm text-zinc-500">正在加载历史版本...</p>
        ) : history.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">暂无历史版本。</p>
        ) : (
          <div className="mt-3 grid gap-3 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-2">
              {history.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setSelectedVersionId(item.id)}
                  className={`w-full rounded-xl border p-3 text-left ${
                    selectedVersionId === item.id
                      ? "border-violet-400/60 bg-violet-500/10"
                      : "border-zinc-800 bg-zinc-950/60"
                  }`}
                >
                  <p className="text-sm text-zinc-100">{item.version || "未命名版本"}</p>
                  <p className="mt-1 text-xs text-zinc-400">{item.targetCompany || "未填写公司"} · {item.createdDate || "-"}</p>
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {!selectedVersion ? (
                <p className="text-sm text-zinc-500">选择一个版本查看对比。</p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setBeforeText(selectedVersion.afterText || selectedVersion.beforeText);
                        setTargetCompany(selectedVersion.targetCompany);
                        setTargetJD(selectedVersion.targetJD);
                        setAiSuggestions(selectedVersion.aiSuggestions);
                        setStatus("已加载历史版本为继续优化基础。");
                      }}
                      className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-100"
                    >
                      以该版本继续优化
                    </button>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
                      <p className="mb-1 text-xs text-zinc-500">优化前</p>
                      <pre className="max-h-56 overflow-auto whitespace-pre-wrap text-xs text-zinc-300">
                        {selectedVersion.beforeText || "（空）"}
                      </pre>
                    </div>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
                      <p className="mb-1 text-xs text-zinc-500">优化后</p>
                      <pre className="max-h-56 overflow-auto whitespace-pre-wrap text-xs text-zinc-300">
                        {selectedVersion.afterText || "（空）"}
                      </pre>
                    </div>
                  </div>
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
                    <p className="mb-1 text-xs text-zinc-500">AI 建议</p>
                    <pre className="max-h-44 overflow-auto whitespace-pre-wrap text-xs text-zinc-300">
                      {selectedVersion.aiSuggestions || "（空）"}
                    </pre>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </section>
      {showResumeFullscreen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4">
          <div className="neon-card flex h-[88vh] w-full max-w-6xl flex-col rounded-2xl p-4">
            <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-3">
              <p className="text-sm font-semibold text-zinc-100">当前简历（全屏查看）</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setBeforeText((prev) => prev || currentResumeText);
                    setStatus("已从全屏视图载入到“优化前文本”。");
                  }}
                  className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-100"
                >
                  作为优化基础
                </button>
                <button
                  type="button"
                  onClick={() => setShowResumeFullscreen(false)}
                  className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-200"
                >
                  关闭
                </button>
              </div>
            </div>
            <pre className="mt-3 flex-1 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm leading-6 text-zinc-300">
              {currentResumeText}
            </pre>
          </div>
        </div>
      ) : null}
      {toast ? (
        <div
          className={`fixed bottom-4 right-4 z-[80] rounded-xl border px-3 py-2 text-xs shadow-xl ${
            toast.type === "success"
              ? "border-emerald-500/40 bg-zinc-950/95 text-emerald-200"
              : toast.type === "error"
                ? "border-rose-500/40 bg-zinc-950/95 text-rose-200"
                : "border-cyan-500/40 bg-zinc-950/95 text-cyan-200"
          }`}
        >
          {toast.message}
        </div>
      ) : null}
    </main>
  );
}
