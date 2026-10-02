import "server-only";
import { createHash } from "node:crypto";
import { databaseClient } from "./supabase";
import { WorkflowError } from "./workflow";
export async function rateLimit(
  identity: string,
  operation: string,
  limit = 30,
  seconds = 60,
) {
  const key = createHash("sha256")
    .update(operation + ":" + identity)
    .digest("hex");
  const { data, error } = await databaseClient().rpc("consume_request_limit", {
    p_key: key,
    p_limit: limit,
    p_seconds: seconds,
  });
  if (error) throw new WorkflowError("Request limit unavailable.", 503);
  if (!data)
    throw new WorkflowError("Too many requests. Try again shortly.", 429);
}
