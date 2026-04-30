"use client";

import { useEffect, useState } from "react";

type PageGuideProps = {
  pageKey: string;
  title?: string;
  items: string[];
};

export function PageGuide({ pageKey, title = "📖 使用指南", items }: PageGuideProps) {
  const storageKey = `interview-os-guide-open:${pageKey}`;
  const [open, setOpen] = useState(true);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved === null) return;
      setOpen(saved === "1");
    } catch {
      // ignore storage failures
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, open ? "1" : "0");
    } catch {
      // ignore storage failures
    }
  }, [open, storageKey]);

  return (
    <section className="neon-card rounded-2xl p-4">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-left text-sm text-zinc-200 transition hover:border-violet-400/40"
      >
        <span>{title}</span>
        <span className="text-zinc-500">{open ? "收起" : "展开"}</span>
      </button>
      {open ? (
        <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
          <ul className="space-y-2 text-sm text-zinc-300">
            {items.map((item, index) => (
              <li key={`${pageKey}-${index}`}>- {item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
