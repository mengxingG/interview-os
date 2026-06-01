import type { ModelType } from "@/lib/llm";

export type ModelOption = {
  value: ModelType;
  label: string;
  provider: string;
};

/** 全部可调用大模型（下拉框统一数据源） */
export const ALL_MODEL_OPTIONS: ModelOption[] = [
  { value: "resume", label: "Qwen3.7-Max", provider: "阿里云 DashScope" },
  { value: "mock", label: "Claude Sonnet 4.6", provider: "GPTsAPI" },
  { value: "practice", label: "DeepSeek V4-Pro", provider: "DeepSeek" },
  { value: "fast", label: "DeepSeek V4 Flash", provider: "DeepSeek" },
  { value: "deepseek-pro", label: "DeepSeek V4 Pro", provider: "DeepSeek" },
  { value: "pro", label: "Gemini 3.5 Flash", provider: "Google" },
];

export const SELECTABLE_MODEL_TYPES = ALL_MODEL_OPTIONS.map((item) => item.value);

export function getModelLabel(type: ModelType): string {
  return ALL_MODEL_OPTIONS.find((item) => item.value === type)?.label ?? type;
}

export function getModelOption(type: ModelType): ModelOption | undefined {
  return ALL_MODEL_OPTIONS.find((item) => item.value === type);
}

export function formatModelOptionLabel(option: ModelOption, recommended?: ModelType): string {
  const suffix = recommended === option.value ? "（推荐）" : "";
  return `${option.label}${suffix} · ${option.provider}`;
}
