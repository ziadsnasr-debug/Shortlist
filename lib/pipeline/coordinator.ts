import "server-only";
import { consumeDocuments } from "./consumer";
import { recoverDeletions } from "./deletion";

export type ProcessingResult = { completed: number; failed: number };
export type PipelineCycleResult = ProcessingResult & { deletions: number };

type PipelineDependencies = {
  consumeDocuments: (deadline: number) => Promise<ProcessingResult>;
  recoverDeletions: (deadline: number) => Promise<number>;
};

const productionDependencies: PipelineDependencies = {
  consumeDocuments,
  recoverDeletions,
};

/**
 * Always attempt durable deletion recovery after processing. A processing
 * failure remains the response failure, but it must not skip due cleanup.
 */
export async function runPipelineCycle(
  deadline: number,
  dependencies: PipelineDependencies = productionDependencies,
): Promise<PipelineCycleResult> {
  let processing: ProcessingResult | undefined;
  let processingError: unknown;
  try {
    processing = await dependencies.consumeDocuments(deadline);
  } catch (error) {
    processingError = error;
  }

  let deletions: number | undefined;
  let deletionError: unknown;
  try {
    deletions = await dependencies.recoverDeletions(deadline);
  } catch (error) {
    deletionError = error;
  }

  if (processingError) throw processingError;
  if (deletionError) throw deletionError;
  if (!processing || deletions === undefined)
    throw new Error("PIPELINE_UNAVAILABLE");
  return { ...processing, deletions };
}
