import { rateLimit } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { owner } from "@/lib/store";
import { jsonBody, fail, privateHeaders } from "@/lib/http";
import { deleteApplication } from "@/lib/pipeline/deletion";
export async function POST(req: NextRequest) {
  try {
    const input = await jsonBody(
      req,
      z
        .object({
          applicationId: z.string().min(1).max(80),
          confirm: z.literal("DELETE CONTENT"),
        })
        .strict(),
    );
    const access = await owner();
    if (!access.local) await rateLimit(access.actor, "delete-content", 30, 60);
    return NextResponse.json(
      await deleteApplication(access, input.applicationId),
      { headers: privateHeaders },
    );
  } catch (e) {
    return fail(e);
  }
}
