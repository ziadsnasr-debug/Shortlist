"use client";
import { useCallback, useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { toast } from "sonner";
import type { Action, Application } from "@/lib/workflow";
import { formatAge } from "@/lib/operation-status";
type DocumentRecord = {
  id: string;
  application_key: string;
  status: string;
  attempts: number;
  stage:
    | "awaiting_upload"
    | "queued"
    | "processing"
    | "ready"
    | "needs_readable_copy"
    | "attention"
    | "deleted";
  reservation_age_seconds: number | null;
  safe_error_message: string | null;
};
const stageLabels: { [stage: string]: string } = {
  awaiting_upload: "Awaiting upload",
  queued: "Queued or processing",
  processing: "Processing",
  ready: "Ready for review",
  needs_readable_copy: "Needs readable copy",
  attention: "Needs attention",
  deleted: "Deleted",
};
function stepSummary(stage: DocumentRecord["stage"]) {
  if (stage === "awaiting_upload")
    return "Upload awaiting completion · Queue pending · Processing pending · Review pending";
  if (stage === "queued")
    return "Upload complete · Queue queued or processing · Review pending";
  if (stage === "processing")
    return "Upload complete · Queue complete · Processing in progress · Review pending";
  if (stage === "ready")
    return "Upload complete · Queue complete · Processing complete · Ready for review";
  if (stage === "needs_readable_copy")
    return "Upload complete · Queue complete · Needs a checked readable copy";
  return "Upload complete · Queue complete · Needs processing attention";
}
export function DocumentIntake({
  vacancyId,
  batchId,
  version,
  closed,
  applications,
  onRefresh,
  send,
  enabled,
}: {
  vacancyId: string;
  batchId: string;
  version: number;
  closed: boolean;
  applications: (Pick<Application, "id" | "state"> & { label: string })[];
  onRefresh: () => void;
  send: (a: Action) => Promise<unknown>;
  enabled: boolean;
}) {
  const [docs, setDocs] = useState<DocumentRecord[]>([]),
    [busy, setBusy] = useState(false),
    [synthetic, setSynthetic] = useState(false),
    [manual, setManual] = useState(""),
    [error, setError] = useState(""),
    [refreshError, setRefreshError] = useState(""),
    [uploadStep, setUploadStep] = useState<
      "idle" | "reserving" | "transferring" | "queueing"
    >("idle");
  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/documents", { cache: "no-store" }),
        d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setDocs(d.documents);
      setRefreshError("");
    } catch {
      setRefreshError("Unable to refresh processing status. Try again.");
    }
  }, []);
  async function action(body: unknown) {
    const r = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      d = await r.json();
    if (!r.ok) throw new Error(d.error);
    return d;
  }
  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const timer = setInterval(() => {
      void refresh();
      onRefresh();
    }, 6000);
    return () => {
      clearInterval(timer);
    };
  }, [enabled, onRefresh, refresh]);
  return (
    <section className="panel">
      <h3>Synthetic document intake</h3>
      <p>
        PDF or DOCX, maximum 5 MiB. Files stay private. Use generated fictional
        fixtures only.
      </p>
      {error && <p role="alert">{error}</p>}
      {refreshError && <p role="alert">{refreshError}</p>}
      {!enabled ? (
        <p>
          File intake needs configured Supabase staging and a verified parser
          snapshot. Sample CV workflow remains available.
        </p>
      ) : (
        <>
          <label className="flex gap-2 my-4">
            <input
              type="checkbox"
              checked={synthetic}
              onChange={(e) => setSynthetic(e.target.checked)}
            />
            I confirm these files contain fictional data only.
          </label>
          <label htmlFor="synthetic-file">Choose fictional CV</label>
          <Input
            id="synthetic-file"
            type="file"
            accept=".pdf,.docx"
            disabled={!synthetic || closed || busy}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setBusy(true);
              setError("");
              try {
                const type = file.name.toLowerCase().endsWith(".pdf")
                  ? "pdf"
                  : file.name.toLowerCase().endsWith(".docx")
                    ? "docx"
                    : null;
                if (!type || file.size > 5242880)
                  throw new Error("Choose PDF or DOCX up to 5 MiB.");
                setUploadStep("reserving");
                const reservation = await action({
                  type: "reserve",
                  version,
                  vacancyId,
                  batchId,
                  filename: file.name,
                  size: file.size,
                  fileType: type,
                  synthetic: true,
                });
                setUploadStep("transferring");
                const uploaded = await fetch(reservation.uploadUrl, {
                  method: "PUT",
                  headers: {
                    "Content-Type":
                      type === "pdf"
                        ? "application/pdf"
                        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                  },
                  body: file,
                });
                if (!uploaded.ok)
                  throw new Error(
                    "Upload incomplete; reserved item remains visible.",
                  );
                setUploadStep("queueing");
                await action({
                  type: "finalise",
                  documentId: reservation.documentId,
                });
                toast.success(
                  "Document queued. Processing continues without this browser.",
                );
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
                setUploadStep("idle");
                onRefresh();
                e.target.value = "";
              }
            }}
          />
          <p role="status" aria-live="polite">
            {uploadStep === "reserving" && "Reserving a private upload slot…"}
            {uploadStep === "transferring" && "Uploading the fictional file…"}
            {uploadStep === "queueing" && "Queueing the uploaded file…"}
          </p>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void refresh()}
          >
            Refresh processing status
          </Button>
          {docs
            .filter((d) => applications.some((a) => a.id === d.application_key))
            .map((d) => (
            <div className="intake-row" key={d.id}>
              <span>
                {applications.find((a) => a.id === d.application_key)?.label ??
                  "Candidate"}
              </span>
              <span>
                <strong>{stageLabels[d.stage] ?? "Status unavailable"}</strong> ·{" "}
                {d.attempts} attempts · reservation
                age {formatAge(d.reservation_age_seconds)}
                {d.safe_error_message && " · " + d.safe_error_message}
                <br />
                <small>{stepSummary(d.stage)}</small>
              </span>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    const r = await fetch("/api/documents?download=" + d.id, {
                        cache: "no-store",
                      }),
                      data = await r.json();
                    if (!r.ok) throw new Error(data.error);
                    const a = document.createElement("a");
                    a.href = data.url;
                    a.rel = "noopener noreferrer";
                    a.download = "";
                    a.click();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Download original (identity may be visible)
              </Button>
              {!closed && ["attention", "readable_copy"].includes(d.status) && (
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      await action({ type: "retry", documentId: d.id });
                      onRefresh();
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  Retry processing
                </Button>
              )}
            </div>
          ))}
        </>
      )}
      {!closed &&
        applications
          .filter((a) =>
            ["readable_copy", "attention", "processing"].includes(a.state),
          )
          .map((a) => (
            <div className="my-3" key={a.id}>
              <Button variant="outline" onClick={() => setManual(a.id)}>
                Provide checked manual passages for {a.label}
              </Button>
              {manual === a.id && (
                <form
                  className="my-4"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    const ok = await send({
                      type: "manual_source",
                      vacancyId,
                      batchId,
                      applicationId: a.id,
                      name: String(f.get("name")),
                      passages: [
                        {
                          locator: String(f.get("locator")),
                          text: String(f.get("text")),
                        },
                      ],
                      reason: String(f.get("reason")),
                      attest: true,
                    });
                    if (ok) {
                      setManual("");
                      onRefresh();
                    }
                  }}
                >
                  <label htmlFor="manual-name">
                    Fictional candidate name (kept hidden during review)
                  </label>
                  <Input id="manual-name" name="name" maxLength={100} />
                  <label htmlFor="manual-locator">
                    Original page or DOCX paragraph reference
                  </label>
                  <Input
                    id="manual-locator"
                    name="locator"
                    required
                    maxLength={100}
                  />
                  <label htmlFor="manual-text">Relevant transcription</label>
                  <Textarea
                    id="manual-text"
                    name="text"
                    required
                    maxLength={10000}
                  />
                  <label htmlFor="manual-reason">
                    Reason for manual handling
                  </label>
                  <Input
                    id="manual-reason"
                    name="reason"
                    required
                    maxLength={1000}
                  />
                  <label className="flex gap-2 my-3">
                    <input type="checkbox" required />I checked these passages
                    against the original document.
                  </label>
                  <Button>Save checked passages</Button>
                </form>
              )}
            </div>
          ))}
    </section>
  );
}
