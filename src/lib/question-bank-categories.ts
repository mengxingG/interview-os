/** Notion QuestionBank 数据库 Category 选项（与 Notion multi_select 选项名一致） */
export const QUESTION_BANK_CATEGORIES = [
  "开场自我介绍",
  "项目深挖",
  "技术基础",
  "RAG知识库",
  "Agent架构",
  "模型选型",
  "评测体系",
  "prompt工程",
  "数据指标",
  "商业化",
  "跨团队协作",
  "产品方法论",
  "行业认知",
  "竞品分析",
  "AI工具",
  "个人特质",
  "职业规划",
  "岗位匹配",
  "薪资谈判",
  "反问环节",
] as const;

export type QuestionBankCategory = (typeof QUESTION_BANK_CATEGORIES)[number];

export const DEFAULT_QUESTION_BANK_CATEGORY: QuestionBankCategory = "项目深挖";

export const QUESTION_BANK_CATEGORY_SET = new Set<string>(QUESTION_BANK_CATEGORIES);

/** 旧英文分类 / 中文别名 → 新 Category */
const LEGACY_CATEGORY_MAP: Record<string, QuestionBankCategory> = {
  Behavioral: "个人特质",
  "Product Sense": "产品方法论",
  Technical: "项目深挖",
  "Case Study": "项目深挖",
  "System Design": "Agent架构",
  "Culture Fit": "个人特质",
  行为面: "个人特质",
  技术面: "项目深挖",
  系统设计: "Agent架构",
  产品Sense: "产品方法论",
  "产品 Sense": "产品方法论",
  产品感: "产品方法论",
  其他: "项目深挖",
};

export function isQuestionBankCategory(value: string): value is QuestionBankCategory {
  return QUESTION_BANK_CATEGORY_SET.has(value);
}

export function normalizeQuestionBankCategory(value: unknown): QuestionBankCategory {
  const raw = String(value ?? "").trim();
  if (!raw) return DEFAULT_QUESTION_BANK_CATEGORY;
  if (isQuestionBankCategory(raw)) return raw;
  return LEGACY_CATEGORY_MAP[raw] ?? DEFAULT_QUESTION_BANK_CATEGORY;
}

export function questionBankCategoryUnionForPrompt() {
  return QUESTION_BANK_CATEGORIES.map((item) => `"${item}"`).join(" | ");
}

export function questionBankCategoryListForPrompt() {
  return QUESTION_BANK_CATEGORIES.join("、");
}
