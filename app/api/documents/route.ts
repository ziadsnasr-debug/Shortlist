import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { processingVersion } from "@/lib/config";
import { rateLimit } from "@/lib/rate-limit";
import { owner } from "@/lib/store";
import { jsonBody, fail, privateHeaders } from "@/lib/http";
import {
  reserve,
  finaliseUpload,
  documentsFor,
  ownedDocument,
} from "@/lib/pipeline/documents";
import { databaseClient } from "@/lib/supabase";
import { consumeDocuments } from "@/lib/pipeline/consumer";
import { WorkflowError } from "@/lib/workflow";
export const maxDuration = 240;
const Input = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("reserve"),
      version: z.number().int().nonnegative(),
      vacancyId: z.string().max(80),
      batchId: z.string().max(80),
      filename: z.string().min(1).max(200),
      size: z.number().int().positive().max(5242880),
      fileType: z.enum(["pdf", "docx"]),
      synthetic: z.literal(true),
    })
    .strict(),
  z
    .object({ type: z.enum(["finalise", "retry"]), documentId: z.uuid() })
    .strict(),
]);
export async function GET(req: NextRequest) {
  try {
    const access = await owner();
    if (req.nextUrl.searchParams.has("download")) {
      const id = z.uuid().parse(req.nextUrl.searchParams.get("download")),
        document = await ownedDocument(access, id);
      const { data, error } = await databaseClient()
        .storage.from("cv-originals")
        .createSignedUrl(document.private_object_key, 60, {
          download: "Shortlist_original." + document.type,
        });
      if (error || !data) throw new WorkflowError("Original unavailable.", 404);
      return NextResponse.json(
        { url: data.signedUrl, expiresSeconds: 60 },
        { headers: privateHeaders },
      );
    }
    return NextResponse.json(await documentsFor(access), {
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
    if (!access.local) await rateLimit(access.actor, "document-write", 30, 60);
    if (input.type === "reserve")
      return NextResponse.json(
        await reserve(access, { ...input, type: input.fileType }),
        { headers: privateHeaders },
      );
    if (input.type === "retry") {
      await ownedDocument(access, input.documentId);
      if (access.role !== "administrator")
        throw new WorkflowError("Administrator access required.", 403);
      const { data, error } = await databaseClient().rpc("retry_document", {
        p_workspace: access.workspaceId,
        p_actor: access.actor,
        p_document: input.documentId,
        p_config: processingVersion(),
      });
      if (error || !data)
        throw new WorkflowError("Retry unavailable for this document.", 422);
    } else await finaliseUpload(access, input.documentId);
    after(async () => {
      try {
        await consumeDocuments();
      } catch {
        /* Safe recovery via durable queue; no sensitive error logging. */
      }
    });
    return NextResponse.json({ ok: true }, { headers: privateHeaders });
  } catch (e) {
    return fail(e);
  }
}
