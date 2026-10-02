import { z } from "zod";
const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);
function localOrigin(value: string | undefined) {
  try {
    const url = new URL(value ?? "");
    return (
      ["http:", "https:"].includes(url.protocol) &&
      loopback.has(url.hostname) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
/** Explicit local synthetic convenience; never replaces hosted authentication. */
export function localBypassActor(
  env: Record<string, string | undefined> = process.env,
) {
  if (env.LOCAL_AUTH_BYPASS !== "true") return undefined;
  if (
    env.VERCEL ||
    env.APP_ENV !== "local" ||
    env.REAL_CV_DATA_ENABLED === "true" ||
    env.PERSISTENCE_MODE !== "supabase-synthetic" ||
    !localOrigin(env.APP_URL) ||
    !localOrigin(env.NEXT_PUBLIC_SUPABASE_URL)
  )
    throw new Error(
      "Local login bypass requires loopback synthetic development.",
    );
  return z.uuid().parse(env.LOCAL_AUTH_USER_ID);
}

export function localBypassHostAllowed(
  host: string | null,
  forwardedHost: string | null,
  env: Record<string, string | undefined> = process.env,
) {
  if (!localBypassActor(env)) return true;
  const expected = new URL(env.APP_URL!).host;
  return host === expected && (!forwardedHost || forwardedHost === expected);
}
