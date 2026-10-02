import type { PublicBatch } from "./types";

// Shared, display-only summaries of where a batch stands. The server remains
// authoritative for every gate; these only describe state to the recruiter.
export function batchSummary(batch: PublicBatch) {
  const active = batch.applications.filter((a) => a.state !== "disposed");
  const reviewed = active.filter((a) => a.confirmed).length;
  const attention = active.filter((a) =>
    ["readable_copy", "attention"].includes(a.state),
  ).length;
  const processing = active.filter((a) => a.state === "processing").length;
  const points = batch.rubric.reduce(
    (n, c) => n + (Number.isFinite(c.points) ? c.points : 0),
    0,
  );
  const allReviewed = active.length > 0 && reviewed === active.length;
  const done = [
    batch.published,
    batch.closed,
    batch.closed && (allReviewed || active.length === 0),
    !!batch.snapshot,
  ];
  return {
    active,
    reviewed,
    attention,
    processing,
    points,
    done,
    toReview: active.length - reviewed,
  };
}

export function nextAction(batch: PublicBatch, isAdmin: boolean) {
  const s = batchSummary(batch);
  if (batch.snapshot) return { label: "View shortlist", step: 3 };
  if (!batch.published)
    return isAdmin
      ? { label: "Set criteria", step: 0 }
      : { label: "View criteria", step: 0 };
  if (!batch.closed) {
    if (!s.active.length) return { label: "Add CVs", step: 1 };
    if (s.attention)
      return {
        label: `Resolve ${s.attention} CV${s.attention === 1 ? "" : "s"}`,
        step: 1,
      };
    if (s.processing) return { label: "Check processing", step: 1 };
    return { label: "Start review", step: 1 };
  }
  if (s.toReview > 0)
    return {
      label: `Review ${s.toReview} CV${s.toReview === 1 ? "" : "s"}`,
      step: 2,
    };
  return { label: "Choose shortlist", step: 3 };
}
