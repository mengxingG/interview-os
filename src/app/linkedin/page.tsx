"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { PageGuide } from "@/components/PageGuide";
import { ModelSelect } from "@/components/ModelSelect";
import { toastFetch } from "@/lib/toast-utils";
import type { ModelType } from "@/lib/llm";
import { readModelSelection, writeModelSelection } from "@/lib/model-selection";

type Depth = "quick" | "standard" | "deep";
type PlatformTab = "linkedin" | "boss" | "liepin" | "lagou" | "zhilian";
type ResultPayload = {
  optimizedFields: Record<string, string>;
  analysis: string[];
  commonAdvice: {
    photoAdvice: string;
    consistencyCheck: string[];
    targetKeywords: string[];
  };
};
type ProfileHistoryRecord = {
  id: string;
  title: string;
  platform: string;
  content: string;
  createdAt: string;
};
type BaseResumeRow = {
  id: string;
  title: string;
  version: string;
  optimizedText: string;
  createdAt: string;
  isActive?: boolean;
};

const tabLabels: Array<{ id: PlatformTab; label: string }> = [
  { id: "linkedin", label: "LinkedIn" },
  { id: "boss", label: "BOSS直聘" },
  { id: "liepin", label: "猎聘" },
  { id: "lagou", label: "拉勾" },
  { id: "zhilian", label: "智联招聘" },
];
const PROFILE_OPT_DRAFT_KEY = "interview-os-profile-optimization-draft";

function resolvePlatformFromLabel(label: string): PlatformTab | null {
  const text = String(label || "").toLowerCase();
  if (text.includes("boss")) return "boss";
  if (text.includes("linkedin")) return "linkedin";
  if (text.includes("猎聘")) return "liepin";
  if (text.includes("拉勾")) return "lagou";
  if (text.includes("智联")) return "zhilian";
  return null;
}

