"use client";

import { useMemo, useState } from "react";
import {
  GLOSSARY_CATEGORIES,
  QUESTION_BANK_GLOSSARY,
  type GlossaryTerm,
} from "@/lib/question-bank-glossary";

type Props = {
  questionCount?: number;
};

export function QuestionBankGlossaryPanel({ questionCount }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof GLOSSARY_CATEGORIES)[number]>("全部");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return QUESTION_BANK_GLOSSARY.filter((item) => {
      if (category !== "全部" && item.category !== category) return false;
      if (!q) return true;
      const haystack = `${item.term} ${item.english ?? ""} ${item.definition}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [query, category]);

  return (
    <div className="neon-card rounded-2xl p-4">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-zinc-100">术语速查</h2>
        <p className="mt-1 text-sm text-zinc-400">
          题库里高频出现的 AI / PM 术语。看面试题或考察点时遇到不熟的，回这里对一下。
        </p>
      </div>

      <div className="relative">
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索术语，如 RAG、Agent、北极星指标..."
          className="w-full rounded-2xl border border-zinc-700 bg-zinc-900 py-3 pl-10 pr-4 text-sm text-zinc-100 placeholder:text-zinc-500"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {GLOSSARY_CATEGORIES.map((item) => {
          const active = category === item;
          return (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              className={`rounded-full px-3 py-1.5 text-xs transition ${
                active
                  ? "bg-zinc-100 font-medium text-zinc-900"
                  : "border border-zinc-700 bg-zinc-900/70 text-zinc-300 hover:border-zinc-500"
              }`}
            >
              {item}
              {item === "全部" ? ` ${QUESTION_BANK_GLOSSARY.length}` : ""}
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-sm text-zinc-400">共 {filtered.length} 个术语</p>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {filtered.map((item) => (
          <GlossaryCard key={`${item.term}-${item.english ?? ""}`} item={item} />
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-zinc-700 bg-zinc-950/40 p-8 text-center text-sm text-zinc-400">
          没有匹配的术语，试试换个关键词。
        </div>
      ) : null}

      <p className="mt-6 text-xs leading-5 text-zinc-500">
        术语覆盖 AI 技术、产品方法与常见工具平台
        {typeof questionCount === "number" ? `；当前题库约 ${questionCount} 道题` : ""}
        。后续可按面经继续扩充。
      </p>
    </div>
  );
}

function GlossaryCard({ item }: { item: GlossaryTerm }) {
  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-100">{item.term}</h3>
        {item.english ? <span className="text-xs text-zinc-500">{item.english}</span> : null}
      </div>
      <p className="mt-2 text-sm leading-6 text-zinc-300">{item.definition}</p>
      <p className="mt-3 text-[11px] text-zinc-500">{item.category}</p>
    </article>
  );
}
