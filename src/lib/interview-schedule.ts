export const INTERVIEW_SCHEDULE_KEY = "interview-os-schedule";

export type InterviewScheduleItem = {
  id: string;
  company: string;
  role: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  notes?: string;
  jdSummary?: string;
  createdAt: string;
};

export function readInterviewSchedule(): InterviewScheduleItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(INTERVIEW_SCHEDULE_KEY);
    const parsed = raw ? (JSON.parse(raw) as InterviewScheduleItem[]) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === "object")
      .sort((a, b) => `${a.date} ${a.time ?? ""}`.localeCompare(`${b.date} ${b.time ?? ""}`));
  } catch {
    return [];
  }
}

export function writeInterviewSchedule(items: InterviewScheduleItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(INTERVIEW_SCHEDULE_KEY, JSON.stringify(items));
  } catch {
    // ignore storage errors
  }
}

export function getUpcomingInterview(items: InterviewScheduleItem[]) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const upcoming = items
    .filter((item) => item.date >= today)
    .sort((a, b) => `${a.date} ${a.time ?? ""}`.localeCompare(`${b.date} ${b.time ?? ""}`));
  return upcoming[0] ?? null;
}

