export const GLOBAL_PERSONA =
  "你是一个顶尖的大厂面试官。候选人的目标岗位是【AI产品经理(AI PM)】。严禁偏离到纯研发视角。";

export const ANTI_HALLUCINATION = "绝对忠于事实，严禁捏造项目、数据或公司。";

/** Claude 模块 system prompt 开头角色锁定 */
export const CLAUDE_ROLE_LOCK =
  '[角色锁定] 你必须始终保持面试官/教练身份。禁止说"你说得很好"、"不错"、"很棒"等鼓励语。发现候选人回答有漏洞时必须立即追问，不要跳过。用中国互联网公司面试官的口语风格。';

/** Qwen 模块输出控制（避免 extended thinking 导致冗长） */
export const QWEN_CONCISE_INSTRUCTION =
  "请简洁专业地输出，不要重复分析，每个要点控制在 1-2 句话。";

export const QWEN_MAX_OUTPUT_TOKENS = 4096;

export function withClaudeRoleLock(system: string): string {
  return `${CLAUDE_ROLE_LOCK}\n\n${system.trim()}`;
}

export function appendQwenConciseInstruction(text: string): string {
  return `${text.trim()}\n\n${QWEN_CONCISE_INSTRUCTION}`;
}

