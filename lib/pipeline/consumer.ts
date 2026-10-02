import "server-only";
import { configuration, processingVersion } from "../config";
import { z } from "zod";
import { databaseClient } from "../supabase";
import type { Application, Workspace } from "../workflow";
import { parseInSandbox } from "./sandbox";
import { assess } from "./ai";
const Message = z.object({ document_id: z.uuid() }).strict();
export async function consumeDocuments() {
  configuration();
  const db = databaseClient();
  const { data: messages, error } = await db.rpc("read_document_queue");
  if (error) throw new Error("QUEUE_UNAVAILABLE");
  let completed = 0,
    failed = 0;
  const deadline = Date.now() + 220000;
  for (const message of messages ?? []) {
    if (Date.now() > deadline - 150000) break;
    const parsed = Message.safeParse(message.message);
    if (!parsed.success) {
      await db.rpc("ack_document_queue", { p_message: message.msg_id });
      failed++;
      continue;
    }
    const id = parsed.data.document_id;
    const { data: d } = await db
      .from("documents")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (
      !d ||
      d.deletion_state !== "retained" ||
      ["complete", "readable_copy", "attention"].includes(d.status)
    ) {
      await db.rpc("ack_document_queue", { p_message: message.msg_id });
      continue;
    }
    const { data: attempt, error: ae } = await db.rpc("document_attempt", {
      p_document: id,
    });
    if (ae) continue;
    if (!attempt) {
      // A process can die after reserving its third attempt. End that job on
      // redelivery; a paused workspace still refuses completion and keeps it.
      const { data: latest } = await db
        .from("documents")
        .select("attempts")
        .eq("id", id)
        .maybeSingle();
      if (latest && latest.attempts >= 3) {
        const { data: terminal, error: finishError } = await db.rpc(
          "complete_document",
          {
            p_document: id,
            p_key: d.processing_key,
            p_result: null,
            p_outputs: null,
            p_usage: null,
            p_error: "PROCESSING_UNAVAILABLE",
          },
        );
        if (!finishError && terminal)
          await db.rpc("ack_document_queue", { p_message: message.msg_id });
      }
      continue;
    }
    try {
      if (d.processing_config !== processingVersion())
        throw new Error("PROCESSING_CONFIGURATION_CHANGED");
      const { error: budget } = await db.rpc("reserve_processing_budget", {
        p_workspace: d.workspace_id,
        p_limit: Number(process.env.MONTHLY_PROCESSING_ALLOWANCE ?? 240),
      });
      if (budget) throw new Error("BUDGET_EXHAUSTED");
      const { data: w } = await db
        .from("synthetic_workspaces")
        .select("payload")
        .eq("workspace_id", d.workspace_id)
        .single();
      const state = w?.payload as Workspace;
      const batch = state?.vacancies
          .find((v) => v.id === d.vacancy_key)
          ?.batches.find((b) => b.id === d.batch_key),
        app = batch?.applications.find((a) => a.id === d.application_key);
      if (!batch || !app || app.state === "disposed" || batch.closed) {
        await db.rpc("ack_document_queue", { p_message: message.msg_id });
        continue;
      }
      const { data: file, error: fe } = await db.storage
        .from("cv-originals")
        .download(d.private_object_key);
      if (fe || !file) throw new Error("STORAGE_UNAVAILABLE");
      const extraction = await parseInSandbox(
        Buffer.from(await file.arrayBuffer()),
      );
      const ready: Application = {
        ...app,
        state: extraction.quality === "readable" ? "ready" : "readable_copy",
        blocks: extraction.blocks.map((b) => ({
          ...b,
          documentVersion: app.documentVersion,
        })),
        sourceFlag: extraction.flags.length
          ? "Inspect source and identity masking: " +
            extraction.flags.join(", ")
          : undefined,
        sourceChecked: false,
        confirmed: false,
      };
      const result =
        extraction.quality === "readable"
          ? await assess(ready, batch.rubric, async () => {
              const { data: current, error } = await db
                .from("workspaces")
                .select("settings")
                .eq("id", d.workspace_id)
                .single();
              if (error || !current || current.settings?.paused)
                throw new Error("PROCESSING_PAUSED");
            })
          : { assessments: {}, outputs: [], usage: [] };
      ready.assessments = result.assessments;
      const { data: committed, error: ce } = await db.rpc("complete_document", {
        p_document: id,
        p_key: d.processing_key,
        p_result: ready,
        p_outputs: result.outputs,
        p_usage: result.usage,
        p_error: null,
      });
      if (ce) throw new Error("COMMIT_UNAVAILABLE");
      if (committed) {
        const { error: ack } = await db.rpc("ack_document_queue", {
          p_message: message.msg_id,
        });
        if (ack) throw new Error("ACK_UNAVAILABLE");
        completed++;
      }
    } catch (error) {
      const code =
        error instanceof Error && error.message === "NEEDS_READABLE_COPY"
          ? "NEEDS_READABLE_COPY"
          : "PROCESSING_UNAVAILABLE";
      const { data: terminal, error: ce } = await db.rpc("complete_document", {
        p_document: id,
        p_key: d.processing_key,
        p_result: null,
        p_outputs: null,
        p_usage: null,
        p_error: code,
      });
      if (!ce && terminal)
        await db.rpc("ack_document_queue", { p_message: message.msg_id });
      failed++;
    }
  }
  return { completed, failed };
}
