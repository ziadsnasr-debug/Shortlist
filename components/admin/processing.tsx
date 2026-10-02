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
import {
  shortId,
  type AdminDocument,
  type Busy,
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
        stage: "uploading",
        label: "Uploading",
        tone: "neutral",
        icon: <Upload />,
      };
    default:
      return d.attempts === 0
        ? {
            stage: "queued",
            label: "Waiting to start",
            tone: "neutral",
            icon: <Clock />,
          }
        : {
            stage: "reading",
            label: "Reading",
            tone: "accent",
            icon: <ScanText />,
          };
  }
}

export function ProcessingTab({
  documents,
  paused,
  busy,
  send,
  refresh,
}: {
  documents: AdminDocument[];
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
                      <TableCell className="max-w-md text-muted-foreground">
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
