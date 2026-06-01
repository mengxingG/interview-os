"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PageGuide } from "@/components/PageGuide";
import { ModelSelect } from "@/components/ModelSelect";
import type { ModelType } from "@/lib/llm";
import { readModelSelection, writeModelSelection } from "@/lib/model-selection";
import { userProfile } from "@/lib/user-profile";

type NetworkingResult = {
  versions: Array<{
    style: string;
    message: string;
  }>;
};

const scenes = [
  "BOSS直聘打招呼话术",
  "BOSS直聘自动回复模板",
  "猎聘主动沟通话术",
  "LinkedIn Cold Message",
  "内推请求话术",
  "Coffee Chat 约聊话术",
  "面试邀约确认回复",
  "面试后感谢跟进",
  "薪资沟通话术",
] as const;
const NETWORKING_HISTORY_KEY = "interview-os-networking-history";
const NETWORKING_DRAFT_KEY = "interview-os-networking-draft";
const DECODE_DRAFT_KEY = "interview-os-decode-draft";
const JD_HISTORY_KEY = "interview-os-jd-history";
const WORD_RANGE = { min: 50, max: 120 };
type JdRecordOption = {
  id: string;
  title?: string;
  company?: string;
  role?: string;
  jdText?: string;
};

function countMessageWords(text: string) {
  const englishWords = (text.match(/[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)*/g) || []).length;
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  return englishWords + chineseChars;
}

function extractCompanyFromJd(jdText: string) {
  const text = jdText.trim();
  if (!text) return "";
  const knownCompanies = ["字节跳动", "阿里巴巴", "腾讯", "美团", "京东", "百度", "小红书", "拼多多", "快手", "滴滴", "蚂蚁集团"];
  const known = knownCompanies.find((name) => text.includes(name));
  if (known) return known;
  const cnMatch = text.match(/([A-Za-z0-9\u4e00-\u9fa5]{2,20}(?:集团|公司|科技|网络|信息|控股))/);
  if (cnMatch?.[1]) return cnMatch[1];
  return "";
}

function extractContactRoleFromJd(jdText: string) {
  const roleMatch = jdText.match(/(招聘经理|HRBP|HR|Hiring Manager|技术面试官|业务面试官)/i);
  return roleMatch?.[1] ?? "";
}

const sceneLengthGuides: Record<(typeof scenes)[number], { min: number; max: number; hint: string }> = {
  BOSS直聘打招呼话术: {
    min: 80,
    max: 150,
    hint: "前 30 字给岗位关键词 + 价值信号，整体尽量控制在 120 字内。",
  },
  BOSS直聘自动回复模板: {
    min: 100,
    max: 180,
    hint: "先回应 HR 重点问题，再给下一步行动建议。",
  },
  猎聘主动沟通话术: {
    min: 120,
    max: 220,
    hint: "强调行业匹配和可量化成果，保持专业但不冗长。",
  },
  "LinkedIn Cold Message": {
    min: 120,
    max: 260,
    hint: "价值主张清晰，避免模板感，收尾给轻量行动请求。",
  },
  内推请求话术: {
    min: 150,
    max: 260,
    hint: "说明匹配理由与请求边界，减少对方决策成本。",
  },
  "Coffee Chat 约聊话术": {
    min: 120,
    max: 220,
    hint: "表达尊重与具体问题，控制在易读长度。",
  },
  面试邀约确认回复: {
    min: 80,
    max: 160,
    hint: "确认时间信息 + 礼貌致谢，简洁明确。",
  },
  面试后感谢跟进: {
    min: 120,
    max: 220,
    hint: "感谢 + 回扣面试讨论点 + 价值补充。",
  },
  薪资沟通话术: {
    min: 120,
    max: 240,
    hint: "先对齐价值，再谈区间与灵活项。",
  },
};

