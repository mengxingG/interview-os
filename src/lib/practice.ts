export const PRACTICE_STAGES = [
  { id: 1, key: "ladder", label: "第1阶段：ladder（结构阶梯）", gate: "Structure >= 3，连续 3 轮达标" },
  { id: 2, key: "pushback", label: "第2阶段：pushback（质疑应对）", gate: "Credibility >= 3，能扛压" },
  { id: 3, key: "pivot", label: "第3阶段：pivot（重定向）", gate: "Relevance >= 3，偏题可拉回" },
  { id: 4, key: "gap", label: "第4阶段：gap（空白处理）", gate: "Credibility >= 3，空白回答也可信" },
  { id: 5, key: "role", label: "第5阶段：role（角色深挖）", gate: "Substance >= 3，可应对专项追问" },
  { id: 6, key: "panel", label: "第6阶段：panel（文化匹配）", gate: "五维均 >= 3，适配多角色面试官" },
  { id: 7, key: "stress", label: "第7阶段：stress（高压）", gate: "五维均 >= 3，抗压稳定" },
  { id: 8, key: "technical", label: "第8阶段：technical（技术表达）", gate: "Structure + Substance >= 3" },
] as const;

export const PRACTICE_STANDALONE = [{ key: "retrieval", label: "retrieval" }] as const;

export const PRACTICE_HISTORY_KEY = "interview-os-practice-history";
export const PRACTICE_PROGRESS_KEY = "interview-os-practice-progress";
export const EVALUATE_TRIAGE_HISTORY_KEY = "interview-os-evaluate-triage-history";
export const INTERVIEW_INTELLIGENCE_KEY = "interview-os-interview-intelligence";
export const MOCK_REPORT_SELECTED_KEY = "interview-os-mock-report-selected";
