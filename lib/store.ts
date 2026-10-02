import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { cookies } from "next/headers";
import { seed, samples } from "@/fixtures/synthetic/seed";
import {
  type Action,
  type Workspace,
  applyAction,
  WorkflowError,
} from "./workflow";
import { configuration } from "./config";
import { databaseClient, sessionClient } from "./supabase";
export type Owner = {
  actor: string;
  workspaceId: string;
  role: "administrator" | "reviewer";
  local: boolean;
};
export async function owner(): Promise<Owner> {
  const config = configuration();
  if (config.mode === "local-synthetic") {
    const jar = await cookies();
    let token = jar.get("shortlist-demo")?.value;
    if (!token || !/^[0-9a-f-]{36}$/.test(token)) {
      token = randomUUID();
      jar.set("shortlist-demo", token, {
        httpOnly: true,
        sameSite: "strict",
        secure: false, // Loopback-only synthetic demo; hosted mode is refused.
        path: "/",
        maxAge: 604800,
      });
    }
    return {
      actor: "synthetic-reviewer",
      workspaceId: token,
      role: "administrator",
      local: true,
    };
  }
  const client = await sessionClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user)
    throw new WorkflowError("Sign in with your invited account.", 401);
  const { data: assurance, error: aalError } =
    await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalError || assurance?.currentLevel !== "aal2")
    throw new WorkflowError("Complete multi-factor authentication.", 403);
  const workspaceId = process.env.WORKSPACE_ID;
  if (!workspaceId)
    throw new WorkflowError("Workspace configuration is missing.", 503);
  const { data: member, error: memberError } = await databaseClient()
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .eq("active", true)
    .single();
  if (memberError || !member)
    throw new WorkflowError("Workspace access denied.", 403);
  return { actor: user.id, workspaceId, role: member.role, local: false };
}
const locks = new Map<string, Promise<unknown>>();
async function exclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => (release = resolve));
  locks.set(key, current);
  await previous.catch(() => {});
  try {
    return await fn();
  } finally {
    release();
    if (locks.get(key) === current) locks.delete(key);
  }
}
function filename(owner: Owner) {
  return path.join(
    process.cwd(),
    "work",
    "synthetic-state",
    `${owner.workspaceId}.json`,
  );
}
export async function readState(access: Owner): Promise<Workspace> {
  if (access.local) {
    try {
      return JSON.parse(await readFile(filename(access), "utf8"));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      return seed();
    }
  }
  const { data, error } = await databaseClient()
    .from("synthetic_workspaces")
    .select("payload")
    .eq("workspace_id", access.workspaceId)
    .single();
  if (error)
    throw new WorkflowError(
      "Workspace not initialised. Run the bootstrap step.",
      503,
    );
  return data.payload;
}
export async function mutate(access: Owner, version: number, action: Action) {
  return exclusive(access.workspaceId, async () => {
    const state = await readState(access);
    if (state.version !== version)
      throw new WorkflowError(
        "Another save changed this workspace. Reload before trying again.",
        409,
      );
    if (
      access.role !== "administrator" &&
      ["create", "rubric", "publish", "next", "dispose"].includes(action.type)
    )
      throw new WorkflowError("Administrator access required.", 403);
    const next = applyAction(state, action, access.actor, randomUUID, samples);
    if (access.local) {
      await mkdir(path.dirname(filename(access)), { recursive: true });
      const temp = filename(access) + "." + randomUUID() + ".tmp";
      await writeFile(temp, JSON.stringify(next), { mode: 0o600 });
      await rename(temp, filename(access));
    } else {
      const { data, error } = await databaseClient().rpc(
        "save_synthetic_workspace",
        {
          p_workspace: access.workspaceId,
          p_actor: access.actor,
          p_expected: version,
          p_payload: next,
          p_operation: action.type,
        },
      );
      if (error)
        throw new WorkflowError(
          "Save denied or conflicted. Reload before trying again.",
          409,
        );
      if (!data)
        throw new WorkflowError(
          "Concurrent update. Reload before trying again.",
          409,
        );
    }
    return next;
  });
}