const extractResumeSections = (rawText: string) => {
  if (!rawText) return { advantage: "", work: "", project: "" };

  const advantageLines: string[] = [];
  const workLines: string[] = [];
  const projectLines: string[] = [];

  let currentSection: "none" | "advantage" | "work" | "project" | "ignore" = "none";
  const lines = rawText.split(/\r?\n/);

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    if (trimmedLine === "---") {
      currentSection = "ignore";
      continue;
    }

    // If any markdown heading appears, we only keep target sections.
    const headingMatch = trimmedLine.match(/^#{1,6}\s*(.+)$/);
    if (headingMatch) {
      const heading = headingMatch[1].trim();
      if (heading.startsWith("个人优势") || heading.startsWith("个人简介")) {
        currentSection = "advantage";
      } else if (heading.startsWith("工作经历")) {
        currentSection = "work";
      } else if (heading.startsWith("项目经历")) {
        currentSection = "project";
      } else {
        // Other headings such as 平台优化分析 / 头像建议 should not be merged into project section.
        currentSection = "ignore";
      }
      continue;
    }

    if (
      trimmedLine.startsWith("定位优势：") ||
      trimmedLine.startsWith("定位优势:") ||
      /^#{1,6}\s*个人优势/.test(trimmedLine) ||
      /^#{1,6}\s*个人简介/.test(trimmedLine)
    ) {
      currentSection = "advantage";
      const content = trimmedLine
        .replace(/^定位优势：|^定位优势:/, "")
        .replace(/^#{1,6}\s*个人优势|^#{1,6}\s*个人简介/, "")
        .trim();
      if (content) advantageLines.push(content);
      continue;
    }
    if (
      trimmedLine.startsWith("工作经历：") ||
      trimmedLine.startsWith("工作经历:") ||
      /^#{1,6}\s*工作经历/.test(trimmedLine)
    ) {
      currentSection = "work";
      const content = trimmedLine.replace(/^工作经历：|^工作经历:/, "").replace(/^#{1,6}\s*工作经历/, "").trim();
      if (content) workLines.push(content);
      continue;
    }
    if (
      trimmedLine.includes("独立 AI 产品") ||
      trimmedLine.startsWith("项目经历") ||
      /^#{1,6}\s*项目经历/.test(trimmedLine)
    ) {
      currentSection = "project";
      const content = trimmedLine.replace(/^项目经历：|^项目经历:/, "").replace(/^#{1,6}\s*项目经历/, "").trim();
      if (content && !content.startsWith("项目经历")) projectLines.push(content);
      continue;
    }
    if (trimmedLine.startsWith("主要顾虑") || trimmedLine.startsWith("叙事主张") || trimmedLine.startsWith("目标岗位")) {
      currentSection = "ignore";
      continue;
    }

    if (currentSection === "advantage") advantageLines.push(trimmedLine);
    else if (currentSection === "work") workLines.push(trimmedLine);
    else if (currentSection === "project") projectLines.push(trimmedLine);
  }

  return {
    advantage: advantageLines.join("\n"),
    work: workLines.join("\n"),
    project: projectLines.join("\n"),
  };
};

function splitHistorySections(fullText: string) {
  const text = String(fullText || "");
  const markerPlatform = text.search(/💡\s*平台优化分析/);
  const markerAvatar = text.search(/📸\s*头像建议/);
  const markerConsistency = text.search(/🔗\s*跨平台一致性检查/);
  const markerKeywords = text.search(/🎯\s*目标岗位关键词建议/);

  const safeSlice = (start: number, end?: number) =>
    start >= 0 ? text.slice(start, end && end > start ? end : undefined).trim() : "";

  const mainResult = (markerPlatform >= 0 ? text.slice(0, markerPlatform) : text).trim();
  const platformAnalysis = safeSlice(markerPlatform, markerAvatar > markerPlatform ? markerAvatar : undefined)
    .replace(/^#{1,6}\s*💡\s*平台优化分析\s*/m, "")
    .trim();
  const avatarSuggestion = safeSlice(markerAvatar, markerConsistency > markerAvatar ? markerConsistency : undefined)
    .replace(/^#{1,6}\s*📸\s*头像建议\s*/m, "")
    .trim();
  const crossPlatformCheck = safeSlice(markerConsistency, markerKeywords > markerConsistency ? markerKeywords : undefined)
    .replace(/^#{1,6}\s*🔗\s*跨平台一致性检查\s*/m, "")
    .trim();
  const keywords = safeSlice(markerKeywords)
    .replace(/^#{1,6}\s*🎯\s*目标岗位关键词建议\s*/m, "")
    .trim();

  return { mainResult, platformAnalysis, avatarSuggestion, crossPlatformCheck, keywords };
}

function toBulletItems(raw: string) {
  return raw
    .split(/\n+/)
    .map((line) => line.replace(/^[\-\*\d\.\)\s]+/, "").trim())
    .filter(Boolean);
}

export default function LinkedinPage() {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (pathname === "/linkedin") {
      router.replace("/communication?tab=profile");
    }
  }, [pathname, router]);

  const [platform, setPlatform] = useState<PlatformTab>("boss");
  const [depth, setDepth] = useState<Depth>("standard");
  const [headline, setHeadline] = useState("");
  const [about, setAbout] = useState("");
  const [experience, setExperience] = useState("");
  const [linkedinProject, setLinkedinProject] = useState("");
  const [bossAdvantage, setBossAdvantage] = useState("");
  const [bossExpectation, setBossExpectation] = useState("");
  const [bossWork, setBossWork] = useState("");
  const [bossProject, setBossProject] = useState("");
  const [liepinIntro, setLiepinIntro] = useState("");
  const [liepinHighlight1, setLiepinHighlight1] = useState("");
  const [liepinHighlight2, setLiepinHighlight2] = useState("");
  const [liepinHighlight3, setLiepinHighlight3] = useState("");
  const [liepinTargetRole, setLiepinTargetRole] = useState("");
  const [liepinWork, setLiepinWork] = useState("");
  const [liepinProject, setLiepinProject] = useState("");
  const [lagouSummary, setLagouSummary] = useState("");
  const [lagouWork, setLagouWork] = useState("");
  const [lagouProject, setLagouProject] = useState("");
  const [lagouTargetRole, setLagouTargetRole] = useState("");
  const [zhilianSummary, setZhilianSummary] = useState("");
  const [zhilianExperience, setZhilianExperience] = useState("");
  const [zhilianProject, setZhilianProject] = useState("");
  const [zhilianTargetRole, setZhilianTargetRole] = useState("");
  const [modelType, setModelType] = useState<ModelType>("pro");
  useEffect(() => {
    writeModelSelection("linkedin", modelType);
  }, [modelType]);
  const [result, setResult] = useState<ResultPayload | null>(null);
  const [historyRecords, setHistoryRecords] = useState<ProfileHistoryRecord[]>([]);
  const [selectedHistoryRecord, setSelectedHistoryRecord] = useState<ProfileHistoryRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingHistory, setSavingHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [baseResumeList, setBaseResumeList] = useState<BaseResumeRow[]>([]);
  const [selectedBaseId, setSelectedBaseId] = useState("");
  const [loadingBaseList, setLoadingBaseList] = useState(false);
  const [status, setStatus] = useState("等待求职档案优化");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(PROFILE_OPT_DRAFT_KEY);
      const draft = raw ? (JSON.parse(raw) as Record<string, string>) : {};
      if (draft.platform && ["linkedin", "boss", "liepin", "lagou", "zhilian"].includes(draft.platform)) {
        setPlatform(draft.platform as PlatformTab);
      }
      if (draft.depth && ["quick", "standard", "deep"].includes(draft.depth)) {
        setDepth(draft.depth as Depth);
      }
      setHeadline(draft.headline || "");
      setAbout(draft.about || "");
      setExperience(draft.experience || "");
      setLinkedinProject(draft.linkedinProject || "");
      setBossAdvantage(draft.bossAdvantage || "");
      setBossExpectation(draft.bossExpectation || "");
      setBossWork(draft.bossWork || "");
      setBossProject(draft.bossProject || "");
      setLiepinIntro(draft.liepinIntro || "");
      setLiepinHighlight1(draft.liepinHighlight1 || "");
      setLiepinHighlight2(draft.liepinHighlight2 || "");
      setLiepinHighlight3(draft.liepinHighlight3 || "");
      setLiepinTargetRole(draft.liepinTargetRole || "");
      setLiepinWork(draft.liepinWork || "");
      setLiepinProject(draft.liepinProject || "");
      setLagouSummary(draft.lagouSummary || "");
      setLagouWork(draft.lagouWork || "");
      setLagouProject(draft.lagouProject || "");
      setLagouTargetRole(draft.lagouTargetRole || "");
      setZhilianSummary(draft.zhilianSummary || "");
      setZhilianExperience(draft.zhilianExperience || "");
      setZhilianProject(draft.zhilianProject || "");
      setZhilianTargetRole(draft.zhilianTargetRole || "");
    } catch {
      // ignore malformed draft
    }
    setModelType(readModelSelection("linkedin", "pro"));
  }, []);

  const copyText = async (text: string) => {
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      setStatus("已复制到剪贴板。");
    } catch {
      setStatus("复制失败，请手动复制。");
    }
  };
  const copyAllOptimized = async () => {
    const fields = result?.optimizedFields ?? {};
    const merged = Object.entries(fields)
      .map(([key, value]) => `${key}\n${value}`)
      .join("\n\n");
    if (!merged.trim()) {
      setStatus("暂无可复制的优化结果。");
      return;
    }
    await copyText(merged);
  };

  const pickOptimizedField = (fields: Record<string, string>, keys: string[]) => {
    for (const key of keys) {
      const direct = fields[key];
      if (typeof direct === "string" && direct.trim()) return direct.trim();
      const fuzzy = Object.entries(fields).find(([fieldKey, value]) => {
        if (!value?.trim()) return false;
        return fieldKey.toLowerCase().includes(key.toLowerCase());
      });
      if (fuzzy?.[1]?.trim()) return fuzzy[1].trim();
    }
    return "";
  };

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await fetch("/api/notion?resource=profile-history", { cache: "no-store" });
      if (!response.ok) throw new Error("load failed");
      const payload = (await response.json()) as { success?: boolean; data?: ProfileHistoryRecord[] };
      setHistoryRecords(payload.data ?? []);
    } catch {
      setStatus("加载档案优化历史失败。");
    } finally {
      setLoadingHistory(false);
    }
  };

  const applySectionsToCurrentPlatform = (
    sections: { advantage: string; work: string; project: string },
    targetPlatform: PlatformTab,
    sourceLabel?: string,
  ) => {
    if (!sections.advantage && !sections.work && !sections.project) {
      setStatus("基础简历中未识别到可用段落（定位优势/工作经历/项目经历）。");
      return;
    }
    switch (targetPlatform) {
      case "boss":
        setBossAdvantage(sections.advantage);
        setBossWork(sections.work);
        setBossProject(sections.project);
        break;
      case "liepin": {
        setLiepinIntro(sections.advantage);
        setLiepinWork(sections.work);
        setLiepinProject(sections.project);
        const advantageLines = sections.advantage
          .split(/[；。;\n]/)
          .map((line) => line.trim())
          .filter((line) => line.length > 0);
        setLiepinHighlight1(advantageLines[0] ?? "");
        setLiepinHighlight2(advantageLines[1] ?? "");
        setLiepinHighlight3(advantageLines[2] ?? "");
        break;
      }
      case "lagou":
        setLagouSummary(sections.advantage);
        setLagouWork(sections.work);
        setLagouProject(sections.project);
        break;
      case "zhilian":
        setZhilianSummary(sections.advantage);
        setZhilianExperience(sections.work);
        setZhilianProject(sections.project);
        break;
      case "linkedin":
        setAbout(sections.advantage);
        setExperience(sections.work);
        setLinkedinProject(sections.project);
        break;
      default:
        setBossAdvantage(sections.advantage);
        setBossWork(sections.work);
        setBossProject(sections.project);
        setExperience(sections.work);
        setLinkedinProject(sections.project);
        break;
    }
    setStatus(
      `已成功加载并适配到【${tabLabels.find((item) => item.id === targetPlatform)?.label || targetPlatform}】表单：${
        sourceLabel || "未命名记录"
      }`,
    );
  };

  const applyBaseResumeText = (baseText: string, baseTitle?: string) => {
    const sections = extractResumeSections(baseText);
    applySectionsToCurrentPlatform(sections, platform, baseTitle || "未命名底本");
  };

  const applyHistoryContentToCurrentForm = (record: ProfileHistoryRecord) => {
    const { mainResult, platformAnalysis, avatarSuggestion, crossPlatformCheck, keywords } = splitHistorySections(
      record.content || "",
    );
    const sections = extractResumeSections(mainResult);
    setResult({
      optimizedFields: {
        个人优势: sections.advantage || "",
        工作经历: sections.work || "",
        项目经历: sections.project || "",
      },
      analysis: platformAnalysis ? [platformAnalysis] : [],
      commonAdvice: {
        photoAdvice: avatarSuggestion || "",
        consistencyCheck: crossPlatformCheck ? [crossPlatformCheck] : [],
        targetKeywords: keywords ? [keywords] : [],
      },
    });
    setStatus(`已将历史记录回填到下方结果区：${record.title || "未命名记录"}`);
  };

  const loadBaseResumeList = async () => {
    setLoadingBaseList(true);
    try {
      const response = await fetch("/api/notion?resource=resume-bases", { cache: "no-store" });
      const payload = (await response.json()) as { records?: BaseResumeRow[]; error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "加载底本列表失败");
      }
      const rows = payload.records ?? [];
      setBaseResumeList(rows);
      const activeBaseId = rows.find((item) => item.isActive)?.id ?? "";
      if (activeBaseId) {
        setSelectedBaseId((prev) => prev || activeBaseId);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "加载底本列表失败");
    } finally {
      setLoadingBaseList(false);
    }
  };

  useEffect(() => {
    void loadHistory();
    void loadBaseResumeList();
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      PROFILE_OPT_DRAFT_KEY,
      JSON.stringify({
        platform,
        depth,
        headline,
        about,
        experience,
        linkedinProject,
        bossAdvantage,
        bossExpectation,
        bossWork,
        bossProject,
        liepinIntro,
        liepinHighlight1,
        liepinHighlight2,
        liepinHighlight3,
        liepinTargetRole,
        liepinWork,
        liepinProject,
        lagouSummary,
        lagouWork,
        lagouProject,
        lagouTargetRole,
        zhilianSummary,
        zhilianExperience,
        zhilianProject,
        zhilianTargetRole,
        savedAt: new Date().toISOString(),
      }),
    );
  }, [
    platform,
    depth,
    headline,
    about,
    experience,
    linkedinProject,
    bossAdvantage,
    bossExpectation,
    bossWork,
    bossProject,
    liepinIntro,
    liepinHighlight1,
    liepinHighlight2,
    liepinHighlight3,
    liepinTargetRole,
    liepinWork,
    liepinProject,
    lagouSummary,
    lagouWork,
    lagouProject,
    lagouTargetRole,
    zhilianSummary,
    zhilianExperience,
    zhilianProject,
    zhilianTargetRole,
  ]);

  useEffect(() => {
    if (!selectedBaseId) return;
    const selectedBase = baseResumeList.find((item) => item.id === selectedBaseId);
    if (!selectedBase?.optimizedText?.trim()) return;
    applyBaseResumeText(selectedBase.optimizedText, selectedBase.title || "未命名底本");
  }, [platform, selectedBaseId, baseResumeList]);

  const onAnalyze = async () => {
    const hasInput =
      platform === "linkedin"
        ? headline.trim() || about.trim() || experience.trim() || linkedinProject.trim()
        : platform === "boss"
          ? bossAdvantage.trim() || bossExpectation.trim() || bossWork.trim() || bossProject.trim()
          : platform === "liepin"
            ? liepinIntro.trim() || liepinHighlight1.trim() || liepinHighlight2.trim() || liepinHighlight3.trim() || liepinTargetRole.trim() || liepinWork.trim() || liepinProject.trim()
            : platform === "lagou"
              ? lagouSummary.trim() || lagouWork.trim() || lagouProject.trim() || lagouTargetRole.trim()
              : zhilianSummary.trim() || zhilianExperience.trim() || zhilianProject.trim() || zhilianTargetRole.trim();
    if (!hasInput) {
      setStatus("请至少填写一个输入字段。");
      return;
    }
    setLoading(true);
    setStatus(modelType === "pro" ? "正在使用 Gemini 3.5 Flash 深度优化（约 10-30 秒）..." : "正在优化求职档案...");
    try {
      const response = await fetch("/api/linkedin/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          depth,
          platform,
          headline,
          about,
          experience,
          linkedinProject,
          bossAdvantage,
          bossExpectation,
          bossWork,
          bossProject,
          liepinIntro,
          liepinHighlights: [liepinHighlight1, liepinHighlight2, liepinHighlight3].filter((item) => item.trim()),
          liepinTargetRole,
          liepinWork,
          liepinProject,
          lagouSummary,
          lagouWork,
          lagouProject,
          lagouTargetRole,
          zhilianSummary,
          zhilianExperience,
          zhilianProject,
          zhilianTargetRole,
          modelType,
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = (await response.json()) as { result?: ResultPayload };
      if (!payload.result) throw new Error("Missing result");
      setResult(payload.result);
      setStatus("档案优化建议已生成。");
    } catch {
      setStatus("生成失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  };

  const clearDraft = () => {
    setPlatform("boss");
    setDepth("standard");
    setHeadline("");
    setAbout("");
    setExperience("");
    setBossAdvantage("");
    setBossExpectation("");
    setBossWork("");
    setBossProject("");
    setLiepinIntro("");
    setLiepinHighlight1("");
    setLiepinHighlight2("");
    setLiepinHighlight3("");
    setLiepinTargetRole("");
    setLagouSummary("");
    setLagouProject("");
    setLagouTargetRole("");
    setZhilianSummary("");
    setZhilianExperience("");
    setZhilianTargetRole("");
    setResult(null);
    setStatus("已清空档案优化草稿。");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(PROFILE_OPT_DRAFT_KEY);
    }
  };

  return (
    <main className="flex w-full flex-col gap-4">
      <section className="neon-card rounded-2xl p-6">
        <h1 className="text-2xl font-semibold">求职档案优化（Profile Optimization）</h1>
        <p className="mt-2 text-sm text-zinc-400">支持 LinkedIn 与中国主流招聘平台档案优化，按平台搜索逻辑生成可直接粘贴文本。</p>
      </section>
      <PageGuide
        pageKey="linkedin"
        items={[
          "先选择平台，再填写对应字段；不同平台的优化逻辑不同。",
          "BOSS 侧重关键词匹配，个人优势前 50 字最关键，HR 通常只看 3-5 秒。",
          "猎聘侧重猎头视角吸引力和职业亮点差异化。",
          "LinkedIn 保留 Headline/About/Experience 逻辑；若主要投中国市场，可优先使用 BOSS/猎聘/拉勾/智联模板。",
          "输出区每个字段支持一键复制，也可“复制全部结果”批量粘贴。",
          "点击“保存到 Notion 历史”后，可在历史区检索并一键回填继续优化。",
          "历史区支持按平台筛选和关键词搜索，便于快速定位旧版本。",
        ]}
      />
      <section className="neon-card rounded-2xl p-4">
        <div className="flex flex-wrap gap-2">
          {tabLabels.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setPlatform(tab.id)}
              className={`rounded-lg border px-3 py-1 text-sm ${
                platform === tab.id
                  ? "border-cyan-500/60 bg-cyan-500/10 text-cyan-100"
                  : "border-zinc-700 bg-zinc-900 text-zinc-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>
      <section className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        <div className="neon-card rounded-2xl p-4">
          <h2 className="mb-3 text-lg font-medium text-zinc-100">输入内容（{tabLabels.find((t) => t.id === platform)?.label}）</h2>
          <div className="mb-3 flex items-center gap-2">
            <select
              className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 p-2.5 text-sm text-zinc-300"
              value={selectedBaseId}
              onChange={(event) => {
                const baseId = event.target.value;
                if (!baseId) return;
                const hasExistingContent = [bossWork, bossProject, experience].some((item) => item.trim().length > 0);
                if (hasExistingContent && baseId !== selectedBaseId) {
                  const confirmed = window.confirm("当前输入区已有内容，加载新底本将覆盖自动填充内容，是否继续？");
                  if (!confirmed) return;
                }
                const selectedBase = baseResumeList.find((item) => item.id === baseId);
                if (!selectedBase?.optimizedText?.trim()) {
                  setStatus("该底本内容为空，无法加载。");
                  return;
                }
                setSelectedBaseId(baseId);
                applyBaseResumeText(selectedBase.optimizedText, selectedBase.title);
              }}
            >
              <option value="">-- 请选择要加载的基础简历（底本）--</option>
              {baseResumeList.map((base) => (
                <option key={base.id} value={base.id}>
                  {base.title} ({base.createdAt ? base.createdAt.substring(0, 10) : "未知日期"})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void loadBaseResumeList()}
              disabled={loadingBaseList}
              className="shrink-0 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
            >
              {loadingBaseList ? "刷新中..." : "刷新底本列表"}
            </button>
          </div>
          <div className="grid gap-2">
            <p className="text-xs text-zinc-500">分析深度</p>
            <select
              value={depth}
              onChange={(event) => setDepth(event.target.value as "quick" | "standard" | "deep")}
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            >
              <option value="quick">快速体检（Quick Audit）</option>
              <option value="standard">标准模式（Standard）</option>
              <option value="deep">深度优化（Deep Optimization）</option>
            </select>
            <ModelSelect
              value={modelType}
              onChange={setModelType}
              storageKey="linkedin"
              recommended="pro"
              label="大模型"
              selectClassName="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            />
            {platform === "linkedin" ? (
              <>
                <p className="text-xs text-zinc-500">标题（Headline）</p>
                <input value={headline} onChange={(event) => setHeadline(event.target.value)} placeholder="期望岗位（Headline）" className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" />
                <p className="text-xs text-zinc-500">个人简介（About）</p>
                <textarea value={about} onChange={(event) => setAbout(event.target.value)} placeholder="个人简介（About）" className="min-h-20 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" />
                <p className="text-xs text-zinc-500">工作经历（Experience）</p>
                <textarea value={experience} onChange={(event) => setExperience(event.target.value)} placeholder="工作经历（Experience）" className="min-h-24 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" />
                <p className="text-xs text-zinc-500">项目经历</p>
                <textarea value={linkedinProject} onChange={(event) => setLinkedinProject(event.target.value)} placeholder="项目经历" className="min-h-24 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" />
              </>
            ) : null}
            {platform === "boss" ? (
              <>
                <p className="text-xs text-zinc-500">个人优势（最多 150 字）</p>
                <textarea value={bossAdvantage} maxLength={150} onChange={(event) => setBossAdvantage(event.target.value)} placeholder="个人优势（前 50 字最关键）" className="min-h-20 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" />
                <p className="text-xs text-zinc-500">求职期望（岗位 + 城市 + 薪资）</p>
                <textarea value={bossExpectation} onChange={(event) => setBossExpectation(event.target.value)} placeholder="如：AI产品经理 / 上海 / 35-45K" className="min-h-16 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" />
                <p className="text-xs text-zinc-500">工作经历</p>
                <textarea value={bossWork} onChange={(event) => setBossWork(event.target.value)} placeholder="工作经历" className="min-h-24 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" />
                <p className="text-xs text-zinc-500">项目经历</p>
                <textarea value={bossProject} onChange={(event) => setBossProject(event.target.value)} placeholder="项目经历" className="min-h-24 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" />
              </>
            ) : null}
            {platform === "liepin" ? (
              <>
                <p className="text-xs text-zinc-500">个人简介</p>
                <textarea value={liepinIntro} onChange={(event) => setLiepinIntro(event.target.value)} placeholder="个人简介" className="min-h-20 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" />
                <p className="text-xs text-zinc-500">职业亮点 1</p>
                <input value={liepinHighlight1} onChange={(event) => setLiepinHighlight1(event.target.value)} placeholder="职业亮点 1" className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" />
                <p className="text-xs text-zinc-500">职业亮点 2</p>
                <input value={liepinHighlight2} onChange={(event) => setLiepinHighlight2(event.target.value)} placeholder="职业亮点 2" className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" />
                <p className="text-xs text-zinc-500">职业亮点 3</p>
                <input value={liepinHighlight3} onChange={(event) => setLiepinHighlight3(event.target.value)} placeholder="职业亮点 3" className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" />
                <p className="text-xs text-zinc-500">期望岗位</p>
                <input value={liepinTargetRole} onChange={(event) => setLiepinTargetRole(event.target.value)} placeholder="期望岗位" className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" />
                <p className="text-xs text-zinc-500">工作经历</p>
                <textarea value={liepinWork} onChange={(event) => setLiepinWork(event.target.value)} placeholder="工作经历" className="min-h-24 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" />
                <p className="text-xs text-zinc-500">项目经历</p>
                <textarea value={liepinProject} onChange={(event) => setLiepinProject(event.target.value)} placeholder="项目经历" className="min-h-24 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" />
              </>
            ) : null}
            {platform === "lagou" ? (
              <>
                <p className="text-xs text-zinc-500">个人简介</p>
                <textarea value={lagouSummary} onChange={(event) => setLagouSummary(event.target.value)} placeholder="个人简介" className="min-h-20 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" />
                <p className="text-xs text-zinc-500">工作经历</p>
                <textarea value={lagouWork} onChange={(event) => setLagouWork(event.target.value)} placeholder="工作经历" className="min-h-24 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" />
                <p className="text-xs text-zinc-500">项目经历</p>
                <textarea value={lagouProject} onChange={(event) => setLagouProject(event.target.value)} placeholder="项目经历" className="min-h-24 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" />
                <p className="text-xs text-zinc-500">期望岗位</p>
                <input value={lagouTargetRole} onChange={(event) => setLagouTargetRole(event.target.value)} placeholder="期望岗位" className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" />
              </>
            ) : null}
            {platform === "zhilian" ? (
              <>
                <p className="text-xs text-zinc-500">个人简介</p>
                <textarea value={zhilianSummary} onChange={(event) => setZhilianSummary(event.target.value)} placeholder="个人简介" className="min-h-20 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" />
                <p className="text-xs text-zinc-500">工作经历</p>
                <textarea value={zhilianExperience} onChange={(event) => setZhilianExperience(event.target.value)} placeholder="工作经历" className="min-h-24 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" />
                <p className="text-xs text-zinc-500">项目经历</p>
                <textarea value={zhilianProject} onChange={(event) => setZhilianProject(event.target.value)} placeholder="项目经历" className="min-h-24 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" />
                <p className="text-xs text-zinc-500">期望岗位</p>
                <input value={zhilianTargetRole} onChange={(event) => setZhilianTargetRole(event.target.value)} placeholder="期望岗位" className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" />
              </>
            ) : null}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={onAnalyze}
              disabled={loading}
              className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100 transition hover:bg-cyan-500/20 disabled:opacity-50"
            >
              {loading ? "分析中..." : "开始优化"}
            </button>
            <button
              type="button"
              onClick={clearDraft}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
            >
              清空草稿
            </button>
            <span className="text-xs text-zinc-500">{status}</span>
          </div>
        </div>
        <div className="grid gap-3">
          <div className="neon-card rounded-xl p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-zinc-100">优化结果（可复制）</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void copyAllOptimized()}
                  className="rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-100"
                >
                  复制全部结果
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!result) {
                      setStatus("请先生成优化结果。");
                      return;
                    }
                    setSavingHistory(true);
                    const inputSummary =
                      platform === "linkedin"
                        ? `期望岗位: ${headline}\n个人简介: ${about}\n工作经历: ${experience}\n项目经历: ${linkedinProject}`
                        : platform === "boss"
                          ? `个人优势: ${bossAdvantage}\n求职期望: ${bossExpectation}\n工作经历: ${bossWork}\n项目经历: ${bossProject}`
                          : platform === "liepin"
                            ? `个人简介: ${liepinIntro}\n亮点: ${[liepinHighlight1, liepinHighlight2, liepinHighlight3].filter(Boolean).join(" | ")}\n期望岗位: ${liepinTargetRole}\n工作经历: ${liepinWork}\n项目经历: ${liepinProject}`
                            : platform === "lagou"
                              ? `个人简介: ${lagouSummary}\n工作经历: ${lagouWork}\n项目经历: ${lagouProject}\n期望岗位: ${lagouTargetRole}`
                              : `个人简介: ${zhilianSummary}\n工作经历: ${zhilianExperience}\n项目经历: ${zhilianProject}\n期望岗位: ${zhilianTargetRole}`;
                    const fields = result.optimizedFields ?? {};
                    const optimizedAdvantage = pickOptimizedField(fields, ["个人优势", "优势"]);
                    const optimizedExpectation = pickOptimizedField(fields, ["求职期望", "期望"]);
                    const optimizedWork = pickOptimizedField(fields, ["工作经历", "经历"]);
                    const optimizedProject = pickOptimizedField(fields, ["项目经历", "项目"]);
                    const platformAnalysis = result.analysis?.join("\n") ?? "";
                    const avatarAdvice = result.commonAdvice?.photoAdvice ?? "";
                    const consistencyCheck = result.commonAdvice?.consistencyCheck?.join("\n") ?? "";
                    const keywordAdvice = result.commonAdvice?.targetKeywords?.join("\n") ?? "";
                    const combinedMarkdown = `
### 个人优势
${optimizedAdvantage || ""}

### 求职期望
${optimizedExpectation || ""}

### 工作经历
${optimizedWork || ""}

### 项目经历
${optimizedProject || ""}

---

### 💡 平台优化分析
${platformAnalysis || ""}

### 📸 头像建议
${avatarAdvice || ""}

### 🔗 跨平台一致性检查
${consistencyCheck || ""}

### 🎯 目标岗位关键词建议
${keywordAdvice || ""}
`.trim();
                    const platformLabel = tabLabels.find((item) => item.id === platform)?.label || platform || "求职档案";
                    const createdDate = new Date().toISOString().slice(0, 10);
                    toastFetch(
                      "/api/notion",
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          resource: "resume",
                          action: "create",
                          type: "Profile",
                          title: `[${platformLabel}] 档案优化 - ${new Date().toISOString().substring(0, 10)}`,
                          version: `PROFILE-${createdDate}-${Date.now().toString().slice(-4)}`,
                          targetCompany: platformLabel,
                          targetJD: inputSummary,
                          beforeText: inputSummary,
                          afterText: combinedMarkdown,
                          aiSuggestions: [platformAnalysis, avatarAdvice, consistencyCheck, keywordAdvice].filter(Boolean).join("\n\n"),
                          createdDate,
                        }),
                      },
                      {
                        loading: "正在保存到 Notion 档案优化历史...",
                        success: "✅ 已保存到 Notion 档案优化历史",
                        error: (err) => `❌ 保存失败：${err.message}`,
                      },
                      () => {
                        setStatus("已保存到 Notion 档案优化历史。");
                        void loadHistory();
                      },
                    );
                    setSavingHistory(false);
                  }}
                  disabled={savingHistory}
                  className="rounded-md border border-violet-500/40 bg-violet-500/10 px-2 py-1 text-xs text-violet-100 disabled:opacity-50"
                >
                  {savingHistory ? "保存中..." : "保存到 Notion 历史"}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {Object.entries(result?.optimizedFields ?? {}).map(([key, value]) => (
                <div key={key} className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-2">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="text-xs text-zinc-400">{key}</p>
                    <button
                      type="button"
                      onClick={() => void copyText(value)}
                      className="rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-100"
                    >
                      一键复制
                    </button>
                  </div>
                  <div className="whitespace-pre-wrap break-words text-sm text-zinc-200">{value || "（空）"}</div>
                </div>
              ))}
              {Object.keys(result?.optimizedFields ?? {}).length === 0 ? (
                <p className="text-sm text-zinc-500">暂无优化结果。</p>
              ) : null}
            </div>
          </div>
          <ResultCard title="平台优化分析" items={result?.analysis ?? []} />
          <ResultCard title="头像建议" items={result?.commonAdvice ? [result.commonAdvice.photoAdvice] : []} />
          <ResultCard title="跨平台一致性检查" items={result?.commonAdvice?.consistencyCheck ?? []} />
          <ResultCard title="目标岗位关键词建议" items={result?.commonAdvice?.targetKeywords ?? []} />
        </div>
      </section>
      <section className="neon-card rounded-2xl p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-zinc-100">优化历史（Notion）</h2>
          <button
            type="button"
            onClick={() => void loadHistory()}
            disabled={loadingHistory}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 disabled:opacity-50"
          >
            刷新历史
          </button>
        </div>
        {loadingHistory ? (
          <p className="text-sm text-zinc-500">正在加载历史...</p>
        ) : historyRecords.length === 0 ? (
          <p className="text-sm text-zinc-500">暂无历史记录。</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {historyRecords.map((record) => (
              <div
                key={record.id}
                className="flex flex-col gap-2 rounded-xl border border-zinc-700/50 bg-zinc-800/40 p-4 transition-colors hover:border-violet-500/50"
              >
                <div className="flex items-start justify-between">
                  <h4 className="line-clamp-1 text-sm font-semibold text-violet-300">{record.title || "未命名记录"}</h4>
                  <span className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-500">{record.platform || "未知平台"}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-zinc-400">{record.content || "无内容"}</p>
                <div className="mt-3 flex items-center justify-between border-t border-zinc-700/50 pt-3">
                  <span className="text-xs text-zinc-500">
                    {record.createdAt ? record.createdAt.substring(0, 10) : "未知日期"}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      className="text-xs text-emerald-400 hover:text-emerald-300"
                      onClick={() => applyHistoryContentToCurrentForm(record)}
                    >
                      回填到当前表单
                    </button>
                    <button
                      className="text-xs text-blue-400 hover:text-blue-300"
                      onClick={() => setSelectedHistoryRecord(record)}
                    >
                      查看完整内容
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      {selectedHistoryRecord ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
          <div className="neon-card max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-2xl p-4">
            <div className="mb-3 flex items-start justify-between gap-2 border-b border-zinc-800 pb-3">
              <div>
                <p className="text-sm font-semibold text-zinc-100">{selectedHistoryRecord.title || "未命名记录"}</p>
                <p className="text-xs text-zinc-500">
                  {selectedHistoryRecord.platform || "未知平台"} ·{" "}
                  {selectedHistoryRecord.createdAt ? selectedHistoryRecord.createdAt.substring(0, 19).replace("T", " ") : "未知时间"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  applyHistoryContentToCurrentForm(selectedHistoryRecord);
                  setSelectedHistoryRecord(null);
                }}
                className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-100"
              >
                回填到当前表单
              </button>
              <button
                type="button"
                onClick={() => setSelectedHistoryRecord(null)}
                className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200"
              >
                关闭
              </button>
            </div>
            <div className="max-h-[68vh] overflow-auto rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
              <article className="prose prose-invert max-w-none text-xs leading-6 text-zinc-300 prose-headings:text-zinc-100 prose-strong:text-zinc-100 prose-li:text-zinc-300">
                <ReactMarkdown>{selectedHistoryRecord.content || "（空）"}</ReactMarkdown>
              </article>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function ResultCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="neon-card rounded-xl p-4">
      <h3 className="mb-2 text-sm font-semibold text-zinc-100">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">暂无内容。</p>
      ) : (
        <div className="space-y-2 text-sm text-zinc-300">
          {items.map((item, idx) => (
            <div key={idx} className="whitespace-pre-wrap break-words">
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

