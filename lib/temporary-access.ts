import { z } from "zod";
/** Explicit, expiring access to the fictional-data pilot only. */
export function temporaryPublicActor(
  env: Record<string, string | undefined> = process.env,
  now = Date.now(),
) {
  if (env.TEMP_PUBLIC_ACCESS !== "true") return undefined;
  if (env.PERSISTENCE_MODE !== "supabase-synthetic" || env.REAL_CV_DATA_ENABLED !== "false")
    throw new Error("Temporary public access requires fictional-data mode.");
  const until = Date.parse(env.TEMP_PUBLIC_ACCESS_UNTIL ?? "");
  if (!Number.isFinite(until)) throw new Error("Temporary access expiry is required.");
  if (now >= until) return undefined;
  return z.uuid().parse(env.TEMP_PUBLIC_ACTOR_ID);
}
