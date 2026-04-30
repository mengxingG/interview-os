/* eslint-disable @next/next/no-html-link-for-pages */
"use client";

import { useEffect, useState } from "react";
import { DashboardCommandCenter } from "@/components/DashboardCommandCenter";
import { HistoryCenterPanel } from "@/components/HistoryCenterPanel";
import { InterviewSchedulePanel } from "@/components/InterviewSchedulePanel";
import { MergedPageTabs } from "@/components/MergedPageTabs";
import { PageGuide } from "@/components/PageGuide";
import { persistTab, readInitialTab } from "@/lib/tab-state";

const DASHBOARD_TAB_KEY = "interview-os-dashboard-active-tab";

export default function Home() {
  const [tab, setTab] = useState<"command" | "history" | "schedule">("command");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("tab");
    const resolved = readInitialTab({
      queryParam: q,
      validTabs: ["command", "history", "schedule"],
      storageKey: DASHBOARD_TAB_KEY,
      fallback: "command",
    });
    setTab(resolved);
  }, []);

  const onChangeTab = (next: "command" | "history" | "schedule") => {
    setTab(next);
    persistTab({
      next,
      storageKey: DASHBOARD_TAB_KEY,
      clearQueryWhen: "command",
      queryParamName: "tab",
    });
  };

  return (
    <main className="flex w-full flex-col gap-4">
      <section className="neon-card rounded-3xl p-6 md:p-8">
        <p className="mb-2 text-xs uppercase tracking-[0.3em] text-violet-300">4 年经验 AI 产品经理（AI PM）</p>
        <h1 className="neon-text text-3xl font-semibold tracking-tight md:text-4xl">
          Interview OS 作战中枢
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-300">
          你的求职作战地图。一眼看到当前进度、薄弱环节和下一步行动。
        </p>
      </section>
      <MergedPageTabs
        tabs={[
          { id: "command", label: "作战中枢（默认）" },
          { id: "history", label: "历史记录" },
          { id: "schedule", label: "面试日程" },
        ]}
        activeTab={tab}
        onChange={(next) => onChangeTab(next as "command" | "history" | "schedule")}
      />
      <PageGuide
        pageKey="dashboard"
        items={
          tab === "command"
            ? [
                "所有数据自动从各模块聚合，不需要手动操作。",
                "重点关注行动建议，按优先级逐项清空。",
                "建议每天至少完成：5道题库练习 + 1轮知识复习 + 1次模拟面试。",
              ]
            : tab === "history"
              ? [
                  "历史记录用于回看各模块沉淀内容，优先筛选最近 7 天重点复盘。",
                  "遇到高质量输出，建议回填到当前模块继续迭代，而不是重复新建。",
                  "按模块查看最近活跃度，快速发现长期未更新的薄弱项。",
                ]
              : [
                  "面试日程用于统一管理公司/岗位/时间节点，避免冲突和遗漏。",
                  "每场面试建议提前 24 小时生成 Prep，并在当天使用热身简报复盘。",
                  "面试结束后及时补录结果，便于后续复盘和节奏追踪。",
                ]
        }
      />
      <div className={tab === "command" ? "block" : "hidden"}>
        <DashboardCommandCenter />
      </div>
      <div className={tab === "history" ? "block" : "hidden"}>
        <HistoryCenterPanel />
      </div>
      <div className={tab === "schedule" ? "block" : "hidden"}>
        <InterviewSchedulePanel />
      </div>
      <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 text-sm text-zinc-400">
        需要帮助？点击左侧菜单「❓ 使用指南」查看完整流程。
      </section>
    </main>
  );
}