export default function NetworkingPage() {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (pathname === "/networking") {
      router.replace("/communication?tab=scripts");
    }
  }, [pathname, router]);

  const [initialDraft] = useState(() => {
    if (typeof window === "undefined") return null as null | { scene?: (typeof scenes)[number]; language?: "zh" | "en"; form?: Record<string, string> };
    try {
      const raw = window.localStorage.getItem(NETWORKING_DRAFT_KEY);
      return raw ? (JSON.parse(raw) as { scene?: (typeof scenes)[number]; language?: "zh" | "en"; form?: Record<string, string> }) : null;
    } catch {
      return null;
    }
  });
  const [scene, setScene] = useState<(typeof scenes)[number]>(initialDraft?.scene && scenes.includes(initialDraft.scene) ? initialDraft.scene : "BOSS直聘打招呼话术");
  const [language, setLanguage] = useState<"zh" | "en">(initialDraft?.language ?? "zh");
  const [form, setForm] = useState({
    targetRole: initialDraft?.form?.targetRole || userProfile.profile.targetRole,
    targetCompany: initialDraft?.form?.targetCompany || "",
    coreAdvantage: initialDraft?.form?.coreAdvantage || userProfile.resumeAnalysis.positioningAdvantages,
    contactName: initialDraft?.form?.contactName || "",
    contactRole: initialDraft?.form?.contactRole || "",
    company: initialDraft?.form?.company || "",
    connectionPoint: initialDraft?.form?.connectionPoint || "",
    extraContext: initialDraft?.form?.extraContext || "",
  });
  const [result, setResult] = useState<NetworkingResult | null>(null);
  const [modelType, setModelType] = useState<ModelType>(() => readModelSelection("networking", "fast"));
  useEffect(() => {
    writeModelSelection("networking", modelType);
  }, [modelType]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      NETWORKING_DRAFT_KEY,
      JSON.stringify({
        scene,
        language,
        form,
        savedAt: new Date().toISOString(),
      }),
    );
  }, [scene, language, form]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (form.targetCompany.trim() || form.contactName.trim() || form.contactRole.trim()) return;
    try {
      const decodeRaw = window.localStorage.getItem(DECODE_DRAFT_KEY);
      const jdHistoryRaw = window.localStorage.getItem(JD_HISTORY_KEY);
      const latestJd =
        (decodeRaw ? (JSON.parse(decodeRaw) as { jdText?: string })?.jdText : "") ||
        ((jdHistoryRaw ? (JSON.parse(jdHistoryRaw) as Array<{ jdText?: string }>) : [])[0]?.jdText ?? "");
      if (!latestJd?.trim()) return;
      setForm((prev) => ({
        ...prev,
        targetCompany: prev.targetCompany || extractCompanyFromJd(latestJd),
        contactName: prev.contactName || "招聘团队",
        contactRole: prev.contactRole || extractContactRoleFromJd(latestJd) || "招聘经理",
      }));
    } catch {
      // Ignore corrupted local storage.
    }
  }, [form.contactName, form.contactRole, form.targetCompany]);
  const [status, setStatus] = useState("等待生成话术");
  const [loading, setLoading] = useState(false);
  const [compressingIndex, setCompressingIndex] = useState<number | null>(null);
  const [jdOptions, setJdOptions] = useState<JdRecordOption[]>([]);
  const [selectedJdId, setSelectedJdId] = useState("");
  const [loadingJdOptions, setLoadingJdOptions] = useState(false);

  const isBossScene = scene.includes("BOSS直聘");
  const sceneGuide = sceneLengthGuides[scene];

  const loadJdOptions = async () => {
    setLoadingJdOptions(true);
    try {
      const response = await fetch("/api/notion?resource=jd", { cache: "no-store" });
      const payload = (await response.json()) as { records?: JdRecordOption[]; error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "加载 JD 列表失败");
      }
      setJdOptions(payload.records ?? []);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "加载 JD 列表失败");
    } finally {
      setLoadingJdOptions(false);
    }
  };

  useEffect(() => {
    void loadJdOptions();
  }, []);

  const onGenerate = async () => {
    if (!form.targetRole.trim() || !form.targetCompany.trim() || !form.coreAdvantage.trim()) {
      setStatus("请先填写目标岗位、目标公司、核心优势。");
      return;
    }
    setLoading(true);
    setStatus(modelType === "pro" ? "正在使用 Gemini Pro 深度生成（约 10-30 秒）..." : "正在生成人脉拓展话术...");
    try {
      const response = await fetch("/api/networking/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scene, language, ...form, modelType }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = (await response.json()) as { result?: NetworkingResult };
      if (!payload.result?.versions) {
        throw new Error("Missing versions");
      }
      setResult(payload.result);
      try {
        const prev = JSON.parse(window.localStorage.getItem(NETWORKING_HISTORY_KEY) || "[]") as Array<{
          scene?: string;
          ts?: string;
        }>;
        const next = [
          {
            scene,
            ts: new Date().toISOString(),
          },
          ...prev,
        ].slice(0, 100);
        window.localStorage.setItem(NETWORKING_HISTORY_KEY, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      setStatus("话术生成完成。");
    } catch {
      setStatus("生成失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  };

  const onCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setStatus("已复制到剪贴板。");
  };

  const clearDraft = () => {
    setScene("BOSS直聘打招呼话术");
    setLanguage("zh");
    setForm({
      targetRole: userProfile.profile.targetRole,
      targetCompany: "",
      coreAdvantage: userProfile.resumeAnalysis.positioningAdvantages,
      contactName: "",
      contactRole: "",
      company: "",
      connectionPoint: "",
      extraContext: "",
    });
    setResult(null);
    setStatus("已清空求职话术草稿。");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(NETWORKING_DRAFT_KEY);
    }
  };

  return (
    <main className="flex w-full flex-col gap-4">
      <section className="neon-card rounded-2xl p-6">
        <h1 className="text-2xl font-semibold">求职话术生成器</h1>
        <p className="mt-2 text-sm text-zinc-400">
          覆盖 BOSS/猎聘/LinkedIn/内推/面试沟通等关键场景，生成可直接发送的话术模板。
        </p>
        <p className="mt-2 text-xs text-amber-300">
          建议字数区间：{WORD_RANGE.min}-{WORD_RANGE.max} 字。{sceneGuide.hint}
        </p>
      </section>
      <PageGuide
        pageKey="networking"
        items={[
          "先选场景，再填写目标岗位、目标公司、核心优势（默认已从用户画像填充）。",
          "BOSS 场景重点在前 30 字，建议先给岗位关键词和价值信号。",
          "猎聘场景更偏专业化，需强调行业匹配与业务成果。",
          "每次会生成多风格版本，点击“一键复制”即可直接发送。",
        ]}
      />
      <section className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        <div className="neon-card rounded-2xl p-4">
          <h2 className="mb-3 text-lg font-medium text-zinc-100">输入信息</h2>
          <div className="mb-3 flex items-center gap-2">
            <select
              value={selectedJdId}
              onChange={(event) => {
                const jdId = event.target.value;
                setSelectedJdId(jdId);
                if (!jdId) return;
                const selected = jdOptions.find((item) => item.id === jdId);
                if (!selected) return;
                const sourceJd = selected.jdText || "";
                setForm((prev) => ({
                  ...prev,
                  targetCompany: selected.company || extractCompanyFromJd(sourceJd) || prev.targetCompany,
                  targetRole: selected.role || prev.targetRole,
                  contactName: prev.contactName || "招聘团队",
                  contactRole: extractContactRoleFromJd(sourceJd) || prev.contactRole || "招聘经理",
                }));
                setStatus(`已从 Notion JD 导入：${selected.title || selected.company || "未命名 JD"}`);
              }}
              className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
            >
              <option value="">从 Notion JD 记录导入</option>
              {jdOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title || `${item.company || "未知公司"}${item.role ? ` - ${item.role}` : ""}`}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void loadJdOptions()}
              disabled={loadingJdOptions}
              className="shrink-0 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
            >
              {loadingJdOptions ? "刷新中..." : "刷新 JD 列表"}
            </button>
          </div>
          <div className="grid gap-2">
            <p className="text-xs text-zinc-500">场景</p>
            <select
              value={scene}
              onChange={(event) => setScene(event.target.value as (typeof scenes)[number])}
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            >
              {scenes.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <p className="text-xs text-zinc-500">语言</p>
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value as "zh" | "en")}
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            >
              <option value="zh">中文</option>
              <option value="en">英文</option>
            </select>
            <p className="text-xs text-zinc-500">目标岗位</p>
            <input
              value={form.targetRole}
              onChange={(event) => setForm((prev) => ({ ...prev, targetRole: event.target.value }))}
              placeholder="目标岗位"
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            />
            <p className="text-xs text-zinc-500">目标公司</p>
            <input
              value={form.targetCompany}
              onChange={(event) => setForm((prev) => ({ ...prev, targetCompany: event.target.value }))}
              placeholder="目标公司"
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            />
            <p className="text-xs text-zinc-500">我的核心优势</p>
            <textarea
              value={form.coreAdvantage}
              onChange={(event) => setForm((prev) => ({ ...prev, coreAdvantage: event.target.value }))}
              placeholder="我的核心优势"
              className="min-h-24 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            />
            <p className="text-xs text-zinc-500">对方姓名</p>
            <input
              value={form.contactName}
              onChange={(event) => setForm((prev) => ({ ...prev, contactName: event.target.value }))}
              placeholder="对方姓名"
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            />
            <p className="text-xs text-zinc-500">对方职位</p>
            <input
              value={form.contactRole}
              onChange={(event) => setForm((prev) => ({ ...prev, contactRole: event.target.value }))}
              placeholder="对方职位"
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            />
            <p className="text-xs text-zinc-500">对方公司</p>
            <input
              value={form.company}
              onChange={(event) => setForm((prev) => ({ ...prev, company: event.target.value }))}
              placeholder="对方公司"
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            />
            <p className="text-xs text-zinc-500">连接点</p>
            <textarea
              value={form.connectionPoint}
              onChange={(event) => setForm((prev) => ({ ...prev, connectionPoint: event.target.value }))}
              placeholder="你和对方的连接点（共同背景/共同项目/共同校友）"
              className="min-h-20 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            />
            <p className="text-xs text-zinc-500">补充信息（可选）</p>
            <textarea
              value={form.extraContext}
              onChange={(event) => setForm((prev) => ({ ...prev, extraContext: event.target.value }))}
              placeholder="例如：JD关键词、你们的共同背景、对方发布的职位亮点"
              className="min-h-16 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            />
            <ModelSelect
              value={modelType}
              onChange={setModelType}
              storageKey="networking"
              recommended="fast"
              label="大模型"
              selectClassName="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={onGenerate}
              disabled={loading}
              className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100 transition hover:bg-cyan-500/20 disabled:opacity-50"
            >
              {loading ? "生成中..." : "生成话术"}
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

        <div className="grid gap-3">
          {(result?.versions ?? []).map((version, idx) => (
            <div key={idx} className="neon-card rounded-xl p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-100">{version.style}</h3>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs ${
                      countMessageWords(version.message) > WORD_RANGE.max || countMessageWords(version.message) < WORD_RANGE.min
                        ? "text-rose-300"
                        : "text-emerald-300"
                    }`}
                  >
                    {countMessageWords(version.message)} words（建议 {WORD_RANGE.min}-{WORD_RANGE.max}）
                  </span>
                  <button
                    type="button"
                    onClick={() => onCopy(version.message)}
                    className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 transition hover:border-zinc-500"
                  >
                    一键复制
                  </button>
                </div>
              </div>
              <p className="whitespace-pre-wrap text-sm text-zinc-300">{version.message}</p>
              {version.message.length > WORD_RANGE.max ? (
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      setCompressingIndex(idx);
                      try {
                        const response = await fetch("/api/networking/generate", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            scene,
                            language,
                            ...form,
                            baseMessage: version.message,
                            maxChars: WORD_RANGE.max,
                            modelType,
                          }),
                        });
                        if (!response.ok) throw new Error("compress failed");
                        const payload = (await response.json()) as { result?: NetworkingResult };
                        const compressed = payload.result?.versions?.[0]?.message?.trim();
                        if (!compressed) throw new Error("empty result");
                        setResult((prev) => {
                          if (!prev) return prev;
                          const next = [...prev.versions];
                          next[idx] = { ...next[idx], message: compressed };
                          return { ...prev, versions: next };
                        });
                        setStatus(`已生成 ${WORD_RANGE.max} 字内精简版。`);
                      } catch {
                        setStatus("精简失败，请稍后重试。");
                      } finally {
                        setCompressingIndex(null);
                      }
                    }}
                    disabled={compressingIndex === idx}
                    className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-100 disabled:opacity-50"
                  >
                    {compressingIndex === idx ? "压缩中..." : `自动压缩到${WORD_RANGE.max}字`}
                  </button>
                  <span className="text-xs text-rose-300">当前超出 {version.message.length - WORD_RANGE.max} 字</span>
                </div>
              ) : null}
              {version.message.length < WORD_RANGE.min ? (
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      setCompressingIndex(idx);
                      try {
                        const response = await fetch("/api/networking/generate", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            scene,
                            language,
                            ...form,
                            baseMessage: version.message,
                            minChars: WORD_RANGE.min,
                            maxChars: WORD_RANGE.max,
                            rewriteMode: "expand",
                            modelType,
                          }),
                        });
                        if (!response.ok) throw new Error("expand failed");
                        const payload = (await response.json()) as { result?: NetworkingResult };
                        const expanded = payload.result?.versions?.[0]?.message?.trim();
                        if (!expanded) throw new Error("empty result");
                        setResult((prev) => {
                          if (!prev) return prev;
                          const next = [...prev.versions];
                          next[idx] = { ...next[idx], message: expanded };
                          return { ...prev, versions: next };
                        });
                        setStatus("已扩展到建议字数区间。");
                      } catch {
                        setStatus("扩展失败，请稍后重试。");
                      } finally {
                        setCompressingIndex(null);
                      }
                    }}
                    disabled={compressingIndex === idx}
                    className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-100 disabled:opacity-50"
                  >
                    {compressingIndex === idx ? "扩展中..." : `自动扩展到${WORD_RANGE.min}-${WORD_RANGE.max}字`}
                  </button>
                  <span className="text-xs text-amber-300">当前低于建议下限 {WORD_RANGE.min - version.message.length} 字</span>
                </div>
              ) : null}
            </div>
          ))}
          {!result ? (
            <div className="neon-card rounded-xl p-4 text-sm text-zinc-500">
              生成后将在此显示 2-3 个不同风格版本。
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
