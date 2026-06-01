import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { getPreferredQwenModelId, getQwenChatModel } from "@/lib/qwen-fallback";

// DeepSeek: 日常练习 / 刷题
const deepseek = createOpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY!,
  baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
});

// Gemini: 其他分析模块（JD 解码、备战、复盘等）
const gemini = createOpenAI({
  apiKey: process.env.GEMINI_API_KEY!,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
});

// Claude (GPTsAPI): 模拟面试
const claude = createAnthropic({
  apiKey: process.env.GPTSAPI_API_KEY || process.env.Qwen_API_KEY!,
  baseURL: process.env.GPTSAPI_BASE_URL || "https://api.gptsapi.net/v1",
});

/** 用户可选档位 + 功能专用模型 */
export type ModelType =
  | "fast"
  | "deepseek-pro"
  | "deep"
  | "pro"
  | "vision"
  | "resume"
  | "mock"
  | "practice";

export const FEATURE_MODEL_LABELS: Record<"resume" | "mock" | "practice", string> = {
  resume: "Qwen3.7-Max",
  mock: "Claude Sonnet 4.6",
  practice: "DeepSeek V4-Pro",
};

export function isFeatureModel(type: ModelType): type is "resume" | "mock" | "practice" {
  return type === "resume" || type === "mock" || type === "practice";
}

export function getModel(type: ModelType = "fast") {
  if (type === "resume") {
    return getQwenChatModel(getPreferredQwenModelId());
  }
  if (type === "mock") {
    return claude(process.env.CLAUDE_SONNET_MODEL || "claude-sonnet-4-6");
  }
  if (type === "practice") {
    return deepseek.chat(process.env.DEEPSEEK_PRO_MODEL || "deepseek-v4-pro");
  }
  if (type === "deep" || type === "pro") {
    return gemini(process.env.GEMINI_PRO_MODEL || "gemini-2.5-pro");
  }
  if (type === "vision") {
    return gemini(process.env.GEMINI_VISION_MODEL || "gemini-1.5-flash");
  }
  if (type === "deepseek-pro") {
    return deepseek.chat(process.env.DEEPSEEK_PRO_MODEL || "deepseek-v4-pro");
  }
  return deepseek.chat(process.env.DEEPSEEK_FLASH_MODEL || "deepseek-v4-flash");
}

/** 功能模块默认 fallback 链 */
export function getFeatureFallbackOrder(feature: "resume" | "mock" | "practice"): ModelType[] {
  if (feature === "resume") return ["resume", "fast"];
  if (feature === "mock") return ["mock", "practice", "fast"];
  return ["practice", "fast"];
}

/** 根据请求的 modelType 解析 fallback 链（含功能专用档位） */
export function getModelFallbackOrder(requested: ModelType): ModelType[] {
  if (isFeatureModel(requested)) return getFeatureFallbackOrder(requested);
  if (requested === "pro" || requested === "deep") return ["pro", "fast"];
  if (requested === "deepseek-pro") return ["deepseek-pro", "fast"];
  return [requested];
}
