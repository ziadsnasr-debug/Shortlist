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
