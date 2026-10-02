"use client";
import { useEffect, useState } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { type Criterion } from "@/lib/workflow";
import { WeightChart } from "../workspace-insights";
import { sampleRubric } from "@/fixtures/synthetic/seed";
import { Notice, Panel } from "./common";
import type { PublicBatch, PublicVacancy, Send } from "./types";
export function Criteria({
  ai,
  vacancy,
  batch,
  send,
  busy,
  onNext,
  onDirty,
  canEdit,
}: {
  canEdit: boolean;
  vacancy: PublicVacancy;
  batch: PublicBatch;
  send: Send;
  busy: boolean;
  onNext: () => void;
  onDirty: (v: boolean) => void;
  ai: boolean;
}) {
  const [rubric, setRubric] = useState<Criterion[]>(batch.rubric),
    [dirty, setDirty] = useState(false);
  const editable = !batch.published && canEdit;
  const total = rubric.reduce((n, c) => n + c.points, 0);
  function update(index: number, key: keyof Criterion, value: unknown) {
    setDirty(true);
    setRubric(rubric.map((c, i) => (i === index ? { ...c, [key]: value } : c)));
  }
  useEffect(() => {
    onDirty(dirty);
  }, [dirty, onDirty]);
  useEffect(() => {
    function warn(e: BeforeUnloadEvent) {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  return (
    <>
      <div className="sectionhead">
        <div>
          <h2>Set the criteria</h2>
          <p>
            Define observable evidence. Weights stay fixed for every CV in this
            batch.
          </p>
        </div>
        <Badge variant="secondary">{total} / 100 points</Badge>
      </div>
      <WeightChart rubric={rubric} />
      {!batch.published && !canEdit && (
        <Notice>
          Only administrators can edit and publish criteria. You can read the
          draft here.
        </Notice>
      )}
      {editable && (
        <Notice>
          Criteria suggestions are editable examples, not AI output. Employer
          approval is required before publication.
        </Notice>
      )}
      {editable && (
        <div className="my-4">
          <Button
            variant="outline"
            disabled={!ai || busy}
            onClick={async () => {
              try {
                const r = await fetch("/api/criteria", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      vacancyId: vacancy.id,
                      synthetic: true,
                    }),
                  }),
                  d = await r.json();
                if (!r.ok) throw new Error(d.error);
                setRubric(d.rubric);
                setDirty(true);
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            Draft criteria with AI
          </Button>
          {!ai && (
            <p>
              AI drafting needs approved provider configuration. Edit example
              criteria directly.
            </p>
          )}
        </div>
      )}
      <Panel>
        <fieldset disabled={!editable || busy} className="criteria-fieldset">
          {rubric.map((c, i) => (
            <div className="criterion" key={c.id}>
              <FieldGroup>
                <div className="criterion-grid">
                  <Field>
                    <FieldLabel htmlFor={`section-${i}`}>Section</FieldLabel>
                    <Input
                      id={`section-${i}`}
                      value={c.section}
                      onChange={(e) => update(i, "section", e.target.value)}
                      maxLength={80}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`criterion-${i}`}>
                      Requirement
                    </FieldLabel>
                    <Input
                      id={`criterion-${i}`}
                      value={c.title}
                      onChange={(e) => update(i, "title", e.target.value)}
                      maxLength={200}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`points-${i}`}>Points</FieldLabel>
                    <Input
                      id={`points-${i}`}
                      type="number"
                      min={1}
                      max={100}
                      value={c.points}
                      onChange={(e) =>
                        update(i, "points", Number(e.target.value))
                      }
                    />
                  </Field>
                </div>
                <label className="check-line">
                  <input
                    type="checkbox"
                    checked={c.essential}
                    onChange={(e) => update(i, "essential", e.target.checked)}
                  />
                  Essential requirement
                </label>
                <details>
                  <summary>Evidence definitions</summary>
                  <div className="definition-grid">
                    <Field>
                      <FieldLabel htmlFor={`full-${i}`}>
                        Full evidence
                      </FieldLabel>
                      <Textarea
                        id={`full-${i}`}
                        value={c.full}
                        onChange={(e) => update(i, "full", e.target.value)}
                        maxLength={1000}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor={`partial-${i}`}>
                        Partial evidence
                      </FieldLabel>
                      <Textarea
                        id={`partial-${i}`}
                        value={c.partial}
                        onChange={(e) => update(i, "partial", e.target.value)}
                        maxLength={1000}
                      />
                    </Field>
                  </div>
                </details>
              </FieldGroup>
              {editable && (
                <div className="actions mt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={i === 0}
                    onClick={() => {
                      const rows = [...rubric];
                      [rows[i - 1], rows[i]] = [rows[i], rows[i - 1]];
                      setRubric(rows);
                      setDirty(true);
                    }}
                  >
                    Move up
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setRubric(rubric.filter((_, j) => j !== i));
                      setDirty(true);
                    }}
                  >
                    Remove criterion
                  </Button>
                </div>
              )}
            </div>
          ))}
        </fieldset>
        {editable && (
          <div className="panel-footer actions">
            <Button
              variant="outline"
              disabled={busy || rubric.length >= 12}
              onClick={() => {
                setRubric([
                  ...rubric,
                  {
                    id: crypto.randomUUID(),
                    section: "Skills",
                    title: "",
                    points: 10,
                    essential: false,
                    full: "",
                    partial: "",
                  },
                ]);
                setDirty(true);
              }}
            >
              Add criterion
              <Plus data-icon="inline-end" />
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setRubric(structuredClone(sampleRubric));
                setDirty(true);
              }}
            >
              Use editable example criteria
            </Button>
          </div>
        )}
      </Panel>
      <div className="footeractions">
        <p>
          {batch.published
            ? "Published criteria are frozen for this batch."
            : !canEdit
              ? "Waiting for an administrator to publish these criteria."
              : dirty
                ? "Unsaved changes. Save the draft before publishing or leaving this step."
                : total !== 100
                  ? `Publishing needs exactly 100 points. ${total < 100 ? `${100 - total} left to allocate.` : `${total - 100} over.`}`
                  : !rubric.length
                    ? "Add at least one criterion before publishing."
                    : "Ready to publish. Publishing freezes these criteria for this batch."}
        </p>
        <div className="actions">
          {editable ? (
            <>
              <Button
                variant="outline"
                disabled={busy}
                onClick={async () => {
                  if (
                    await send({
                      type: "rubric",
                      vacancyId: vacancy.id,
                      batchId: batch.id,
                      rubric,
                    })
                  ) {
                    setDirty(false);
                  }
                }}
              >
                Save criteria draft
              </Button>
              <Button
                disabled={busy || total !== 100 || dirty || !rubric.length}
                onClick={async () => {
                  if (
                    await send({
                      type: "publish",
                      vacancyId: vacancy.id,
                      batchId: batch.id,
                    })
                  )
                    onNext();
                }}
              >
                Publish criteria
                <ArrowRight data-icon="inline-end" />
              </Button>
            </>
          ) : batch.published ? (
            <Button onClick={onNext}>
              Continue to Add CVs
              <ArrowRight data-icon="inline-end" />
            </Button>
          ) : null}
        </div>
      </div>
    </>
  );
}
