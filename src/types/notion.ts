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
