import "server-only";
import { configuration, processingVersion } from "../config";
import { z } from "zod";
import { signalUntil } from "../bounded-fetch";
import { databaseClient } from "../supabase";
import type { Application, Workspace } from "../workflow";
import { parseInSandbox } from "./sandbox";
import { assess } from "./ai";
const Message = z.object({ document_id: z.uuid() }).strict();
export async function consumeDocuments(deadline = Date.now() + 220000) {
  if (Date.now() > deadline - 175000) return { completed: 0, failed: 0 };
  configuration();
  const workDeadline = deadline - 35000;
  const signal = signalUntil(workDeadline);
  const db = databaseClient(workDeadline);
  const { data: messages, error } = await db.rpc("read_document_queue");
  if (signal.aborted) return { completed: 0, failed: 0 };
  if (error) throw new Error("QUEUE_UNAVAILABLE");
  let completed = 0,
    failed = 0;
  for (const message of messages ?? []) {
    // Leave enough time for sandbox setup, two bounded model calls and the
    // database commit. The cron route reserves the remainder for deletions.
    if (Date.now() > deadline - 175000 || signal.aborted) break;
    const parsed = Message.safeParse(message.message);
    if (!parsed.success) {
      await db.rpc("ack_document_queue", { p_message: message.msg_id });
      failed++;
      continue;
    }
    const id = parsed.data.document_id;
    const { data: d, error: documentError } = await db
      .from("documents")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (signal.aborted) break;
    if (documentError) continue;
    if (
      !d ||
      d.deletion_state !== "retained" ||
      ["complete", "readable_copy", "attention"].includes(d.status)
    ) {
      await db.rpc("ack_document_queue", { p_message: message.msg_id });
      continue;
    }
    const { data: w, error: workspaceError } = await db
      .from("synthetic_workspaces")
      .select("payload")
      .eq("workspace_id", d.workspace_id)
      .single();
    if (signal.aborted) break;
    if (workspaceError || !w) continue;
    const state = w.payload as Workspace;
    const batch = state.vacancies
        .find((v) => v.id === d.vacancy_key)
        ?.batches.find((b) => b.id === d.batch_key),
      app = batch?.applications.find((a) => a.id === d.application_key);
    if (
      !batch ||
      !app ||
      app.state !== "processing" ||
      batch.closed ||
      batch.snapshot
    ) {
      await db.rpc("ack_document_queue", { p_message: message.msg_id });
      continue;
    }
    if (d.processing_config !== processingVersion()) {
      const { data: marked, error: markError } = await db.rpc(
        "complete_document",
        {
          p_document: id,
          p_key: d.processing_key,
          p_generation: d.processing_generation,
          p_result: null,
          p_outputs: null,
          p_usage: null,
          p_error: "PROCESSING_CONFIGURATION_CHANGED",
        },
      );
      if (!markError && marked)
        await db.rpc("ack_document_queue", { p_message: message.msg_id });
      continue;
    }
    const { data: attempt, error: ae } = await db.rpc("document_attempt", {
      p_document: id,
      p_generation: d.processing_generation,
    });
    if (signal.aborted) break;
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
            p_generation: d.processing_generation,
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
      signal.throwIfAborted();
      const { error: budget } = await db.rpc("reserve_processing_budget", {
        p_workspace: d.workspace_id,
        p_limit: Number(process.env.MONTHLY_PROCESSING_ALLOWANCE ?? 240),
      });
      if (budget) throw new Error("BUDGET_EXHAUSTED");
      const { data: file, error: fe } = await db.storage
        .from("cv-originals")
        .download(d.private_object_key);
      if (fe || !file) throw new Error("STORAGE_UNAVAILABLE");
      signal.throwIfAborted();
      const extraction = await parseInSandbox(
        Buffer.from(await file.arrayBuffer()),
        signal,
      );
      signal.throwIfAborted();
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
            }, signal)
          : { assessments: {}, outputs: [], usage: [] };
      signal.throwIfAborted();
      ready.assessments = result.assessments;
      const { data: committed, error: ce } = await db.rpc("complete_document", {
        p_document: id,
        p_key: d.processing_key,
        p_generation: d.processing_generation,
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
      // An expired invocation cannot safely perform another RPC. The queue
      // message stays available for redelivery under pgmq visibility.
      if (signal.aborted) break;
      const code =
        error instanceof Error && error.message === "NEEDS_READABLE_COPY"
          ? "NEEDS_READABLE_COPY"
          : "PROCESSING_UNAVAILABLE";
      const { data: terminal, error: ce } = await db.rpc("complete_document", {
        p_document: id,
        p_key: d.processing_key,
        p_generation: d.processing_generation,
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
