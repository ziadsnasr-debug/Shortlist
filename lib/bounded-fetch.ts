/** Bound privileged backend requests; caller cancellation still wins. */
export function signalUntil(deadline: number, caller?: AbortSignal): AbortSignal {
  if (!Number.isFinite(deadline)) throw new Error("INVALID_DEADLINE");
  const remaining = deadline - Date.now();
  const timer = remaining > 0
    ? AbortSignal.timeout(Math.max(1, remaining))
    : AbortSignal.abort(new DOMException("Deadline exceeded", "TimeoutError"));
  return caller ? AbortSignal.any([caller, timer]) : timer;
}

export function boundedFetch(
  timeoutMs = 15_000,
  transport: typeof fetch = fetch,
  absoluteDeadline?: number,
): typeof fetch {
  return (input, init) => {
    const caller =
      init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const deadline = absoluteDeadline === undefined
      ? AbortSignal.timeout(timeoutMs)
      : signalUntil(absoluteDeadline, AbortSignal.timeout(timeoutMs));
    return transport(input, {
      ...init,
      signal: caller ? AbortSignal.any([caller, deadline]) : deadline,
    });
  };
}
