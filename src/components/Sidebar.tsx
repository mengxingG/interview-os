"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type NavSection = {
  id: string;
  title: string;
  links: Array<{ href: string; label: string }>;
};

type SidebarProps = {
  className?: string;
  onNavigate?: () => void;
};

type SectionProgressHint = {
  phase1: { show: boolean; count: number };
  phase2: { show: boolean; count: number };
  phase3: { show: boolean; count: number };
  phase4: { show: boolean; count: number };
};

type SectionCollapseState = Record<string, boolean>;

const SIDEBAR_COLLAPSE_KEY = "sidebar:section-collapse";

const sections: NavSection[] = [
  {
    id: "overview",
    title: "📊 总览",
    links: [
      { href: "/", label: "仪表盘" },
    ],
  },
  {
    id: "phase1",
    title: "🎯 阶段一：资产沉淀",
    links: [
      { href: "/base-resumes", label: "简历底本管理" },
      { href: "/positioning", label: "求职定位" },
      { href: "/stories", label: "故事库" },
    ],
  },
  {
    id: "phase2",
    title: "📋 阶段二：精准投递",
    links: [
      { href: "/job-analysis", label: "岗位分析" },
      { href: "/resume", label: "简历优化" },
      { href: "/communication", label: "求职沟通" },
    ],
  },
  {
    id: "phase3",
    title: "🎤 阶段三：面试攻坚",
    links: [
      { href: "/question-bank", label: "面试题库\n日常刷题" },
      { href: "/train", label: "知识训练\n日常背诵" },
      { href: "/prep", label: "面试备战\n拿到真实 JD 后，生成万字战略报告" },
      { href: "/mock", label: "模拟面试\n面考前 1-2 天的实战演练" },
      { href: "/warm-up", label: "考前热身\n面试前 5 分钟的终极护身符" },
    ],
  },
  {
    id: "phase4",
    title: "📝 阶段四：复盘转化",
    links: [
      { href: "/debrief", label: "面试复盘" },
      { href: "/negotiation", label: "薪资谈判" },
      { href: "/progress", label: "成长进度" },
    ],
  },
];

