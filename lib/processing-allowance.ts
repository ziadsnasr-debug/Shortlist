export type ProcessingAllowanceState =
  | "normal"
  | "near_limit"
  | "exhausted";

export type ProcessingAllowance = {
  period: string;
  used: number;
  limit: number;
  remaining: number;
  state: ProcessingAllowanceState;
  capturedAt?: string;
};

/** Returns the first day of the current month in UTC for the allowance key. */
export function currentUtcAllowancePeriod(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export function allowanceState(
  used: number,
  limit: number,
): ProcessingAllowanceState {
  if (used >= limit) return "exhausted";
  if (used >= limit * 0.8) return "near_limit";
  return "normal";
}

export function makeProcessingAllowance(input: {
  period: string;
  used: number;
  limit: number;
  capturedAt?: string;
}): ProcessingAllowance {
  if (!Number.isSafeInteger(input.used) || input.used < 0)
    throw new Error("Invalid processing allowance usage.");
  if (!Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 1000)
    throw new Error("Invalid processing allowance limit.");
  const { used, limit } = input;
  return {
    period: input.period,
    used,
    limit,
    remaining: Math.max(0, limit - used),
    state: allowanceState(used, limit),
    ...(input.capturedAt ? { capturedAt: input.capturedAt } : {}),
  };
}
