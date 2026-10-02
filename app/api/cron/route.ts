import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runPipelineCycle } from "@/lib/pipeline/coordinator";
import { PIPELINE_INVOCATION_MS } from "@/lib/pipeline/deadline";
import { privateHeaders, fail } from "@/lib/http";
export const maxDuration = 240;
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET,
    received = req.headers.get("authorization");
  if (
    !expected ||
    !received ||
    Buffer.byteLength(received) !== Buffer.byteLength(`Bearer ${expected}`) ||
    !timingSafeEqual(Buffer.from(received), Buffer.from(`Bearer ${expected}`))
  )
    return NextResponse.json(
      { error: "Access denied." },
      { status: 401, headers: privateHeaders },
    );
  try {
    const deadline = Date.now() + PIPELINE_INVOCATION_MS;
    return NextResponse.json(await runPipelineCycle(deadline), {
      headers: privateHeaders,
    });
  } catch (e) {
    return fail(e);
  }
}
