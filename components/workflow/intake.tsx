"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  LazyMotion,
  MotionConfig,
  domAnimation,
  m,
} from "motion/react";
import { ArrowRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Notice } from "./common";
import {
  type DocumentRecord,
  type FileStage,
  ProcessingGlyph,
  fileStage,
  inFlight,
  needsAttention,
  stageHelp,
  stageLabel,
} from "./processing";
import { UploadZone } from "./upload";
import type { PublicApp, PublicBatch, PublicVacancy, Send } from "./types";

const settle = { type: "spring", bounce: 0, duration: 0.35 } as const;

export function Intake({
  vacancy,
  batch,
  send,
  busy,
  onNext,
  onRefresh,
  uploads,
  canDispose,
}: {
  canDispose: boolean;
  vacancy: PublicVacancy;
  batch: PublicBatch;
  send: Send;
  busy: boolean;
  onNext: () => void;
  onRefresh: () => void;
  version: number;
  uploads: boolean;
}) {
  const [docs, setDocs] = useState<DocumentRecord[]>([]);
  const [error, setError] = useState("");
  const [refreshError, setRefreshError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [open, setOpen] = useState<{
    id: string;
    form: "dispose" | "manual";
  } | null>(null);
  const [kick, setKick] = useState(0);

  const docFor = (a: PublicApp) => docs.find((d) => d.application_key === a.id);
  const rows = batch.applications.map((a) => ({
    app: a,
    doc: docFor(a),
    stage: fileStage(a, docFor(a)),
  }));
  const active = rows.filter((r) => r.stage !== "disposed");
  const ready = active.filter(
    (r) => r.stage === "ready" || r.stage === "reviewed",
  ).length;
  const issues = rows.filter((r) => needsAttention(r.stage));
  const flowing = rows.some((r) => inFlight(r.stage));

  const loadDocs = useCallback(async () => {
    if (!uploads) return;
    try {
      const r = await fetch("/api/documents", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok)
        throw new Error("Unable to refresh processing status. Try again.");
      setDocs(d.documents);
      setRefreshError("");
    } catch {
      setRefreshError("Unable to refresh processing status. Try again.");
    }
  }, [uploads]);

  // Poll briskly only while something is uploading or being read; stay idle
  // otherwise. An upload or retry restarts polling through `kick`.
  useEffect(() => {
    void loadDocs();
    if (!uploads || (!flowing && kick === 0)) return;
    const timer = setInterval(() => {
      void loadDocs();
      onRefresh();
    }, 2500);
    return () => clearInterval(timer);
  }, [uploads, flowing, kick, loadDocs, onRefresh]);
  useEffect(() => {
    if (!flowing && kick) {
      const t = setTimeout(() => setKick(0), 6000);
      return () => clearTimeout(t);
    }
  }, [flowing, kick]);

  // Announce completions politely, batched so a screen reader isn't flooded.
  const previous = useRef(new Map<string, FileStage>());
  const stages = rows.map((r) => `${r.app.id}:${r.stage}`).join("|");
  useEffect(() => {
    const done: string[] = [];
    for (const r of rows) {
      const before = previous.current.get(r.app.id);
      if (before && inFlight(before) && !inFlight(r.stage))
        done.push(`${r.app.label}: ${stageLabel[r.stage]}`);
      previous.current.set(r.app.id, r.stage);
    }
    if (done.length) setAnnouncement(done.join(". "));
  }, [stages]); // eslint-disable-line react-hooks/exhaustive-deps

  async function documentAction(body: unknown) {
    setError("");
    try {
      const r = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setKick((k) => k + 1);
      onRefresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function download(id: string) {
    setError("");
    try {
      const r = await fetch("/api/documents?download=" + id, {
        cache: "no-store",
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      const a = document.createElement("a");
      a.href = data.url;
      a.rel = "noopener noreferrer";
      a.download = "";
      a.click();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const startBlocked = !batch.published
    ? "Publish criteria before adding CVs."
    : !active.length
      ? "Add at least one CV to start the review."
      : issues.length
        ? `Resolve ${issues.length === 1 ? "the CV that needs" : `the ${issues.length} CVs that need`} attention, or record a disposition.`
        : flowing
          ? "Wait until every CV has finished processing."
          : null;

  const row = ({ app, doc, stage }: (typeof rows)[number]) => {
    const help = stageHelp(stage, doc?.safe_error_code);
    const expanded = open?.id === app.id ? open.form : null;
    const toggle = (form: "dispose" | "manual") =>
      setOpen(expanded === form ? null : { id: app.id, form });
    return (
      <m.li
        key={app.id}
        layout="position"
        transition={settle}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className={`file-row stage-${stage}`}
      >
        <div className="file-main">
          <ProcessingGlyph stage={stage} />
          <div className="file-text">
            <strong className="mono">{app.label}</strong>
            <span className="file-name">{app.file}</span>
            <span className="file-stage">
              <span className="sr-only">Status: </span>
              {stageLabel[stage]}
              {doc && doc.attempts > 1 && inFlight(stage)
                ? ` · attempt ${doc.attempts}`
                : ""}
            </span>
            {help && <span className="file-help">{help}</span>}
            {app.dispositionReason && (
              <span className="file-help">
                {app.disposition?.replace("_", " ")}: {app.dispositionReason}
              </span>
            )}
          </div>
          <div className="file-actions">
            {needsAttention(stage) && doc && !batch.closed && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  void documentAction({ type: "retry", documentId: doc.id })
                }
              >
                Retry processing
              </Button>
            )}
            {["processing", "attention", "readable_copy"].includes(app.state) &&
              !batch.closed && (
                <Button
                  size="sm"
                  variant="outline"
                  aria-expanded={expanded === "manual"}
                  onClick={() => toggle("manual")}
                >
                  Transcribe passages
                </Button>
              )}
            {doc && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void download(doc.id)}
              >
                Original
              </Button>
            )}
            {canDispose && !batch.closed && stage !== "disposed" && (
              <Button
                size="sm"
                variant="ghost"
                aria-expanded={expanded === "dispose"}
                onClick={() => toggle("dispose")}
              >
                Record disposition
              </Button>
            )}
          </div>
        </div>
        {expanded === "dispose" && (
          <form
            className="file-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (
                await send({
                  type: "dispose",
                  vacancyId: vacancy.id,
                  batchId: batch.id,
                  applicationId: app.id,
                  disposition: String(f.get("disposition")) as "duplicate",
                  reason: String(f.get("reason")),
                })
              )
                setOpen(null);
            }}
          >
            <p>
              Only for genuine duplicates, withdrawals and wrong-vacancy
              submissions. Every other CV still needs a review.
            </p>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={`disposition-${app.id}`}>
                  Disposition
                </FieldLabel>
                <Select name="disposition" defaultValue="duplicate">
                  <SelectTrigger id={`disposition-${app.id}`} className="w-60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="duplicate">Duplicate</SelectItem>
                    <SelectItem value="withdrawal">Withdrawal</SelectItem>
                    <SelectItem value="wrong_vacancy">Wrong vacancy</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor={`disposition-reason-${app.id}`}>
                  Reason
                </FieldLabel>
                <Textarea
                  id={`disposition-reason-${app.id}`}
                  name="reason"
                  required
                  maxLength={1000}
                />
              </Field>
            </FieldGroup>
            <div className="actions">
              <Button type="submit" loading={busy}>
                Record disposition
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(null)}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
        {expanded === "manual" && (
          <form
            className="file-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const ok = await send({
                type: "manual_source",
                vacancyId: vacancy.id,
                batchId: batch.id,
                applicationId: app.id,
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
                setOpen(null);
                onRefresh();
              }
            }}
          >
            <p>
              Transcribed passages are labelled as manual in the review. Check
              them against the original document.
            </p>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={`manual-name-${app.id}`}>
                  Fictional candidate name (kept hidden during review)
                </FieldLabel>
                <Input
                  id={`manual-name-${app.id}`}
                  name="name"
                  maxLength={100}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`manual-locator-${app.id}`}>
                  Page or paragraph in the original
                </FieldLabel>
                <Input
                  id={`manual-locator-${app.id}`}
                  name="locator"
                  required
                  maxLength={100}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`manual-text-${app.id}`}>
                  Relevant transcription
                </FieldLabel>
                <Textarea
                  id={`manual-text-${app.id}`}
                  name="text"
                  required
                  maxLength={10000}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`manual-reason-${app.id}`}>
                  Reason for manual handling
                </FieldLabel>
                <Input
                  id={`manual-reason-${app.id}`}
                  name="reason"
                  required
                  maxLength={1000}
                />
              </Field>
            </FieldGroup>
            <label className="check-line">
              <input type="checkbox" required />I checked these passages against
              the original document.
            </label>
            <div className="actions">
              <Button type="submit" loading={busy}>
                Save checked passages
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(null)}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </m.li>
    );
  };

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <div className="sectionhead">
          <div>
            <h2>Add CVs for this batch</h2>
            <p>
              Every document must be accounted for before review starts. Arrival
              order never changes.
            </p>
          </div>
        </div>
        {!batch.published && (
          <Notice>Publish criteria before adding CVs.</Notice>
        )}
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        {refreshError && (
          <p className="inline-error" role="alert">
            {refreshError}
          </p>
        )}
        {uploads && (
          <Button
            variant="outline"
            onClick={() => void loadDocs()}
            disabled={busy}
          >
            Refresh processing status
          </Button>
        )}
        {uploads && batch.published && !batch.closed && (
          <UploadZone
            vacancyId={vacancy.id}
            batchId={batch.id}
            existing={active.length}
            disabled={busy}
            onUploaded={() => {
              setKick((k) => k + 1);
              void loadDocs();
              onRefresh();
            }}
          />
        )}
        {!rows.length ? (
          <section className="panel empty">
            <ProcessingGlyph stage="queued" className="empty-glyph" />
            <h2>{uploads ? "No CVs yet" : "Ready for your sample batch"}</h2>
            <p>
              {!batch.published
                ? "Publish criteria first. CVs are then read against those criteria."
                : uploads
                  ? "Upload fictional CVs above, or practise with six sample CVs."
                  : "Six fictional sample CVs cover agreed evidence, a disagreement, a tie and suspicious source content. File uploads need the staging backend."}
            </p>
            <Button
              disabled={busy || !batch.published}
              onClick={() =>
                void send({
                  type: "samples",
                  vacancyId: vacancy.id,
                  batchId: batch.id,
                })
              }
            >
              Add sample CVs
              <Plus data-icon="inline-end" />
            </Button>
          </section>
        ) : (
          <>
            <div className="batch-status">
              <div className="batch-status-text">
                <strong className="tabular-nums">
                  {ready} of {active.length} ready
                </strong>
                <span>
                  {flowing
                    ? "Processing continues even if you leave this page."
                    : issues.length
                      ? `${issues.length} need${issues.length === 1 ? "s" : ""} attention`
                      : batch.closed
                        ? "Intake closed"
                        : "All CVs processed"}
                </span>
              </div>
              <Progress
                value={active.length ? (ready / active.length) * 100 : 0}
                aria-label="CVs ready to review"
                aria-valuetext={`${ready} of ${active.length} ready`}
              />
            </div>
            {issues.length > 0 && (
              <section className="file-group" aria-labelledby="issues-title">
                <h3 id="issues-title">
                  Needs your attention{" "}
                  <span className="tabular-nums">({issues.length})</span>
                </h3>
                <ul className="file-list">
                  <AnimatePresence initial={false}>
                    {issues.map(row)}
                  </AnimatePresence>
                </ul>
              </section>
            )}
            <section className="file-group" aria-labelledby="files-title">
              <h3 id="files-title">
                {issues.length ? "Other CVs" : "CVs in this batch"}{" "}
                <span className="tabular-nums">
                  ({rows.length - issues.length})
                </span>
              </h3>
              <ul className="file-list">
                <AnimatePresence initial={false}>
                  {rows.filter((r) => !needsAttention(r.stage)).map(row)}
                </AnimatePresence>
              </ul>
            </section>
          </>
        )}
        <p className="sr-only" aria-live="polite">
          {announcement}
        </p>
        <div className="footeractions">
          <p>
            {batch.closed
              ? "Intake closed. New arrivals belong in the next batch."
              : (startBlocked ??
                "Starting the review closes intake for this batch.")}
          </p>
          <Button
            disabled={busy || (!batch.closed && !!startBlocked)}
            onClick={async () => {
              if (
                batch.closed ||
                (await send({
                  type: "close",
                  vacancyId: vacancy.id,
                  batchId: batch.id,
                }))
              )
                onNext();
            }}
          >
            {batch.closed ? "Continue review" : "Start review"}
            <ArrowRight data-icon="inline-end" />
          </Button>
        </div>
      </MotionConfig>
    </LazyMotion>
  );
}
