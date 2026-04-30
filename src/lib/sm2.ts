export type Sm2Result = {
  interval: number;
  easeFactor: number;
  nextReviewDate: string;
};

function addDays(days: number) {
  const next = new Date();
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

// SM-2 step with quality score 0-5.
// Inputs: current ease factor, current interval, quality.
// Outputs: new interval, new ease factor, next review date.
export function nextSm2(
  easeFactor: number,
  interval: number,
  quality: number,
): Sm2Result {
  const q = Math.max(0, Math.min(5, Math.round(quality)));
  const newEaseFactor = Math.max(
    1.3,
    easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)),
  );

  let newInterval = 1;
  if (q < 3) {
    newInterval = 1;
  } else if (interval <= 1) {
    newInterval = 6;
  } else {
    newInterval = Math.max(1, Math.round(interval * newEaseFactor));
  }

  return {
    interval: newInterval,
    easeFactor: Number(newEaseFactor.toFixed(2)),
    nextReviewDate: addDays(newInterval),
  };
}
