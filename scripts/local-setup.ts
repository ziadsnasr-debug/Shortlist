// Disposable synthetic LOCAL instance only. Secrets stay in ignored, owner-only files.
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFile, writeFile, mkdir, chmod } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { seed } from "../fixtures/synthetic/seed";
const local = JSON.parse(
  execFileSync("supabase", ["status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }),
);
if (new URL(local.API_URL).hostname !== "127.0.0.1")
  throw new Error("LOCAL_BACKEND_REQUIRED");
const db = createClient(local.API_URL, local.SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
await mkdir("work", { recursive: true, mode: 0o700 });
let owner: {
  id: string;
  email: string;
  password: string;
  workspaceId?: string;
  factorId?: string;
  secret?: string;
};
try {
  owner = JSON.parse(await readFile("work/local-owner.json", "utf8"));
  const user = await db.auth.admin.getUserById(owner.id);
  if (user.error) throw new Error();
} catch {
  const password = randomBytes(30).toString("base64url"),
    email = "owner@shortlist.local";
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user)
    throw new Error(
      "LOCAL_OWNER_CREATION_FAILED: preserve existing owner account; inspect local Auth without printing secrets.",
    );
  owner = { id: data.user.id, email, password };
}
if (!owner.workspaceId) {
  const { data: w, error } = await db
    .from("workspaces")
    .insert({ name: "Shortlist local synthetic workspace" })
    .select("id")
    .single();
  if (error) throw new Error("WORKSPACE_SETUP");
  owner.workspaceId = w.id;
  if (
    (
      await db.from("workspace_members").insert({
        workspace_id: w.id,
        user_id: owner.id,
        role: "administrator",
      })
    ).error
  )
    throw new Error("MEMBER_SETUP");
  if (
    (
      await db
        .from("synthetic_workspaces")
        .insert({ workspace_id: w.id, payload: seed(), version: 0 })
    ).error
  )
    throw new Error("STATE_SETUP");
}
await writeFile("work/local-owner.json", JSON.stringify(owner), {
  mode: 0o600,
});
await chmod("work/local-owner.json", 0o600);
let text = "";
try {
  text = await readFile(".env.local", "utf8");
} catch {}
const supplied = new Map(
  text
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+\s*=/.test(l))
    .map((l) => [l.split("=", 1)[0].trim(), l.slice(l.indexOf("=") + 1)]),
);
const config: Record<string, string> = {
  PERSISTENCE_MODE: "supabase-synthetic",
  APP_ENV: "local",
  REAL_CV_DATA_ENABLED: "false",
  APP_URL: "http://127.0.0.1:3218",
  WORKSPACE_ID: owner.workspaceId!,
  NEXT_PUBLIC_SUPABASE_URL: local.API_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: local.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: local.SERVICE_ROLE_KEY,
  AI_ENABLED: "false",
  MONTHLY_PROCESSING_ALLOWANCE: "240",
  CRON_SECRET: randomBytes(32).toString("hex"),
};
for (const [k, v] of Object.entries(config)) supplied.set(k, JSON.stringify(v));
if (!supplied.has("OPENAI_API_KEY")) supplied.set("OPENAI_API_KEY", '""');
if (!supplied.has("AI_MODEL_ID")) supplied.set("AI_MODEL_ID", '""');
const parser = JSON.parse(await readFile("work/parser/manifest.json", "utf8"));
supplied.set("PARSER_BUNDLE_SHA256", JSON.stringify(parser.sha256));
await writeFile(
  ".env.local",
  [...supplied].map(([k, v]) => `${k}=${v}`).join("\n") + "\n",
  { mode: 0o600 },
);
await chmod(".env.local", 0o600);
console.log(
  "Local backend connected. Owner credentials stored privately in work/local-owner.json; .env.local is ignored and mode 600. API key line preserved; AI stays disabled until tested.",
);
