import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { recoverDeletions } from "@/lib/pipeline/deletion";
import { consumeDocuments } from "@/lib/pipeline/consumer";
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
    const deadline = Date.now() + 220000;
    return NextResponse.json(
      {
        ...(await consumeDocuments(deadline)),
        deletions: await recoverDeletions(deadline),
      },
      { headers: privateHeaders },
    );
  } catch (e) {
    return fail(e);
  }
}
