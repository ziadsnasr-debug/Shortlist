import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { databaseClient } from "@/lib/supabase";
import { owner, readState } from "@/lib/store";
import { jsonBody, fail, privateHeaders } from "@/lib/http";
import { draftCriteria } from "@/lib/pipeline/ai";
import { WorkflowError } from "@/lib/workflow";
export async function POST(req: NextRequest) {
  try {
    const input = await jsonBody(
        req,
        z
          .object({ vacancyId: z.string().max(80), synthetic: z.literal(true) })
          .strict(),
      ),
      access = await owner();
    if (access.role !== "administrator")
      throw new WorkflowError("Administrator access required.", 403);
    if (access.local)
      throw new WorkflowError(
        "AI drafting requires isolated Supabase staging.",
        503,
      );
    if (!access.local) await rateLimit(access.actor, "criteria-ai", 5, 60);
    const vacancy = (await readState(access)).vacancies.find(
      (v) => v.id === input.vacancyId,
    );
    if (!vacancy) throw new WorkflowError("Vacancy unavailable.", 404);
    const { error: budget } = await databaseClient().rpc(
      "reserve_processing_budget",
      {
        p_workspace: access.workspaceId,
        p_limit: Number(process.env.MONTHLY_PROCESSING_ALLOWANCE ?? 240),
      },
    );
    if (budget) throw new WorkflowError("Processing allowance exhausted.", 429);
    return NextResponse.json(
      { rubric: await draftCriteria(vacancy.description), published: false },
      { headers: privateHeaders },
    );
  } catch (e) {
    return fail(e);
  }
}
