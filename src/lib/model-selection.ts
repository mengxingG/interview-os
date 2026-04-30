import type { ModelType } from "@/lib/llm";

const MODEL_STORAGE_PREFIX = "interview-os-model:";

const VALID_MODELS: ModelType[] = ["fast", "deepseek-pro", "deep", "pro"];

export function readModelSelection(storageKey: string, fallback: ModelType): ModelType {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(`${MODEL_STORAGE_PREFIX}${storageKey}`);
    if (VALID_MODELS.includes(raw as ModelType)) return raw as ModelType;
    return fallback;
  } catch {
    return fallback;
  }
}

export function writeModelSelection(storageKey: string, model: ModelType) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${MODEL_STORAGE_PREFIX}${storageKey}`, model);
  } catch {
    // ignore storage failures
  }
}