export function Sidebar({ className = "", onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const [showGlobalGuide, setShowGlobalGuide] = useState(false);
  const [hints, setHints] = useState<SectionProgressHint>({
    phase1: { show: false, count: 0 },
    phase2: { show: false, count: 0 },
    phase3: { show: false, count: 0 },
    phase4: { show: false, count: 0 },
  });
  const [linkHints, setLinkHints] = useState<Record<string, string>>({});
  const [collapsed, setCollapsed] = useState<SectionCollapseState>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem(SIDEBAR_COLLAPSE_KEY);
      return raw ? (JSON.parse(raw) as SectionCollapseState) : {};
    } catch {
      return {};
    }
  });

  const isLinkActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));

  const activeSectionId =
    sections.find((section) => section.links.some((link) => isLinkActive(link.href)))?.id ?? "overview";

  useEffect(() => {
    // Default behavior: current section expanded, others collapsed; overview always expanded.
    setCollapsed((prev) => {
      const next: SectionCollapseState = {};
      sections.forEach((section) => {
        if (section.id === "overview") {
          next[section.id] = false;
          return;
        }
        if (Object.prototype.hasOwnProperty.call(prev, section.id)) {
          next[section.id] = prev[section.id];
          return;
        }
        next[section.id] = section.id !== activeSectionId;
      });
      next.overview = false;
      next[activeSectionId] = false;
      return next;
    });
  }, [activeSectionId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SIDEBAR_COLLAPSE_KEY, JSON.stringify(collapsed));
  }, [collapsed]);

  useEffect(() => {
    let mounted = true;
    async function loadHint() {
      try {
        const response = await fetch("/api/notion/progress");
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as {
          dashboard?: {
            stories?: number;
            practicedQuestions?: number;
            reviewedKnowledge?: number;
            jdDecoded?: number;
            mocks?: number;
            interviewRecords?: number;
            debriefCount?: number;
          };
        };
        const dashboard = payload.dashboard ?? {};
        if (mounted) {
          const nextLinkHints: Record<string, string> = {};
          if ((dashboard.stories ?? 0) < 5) nextLinkHints["/stories"] = "故事<5";
          if ((dashboard.practicedQuestions ?? 0) === 0) nextLinkHints["/question-bank"] = "题库未练习";
          if ((dashboard.reviewedKnowledge ?? 0) === 0) nextLinkHints["/train"] = "知识未复习";
          if ((dashboard.jdDecoded ?? 0) === 0) nextLinkHints["/job-analysis"] = "JD未解码";
          if ((dashboard.mocks ?? 0) === 0) nextLinkHints["/mock"] = "模拟面试=0";
          if ((dashboard.interviewRecords ?? 0) > 0 && (dashboard.debriefCount ?? 0) === 0) {
            nextLinkHints["/debrief"] = "未复盘";
          }
          setLinkHints(nextLinkHints);

          const phase1Count = ["/stories"].filter((href) => nextLinkHints[href]).length;
          const phase2Count = ["/job-analysis"].filter((href) => nextLinkHints[href]).length;
          const phase3Count = ["/question-bank", "/train", "/mock", "/warm-up"].filter((href) => nextLinkHints[href]).length;
          const phase4Count = ["/debrief"].filter((href) => nextLinkHints[href]).length;
          setHints({
            phase1: {
              show: phase1Count > 0,
              count: phase1Count,
            },
            phase2: {
              show: phase2Count > 0,
              count: phase2Count,
            },
            phase3: {
              show: phase3Count > 0,
              count: phase3Count,
            },
            phase4: {
              show: phase4Count > 0,
              count: phase4Count,
            },
          });
        }
      } catch {
        // Keep all hints false if progress API is unavailable.
      }
    }
    loadHint();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <aside className={`neon-card h-full w-full overflow-y-auto rounded-2xl p-4 ${className}`}>
      <div className="mb-6 rounded-xl border border-violet-400/30 bg-violet-500/10 px-3 py-2">
        <p className="text-xs uppercase tracking-[0.2em] text-violet-300">Interview OS</p>
        <p className="mt-1 text-sm text-zinc-300">Vibe Coding cockpit</p>
      </div>
      <nav className="flex flex-col gap-4 text-sm">
        {sections.map((section) => {
          const active = section.links.some((link) => isLinkActive(link.href));
          const showHint =
            section.id === "phase1"
              ? hints.phase1.show
              : section.id === "phase2"
                ? hints.phase2.show
                : section.id === "phase3"
                  ? hints.phase3.show
                  : section.id === "phase4"
                    ? hints.phase4.show
                    : false;
          const pendingCount =
            section.id === "phase1"
              ? hints.phase1.count
              : section.id === "phase2"
                ? hints.phase2.count
                : section.id === "phase3"
                  ? hints.phase3.count
                  : section.id === "phase4"
                    ? hints.phase4.count
                    : 0;
          const isOverview = section.id === "overview";
          const isCollapsed = isOverview ? false : Boolean(collapsed[section.id]);
          return (
            <div key={section.id} className="border-b border-zinc-800/80 pb-3 last:border-b-0">
              <button
                type="button"
                onClick={() => {
                  if (isOverview) return;
                  setCollapsed((prev) => ({ ...prev, [section.id]: !isCollapsed }));
                }}
                className="mb-2 flex w-full items-center gap-2 text-left text-xs text-blue-300"
              >
                <span className="inline-block w-4 text-zinc-500">{isOverview ? " " : isCollapsed ? "▸" : "▾"}</span>
                <span>{section.title}</span>
                {showHint ? (
                  <>
                    <span className="h-2 w-2 rounded-full bg-rose-400" title="该阶段有未完成任务" />
                    <span className="text-[11px] text-rose-300">待完成 {pendingCount} 项</span>
                  </>
                ) : null}
                {active ? <span className="text-violet-300">●</span> : null}
              </button>
              <div className={`${isCollapsed ? "hidden" : "flex"} flex-col gap-1.5`}>
                {section.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={onNavigate}
                    className={`rounded-xl border px-3 py-1.5 transition ${
                      isLinkActive(link.href)
                        ? "border-violet-400/60 bg-violet-500/20 text-violet-100 shadow-[0_0_24px_rgba(139,92,246,0.35)]"
                        : "border-transparent text-zinc-400 hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-zinc-100"
                    }`}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="block min-w-0 leading-snug">
                        <span className="block text-sm">{link.label.split("\n")[0] ?? link.label}</span>
                        {link.label.includes("\n") ? (
                          <span className="mt-0.5 block text-[11px] text-violet-300/80">
                            {link.label.split("\n")[1]}
                          </span>
                        ) : null}
                      </span>
                      {linkHints[link.href] ? (
                        <span
                          className="shrink-0 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-300"
                          title={linkHints[link.href]}
                        >
                          {linkHints[link.href]}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </nav>
      <button
        type="button"
        onClick={() => setShowGlobalGuide(true)}
        className="mt-4 w-full rounded-xl border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-300 transition hover:border-violet-400/40 hover:text-zinc-100"
      >
        ❓ 使用指南
      </button>

      {showGlobalGuide ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="neon-card w-full max-w-2xl rounded-2xl p-5">
            <h2 className="text-xl font-semibold text-zinc-100">Interview OS 四阶段工作流</h2>
            <div className="mt-3 space-y-3 text-sm text-zinc-300">
              <p>- 阶段一（资产沉淀）：先明确求职定位，沉淀简历底本与故事库，打好长期资产基础。</p>
              <p>- 阶段二（精准投递）：围绕目标岗位做岗位分析、简历优化与求职沟通，提高投递命中率。</p>
              <p>- 阶段三（面试攻坚）：结合题库、知识训练、Prep、模拟面试与考前热身，集中补齐面试短板。</p>
              <p>- 阶段四（复盘转化）：及时复盘、推进谈薪，并在成长进度中沉淀可复用经验。</p>
            </div>
            <div className="mt-4 flex justify-end">
              <Link
                href="/stories"
                onClick={() => setShowGlobalGuide(false)}
                className="mr-2 rounded-lg border border-violet-500/45 bg-violet-500/15 px-3 py-2 text-sm text-violet-100 transition hover:bg-violet-500/25"
              >
                立即开始第一步
              </Link>
              <button
                type="button"
                onClick={() => setShowGlobalGuide(false)}
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 transition hover:border-zinc-500"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
