import { readBoundedText } from "@/lib/http";
import { validOrigin } from "@/lib/origin";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  Action,
  publicState,
  WorkflowError,
  exportBatch,
  requireRule,
} from "@/lib/workflow";
import { owner, readState, mutate } from "@/lib/store";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
function errorResponse(error: unknown) {
  if (error instanceof WorkflowError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status, headers },
    );
  if (error instanceof z.ZodError)
    return NextResponse.json(
      { error: "Invalid request. Check field values." },
      { status: 422, headers },
    );
  return NextResponse.json(
    { error: "Operation failed. Your saved state remains intact." },
    { status: 503, headers },
  );
}
export async function GET(req: NextRequest) {
  try {
    const access = await owner();
    const state = await readState(access);
    if (req.nextUrl.searchParams.has("export")) {
      const v = state.vacancies.find(
          (v) => v.id === req.nextUrl.searchParams.get("vacancy"),
        ),
        b = v?.batches.find(
          (b) => b.id === req.nextUrl.searchParams.get("export"),
        );
      requireRule(v && b, "Batch not found.");
      return new NextResponse(exportBatch(v, b), {
        headers: {
          ...headers,
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="Shortlist_Synthetic_Review.csv"',
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    return NextResponse.json(
      {
        ...publicState(
          state,
          req.nextUrl.searchParams.get("reveal") === "true",
        ),
        role: access.role,
        mode: access.local ? "Local synthetic" : "Supabase synthetic",
        capabilities: {
          uploads: !access.local && !!process.env.PARSER_SNAPSHOT_ID,
          ai:
            process.env.AI_ENABLED === "true" &&
            !!process.env.ANTHROPIC_API_KEY,
        },
      },
      { headers },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    if (!validOrigin(req))
      throw new WorkflowError("Request origin denied.", 403);
    if (Number(req.headers.get("content-length") ?? 0) > 200000)
      throw new WorkflowError("Request too large.", 413);
    const text = await readBoundedText(req, 200000);
    if (text.length > 200000)
      throw new WorkflowError("Request too large.", 413);
    const body = z
      .object({ version: z.number().int().nonnegative(), action: Action })
      .strict()
      .parse(JSON.parse(text));
    const access = await owner();
    const state = await mutate(access, body.version, body.action);
    return NextResponse.json(
      {
        ...publicState(state),
        role: access.role,
        mode: access.local ? "Local synthetic" : "Supabase synthetic",
        capabilities: {
          uploads: !access.local && !!process.env.PARSER_SNAPSHOT_ID,
          ai:
            process.env.AI_ENABLED === "true" &&
            !!process.env.ANTHROPIC_API_KEY,
        },
      },
      { headers },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
