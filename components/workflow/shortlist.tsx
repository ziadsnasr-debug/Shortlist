"use client";
import { useEffect, useState } from "react";
import { Check, ListChecks, Plus } from "lucide-react";
import { toast } from "sonner";
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
import { type Batch, highest } from "@/lib/workflow";
import { ScoreBar, EvidenceComparison } from "../workspace-insights";
import { Notice, Panel } from "./common";
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
    [nextDialog, setNextDialog] = useState(false);
  if (!batch.ranking)
    return (
      <Panel>
        <div className="empty">
          <ListChecks aria-hidden="true" />
          <h2>Review every CV first</h2>
          <p>
            Comparative ranking appears only after intake closes and every
            active application has a resolved human review.
          </p>
        </div>
      </Panel>
    );
  return (
    <>
      <div className="sectionhead">
        <div>
          <h2>
            {batch.snapshot ? "Finalised shortlist" : "Choose your shortlist"}
          </h2>
          <p>
            Choose zero to three. Scores support your decision; essentials
            remain separate.
          </p>
        </div>
        <Button variant="outline" onClick={onReveal}>
          {reveal ? "Hide names" : "Reveal names"}
        </Button>
      </div>
      {batch.snapshot && (
        <Notice>
          Finalised{" "}
          {new Date(batch.snapshot.at).toLocaleString("en-GB", {
            timeZone: "Europe/London",
          })}
          . Decisions and batch membership are frozen.
        </Notice>
      )}
      <Panel>
        {batch.ranking.map((row) => {
          const app = batch.applications.find((a) => a.id === row.id)!;
          return (
            <div className="rank-row" key={row.id}>
              <input
                aria-label={`Select ${app.label}`}
                type="checkbox"
                checked={selected.includes(row.id)}
                disabled={
                  busy ||
                  !!batch.snapshot ||
                  (!selected.includes(row.id) && selected.length === 3)
                }
                onChange={(e) => {
                  setDirty(true);
                  setSelected(
                    e.target.checked
                      ? [...selected, row.id]
                      : selected.filter((id) => id !== row.id),
                  );
                }}
              />
              <div>
                <h3>{reveal ? app.name : app.label}</h3>
                <ScoreBar score={row.score} />
                <p>
                  {row.essentials.length
                    ? `Essential requirements not fully evidenced: ${row.essentials.join(", ")}`
                    : "All essential requirements fully evidenced"}
                </p>
                {selected.includes(row.id) && row.essentials.length > 0 && (
                  <Field className="mt-3">
                    <FieldLabel htmlFor={`exception-${row.id}`}>
                      Essential exception for {app.label}
                    </FieldLabel>
                    <Textarea
                      id={`exception-${row.id}`}
                      disabled={!!batch.snapshot}
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
                  </Field>
                )}
              </div>
              <strong className="score">
                {row.score}
                <small>/ 100</small>
              </strong>
            </div>
          );
        })}
        {!batch.ranking.length && (
          <div className="empty">
            <p>
              No active candidates. You may finalise an empty shortlist with a
              reason.
            </p>
          </div>
        )}
      </Panel>
      <EvidenceComparison
        rubric={batch.rubric}
        applications={batch.applications.filter((a) => selected.includes(a.id))}
      />
      {!batch.snapshot && (
        <div className="actions selection-tray my-5">
          <Button
            variant="outline"
            onClick={() => {
              const b = batch as unknown as Batch;
              setDirty(true);
              setSelected(highest(b));
              toast.info(
                "Selected highest scores. Boundary ties remain for your decision.",
              );
            }}
          >
            Select highest scores
          </Button>
          <span>{selected.length} of 3 selected</span>
        </div>
      )}
      <Panel>
        <div className="panel-body">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="selection-reason">
                Selection reason (required, including an empty shortlist)
              </FieldLabel>
              <Textarea
                id="selection-reason"
                disabled={!!batch.snapshot}
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
            <Field>
              <FieldLabel htmlFor="tie-reason">
                Boundary tie decision
              </FieldLabel>
              <Textarea
                id="tie-reason"
                disabled={!!batch.snapshot}
                value={tieReason}
                onChange={(e) => {
                  setDirty(true);
                  setTieReason(e.target.value);
                }}
                maxLength={1000}
              />
              <FieldDescription>
                Required when selected and unselected applicants share the
                cutoff score. Arrival order is never a tie breaker.
              </FieldDescription>
            </Field>
          </FieldGroup>
        </div>
      </Panel>
      <div className="footeractions">
        <p>
          {batch.snapshot
            ? "Export reads the frozen snapshot. Names are excluded."
            : "Finalisation rechecks every application and locks this batch."}
        </p>
        <div className="actions">
          {batch.snapshot ? (
            <>
              <Button variant="outline" asChild>
                <a
                  href={`/api/workspace?vacancy=${vacancy.id}&export=${batch.id}`}
                >
                  Export review CSV
                </a>
              </Button>
              {canStartNext && (
                <Button onClick={() => setNextDialog(true)}>
                  Start next batch
                  <Plus data-icon="inline-end" />
                </Button>
              )}
            </>
          ) : (
            <>
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
                disabled={busy || !reason.trim()}
                onClick={async () => {
                  const result = await send({
                    type: "selection",
                    vacancyId: vacancy.id,
                    batchId: batch.id,
                    selected,
                    reason,
                    tieReason,
                    exceptions,
                  });
                  if (result) {
                    setDirty(false);
                    await send(
                      {
                        type: "finalise",
                        vacancyId: vacancy.id,
                        batchId: batch.id,
                      },
                      result.version,
                    );
                  }
                }}
              >
                Finalise shortlist
                <Check data-icon="inline-end" />
              </Button>
            </>
          )}
        </div>
      </div>
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
