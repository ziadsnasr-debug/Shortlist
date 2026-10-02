// URL model for the workspace. The path is the source of truth for where the
// recruiter is, so refresh, back and deep links restore the same place.
export const stepSlugs = ["criteria", "cvs", "review", "shortlist"] as const;
export type StepSlug = (typeof stepSlugs)[number];

export type Route =
  | { view: "home" }
  | { view: "new" }
  | { view: "admin" }
  | {
      view: "batch";
      vacancyId: string;
      batchId: string;
      step: number;
      candidate?: number;
    }
  | { view: "missing" };

const segment = /^[A-Za-z0-9_-]{1,120}$/;

export function parsePath(pathname: string): Route {
  const parts = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  if (parts.length === 0) return { view: "home" };
  if (parts[0] === "admin" && parts.length === 1) return { view: "admin" };
  if (parts[0] !== "vacancies") return { view: "missing" };
  if (parts.length === 1) return { view: "home" };
  if (parts.length === 2 && parts[1] === "new") return { view: "new" };
  const [, vacancyId, batchId, slug, candidate] = parts;
  if (!segment.test(vacancyId ?? "") || !segment.test(batchId ?? ""))
    return { view: "missing" };
  const step = slug ? stepSlugs.indexOf(slug as StepSlug) : 0;
  if (step < 0 || parts.length > 5) return { view: "missing" };
  if (candidate !== undefined) {
    if (step !== 2 || !/^\d{1,3}$/.test(candidate)) return { view: "missing" };
    return { view: "batch", vacancyId, batchId, step, candidate: +candidate };
  }
  return { view: "batch", vacancyId, batchId, step };
}

export function pathFor(route: Route): string {
  switch (route.view) {
    case "home":
    case "missing":
      return "/vacancies";
    case "new":
      return "/vacancies/new";
    case "admin":
      return "/admin";
    case "batch": {
      const base = `/vacancies/${encodeURIComponent(route.vacancyId)}/${encodeURIComponent(route.batchId)}/${stepSlugs[route.step]}`;
      return route.step === 2 && route.candidate
        ? `${base}/${String(route.candidate).padStart(2, "0")}`
        : base;
    }
  }
}

// The step a batch should open on: the next thing that needs doing.
export function defaultStep(batch: {
  published: boolean;
  closed: boolean;
  snapshot?: unknown;
}) {
  return batch.snapshot ? 3 : batch.closed ? 2 : batch.published ? 1 : 0;
}
