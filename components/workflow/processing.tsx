import { cn } from "@/lib/utils";
import type { PublicApp } from "./types";

export type DocumentRecord = {
  id: string;
  application_key: string;
  status: string;
  attempts: number;
  safe_error_code?: string | null;
};

// Stages the backend can actually tell apart. "Reading" covers text
// extraction and evidence finding together: the queue does not report which
// of the two is running, so the interface does not pretend to know.
export type FileStage =
  | "awaiting_upload"
  | "queued"
  | "reading"
  | "ready"
  | "reviewed"
  | "readable_copy"
  | "attention"
  | "disposed";

export function fileStage(
  app: Pick<PublicApp, "state" | "confirmed">,
  doc?: DocumentRecord,
): FileStage {
  if (app.state === "disposed") return "disposed";
  if (app.state === "ready") return app.confirmed ? "reviewed" : "ready";
  if (app.state === "readable_copy" || doc?.status === "readable_copy")
    return "readable_copy";
  if (app.state === "attention" || doc?.status === "attention")
    return "attention";
  if (doc?.status === "reserved") return "awaiting_upload";
  if (doc?.status === "processing") return "reading";
  return "queued";
}

export const stageLabel: Record<FileStage, string> = {
  awaiting_upload: "Awaiting upload",
  queued: "Queued or processing",
  reading: "Reading the CV and finding evidence",
  ready: "Ready to review",
  reviewed: "Reviewed",
  readable_copy: "Needs a readable copy",
  attention: "Needs attention",
  disposed: "Disposition recorded",
};

export const inFlight = (s: FileStage) =>
  s === "awaiting_upload" || s === "queued" || s === "reading";
export const needsAttention = (s: FileStage) =>
  s === "readable_copy" || s === "attention";

// Plain explanations for the parser and queue's safe error codes. Each one
// says what to do next; none exposes internals.
export function stageHelp(stage: FileStage, code?: string | null) {
  if (stage === "readable_copy" || code === "NEEDS_READABLE_COPY")
    return "No readable text was found, for example scanned pages. Upload a text-based copy, or transcribe the relevant passages and check them against the original.";
  switch (code) {
    case "FILE_SIGNATURE":
      return "This doesn't look like a genuine PDF or DOCX file. Upload the original file again.";
    case "FILE_SIZE":
    case "PARSER_OUTPUT_LIMIT":
      return "This CV is over the size, page or text limit. Upload a shorter copy, or transcribe the relevant passages.";
    case "PROCESSING_PAUSED":
      return "An administrator has paused processing. It continues when processing resumes.";
    case "BUDGET_EXHAUSTED":
      return "This workspace's processing allowance is used up. An administrator can raise it, then retry.";
    case "PROCESSING_CONFIGURATION_CHANGED":
      return "Processing settings changed after this file was queued. Retry to process it with the current settings.";
    case "AI_NOT_CONFIGURED":
    case "PARSER_NOT_CONFIGURED":
      return "Processing isn't set up for this workspace yet. Ask an administrator.";
  }
  if (stage === "attention")
    return "Processing stopped before it finished. Retry, or transcribe the relevant passages. A processing problem never counts as zero points.";
  if (stage === "queued") return "Usually starts within a few seconds.";
  return null;
}

// A page being read. Lines firm up under a scan line, a few highlight as
// evidence is found, and on completion the lines fold into the logo's three
// bars before resolving to a check. Pure CSS, so it costs no main-thread work
// and becomes a static icon under reduced motion.
export function ProcessingGlyph({
  stage,
  className,
}: {
  stage: FileStage;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 40 48"
      className={cn("glyph", `glyph-${stage}`, className)}
      aria-hidden="true"
    >
      <rect className="glyph-page" x="4" y="2" width="32" height="44" rx="5" />
      <rect
        className="glyph-ln k1 hl"
        x="10"
        y="10"
        width="20"
        height="3"
        rx="1.5"
      />
      <rect
        className="glyph-ln drop"
        x="10"
        y="16"
        width="16"
        height="3"
        rx="1.5"
      />
      <rect
        className="glyph-ln k2 hl hl-b"
        x="10"
        y="22"
        width="18"
        height="3"
        rx="1.5"
      />
      <rect
        className="glyph-ln drop hl hl-c"
        x="10"
        y="28"
        width="14"
        height="3"
        rx="1.5"
      />
      <rect
        className="glyph-ln k3"
        x="10"
        y="34"
        width="17"
        height="3"
        rx="1.5"
      />
      <rect
        className="glyph-scan"
        x="8"
        y="8"
        width="24"
        height="1.5"
        rx="0.75"
      />
      <path className="glyph-tick" d="M12 24l6 6 11-12" />
      <path className="glyph-alert" d="M20 15v10M20 30.5v.5" />
    </svg>
  );
}
