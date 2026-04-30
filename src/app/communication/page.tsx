"use client";

import { useEffect, useState } from "react";
import LinkedinPage from "@/app/linkedin/page";
import NetworkingPage from "@/app/networking/page";
import { MergedPageTabs } from "@/components/MergedPageTabs";
import { PageGuide } from "@/components/PageGuide";
import { persistTab, readInitialTab } from "@/lib/tab-state";

const COMMUNICATION_TAB_KEY = "interview-os-communication-active-tab";

export default function CommunicationPage() {
  const [tab, setTab] = useState<"profile" | "scripts">("profile");
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("tab");
    const resolved = readInitialTab({
      queryParam: q,
      validTabs: ["profile", "scripts"],
      storageKey: COMMUNICATION_TAB_KEY,
      fallback: "profile",
    });
    setTab(resolved);
  }, []);

  const onChangeTab = (next: "profile" | "scripts") => {
    setTab(next);
    persistTab({
      next,
      storageKey: COMMUNICATION_TAB_KEY,
      queryParamName: "tab",
    });
  };

  return (
    <main className="flex w-full flex-col gap-4">
      <section className="neon-card rounded-2xl p-6">
        <h1 className="text-2xl font-semibold">求职沟通</h1>
        <p className="mt-2 text-sm text-zinc-400">优化各平台档案 + 生成高转化话术</p>
      </section>
      <MergedPageTabs
        tabs={[
          { id: "profile", label: "档案优化" },
          { id: "scripts", label: "话术生成" },
        ]}
        activeTab={tab}
        onChange={(next) => onChangeTab(next as "profile" | "scripts")}
      />
      <PageGuide pageKey="communication" items={["档案优化和话术生成已合并。", "Tab 切换不刷新页面。"]} />
      <div className={tab === "profile" ? "block" : "hidden"}>
        <LinkedinPage />
      </div>
      <div className={tab === "scripts" ? "block" : "hidden"}>
        <NetworkingPage />
      </div>
    </main>
  );
}
