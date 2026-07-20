const STORAGE_KEY = "interview-os:question-bank-manual-defaults";

export type QuestionBankManualDefaults = {
  category: string;
  source: string;
  company: string;
  role: string;
  round: string;
  difficulty: string;
  status: string;
};

export function readQuestionBankManualDefaults(): Partial<QuestionBankManualDefaults> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<QuestionBankManualDefaults>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function writeQuestionBankManualDefaults(data: QuestionBankManualDefaults) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore storage failures
  }
}
