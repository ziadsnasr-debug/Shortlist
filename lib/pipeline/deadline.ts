/** A single outer deadline is shared by processing and durable cleanup. */
export const PIPELINE_INVOCATION_MS = 220_000;
export const DELETION_START_RESERVE_MS = 35_000;
export const DELETION_FINISH_RESERVE_MS = 5_000;
// After processing, sandbox cleanup can take 5s. Recovery's first ledger
// lookup is bounded at 15s, so keep a further 5s handoff margin before its
// 35s loop reserve.
export const CONSUMER_DELETION_GUARD_MS = 25_000;
export const CONSUMER_WORK_RESERVE_MS =
  DELETION_START_RESERVE_MS + CONSUMER_DELETION_GUARD_MS;

export function hasDeadlineBudget(deadline: number, reserveMs: number) {
  return Date.now() <= deadline - reserveMs;
}

export function consumerWorkDeadline(deadline: number) {
  return deadline - CONSUMER_WORK_RESERVE_MS;
}

export function deletionOperationDeadline(deadline: number) {
  return deadline - DELETION_FINISH_RESERVE_MS;
}
