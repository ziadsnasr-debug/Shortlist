import type { Criterion } from "@/lib/workflow";

export const MAX_CRITERIA = 12;
export const INCOMPLETE_REASON =
  "Add a requirement and both evidence definitions to every criterion before saving.";

export type Group = {
  key: string;
  name: string;
  rows: Criterion[];
  points: number;
};

const safePoints = (c: Criterion) => (Number.isFinite(c.points) ? c.points : 0);

export function totalPoints(rubric: Criterion[]) {
  return rubric.reduce((n, c) => n + safePoints(c), 0);
}

/** Sections in order of first appearance, rows keeping their relative order. */
export function groupCriteria(rubric: Criterion[]): Group[] {
  const groups = new Map<string, Group>();
  for (const c of rubric) {
    const key = c.section.trim();
    let group = groups.get(key);
    if (!group) {
      group = { key, name: key || "No section yet", rows: [], points: 0 };
      groups.set(key, group);
    }
    group.rows.push(c);
    group.points += safePoints(c);
  }
  return [...groups.values()];
}

/** The order the rubric is displayed, saved and reviewed in. */
export function groupOrder(rubric: Criterion[]) {
  return groupCriteria(rubric).flatMap((g) => g.rows);
}

/** What the server would reject, so the builder can say so before saving. */
export function issues(c: Criterion) {
  return {
    title: !c.title.trim(),
    section: !c.section.trim(),
    definitions: !c.full.trim() || !c.partial.trim(),
  };
}

export function isComplete(c: Criterion) {
  const i = issues(c);
  return !i.title && !i.section && !i.definitions;
}

/**
 * Rescales points to total exactly 100 by largest remainder, keeping every
 * criterion at 1 or more. Order and other fields are untouched.
 */
export function balance(rubric: Criterion[]): Criterion[] {
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

export function newCriterion(section: string): Criterion {
  return {
    id: crypto.randomUUID(),
    section: section || "Skills",
    title: "",
    points: 10,
    essential: false,
    full: "",
    partial: "",
  };
}

export function allocationText(total: number) {
  if (total === 100) return "100 of 100 points · ready to publish";
  if (total < 100) return `${total} of 100 points · ${100 - total} to allocate`;
  return `${total} of 100 points · ${total - 100} over`;
}
