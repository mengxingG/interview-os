"use client";

type LoadingHintProps = {
  active: boolean;
  text: string;
  className?: string;
};

export function LoadingHint({ active, text, className = "" }: LoadingHintProps) {
  if (!text) return null;
  return (
    <div
      className={`rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-xs ${
        active ? "text-cyan-300 loading-pulse" : "text-zinc-400"
      } ${className}`}
    >
      {active ? <span className="loading-dots">{text}</span> : text}
    </div>
  );
}
