// Pure and dependency-free so the server and the browser can both import it.

export const safePoints = (c: { points: number }) =>
  Number.isFinite(c.points) ? c.points : 0;

/**
 * Rescales points to total exactly 100 by largest remainder, keeping every
 * criterion at 1 or more. Order and other fields are untouched.
 */
export function balance<T extends { points: number }>(rubric: T[]): T[] {
  if (!rubric.length) return [];
  const raw = rubric.map(safePoints);
  const sum = raw.reduce((n, p) => n + p, 0);
  const weights = sum > 0 ? raw : raw.map(() => 1);
  const weightTotal = sum > 0 ? sum : rubric.length;
  const exact = weights.map((w) => (w * 100) / weightTotal);
  const points = exact.map((x) => Math.max(1, Math.floor(x)));
  let diff = 100 - points.reduce((n, p) => n + p, 0);
  const byRemainder = exact
    .map((x, i) => ({ i, rest: x - Math.floor(x) }))
    .sort((a, b) => b.rest - a.rest || a.i - b.i);
  for (let k = 0; diff > 0; k = (k + 1) % byRemainder.length, diff -= 1)
    points[byRemainder[k].i] += 1;
  while (diff < 0) {
    let largest = -1;
    points.forEach((p, i) => {
      if (p > 1 && (largest < 0 || p > points[largest])) largest = i;
    });
    if (largest < 0) break;
    points[largest] -= 1;
    diff += 1;
  }
  return rubric.map((c, i) => ({ ...c, points: points[i] }));
}
