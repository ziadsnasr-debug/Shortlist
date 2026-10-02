import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { owner } from "@/lib/store";
import { jsonBody, fail, privateHeaders } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import {
  retention,
  draftRetentionPolicy,
  placeRetentionHold,
  releaseRetentionHold,
} from "@/lib/retention";

const Input = z.union([
  z.object({ action: z.literal("draft_policy"), proposedDays: z.number().int().min(1).max(3650).nullable(), startEvent: z.literal("batch_finalised_at") }).strict(),
  z.object({ action: z.literal("place_hold"), scope: z.literal("workspace"), reasonCode: z.enum(["legal", "investigation", "subject_request", "operational"]) }).strict(),
  z.object({ action: z.literal("place_hold"), scope: z.literal("application"), applicationId: z.string().min(1).max(80), reasonCode: z.enum(["legal", "investigation", "subject_request", "operational"]) }).strict(),
  z.object({ action: z.literal("release_hold"), holdId: z.uuid() }).strict(),
]);
export async function GET() {
  try { return NextResponse.json(await retention(await owner()), { headers: privateHeaders }); }
  catch (error) { return fail(error); }
}
export async function POST(req: NextRequest) {
  try {
    const input = await jsonBody(req, Input), access = await owner();
    await rateLimit(access.actor, "retention-write", 10, 60);
    if (input.action === "draft_policy") await draftRetentionPolicy(access, input.proposedDays, input.startEvent);
    else if (input.action === "place_hold") await placeRetentionHold(access, input.scope, "applicationId" in input ? input.applicationId : undefined, input.reasonCode);
    else await releaseRetentionHold(access, input.holdId);
    return NextResponse.json(await retention(access), { headers: privateHeaders });
  } catch (error) { return fail(error); }
}
