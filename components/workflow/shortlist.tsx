"use client";
import { useEffect, useState } from "react";
import { Download, Eye, EyeOff, ListChecks, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { type Batch, highest } from "@/lib/rules";
import { EvidenceComparison } from "../workspace-insights";
import { Panel } from "./common";
import {
  FinishMark,
  ScoreChart,
  ScoreTable,
  cutTie,
  points,
  tieAtSelection,
  type RankRow,
} from "./results";
import type { PublicBatch, PublicVacancy, Send } from "./types";

export function Shortlist({
  vacancy,
  batch,
  send,
  busy,
  reveal,
  onReveal,
  onNew,
  onDirty,
  canStartNext,
}: {
  canStartNext: boolean;
  vacancy: PublicVacancy;
  batch: PublicBatch;
  send: Send;
  busy: boolean;
  reveal: boolean;
  onReveal: () => void;
  onNew: (b: PublicBatch) => void;
  onDirty: (v: boolean) => void;
}) {
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    onDirty(dirty);
  }, [dirty, onDirty]);
  const [selected, setSelected] = useState(batch.selected),
    [reason, setReason] = useState(batch.reason),
    [tieReason, setTieReason] = useState(batch.tieReason),
    [exceptions, setExceptions] = useState(batch.exceptions),
    [view, setView] = useState<"chart" | "table">("chart"),
    [message, setMessage] = useState(""),
    [confirming, setConfirming] = useState(false),
    [justFinalised, setJustFinalised] = useState(false),
    [nextDialog, setNextDialog] = useState(false);

  if (!batch.ranking) {
    const active = batch.applications.filter((a) => a.state !== "disposed");
    const left = active.filter((a) => !a.confirmed).length;
    return (
      <Panel>
        <div className="empty">
          <ListChecks aria-hidden="true" />
          <h2>Review every CV first</h2>
          <p>
            {batch.closed && left
              ? `Ranking appears after all ${active.length} CVs are reviewed. ${left} remaining.`
              : "Comparative ranking appears only after intake closes and every active application has a resolved human review."}
          </p>
        </div>
      </Panel>
    );
  }

  const ranking: RankRow[] = batch.ranking;
  const locked = !!batch.snapshot;
  const tie = cutTie(ranking);
  const needsTie = tieAtSelection(ranking, selected);
  const missingExceptions = ranking.filter(
    (r) =>
      selected.includes(r.id) &&
      r.essentials.length > 0 &&
      !exceptions[r.id]?.trim(),
  );
  const label = (id: string) => {
    const app = batch.applications.find((a) => a.id === id)!;
    return reveal && app.name ? app.name : app.label;
  };
  // Mirrors the server's finalise rules so the reason shows before trying.
  const blocked = !reason.trim()
    ? "Record a written selection reason, including when selecting nobody."
    : needsTie && !tieReason.trim()
      ? "Record a human decision for the boundary tie."
      : missingExceptions.length
        ? "Document an exception for each selected applicant with unmet essentials."
        : null;
  const scores = ranking.map((r) => r.score);
  const summary = ranking.length
    ? `${ranking.length} CV${ranking.length === 1 ? "" : "s"} reviewed. Confirmed scores range from ${points(Math.min(...scores))} to ${points(Math.max(...scores))}.${tie !== null ? ` ${ranking.filter((r) => r.score === tie).length} CVs tie at ${points(tie)} across the cut after third place.` : ""}`
    : "No active CVs. You may finalise an empty shortlist with a reason.";

  const toggle = (id: string, on: boolean) => {
    setDirty(true);
    setMessage("");
    setSelected(on ? [...selected, id] : selected.filter((x) => x !== id));
  };

  async function finalise() {
    const result = await send({
      type: "selection",
      vacancyId: vacancy.id,
      batchId: batch.id,
      selected,
      reason,
      tieReason,
      exceptions,
    });
    if (!result) return;
    setDirty(false);
    const done = await send(
      { type: "finalise", vacancyId: vacancy.id, batchId: batch.id },
      result.version,
    );
    if (done) {
      setConfirming(false);
      setJustFinalised(true);
    }
  }

  return (
    <>
      <div className="sectionhead">
        <div>
          <h2>{locked ? "Finalised shortlist" : "Choose your shortlist"}</h2>
          <p>
            Choose zero to three. Scores support your decision; essentials stay
            separate.
          </p>
        </div>
        <Button variant="outline" onClick={onReveal}>
          {reveal ? (
            <EyeOff data-icon="inline-start" />
          ) : (
            <Eye data-icon="inline-start" />
          )}
          {reveal ? "Hide names" : "Reveal names"}
        </Button>
      </div>
      {locked && (
        <section className="finish-receipt" aria-labelledby="finish-title">
          <FinishMark play={justFinalised} />
          <div>
            <h3 id="finish-title">Shortlist finalised</h3>
            <p>
              {new Date(batch.snapshot!.at).toLocaleString("en-GB", {
                timeZone: "Europe/London",
                dateStyle: "long",
                timeStyle: "short",
              })}
              . Decisions and batch membership are frozen. The export reads this
              snapshot and leaves names out.
            </p>
            <div className="actions mt-3">
              <Button variant="outline" asChild>
                <a
                  href={`/api/workspace?vacancy=${vacancy.id}&export=${batch.id}`}
                >
                  <Download data-icon="inline-start" />
                  Export review CSV
                </a>
              </Button>
              {canStartNext && (
                <Button onClick={() => setNextDialog(true)}>
                  Start next batch
                  <Plus data-icon="inline-end" />
                </Button>
              )}
            </div>
          </div>
        </section>
      )}
      <section className="results panel" aria-labelledby="results-title">
        <div className="results-head">
          <div>
            <h3 id="results-title">Confirmed scores</h3>
            <p className="summary-line">{summary}</p>
          </div>
          <div className="view-toggle" role="group" aria-label="View">
            <button
              type="button"
              aria-pressed={view === "chart"}
              onClick={() => setView("chart")}
            >
              Chart
            </button>
            <button
              type="button"
              aria-pressed={view === "table"}
              onClick={() => setView("table")}
            >
              Table
            </button>
          </div>
        </div>
        {view === "chart" ? (
          <>
            <div className="chart-legend" aria-hidden="true">
              <span>
                <i className="seg-full" /> Points from full evidence
              </span>
              <span>
                <i className="seg-partial" /> Points from partial evidence
              </span>
              <span>
                <i className="seg-none" /> Not earned
              </span>
            </div>
            <ScoreChart
              batch={batch}
              ranking={ranking}
              selected={selected}
              reveal={reveal}
              locked={locked}
              busy={busy}
              onToggle={toggle}
              exceptionFor={(row) =>
                selected.includes(row.id) &&
                row.essentials.length > 0 && (
                  <Field className="score-exception">
                    <FieldLabel htmlFor={`exception-${row.id}`}>
                      Essential exception for{" "}
                      {batch.applications.find((a) => a.id === row.id)!.label}
                    </FieldLabel>
                    <Textarea
                      id={`exception-${row.id}`}
                      disabled={locked}
                      value={exceptions[row.id] ?? ""}
                      onChange={(e) => {
                        setDirty(true);
                        setExceptions({
                          ...exceptions,
                          [row.id]: e.target.value,
                        });
                      }}
                      maxLength={1000}
                    />
                    <FieldDescription>
                      Explain why this CV is shortlisted although{" "}
                      {row.essentials.join(", ")}{" "}
                      {row.essentials.length === 1 ? "is" : "are"} not fully
                      evidenced.
                    </FieldDescription>
                  </Field>
                )
              }
            />
          </>
        ) : (
          <ScoreTable
            batch={batch}
            ranking={ranking}
            selected={selected}
            reveal={reveal}
          />
        )}
      </section>
      {!locked && (
        <div className="selection-tray actions">
          <div className="tray-text" aria-live="polite">
            <strong>{selected.length} of 3 selected</strong>
            {message && <span>{message}</span>}
          </div>
          <div className="actions">
            <Button
              variant="ghost"
              size="sm"
              disabled={!selected.length || busy}
              onClick={() => {
                setDirty(true);
                setMessage("");
                setSelected([]);
              }}
            >
              Clear
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDirty(true);
                const top = highest(batch as unknown as Batch);
                setSelected(top);
                const msg =
                  tie !== null && top.length < 3
                    ? `Stopped at the tie at ${points(tie)}. Choose between the tied CVs and record why.`
                    : "Selected the highest confirmed scores.";
                setMessage(msg);
              }}
            >
              Select highest scores
            </Button>
          </div>
        </div>
      )}
      <EvidenceComparison
        rubric={batch.rubric}
        applications={selected.map((id) => {
          const app = batch.applications.find((a) => a.id === id)!;
          return { ...app, label: reveal && app.name ? app.name : app.label };
        })}
      />
      <Panel>
        <div className="panel-body">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="selection-reason">
                Selection reason (required, including an empty shortlist)
              </FieldLabel>
              <Textarea
                id="selection-reason"
                disabled={locked}
                value={reason}
                onChange={(e) => {
                  setDirty(true);
                  setReason(e.target.value);
                }}
                maxLength={2000}
              />
              <FieldDescription>
                Explain exceptions or selections outside the highest confirmed
                scores.
              </FieldDescription>
            </Field>
            {(needsTie || tieReason) && (
              <Field>
                <FieldLabel htmlFor="tie-reason">
                  Boundary tie decision
                </FieldLabel>
                <Textarea
                  id="tie-reason"
                  disabled={locked}
                  value={tieReason}
                  onChange={(e) => {
                    setDirty(true);
                    setTieReason(e.target.value);
                  }}
                  maxLength={1000}
                />
                <FieldDescription>
                  A selected CV shares the cutoff score with one you did not
                  select. Arrival order is never a tie breaker.
                </FieldDescription>
              </Field>
            )}
          </FieldGroup>
        </div>
      </Panel>
      {!locked && (
        <div className="footeractions">
          <p>
            {blocked ??
              "Finalising rechecks every application and freezes this batch."}
          </p>
          <div className="actions">
            <Button
              variant="outline"
              disabled={busy}
              onClick={async () => {
                if (
                  await send({
                    type: "selection",
                    vacancyId: vacancy.id,
                    batchId: batch.id,
                    selected,
                    reason,
                    tieReason,
                    exceptions,
                  })
                )
                  setDirty(false);
              }}
            >
              Save selection draft
            </Button>
            <Button
              disabled={busy || !!blocked}
              onClick={() => setConfirming(true)}
            >
              Finalise shortlist
            </Button>
          </div>
        </div>
      )}
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finalise this shortlist?</DialogTitle>
            <DialogDescription>
              Finalising freezes every decision and the batch membership. It
              can&apos;t be reopened.
            </DialogDescription>
          </DialogHeader>
          <dl className="confirm-summary">
            <div>
              <dt>Shortlisted</dt>
              <dd>
                {selected.length
                  ? selected.map(label).join(", ")
                  : "Nobody (empty shortlist)"}
              </dd>
            </div>
            <div>
              <dt>Reason</dt>
              <dd>{reason}</dd>
            </div>
            {needsTie && (
              <div>
                <dt>Tie decision</dt>
                <dd>{tieReason}</dd>
              </div>
            )}
            {selected.some((id) => exceptions[id]?.trim()) && (
              <div>
                <dt>Essential exceptions</dt>
                <dd>
                  {selected
                    .filter((id) => exceptions[id]?.trim())
                    .map((id) => `${label(id)}: ${exceptions[id]}`)
                    .join(" · ")}
                </dd>
              </div>
            )}
          </dl>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Keep editing
            </Button>
            <Button loading={busy} onClick={() => void finalise()}>
              Finalise shortlist
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={nextDialog} onOpenChange={setNextDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start next batch</DialogTitle>
            <DialogDescription>
              Copies criteria into an editable draft. Earlier decisions remain
              frozen.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const label = String(new FormData(e.currentTarget).get("label"));
              const result = await send({
                type: "next",
                vacancyId: vacancy.id,
                batchId: batch.id,
                label,
              });
              if (result) {
                const v = result.vacancies.find((v) => v.id === vacancy.id)!;
                onNew(v.batches.at(-1)!);
                setNextDialog(false);
              }
            }}
          >
            <Field>
              <FieldLabel htmlFor="batch-label">Batch period</FieldLabel>
              <Input
                id="batch-label"
                name="label"
                required
                maxLength={100}
                placeholder="Week of 5 October 2026"
              />
            </Field>
            <DialogFooter className="mt-5">
              <Button disabled={busy}>Create batch</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
