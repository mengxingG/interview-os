"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getUpcomingInterview, readInterviewSchedule, type InterviewScheduleItem } from "@/lib/interview-schedule";

export function UpcomingInterviewFocus() {
  const [upcoming, setUpcoming] = useState<InterviewScheduleItem | null>(null);

  useEffect(() => {
    const rows = readInterviewSchedule();
    setUpcoming(getUpcomingInterview(rows));
  }, []);

  if (!upcoming) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-xs text-zinc-500">
        当前没有即将到来的面试安排。可前往「面试日程表」添加，系统会自动给出关联训练建议。
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3">
      <p className="text-sm text-cyan-100">
        即将面试：{upcoming.company} · {upcoming.role} · {upcoming.date}
        {upcoming.time ? ` ${upcoming.time}` : ""}
      </p>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <Link href={`/question-bank?company=${encodeURIComponent(upcoming.company)}`} className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2 py-1 text-cyan-100">
          去题库做公司专练
        </Link>
        <Link href="/mock?mode=practice" className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-200">
          去模拟面试训练
        </Link>
        <Link href="/train" className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-200">
          去知识训练复习
        </Link>
      </div>
    </div>
  );
}

