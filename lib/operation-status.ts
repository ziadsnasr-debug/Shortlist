export type OperationDocument = {
  id?: string;
  application_key?: string;
  status: string;
  attempts: number;
  reserved_at: string;
  safe_error_code: string | null;
  deletion_state?: string;
};

export type DocumentStage =
  | "awaiting_upload"
  | "queued"
  | "processing"
  | "ready"
  | "needs_readable_copy"
  | "attention"
  | "deleted";

const safeErrors: Record<string, string> = {
  NEEDS_READABLE_COPY: "Needs a checked readable copy.",
  PROCESSING_CONFIGURATION_CHANGED: "Configuration changed; retry required.",
  PROCESSING_FAILED: "Processing needs attention.",
};

export function documentStage(document: OperationDocument): DocumentStage {
  if (document.deletion_state === "pending" || document.status === "deleted")
    return "deleted";
  if (document.status === "reserved") return "awaiting_upload";
  if (document.status === "processing") return "processing";
  if (document.status === "attention") return "attention";
  if (document.status === "readable_copy") return "needs_readable_copy";
  if (document.status === "complete") return "ready";
  return "queued";
}

export function safeErrorMessage(code: string | null) {
  return code ? (safeErrors[code] ?? "Processing needs attention.") : null;
}

export function ageSeconds(iso: string, now = Date.now()) {
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.floor((now - timestamp) / 1000));
}

export function formatAge(seconds: number | null) {
  if (seconds === null) return "Age unavailable";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function operationSummary(documents: OperationDocument[]) {
  const summary = {
    total: documents.length,
    awaiting_upload: 0,
    queued_or_processing: 0,
    ready: 0,
    attention: 0,
  };
  for (const document of documents) {
    const stage = documentStage(document);
    if (stage === "needs_readable_copy") summary.attention++;
    else if (stage === "queued" || stage === "processing")
      summary.queued_or_processing++;
    else if (stage !== "deleted") summary[stage]++;
  }
  return summary;
}
