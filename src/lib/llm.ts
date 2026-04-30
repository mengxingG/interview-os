import { createOpenAI } from "@ai-sdk/openai";

// DeepSeek: short chats and scoring
const deepseek = createOpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY!,
  baseURL: process.env.DEEPSEEK_BASE_URL!,
});

// Gemini: long-context analysis
const gemini = createOpenAI({
  apiKey: process.env.GEMINI_API_KEY!,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
});

export type ModelType = "fast" | "deepseek-pro" | "deep" | "pro";

export function getModel(type: ModelType = "fast") {
  if (type === "pro") {
    return gemini(process.env.GEMINI_PRO_MODEL || "gemini-2.5-pro");
  }
  if (type === "deep") {
    return gemini(process.env.GEMINI_FLASH_MODEL || "gemini-2.5-flash");
  }
  if (type === "deepseek-pro") {
    return deepseek.chat(process.env.DEEPSEEK_PRO_MODEL || "deepseek-v4-pro");
  }
  return deepseek.chat(process.env.DEEPSEEK_FLASH_MODEL || "deepseek-v4-flash");
}
