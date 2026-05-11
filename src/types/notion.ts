export type NotionRelationRef = {
  id: string;
};

export type KnowledgeNotionRow = {
  id: string;
  title: string;
  prompt: string;
  answer: string;
  content: string;
  domain: string;
  interval: number;
  easeFactor: number;
  mastery: number;
  nextReview: string;
  questions: NotionRelationRef[];
};

export type QuestionBankNotionRow = {
  id: string;
  title: string;
  category: string;
  source: string;
  company: string;
  role: string;
  difficulty: string;
  myAnswer: string;
  aiFeedback: string;
  bestStory: string;
  tags: string[];
  practiceCount: number;
  lastScore: number;
  lastPracticed: string;
  status: string;
  knowledge: NotionRelationRef[];
};

// ==========================================
// 岗位监控 (Job Monitor) 类型
// ==========================================
export type JobStatus = "新发现" | "已查看" | "已解码" | "已投递" | "已放弃";

export type JobRow = {
  id: string;
  title: string;
  company: string;
  role: string;
  matchScore: number;
  status: JobStatus;
  location: string;
  url: string;
  jdText: string;
  platform: string;
  salaryRange: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};
