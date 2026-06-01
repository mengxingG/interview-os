"use client";

import type { ModelType } from "@/lib/llm";
import {
  ALL_MODEL_OPTIONS,
  formatModelOptionLabel,
  getModelLabel,
} from "@/lib/model-options";
import { writeModelSelection } from "@/lib/model-selection";

type ModelSelectProps = {
  value: ModelType;
  onChange: (model: ModelType) => void;
  /** 写入 localStorage，切换后下一请求生效 */
  storageKey?: string;
  recommended?: ModelType;
  disabled?: boolean;
  label?: string;
  hint?: string;
  className?: string;
  selectClassName?: string;
  showNextRequestHint?: boolean;
};

export function ModelSelect({
  value,
  onChange,
  storageKey,
  recommended,
  disabled = false,
  label = "大模型",
  hint,
  className = "",
  selectClassName = "mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200",
  showNextRequestHint = true,
}: ModelSelectProps) {
  function handleChange(next: ModelType) {
    onChange(next);
    if (storageKey) writeModelSelection(storageKey, next);
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="text-xs text-zinc-500">{label}</p>
        {showNextRequestHint ? (
          <p className="text-xs text-cyan-300/90">
            下一条请求将使用：<span className="font-medium">{getModelLabel(value)}</span>
          </p>
        ) : null}
      </div>
      {hint ? <p className="mt-0.5 text-xs text-zinc-500">{hint}</p> : null}
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => handleChange(event.target.value as ModelType)}
        className={selectClassName}
      >
        {ALL_MODEL_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {formatModelOptionLabel(option, recommended)}
          </option>
        ))}
      </select>
    </div>
  );
}
