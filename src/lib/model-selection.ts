import type { ModelType } from "@/lib/llm";
import { SELECTABLE_MODEL_TYPES } from "@/lib/model-options";

const MODEL_STORAGE_PREFIX = "interview-os-model:";

const VALID_MODELS: ModelType[] = SELECTABLE_MODEL_TYPES;

export function readModelSelection(storageKey: string, fallback: ModelType): ModelType {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(`${MODEL_STORAGE_PREFIX}${storageKey}`);
    const normalized = raw === "deep" ? "pro" : raw;
    if (VALID_MODELS.includes(normalized as ModelType)) return normalized as ModelType;
    return fallback === "deep" ? "pro" : fallback;
  } catch {
    return fallback === "deep" ? "pro" : fallback;
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
