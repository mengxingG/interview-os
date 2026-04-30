type ScoreRadarProps = {
  scores: number[];
  title?: string;
  subtitle?: string;
  hasData?: boolean;
};

export function ScoreRadar({ scores, title = "五维评分", subtitle, hasData = true }: ScoreRadarProps) {
  const labels = ["表达力", "结构性", "相关性", "可信度", "差异化"];

  return (
    <section className="neon-card rounded-2xl p-4">
      <h2 className="mb-1 text-lg font-medium text-zinc-100">{title}</h2>
      {subtitle ? <p className="mb-3 text-xs text-zinc-500">{subtitle}</p> : <div className="mb-4" />}
      <div className="space-y-3">
        {labels.map((label, index) => {
          const score = scores[index] ?? 0;
          return (
            <div key={label}>
              <div className="mb-1 flex justify-between text-xs text-zinc-400">
                <span>{label}</span>
                <span>{score}</span>
              </div>
              <div className="h-2 rounded-full bg-zinc-800">
                <div
                  className={`h-2 rounded-full transition-all duration-700 ease-out ${
                    hasData ? "bg-gradient-to-r from-violet-500 to-cyan-400" : "bg-zinc-600"
                  }`}
                  style={{ width: `${Math.min(100, score * 10)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
