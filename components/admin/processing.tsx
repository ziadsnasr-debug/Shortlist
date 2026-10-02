"use client";
import {
  CircleCheck,
  Clock,
  FileWarning,
  ScanText,
  TriangleAlert,
  Upload,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { stageHelp, type FileStage } from "@/components/workflow/processing";
import { formatAge } from "@/lib/operation-status";
import {
  shortId,
  type AdminDocument,
  type Busy,
  type ProcessingAllowance,
  type ProcessingSummary,
  type SendAction,
} from "./types";

type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

function describe(d: AdminDocument): {
  stage: FileStage;
  label: string;
  tone: Tone;
  icon: ReactNode;
} {
  switch (d.status) {
    case "processing":
      return {
        stage: "reading",
        label: "Processing",
        tone: "accent",
        icon: <ScanText />,
      };
    case "complete":
      return {
        stage: "ready",
        label: "Processed",
        tone: "success",
        icon: <CircleCheck />,
      };
    case "readable_copy":
      return {
        stage: "readable_copy",
        label: "Needs a readable copy",
        tone: "warning",
        icon: <FileWarning />,
      };
    case "attention":
      return {
        stage: "attention",
        label: "Needs attention",
        tone: "danger",
        icon: <TriangleAlert />,
      };
    case "reserved":
      return {
        stage: "awaiting_upload",
        label: "Awaiting upload",
        tone: "neutral",
        icon: <Upload />,
      };
    default:
      // The queue cannot tell waiting from running for queued files.
      return {
        stage: "queued",
        label: "Queued or processing",
        tone: "neutral",
        icon: <Clock />,
      };
  }
}

export function ProcessingTab({
  documents,
  summary,
  allowance,
  paused,
  busy,
  send,
  refresh,
}: {
  documents: AdminDocument[];
  summary?: ProcessingSummary;
  allowance?: ProcessingAllowance;
  paused: boolean;
  busy: Busy;
  send: SendAction;
  refresh: () => Promise<void>;
}) {
  const working = busy !== null;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <section
        aria-labelledby="processing-heading"
        className="grid grid-cols-[minmax(0,1fr)] gap-4"
      >
        <div className="grid grid-cols-[minmax(0,1fr)] max-w-prose gap-1">
          <h2 id="processing-heading">Processing</h2>
          <p className="text-sm">
            Uploads start processing automatically. Scheduled recovery runs
            daily on the current plan. Process up to two pending files now, or
            refresh to check an existing job.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            loading={busy === "process"}
            disabled={working || paused}
            aria-describedby={paused ? "process-paused" : undefined}
            onClick={() => void send({ type: "process" })}
          >
            Process pending files
          </Button>
          <Button
            variant="outline"
            loading={busy === "refresh"}
            disabled={working}
            onClick={() => void refresh()}
          >
            Refresh status
          </Button>
        </div>
        {summary && (
          <dl
            role="status"
            aria-label="Processing status"
            className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-card p-4 text-sm sm:grid-cols-5"
          >
            {(
              [
                ["Retained files", summary.total],
                ["Awaiting upload", summary.awaiting_upload],
                ["Queued or processing", summary.queued_or_processing],
                ["Ready", summary.ready],
                ["Need attention", summary.attention],
              ] as const
            ).map(([term, value]) => (
              <div key={term} className="grid gap-0.5">
                <dt className="text-xs text-muted-foreground">{term}</dt>
                <dd className="font-mono text-base tabular-nums text-foreground">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        )}
        <section
          aria-labelledby="allowance-heading"
          className="grid gap-3 rounded-lg border border-border bg-card p-4"
        >
          <div className="grid gap-1">
            <h3 id="allowance-heading" className="text-base font-medium">
              Monthly processing allowance
            </h3>
            <p className="text-sm text-muted-foreground">
              Includes queued uploads, AI criteria drafts, processing attempts and retries, even
              when processing fails. This is not a completed-CV count or spend.
              The period is based on UTC.
            </p>
          </div>
          {allowance ? (
            <>
              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                {(
                  [
                    ["Period", allowance.period],
                    ["Used", allowance.used],
                    ["Limit", allowance.limit],
                    ["Remaining", allowance.remaining],
                  ] as const
                ).map(([term, value]) => (
                  <div key={term} className="grid gap-0.5">
                    <dt className="text-xs text-muted-foreground">{term}</dt>
                    <dd className="font-mono tabular-nums text-foreground">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
              {allowance.state === "near_limit" && (
                <p role="status" className="text-sm text-amber-700 dark:text-amber-300">
                  This workspace is nearing its monthly processing allowance.
                </p>
              )}
              {allowance.state === "exhausted" && (
                <p role="status" className="text-sm text-destructive">
                  This workspace has used its monthly processing allowance.
                  New processing requires remaining allowance. Files needing
                  attention may also need an explicit retry.
                </p>
              )}
            </>
          ) : (
            <p role="status" className="text-sm text-muted-foreground">
              Monthly allowance usage is unavailable. Refresh or contact an
              administrator if this continues.
            </p>
          )}
        </section>
        {paused && (
          <p id="process-paused" className="text-sm">
            Processing is paused. Turn off Pause intake and inference in
            Controls, then save, before processing files.
          </p>
        )}
      </section>

      <section
        aria-labelledby="documents-heading"
        className="grid grid-cols-[minmax(0,1fr)] gap-3"
      >
        <h2 id="documents-heading">Documents</h2>
        {documents.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-sm">
            No documents are waiting or recorded. Uploaded CVs appear here while
            they are processed.
          </p>
        ) : (
          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead scope="col">Document</TableHead>
                  <TableHead scope="col">Status</TableHead>
                  <TableHead scope="col" className="text-right">
                    Attempts
                  </TableHead>
                  <TableHead scope="col">Upload age</TableHead>
                  <TableHead scope="col">What it means</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((d) => {
                  const s = describe(d);
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="align-top">
                        <span title={d.id} className="font-mono text-xs">
                          <span aria-hidden="true">{shortId(d.id)}</span>
                          <span className="sr-only">{d.id}</span>
                        </span>
                      </TableCell>
                      <TableCell className="align-top">
                        <StatusChip tone={s.tone} icon={s.icon}>
                          {s.label}
                        </StatusChip>
                      </TableCell>
                      <TableCell className="text-right align-top font-mono tabular-nums">
                        {d.attempts ?? "–"}
                      </TableCell>
                      <TableCell className="align-top whitespace-nowrap">
                        {d.reservation_age_seconds === undefined
                          ? "–"
                          : formatAge(d.reservation_age_seconds)}
                      </TableCell>
                      <TableCell className="max-w-md text-muted-foreground">
                        {d.safe_error_message && (
                          <span className="block text-foreground">
                            {d.safe_error_message}
                          </span>
                        )}
                        {stageHelp(s.stage, d.safe_error_code) ??
                          "No problem recorded."}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
