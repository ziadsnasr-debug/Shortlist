"use client";
import { useState } from "react";
import { ArrowRight, FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { DocumentIntake } from "../document-intake";
import { Notice, Panel } from "./common";
import type { PublicApp, PublicBatch, PublicVacancy, Send } from "./types";
export function Intake({
  vacancy,
  batch,
  send,
  busy,
  onNext,
  onRefresh,
  version,
  uploads,
}: {
  vacancy: PublicVacancy;
  batch: PublicBatch;
  send: Send;
  busy: boolean;
  onNext: () => void;
  onRefresh: () => void;
  version: number;
  uploads: boolean;
}) {
  const [disposition, setDisposition] = useState<PublicApp | null>(null);
  return (
    <>
      <div className="sectionhead">
        <div>
          <h2>Add CVs for this batch</h2>
          <p>
            Account for every document before review starts. Arrival order stays
            unchanged.
          </p>
        </div>
      </div>
      <Notice>
        Six fictional sample CVs cover agreed evidence, a disagreement, a tie
        and suspicious source content.
      </Notice>
      <DocumentIntake
        vacancyId={vacancy.id}
        batchId={batch.id}
        version={version}
        closed={batch.closed}
        applications={batch.applications}
        onRefresh={onRefresh}
        send={send}
        enabled={uploads}
      />
      <Panel>
        {!batch.applications.length ? (
          <div className="empty">
            <FileText aria-hidden="true" />
            <h2>Ready for your sample batch</h2>
            <p>
              {batch.published
                ? "Add fictional CVs to practise the complete review workflow."
                : "Publish criteria before adding sample CVs."}
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
          </div>
        ) : (
          batch.applications.map((a) => (
            <div key={a.id} className="intake-row">
              <FileText aria-hidden="true" />
              <div>
                <strong>{a.label}</strong>
                <p>{a.file}</p>
                {a.dispositionReason && (
                  <p>
                    {a.disposition}: {a.dispositionReason}
                  </p>
                )}
              </div>
              <Badge variant="secondary">
                {a.state === "disposed"
                  ? "Disposition recorded"
                  : a.confirmed
                    ? "Reviewed"
                    : a.state === "ready"
                      ? "Ready to review"
                      : a.state === "processing"
                        ? "Processing"
                        : "Needs readable copy or attention"}
              </Badge>
              {!batch.closed && a.state !== "disposed" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDisposition(a)}
                >
                  Record disposition
                </Button>
              )}
            </div>
          ))
        )}
      </Panel>
      <div className="footeractions">
        <p>
          {batch.closed
            ? "Intake closed. New arrivals belong in the next batch."
            : "Start review explicitly closes intake for this batch."}
        </p>
        <Button
          disabled={
            busy ||
            !batch.published ||
            !batch.applications.length ||
            batch.applications.some(
              (a) => !["ready", "disposed"].includes(a.state),
            )
          }
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
      <Dialog
        open={!!disposition}
        onOpenChange={(v) => !v && setDisposition(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Account for {disposition?.label}</DialogTitle>
            <DialogDescription>
              Only genuine duplicates, withdrawals and wrong-vacancy
              submissions. Low scoring CVs still require review.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (
                await send({
                  type: "dispose",
                  vacancyId: vacancy.id,
                  batchId: batch.id,
                  applicationId: disposition!.id,
                  disposition: String(f.get("disposition")) as "duplicate",
                  reason: String(f.get("reason")),
                })
              )
                setDisposition(null);
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="disposition">Disposition</FieldLabel>
                <select id="disposition" name="disposition">
                  <option value="duplicate">Duplicate</option>
                  <option value="withdrawal">Withdrawal</option>
                  <option value="wrong_vacancy">Wrong vacancy</option>
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="disposition-reason">Reason</FieldLabel>
                <Textarea
                  id="disposition-reason"
                  name="reason"
                  required
                  maxLength={1000}
                />
              </Field>
            </FieldGroup>
            <DialogFooter className="mt-5">
              <Button disabled={busy}>Record disposition</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
