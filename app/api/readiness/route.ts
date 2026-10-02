import { NextResponse } from "next/server";
import { administrator } from "@/lib/administration";
import { privateHeaders } from "@/lib/http";
import { readiness } from "@/lib/readiness";
import { owner } from "@/lib/store";
import { WorkflowError } from "@/lib/workflow";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    administrator(await owner());
    const report = readiness();
    return NextResponse.json(report, {
      status: report.status === "configuration_ready" ? 200 : 503,
      headers: privateHeaders,
    });
  } catch (error) {
    const status = error instanceof WorkflowError ? error.status : 503;
    return NextResponse.json(
      { error: status === 401 || status === 403 ? "ACCESS_DENIED" : "READINESS_UNAVAILABLE" },
      {
        status,
        headers: privateHeaders,
      },
    );
  }
}
