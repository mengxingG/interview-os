"use client";

import { useEffect, useMemo, useState } from "react";

type Card = {
  id: string;
  title?: string;
  interval?: number;
  nextReview?: string;
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function TodayReviewPlan() {
  const [cards, setCards] = useState<Card[]>([]);
  const [note, setNote] = useState("正在读取今日复习计划...");

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const response = await fetch("/api/notion/knowledge");
        if (!response.ok) throw new Error(String(response.status));
        const payload = (await response.json()) as { cards?: Card[] };
        if (!mounted) return;
        const rows = Array.isArray(payload.cards) ? payload.cards : [];
        setCards(rows);
        setNote(rows.length > 0 ? "已按 Notion 复习卡片动态更新" : "今日暂无待复习知识点");
      } catch {
        if (mounted) setNote("读取失败，暂未拿到 Notion 计划");
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const dueCards = useMemo(
    () => cards.filter((card) => (card.nextReview || todayISO()) <= todayISO()).slice(0, 6),
    [cards],
  );

  return (
    <div className="neon-card rounded-2xl p-4 text-sm text-zinc-300">
      <p className="mb-2 text-zinc-100">今日复习计划（动态）</p>
      {dueCards.length === 0 ? (
        <p>今日复习完成，明天继续巩固。</p>
      ) : (
        <div className="space-y-1">
          {dueCards.map((card) => (
            <p key={card.id}>
              - {card.title || "未命名知识点"}：间隔 {card.interval ?? 1} 天（interval {card.interval ?? 1}d）
            </p>
          ))}
        </div>
      )}
      <p className="mt-2 text-xs text-zinc-500">{note}</p>
    </div>
  );
}

