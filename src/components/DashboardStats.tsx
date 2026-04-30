"use client";

import { useEffect, useState } from "react";

type DashboardPayload = {
  dashboard: {
    stories: number;
    jd: number;
    mocks: number;
    knowledgeMastery: number;
  };
};

const fallback = {
  stories: 0,
  jd: 0,
  mocks: 0,
  knowledgeMastery: 0,
};

export function DashboardStats() {
  const [stats, setStats] = useState(fallback);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const response = await fetch("/api/notion/progress");
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as DashboardPayload;
        if (mounted && payload.dashboard) {
          setStats(payload.dashboard);
        }
      } catch {
        // Keep fallback values silently.
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="neon-card rounded-xl p-4">
        <p className="text-xs text-zinc-500">故事数量</p>
        <p className="mt-2 text-2xl font-semibold text-violet-200">{stats.stories}</p>
      </div>
      <div className="neon-card rounded-xl p-4">
        <p className="text-xs text-zinc-500">JD 解码数量</p>
        <p className="mt-2 text-2xl font-semibold text-cyan-200">{stats.jd}</p>
      </div>
      <div className="neon-card rounded-xl p-4">
        <p className="text-xs text-zinc-500">模拟面试次数</p>
        <p className="mt-2 text-2xl font-semibold text-fuchsia-200">{stats.mocks}</p>
      </div>
      <div className="neon-card rounded-xl p-4">
        <p className="text-xs text-zinc-500">知识掌握度</p>
        <p className="mt-2 text-2xl font-semibold text-emerald-200">{stats.knowledgeMastery}/5</p>
      </div>
    </section>
  );
}
