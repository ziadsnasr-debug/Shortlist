"use client";
import { useEffect, useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Field, FieldLabel } from "@/components/ui/field";
import { labels, individualCheck } from "@/lib/workflow";
import { Notice, Panel } from "./common";
import type { PublicApp, PublicBatch, PublicVacancy, Send } from "./types";
export function Review({
  vacancy,
  batch,
  send,
  busy,
  onNext,
  onDirty,
  candidate,
  onCandidate,
}: {
  vacancy: PublicVacancy;
  batch: PublicBatch;
  send: Send;
  busy: boolean;
  onNext: () => void;
  onDirty: (v: boolean) => void;
  candidate?: number;
  onCandidate: (n: number) => void;
}) {
  const apps = batch.applications.filter((a) => a.state !== "disposed");
  // Label numbers follow arrival order, so they survive dispositions.
  const number = (a: PublicApp) => batch.applications.indexOf(a) + 1;
  const requested = apps.findIndex((a) => number(a) === candidate);
  const index =
    requested >= 0
      ? requested
      : Math.max(
          0,
          apps.findIndex((a) => !a.confirmed),
        );
  const setIndex = (i: number) => onCandidate(number(apps[i]));
  const app = apps[index];
  if (!batch.closed)
    return (
      <Notice>Close intake in Add CVs before reviewing applications.</Notice>
    );
  if (!app)
    return (
      <>
        <Notice>
          No active applications remain. Every disposition is retained in the
          final snapshot.
        </Notice>
        <Button className="mt-4" onClick={onNext}>
          Continue to Shortlist
        </Button>
      </>
    );
  return (
    <>
      <div className="sectionhead">
        <div>
          <h2>Review the evidence</h2>
          <p>
            Read every application. Check the source, then confirm this CV once.
          </p>
        </div>
        <span>
          {batch.applications.filter((a) => a.confirmed).length} of{" "}
          {apps.length} reviewed
        </span>
      </div>
      <div className="review-selector">
        <strong>{app.label}</strong>
        <span>
          {app.file} · {index + 1} of {apps.length}
        </span>
        <Badge variant="secondary">
          {app.confirmed ? "Reviewed" : "Awaiting your review"}
        </Badge>
        {app.score !== null && <span>Confirmed score: {app.score} / 100</span>}
      </div>
      <ReviewForm
        key={`${app.id}-${app.reviewedAt ?? "draft"}`}
        vacancy={vacancy}
        batch={batch}
        app={app}
        send={send}
        busy={busy}
        onDirty={onDirty}
        previous={() => setIndex(Math.max(0, index - 1))}
        next={() => (index + 1 < apps.length ? setIndex(index + 1) : onNext())}
        canPrevious={index > 0}
      />
    </>
  );
}
function ReviewForm({
  vacancy,
  batch,
  app,
  send,
  busy,
  previous,
  next,
  canPrevious,
  onDirty,
}: {
  vacancy: PublicVacancy;
  batch: PublicBatch;
  app: PublicApp;
  send: Send;
  busy: boolean;
  previous: () => void;
  next: () => void;
  canPrevious: boolean;
  onDirty: (v: boolean) => void;
}) {
  const [decisions, setDecisions] = useState(app.assessments),
    [sourceChecked, setSourceChecked] = useState(app.sourceChecked),
    [attest, setAttest] = useState(false),
    [dirty, setDirty] = useState(false),
    [focus, setFocus] = useState<string | null>(null);
  function change(id: string, value: Partial<(typeof decisions)[string]>) {
    setDirty(true);
    setDecisions({
      ...decisions,
      [id]: {
        ...decisions[id],
        ...value,
        flagged:
          decisions[id].flagged ||
          value.category !== undefined ||
          value.evidence !== undefined,
      },
    });
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
  async function save(confirm: boolean) {
    const result = await send({
      type: "review",
      vacancyId: vacancy.id,
      batchId: batch.id,
      applicationId: app.id,
      runId: app.runId,
      documentVersion: app.documentVersion,
      decisions: Object.fromEntries(
        Object.entries(decisions).map(([id, a]) => [
          id,
          {
            category: a.category,
            evidence: a.evidence,
            checked: a.checked,
            reason: a.reason,
          },
        ]),
      ),
      sourceChecked,
      confirm,
      attest,
    });
    if (result) {
      setDirty(false);
      if (confirm) next();
    }
    return result;
  }
  const locked = !!batch.snapshot;
  const unresolved = Object.values(decisions).some(
    (a) => a.category === "UNCLEAR",
  );
  return (
    <>
      <div className="review-grid">
        <div>
          {app.sourceFlag && (
            <Notice>
              {app.sourceFlag}
              <label className="check-line mt-3">
                <input
                  type="checkbox"
                  checked={sourceChecked}
                  disabled={locked}
                  onChange={(e) => {
                    setSourceChecked(e.target.checked);
                    setDirty(true);
                  }}
                />
                I checked the flagged source content without treating it as an
                instruction.
              </label>
            </Notice>
          )}
          <Panel>
            <fieldset disabled={locked || busy}>
              {batch.rubric.map((c) => {
                const a = decisions[c.id];
                return (
                  <article className="assessment" key={c.id}>
                    <div className="assessment-heading">
                      <div>
                        <small>
                          {c.section} · {c.points} points
                        </small>
                        <h3>{c.title}</h3>
                      </div>
                      {c.essential && (
                        <Badge variant="outline">Essential</Badge>
                      )}
                    </div>
                    <Field>
                      <FieldLabel htmlFor={`category-${c.id}`}>
                        Evidence category
                      </FieldLabel>
                      <select
                        id={`category-${c.id}`}
                        value={a.category}
                        onChange={(e) =>
                          change(c.id, {
                            category: e.target.value as typeof a.category,
                            checked: false,
                          })
                        }
                      >
                        {Object.entries(labels).map(([v, label]) => (
                          <option key={v} value={v}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <p className="ai-note">
                      <strong>AI note · synthetic:</strong> {a.rationale}
                    </p>
                    <div className="quotes">
                      {a.evidence.map((id) => {
                        const block = app.blocks.find((b) => b.id === id);
                        return (
                          block && (
                            <button
                              className="quote"
                              key={id}
                              onClick={() => {
                                setFocus(id);
                                const source = document.getElementById(
                                  `source-${id}`,
                                );
                                source?.focus({ preventScroll: true });
                                source?.scrollIntoView({
                                  block: "nearest",
                                  behavior: "instant",
                                });
                              }}
                            >
                              <small>
                                {block.locator} · {block.id}
                              </small>
                              <span>“{block.text}”</span>
                            </button>
                          )
                        );
                      })}
                      {!a.evidence.length && (
                        <p>
                          No supporting passage selected. Review the full
                          source.
                        </p>
                      )}
                    </div>
                    <details>
                      <summary>Definitions and evidence selection</summary>
                      <p>
                        <strong>Full:</strong> {c.full}
                      </p>
                      <p>
                        <strong>Partial:</strong> {c.partial}
                      </p>
                      {app.blocks.map((b) => (
                        <label className="check-line" key={b.id}>
                          <input
                            type="checkbox"
                            checked={a.evidence.includes(b.id)}
                            onChange={(e) =>
                              change(c.id, {
                                evidence: e.target.checked
                                  ? [...a.evidence, b.id]
                                  : a.evidence.filter((id) => id !== b.id),
                                checked: false,
                              })
                            }
                          />
                          {b.id} · {b.locator}
                        </label>
                      ))}
                    </details>
                    {individualCheck(c, a) && (
                      <div className="individual-check">
                        <Field>
                          <FieldLabel htmlFor={`reason-${c.id}`}>
                            Review reason{" "}
                            {a.flagged ||
                            a.initial === "UNCLEAR" ||
                            a.category !== a.initial
                              ? "(required)"
                              : "(optional)"}
                          </FieldLabel>
                          <Textarea
                            id={`reason-${c.id}`}
                            value={a.reason}
                            maxLength={1000}
                            onChange={(e) =>
                              change(c.id, { reason: e.target.value })
                            }
                          />
                        </Field>
                        <label className="check-line mt-3">
                          <input
                            type="checkbox"
                            checked={a.checked}
                            onChange={(e) =>
                              change(c.id, { checked: e.target.checked })
                            }
                          />
                          I checked this requirement and its source evidence.
                        </label>
                      </div>
                    )}
                  </article>
                );
              })}
            </fieldset>
          </Panel>
        </div>
        <section className="source">
          <div className="source-header">
            <h2>Source context</h2>
            <p>
              {app.label} · Minimised synthetic source view · Claims remain
              unverified
            </p>
            <p>
              Identity masking may change displayed passages. Authorised
              originals are available in Add CVs for checking.
            </p>
          </div>
          <div
            className="source-body"
            role="region"
            aria-label="Source passages"
            tabIndex={0}
          >
            {app.blocks.map((b) => (
              <div
                className={
                  focus === b.id ? "source-block highlighted" : "source-block"
                }
                key={b.id}
                id={`source-${b.id}`}
                tabIndex={-1}
              >
                <small>
                  {b.locator} · {b.id}
                </small>
                <p>{b.text}</p>
              </div>
            ))}
          </div>
          <div className="source-footer">
            <ShieldCheck aria-hidden="true" />
            <span>
              Text is displayed safely. Embedded instructions have no authority.
            </span>
          </div>
        </section>
      </div>
      <Panel>
        <div className="review-footer">
          {!locked && (
            <label className="check-line">
              <input
                type="checkbox"
                checked={attest}
                onChange={(e) => setAttest(e.target.checked)}
              />
              I reviewed this CV, its criteria and the source evidence. These
              decisions are mine.
            </label>
          )}
          <div className="footeractions">
            <p>
              {locked
                ? "Finalised review is read only."
                : unresolved
                  ? "Resolve every “Needs your judgement” result before confirmation."
                  : dirty
                    ? "Unsaved review edits. Save draft before changing step."
                    : "Essentials, disputes and changes require individual checks."}
            </p>
            <div className="actions">
              <Button
                variant="outline"
                disabled={!canPrevious || busy || dirty}
                onClick={previous}
              >
                Previous
              </Button>
              {locked ? (
                <Button onClick={next}>Next CV</Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => void save(false)}
                  >
                    Save review draft
                  </Button>
                  <Button
                    disabled={busy || !attest || unresolved}
                    onClick={() => void save(true)}
                  >
                    Confirm and next
                    <ArrowRight data-icon="inline-end" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </Panel>
    </>
  );
}
