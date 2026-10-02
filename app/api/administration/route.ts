import { rateLimit } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { owner } from "@/lib/store";
import { databaseClient } from "@/lib/supabase";
import { administration, administrator } from "@/lib/administration";
import { jsonBody, fail, privateHeaders } from "@/lib/http";
import { consumeDocuments } from "@/lib/pipeline/consumer";
import { recoverDeletions } from "@/lib/pipeline/deletion";
import { WorkflowError } from "@/lib/workflow";
export const maxDuration = 240;
const Input = z.discriminatedUnion("type", [
  z.object({ type: z.literal("process") }).strict(),
  z
    .object({
      type: z.literal("invite"),
      email: z.email(),
      role: z.enum(["administrator", "reviewer"]),
    })
    .strict(),
  z
    .object({
      type: z.literal("member"),
      userId: z.uuid(),
      active: z.boolean(),
      role: z.enum(["administrator", "reviewer"]),
    })
    .strict(),
  z
    .object({
      type: z.literal("settings"),
      paused: z.boolean(),
      retentionDays: z.number().int().min(1).max(3650).nullable(),
      incidentOwner: z.string().trim().max(100),
    })
    .strict(),
]);
export async function GET() {
  try {
    return NextResponse.json(await administration(await owner()), {
      headers: privateHeaders,
    });
  } catch (e) {
    return fail(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    const input = await jsonBody(req, Input),
      access = await owner();
    administrator(access);
    await rateLimit(access.actor, "admin-write", 10, 60);
    const db = databaseClient();
    if (input.type === "process") {
      const deadline = Date.now() + 220000;
      const result = {
        ...(await consumeDocuments(deadline)),
        deletions: await recoverDeletions(deadline),
      };
      const { error } = await db.from("audit_events").insert({
        workspace_id: access.workspaceId,
        actor: access.actor,
        operation: "manual_processing",
        entity_id: access.workspaceId,
        safe_metadata: result,
      });
      if (error)
        throw new WorkflowError(
          "Processing finished; audit unavailable. Reload processing status before retrying.",
          503,
        );
      return NextResponse.json(
        { ok: true, ...result },
        { headers: privateHeaders },
      );
    }
    if (input.type === "invite") {
      if (!process.env.APP_URL)
        throw new WorkflowError(
          "APP_URL and approved authentication sender required.",
          503,
        );
      // Called only by administrator's explicit invite action; not by setup/test outside local fixtures.
      const { data, error } = await db.auth.admin.inviteUserByEmail(
        input.email,
        {
          redirectTo: new URL("/auth/confirm", process.env.APP_URL).toString(),
        },
      );
      if (error || !data.user)
        throw new WorkflowError(
          "Invitation unavailable. Check authentication sender settings.",
          422,
        );
      const { error: membership } = await db.rpc("manage_member", {
        p_workspace: access.workspaceId,
        p_actor: access.actor,
        p_user: data.user.id,
        p_role: input.role,
        p_active: true,
      });
      if (membership)
        throw new WorkflowError(
          "Invitation submitted but membership failed. Administrator must reconcile before reinviting.",
          503,
        );
    } else if (input.type === "member") {
      const { error } = await db.rpc("manage_member", {
        p_workspace: access.workspaceId,
        p_actor: access.actor,
        p_user: input.userId,
        p_role: input.role,
        p_active: input.active,
      });
      if (error)
        throw new WorkflowError(
          "Member change denied. Keep at least one active administrator.",
          422,
        );
    } else {
      const { error } = await db.rpc("manage_settings", {
        p_workspace: access.workspaceId,
        p_actor: access.actor,
        p_settings: {
          paused: input.paused,
          retentionDays: input.retentionDays,
          incidentOwner: input.incidentOwner,
        },
      });
      if (error) throw new Error("SETTINGS_UNAVAILABLE");
    }
    return NextResponse.json({ ok: true }, { headers: privateHeaders });
  } catch (e) {
    return fail(e);
  }
}
