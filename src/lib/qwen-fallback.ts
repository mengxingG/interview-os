import { generateText, streamText } from "ai";
import type { LanguageModel } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { QWEN_MAX_OUTPUT_TOKENS } from "@/config/prompts";

const DEFAULT_QWEN_FREE_TIER_MODELS = [
  "qwen3.7-max",
  "qwen3.7-max-preview",
  "qwen3.7-max-2026-05-20",
  "qwen3.7-max-2026-05-17",
] as const;

const qwenClient = createOpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY!,
  baseURL: process.env.DASHSCOPE_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1",
});

/** 进程内缓存：优先使用上次成功的 Qwen 模型，减少重复失败探测 */
let lastSuccessfulQwenModelId: string | null = null;

function parseModelListFromEnv(): string[] | null {
  const raw = process.env.QWEN_FALLBACK_MODELS?.trim();
  if (!raw) return null;
  const list = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return list.length > 0 ? list : null;
}

/** 免费额度模型列表（主模型优先，成功后旋转到队首） */
export function getQwenModelIds(): string[] {
  const envList = parseModelListFromEnv();
  const primary = process.env.QWEN_MAX_MODEL || "qwen3.7-max";
  const base = envList ?? [...DEFAULT_QWEN_FREE_TIER_MODELS];
  const merged = [...new Set([primary, ...base])];

  if (lastSuccessfulQwenModelId && merged.includes(lastSuccessfulQwenModelId)) {
    const idx = merged.indexOf(lastSuccessfulQwenModelId);
    return [...merged.slice(idx), ...merged.slice(0, idx)];
  }
  return merged;
}

export function getQwenChatModel(modelId: string): LanguageModel {
  return qwenClient.chat(modelId);
}

export function getPreferredQwenModelId(): string {
  return getQwenModelIds()[0] ?? process.env.QWEN_MAX_MODEL ?? "qwen3.7-max";
}

function markQwenModelSuccess(modelId: string) {
  lastSuccessfulQwenModelId = modelId;
}

function collectErrorText(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth += 1) {
    if (current instanceof Error) {
      parts.push(current.message);
      const enriched = current as Error & { statusCode?: number; data?: unknown; responseBody?: string };
      if (typeof enriched.statusCode === "number") parts.push(String(enriched.statusCode));
      if (enriched.responseBody) parts.push(enriched.responseBody);
      if (enriched.data !== undefined) {
        try {
          parts.push(JSON.stringify(enriched.data));
        } catch {
          parts.push(String(enriched.data));
        }
      }
      current = enriched.cause;
    } else if (typeof current === "object" && current !== null) {
      try {
        parts.push(JSON.stringify(current));
      } catch {
        parts.push(String(current));
      }
      break;
    } else {
      parts.push(String(current));
      break;
    }
  }
  return parts.join(" ").toLowerCase();
}

/** 是否为免费额度耗尽 / 模型级配额错误（可切换下一个 Qwen 模型） */
export function shouldRetryWithNextQwenModel(error: unknown): boolean {
  const text = collectErrorText(error);
  const quotaSignals = [
    "quota",
    "free tier",
    "free-tier",
    "fre etier",
    "insufficient",
    "exhausted",
    "allocationquota",
    "allocation quota",
    "throttling.allocation",
    "余额不足",
    "余额",
    "配额",
    "额度",
    "超出免费",
    "免费额度",
    "limit exceeded",
    "rate limit",
    "too many requests",
    "arrearage",
    "resource_exhausted",
    "insufficient_quota",
  ];
  if (quotaSignals.some((signal) => text.includes(signal))) return true;
  if (/\b(403|429|402)\b/.test(text)) return true;
  return false;
}

type GenerateTextInput = Omit<Parameters<typeof generateText>[0], "model">;
type StreamTextInput = Omit<Parameters<typeof streamText>[0], "model">;

/** 依次尝试各 Qwen 免费模型，额度报错时自动切换，对用户无感 */
export async function generateTextWithQwenFallback(params: GenerateTextInput) {
  const modelIds = getQwenModelIds();
  let lastError: unknown = null;

  for (const modelId of modelIds) {
    try {
      const result = await generateText({
        maxOutputTokens: QWEN_MAX_OUTPUT_TOKENS,
        ...params,
        model: getQwenChatModel(modelId),
      });
      markQwenModelSuccess(modelId);
      return result;
    } catch (error) {
      lastError = error;
      if (!shouldRetryWithNextQwenModel(error)) throw error;
      console.warn(`[qwen-fallback] ${modelId} unavailable, trying next model...`);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("All Qwen free-tier models are exhausted.");
}

/** 流式调用：仅在启动阶段失败时切换模型（与 generateText 相同策略） */
export function streamTextWithQwenFallback(params: StreamTextInput) {
  const modelIds = getQwenModelIds();
  let lastError: unknown = null;

  for (const modelId of modelIds) {
    try {
      const result = streamText({
        maxOutputTokens: QWEN_MAX_OUTPUT_TOKENS,
        ...params,
        model: getQwenChatModel(modelId),
      });
      markQwenModelSuccess(modelId);
      return result;
    } catch (error) {
      lastError = error;
      if (!shouldRetryWithNextQwenModel(error)) throw error;
      console.warn(`[qwen-fallback] ${modelId} stream unavailable, trying next model...`);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("All Qwen free-tier models are exhausted.");
}

/** 探测可用 Qwen 模型（用于 chat preflight） */
export async function probeQwenModelAvailability(): Promise<boolean> {
  try {
    await generateTextWithQwenFallback({
      prompt: "ok",
      maxOutputTokens: 1,
    });
    return true;
  } catch {
    return false;
  }
}
