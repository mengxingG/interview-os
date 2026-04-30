"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getUpcomingInterview, readInterviewSchedule, type InterviewScheduleItem, writeInterviewSchedule } from "@/lib/interview-schedule";

const emptyForm = {
  id: "",
  company: "",
  role: "",
  date: "",
  time: "",
  notes: "",
  jdSummary: "",
};

function daysUntil(date: string, time?: string) {
  const target = new Date(`${date}T${time || "09:00"}:00`);
  if (Number.isNaN(target.getTime())) return null;
  return Math.ceil((target.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

function countdownTone(days: number | null) {
  if (days === null) return "text-zinc-400 border-zinc-700 bg-zinc-900";
  if (days < 3) return "text-rose-200 border-rose-500/40 bg-rose-500/10";
  if (days <= 7) return "text-amber-200 border-amber-500/40 bg-amber-500/10";
  return "text-zinc-300 border-zinc-700 bg-zinc-900";
}

function CalendarMonth({ items, monthDate }: { items: InterviewScheduleItem[]; monthDate: Date }) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startWeekday = firstDay.getDay();
  const totalDays = lastDay.getDate();
  const cells: Array<{ day: number | null; hasInterview: boolean }> = [];
  for (let i = 0; i < startWeekday; i += 1) cells.push({ day: null, hasInterview: false });
  for (let day = 1; day <= totalDays; day += 1) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push({ day, hasInterview: items.some((item) => item.date === iso) });
  }
  while (cells.length % 7 !== 0) cells.push({ day: null, hasInterview: false });

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
      <p className="mb-2 text-xs text-zinc-400">{year}年{month + 1}月</p>
      <div className="mb-1 grid grid-cols-7 gap-1 text-[11px] text-zinc-500">
        {["日", "一", "二", "三", "四", "五", "六"].map((w) => (
          <span key={w} className="text-center">
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 text-xs">
        {cells.map((cell, idx) => (
          <div key={idx} className="flex h-8 items-center justify-center rounded border border-zinc-800 bg-zinc-900/40">
            {cell.day ? (
              <div className="flex items-center gap-1">
                <span>{cell.day}</span>
                {cell.hasInterview ? <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" /> : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function InterviewSchedulePanel() {
  const [items, setItems] = useState<InterviewScheduleItem[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState("");
  const [monthCursor, setMonthCursor] = useState(() => new Date());

  useEffect(() => {
    setItems(readInterviewSchedule());
  }, []);

  const upcoming = getUpcomingInterview(items);

  const onSave = () => {
    if (!form.company.trim() || !form.role.trim() || !form.date.trim()) {
      setStatus("请至少填写公司、岗位、日期。");
      return;
    }
    const nextItem: InterviewScheduleItem = {
      id: form.id || crypto.randomUUID(),
      company: form.company.trim(),
      role: form.role.trim(),
      date: form.date.trim(),
      time: form.time.trim() || undefined,
      notes: form.notes.trim() || undefined,
      jdSummary: form.jdSummary.trim() || undefined,
      createdAt: form.id ? items.find((item) => item.id === form.id)?.createdAt || new Date().toISOString() : new Date().toISOString(),
    };
    const next: InterviewScheduleItem[] = [...items.filter((item) => item.id !== nextItem.id), nextItem].sort((a, b) =>
      `${a.date} ${a.time ?? ""}`.localeCompare(`${b.date} ${b.time ?? ""}`),
    );
    setItems(next);
    writeInterviewSchedule(next);
    setForm(emptyForm);
    setStatus(form.id ? "面试安排已更新。" : "面试安排已添加。");
  };

  const onDelete = (id: string) => {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm("确定要删除这条面试安排吗？此操作不可逆。");
      if (!confirmed) return;
    }
    const next = items.filter((item) => item.id !== id);
    setItems(next);
    writeInterviewSchedule(next);
    setStatus("面试安排已删除。");
  };

  const onEdit = (item: InterviewScheduleItem) => {
    setForm({
      id: item.id,
      company: item.company,
      role: item.role,
      date: item.date,
      time: item.time || "",
      notes: item.notes || "",
      jdSummary: item.jdSummary || "",
    });
    setStatus("已载入安排，可直接编辑后保存。");
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="neon-card rounded-2xl p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm text-zinc-200">面试日历视图</p>
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-300"
            >
              上月
            </button>
            <button
              type="button"
              onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-300"
            >
              下月
            </button>
          </div>
        </div>
        <CalendarMonth items={items} monthDate={monthCursor} />
      </section>

      <section className="neon-card rounded-2xl p-4">
        <p className="text-sm text-zinc-200">新增安排</p>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <input value={form.company} onChange={(e) => setForm((prev) => ({ ...prev, company: e.target.value }))} placeholder="公司" className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" />
          <input value={form.role} onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))} placeholder="岗位" className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" />
          <input type="date" value={form.date} onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" />
          <input type="time" value={form.time} onChange={(e) => setForm((prev) => ({ ...prev, time: e.target.value }))} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" />
          <textarea value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="备注（面试轮次/面试官等）" className="md:col-span-2 min-h-20 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button type="button" onClick={onSave} className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100">
            {form.id ? "保存修改" : "添加面试安排"}
          </button>
          {form.id ? (
            <button type="button" onClick={() => setForm(emptyForm)} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200">
              取消编辑
            </button>
          ) : null}
          <span className="text-xs text-zinc-500">{status}</span>
        </div>
      </section>

      {upcoming ? (
        <section className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-sm text-cyan-100">
          最近面试：{upcoming.company} · {upcoming.role} · {upcoming.date}
          {upcoming.time ? ` ${upcoming.time}` : ""}
        </section>
      ) : null}

      <section className="neon-card rounded-2xl p-4">
        <p className="text-sm text-zinc-200">已记录安排</p>
        <div className="mt-2 space-y-2">
          {items.length === 0 ? (
            <p className="text-sm text-zinc-500">暂无安排。</p>
          ) : (
            items.map((item) => (
              <div key={item.id} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                <p className="text-sm text-zinc-100">{item.company} · {item.role}</p>
                <p className="text-xs text-zinc-400">
                  {item.date}
                  {item.time ? ` ${item.time}` : ""}
                </p>
                <p className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] ${countdownTone(daysUntil(item.date, item.time))}`}>
                  {(() => {
                    const days = daysUntil(item.date, item.time);
                    if (days === null) return "日期异常";
                    if (days < 0) return "已结束";
                    return `距面试还有 ${days} 天`;
                  })()}
                </p>
                {item.notes ? <p className="mt-1 text-xs text-zinc-300">{item.notes}</p> : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => onEdit(item)} className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200">
                    编辑
                  </button>
                  <button type="button" onClick={() => onDelete(item.id)} className="rounded-lg border border-rose-500/35 bg-rose-500/10 px-2 py-1 text-xs text-rose-100">
                    删除
                  </button>
                  <Link href={`/prep?company=${encodeURIComponent(item.company)}&role=${encodeURIComponent(item.role)}`} className="rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-100">
                    去面试备战
                  </Link>
                  <Link href="/mock?tab=hype" className="rounded-lg border border-violet-500/35 bg-violet-500/10 px-2 py-1 text-xs text-violet-100">
                    去面试热身
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
