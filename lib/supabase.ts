import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
export async function sessionClient() {
  const jar = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase environment is incomplete.");
  return createServerClient(url, key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (values) =>
        values.forEach(({ name, value, options }) =>
          jar.set(name, value, {
            ...options,
            httpOnly: true,
            secure:
              !!process.env.VERCEL ||
              process.env.APP_URL?.startsWith("https://") === true,
            sameSite: "lax",
          }),
        ),
    },
  });
}
export function databaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase environment is incomplete.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
