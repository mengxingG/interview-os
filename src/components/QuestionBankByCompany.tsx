"use client";

import { useEffect, useMemo, useState } from "react";

export type CompanyQuestionRow = {
  id: string;
  title: string;
  category: string;
  company: string;
  round?: string;
  tags: string[];
};

type Props = {
  rows: CompanyQuestionRow[];
  focusCompany?: string;
  onSelectQuestion?: (row: CompanyQuestionRow) => void;
};

const UNLABELED_ROUND = "未标注轮次";

export function isMustDoQuestion(tags: string[]) {
  return tags.some((tag) => tag.trim() === "高频");
}

type RoundGroup = {
  name: string;
  questions: CompanyQuestionRow[];
};

type CompanyCard = {
  company: string;
  questionCount: number;
  roundCount: number;
  dimensions: string[];
  rounds: RoundGroup[];
  mustDoCount: number;
};

function buildCompanyCards(rows: CompanyQuestionRow[]): CompanyCard[] {
  const byCompany = new Map<string, CompanyQuestionRow[]>();
  for (const row of rows) {
    const company = row.company.trim();
    if (!company) continue;
    const list = byCompany.get(company) ?? [];
    list.push(row);
    byCompany.set(company, list);
  }

  const cards: CompanyCard[] = [];
  for (const [company, questions] of byCompany) {
    const roundMap = new Map<string, CompanyQuestionRow[]>();
    for (const q of questions) {
      const round = (q.round ?? "").trim() || UNLABELED_ROUND;
      const list = roundMap.get(round) ?? [];
      list.push(q);
      roundMap.set(round, list);
    }

    const sortQuestions = (list: CompanyQuestionRow[]) =>
      [...list].sort((a, b) => {
        const am = isMustDoQuestion(a.tags) ? 0 : 1;
        const bm = isMustDoQuestion(b.tags) ? 0 : 1;
        return am - bm || a.title.localeCompare(b.title, "zh");
      });

    const labeledRounds = Array.from(roundMap.entries())
      .filter(([name]) => name !== UNLABELED_ROUND)
      .sort(([a], [b]) => a.localeCompare(b, "zh"))
      .map(([name, list]) => ({ name, questions: sortQuestions(list) }));

    const unlabeled = roundMap.get(UNLABELED_ROUND);
    const rounds: RoundGroup[] = [...labeledRounds];
    if (unlabeled?.length) {
      rounds.push({
        name: labeledRounds.length > 0 ? UNLABELED_ROUND : "全部题目",
        questions: sortQuestions(unlabeled),
      });
    }

    const dimensionSet = new Set<string>();
    for (const q of questions) {
      const cat = q.category.trim();
      if (cat) dimensionSet.add(cat);
    }

    cards.push({
      company,
      questionCount: questions.length,
      roundCount: labeledRounds.length,
      dimensions: Array.from(dimensionSet).sort((a, b) => a.localeCompare(b, "zh")),
      rounds,
      mustDoCount: questions.filter((q) => isMustDoQuestion(q.tags)).length,
    });
  }

  cards.sort(
    (a, b) =>
      b.questionCount - a.questionCount || a.company.localeCompare(b.company, "zh"),
  );
  return cards;
}

export function QuestionBankByCompany({ rows, focusCompany, onSelectQuestion }: Props) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const cards = useMemo(() => buildCompanyCards(rows), [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter((card) => {
      if (card.company.toLowerCase().includes(q)) return true;
      if (card.dimensions.some((d) => d.toLowerCase().includes(q))) return true;
      return card.rounds.some((round) =>
        round.questions.some((item) => item.title.toLowerCase().includes(q)),
      );
    });
  }, [cards, query]);

  useEffect(() => {
    const focus = (focusCompany ?? "").trim();
    if (!focus) return;
    setExpanded((prev) => ({ ...prev, [focus]: true }));
  }, [focusCompany]);

  const unlabeledCompanyCount = useMemo(
    () => rows.filter((row) => !row.company.trim()).length,
    [rows],
  );

  function toggle(company: string) {
    setExpanded((prev) => ({ ...prev, [company]: !prev[company] }));
  }

  return (
    <div className="neon-card rounded-2xl p-4 md:p-5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-zinc-100">按公司看</h2>
        <p className="mt-1 text-sm text-zinc-400">
          同一公司的题目会合并到一张卡片。展开可看各轮考察内容与覆盖维度；标了「高频」Tag
          的是必刷题。
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
          placeholder="搜索公司、维度或题目..."
          className="w-full rounded-2xl border border-zinc-700 bg-zinc-900 py-3 pl-10 pr-4 text-sm text-zinc-100 placeholder:text-zinc-500"
        />
      </div>

      <p className="mt-4 text-sm text-zinc-500">
        共 {filtered.length} 家公司
        {query.trim() ? `（筛选自 ${cards.length}）` : ""}
        {unlabeledCompanyCount > 0 ? ` · ${unlabeledCompanyCount} 道题未填公司，未纳入此视图` : ""}
      </p>

      {filtered.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-zinc-700 px-4 py-8 text-center text-sm text-zinc-500">
          暂无带公司名的题目。在题库里给题目填写 Company，或从复盘入库时带上公司名。
        </p>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {filtered.map((card) => {
            const open = Boolean(expanded[card.company]);
            const stats =
              card.roundCount > 0
                ? `${card.roundCount} 场 · 共 ${card.questionCount} 题`
                : `共 ${card.questionCount} 题`;
            return (
              <article
                key={card.company}
                className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/60"
              >
                <button
                  type="button"
                  onClick={() => toggle(card.company)}
                  className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition hover:bg-zinc-900/80"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <h3 className="text-base font-semibold text-zinc-100">{card.company}</h3>
                      <span className="text-xs text-zinc-500">{stats}</span>
                      {card.mustDoCount > 0 ? (
                        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] text-amber-200">
                          {card.mustDoCount} 道必刷
                        </span>
                      ) : null}
                    </div>
                    {card.dimensions.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {card.dimensions.map((dim) => (
                          <span
                            key={dim}
                            className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-300"
                          >
                            {dim}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <span className="mt-1 shrink-0 text-zinc-500" aria-hidden>
                    <svg
                      viewBox="0 0 24 24"
                      className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </button>

                {open ? (
                  <div className="space-y-4 border-t border-zinc-800 px-4 py-3">
                    {card.rounds.map((round) => (
                      <div key={round.name}>
                        <div className="mb-2 flex items-baseline justify-between gap-2">
                          <h4 className="text-sm font-medium text-zinc-200">{round.name}</h4>
                          <span className="text-xs text-zinc-500">考了 {round.questions.length} 题</span>
                        </div>
                        <ul className="space-y-1.5">
                          {round.questions.map((q, index) => {
                            const mustDo = isMustDoQuestion(q.tags);
                            return (
                              <li key={q.id}>
                                <button
                                  type="button"
                                  onClick={() => onSelectQuestion?.(q)}
                                  className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-zinc-900"
                                >
                                  <span className="mt-0.5 shrink-0 font-mono text-xs text-zinc-500">
                                    #{index + 1}
                                  </span>
                                  <span className="min-w-0 flex-1 text-zinc-200">
                                    {q.title}
                                    {mustDo ? (
                                      <span className="ml-2 inline-block rounded bg-zinc-700/80 px-1.5 py-0.5 align-middle text-[10px] text-zinc-200">
                                        高频
                                      </span>
                                    ) : null}
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
