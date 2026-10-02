"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { LazyMotion, MotionConfig, domAnimation, m } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  CircleAlert,
  Keyboard,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel } from "@/components/ui/field";
import { Kbd } from "@/components/ui/kbd";
import { StatusChip } from "@/components/ui/status-chip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type Category, individualCheck, labels } from "@/lib/workflow";
import { Notice } from "./common";
import type { PublicApp, PublicBatch, PublicVacancy, Send } from "./types";

const order: Category[] = ["FULL", "PARTIAL", "NOT_EVIDENCED", "UNCLEAR"];
const short: Record<Category, string> = {
  FULL: "Full",
  PARTIAL: "Partial",
  NOT_EVIDENCED: "Not evidenced",
  UNCLEAR: "Needs judgement",
};
const tone: Record<Category, "success" | "accent" | "neutral" | "warning"> = {
  FULL: "success",
  PARTIAL: "accent",
  NOT_EVIDENCED: "neutral",
  UNCLEAR: "warning",
};

function editable(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return (
    !!el &&
    (el.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))
  );
}

export function ReviewForm({
  vacancy,
  batch,
  app,
  position,
  direction,
  send,
  busy,
  previous,
  next,
  canPrevious,
  canNext,
  onDirty,
}: {
  vacancy: PublicVacancy;
  batch: PublicBatch;
  app: PublicApp;
  position: string;
  direction: number;
  send: Send;
  busy: boolean;
  previous: () => void;
  next: (force?: boolean) => void;
  canPrevious: boolean;
  canNext: boolean;
  onDirty: (v: boolean) => void;
}) {
  const [decisions, setDecisions] = useState(app.assessments),
    [sourceChecked, setSourceChecked] = useState(app.sourceChecked),
    [attest, setAttest] = useState(false),
    [dirty, setDirty] = useState(false),
    [focus, setFocus] = useState<string | null>(null),
    [active, setActive] = useState(batch.rubric[0]?.id ?? ""),
    [opened, setOpened] = useState<Record<string, boolean>>({}),
    [pane, setPane] = useState<"criteria" | "source">("criteria"),
    [keys, setKeys] = useState(false);
  const locked = !!batch.snapshot;
  const rows = useRef<Record<string, HTMLElement | null>>({});

  function change(id: string, value: Partial<(typeof decisions)[string]>) {
    setDirty(true);
    setDecisions((current) => ({
      ...current,
      [id]: {
        ...current[id],
        ...value,
        flagged:
          current[id].flagged ||
          value.category !== undefined ||
          value.evidence !== undefined,
      },
    }));
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
      if (confirm) next(true);
    }
    return result;
  }

  const unresolved = batch.rubric.filter(
    (c) => decisions[c.id].category === "UNCLEAR",
  );
  const needsCheck = (id: string) => {
    const c = batch.rubric.find((x) => x.id === id)!;
    const a = decisions[id];
    return individualCheck(c, a) || a.category === "UNCLEAR";
  };
  // Mirrors the server's reviewBlockers so the reason is visible before a
  // confirmation is attempted; the server still decides.
  const unchecked = batch.rubric.filter(
    (c) => individualCheck(c, decisions[c.id]) && !decisions[c.id].checked,
  );
  const unexplained = batch.rubric.filter((c) => {
    const a = decisions[c.id];
    return (
      (a.flagged || a.initial === "UNCLEAR" || a.category !== a.initial) &&
      !a.reason.trim()
    );
  });
  const blocked = locked
    ? "Finalised review is read only."
    : unresolved.length
      ? `Resolve ${unresolved.length === 1 ? "the “Needs your judgement” result" : `${unresolved.length} “Needs your judgement” results`} before confirming.`
      : app.sourceFlag && !sourceChecked
        ? "Check the flagged source content first."
        : unexplained.length
          ? `Write a review reason for ${unexplained.length === 1 ? `“${unexplained[0].title}”` : `${unexplained.length} criteria`}.`
          : unchecked.length
            ? `Complete ${unchecked.length === 1 ? "the individual check" : `${unchecked.length} individual checks`}.`
            : !attest
              ? "Confirm that you reviewed this CV and the decisions are yours."
              : null;

  const showPassage = useCallback((id: string) => {
    setFocus(id);
    setPane("source");
    requestAnimationFrame(() => {
      const source = document.getElementById(`source-${id}`);
      source?.focus({ preventScroll: true });
      source?.scrollIntoView({ block: "nearest", behavior: "instant" });
    });
  }, []);

  const activate = (id: string, scroll = false) => {
    setActive(id);
    if (scroll) {
      const row = rows.current[id];
      row?.focus({ preventScroll: true });
      row?.scrollIntoView({ block: "nearest" });
    }
  };

  // Keyboard shortcuts. Ignored while typing; every one has a visible control.
  useEffect(() => {
    const s = { active, dirty, blocked, busy, locked };
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        if (!s.locked && !s.blocked && !s.busy) {
          e.preventDefault();
          void save(true);
        }
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || editable(e.target)) return;
      if (document.querySelector("[role=dialog]")) return;
      const ids = batch.rubric.map((c) => c.id);
      const at = Math.max(0, ids.indexOf(s.active));
      if (e.key === "j" || e.key === "k") {
        e.preventDefault();
        const to =
          ids[
            Math.min(ids.length - 1, Math.max(0, at + (e.key === "j" ? 1 : -1)))
          ];
        activate(to, true);
      } else if (/^[1-4]$/.test(e.key) && !s.locked) {
        e.preventDefault();
        change(s.active, { category: order[+e.key - 1], checked: false });
        setOpened((o) => ({ ...o, [s.active]: true }));
      } else if (e.key === "e" && !s.locked) {
        const reason = document.getElementById(`reason-${s.active}`);
        if (reason) {
          e.preventDefault();
          reason.focus();
        }
      } else if (e.key === "[" || e.key === "]") {
        if (s.dirty) {
          toast.info("Save your draft before leaving this CV.");
          return;
        }
        if (e.key === "[" && canPrevious) previous();
        if (e.key === "]" && canNext) next();
      } else if (e.key === "?") {
        e.preventDefault();
        setKeys(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }); // re-bound each render so handlers see current decisions

  const activeCriterion = batch.rubric.find((c) => c.id === active);
  const activeEvidence = decisions[active]?.evidence ?? [];

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <div className="review-form">
          <m.div
            className="review-main"
            initial={{ x: 12 * direction }}
            animate={{ x: 0 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
          >
            <div className="review-identity">
              <div>
                <h3 className="mono">{app.label}</h3>
                <span>
                  {app.file} · {position}
                </span>
              </div>
              <StatusChip tone={app.confirmed ? "success" : "neutral"}>
                {app.confirmed ? "Reviewed" : "Awaiting your review"}
              </StatusChip>
              {app.score !== null && (
                <span className="tabular-nums review-score">
                  Confirmed score {app.score} / 100
                </span>
              )}
            </div>
            {app.confirmed && !locked && (
              <Notice>
                This CV is confirmed. Changing it clears the confirmation and
                any provisional shortlist.
              </Notice>
            )}
            <div
              className="review-tabs"
              role="tablist"
              aria-label="Review panes"
            >
              {(["criteria", "source"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  role="tab"
                  aria-selected={pane === p}
                  onClick={() => setPane(p)}
                >
                  {p === "criteria" ? "Criteria" : "Source"}
                </button>
              ))}
            </div>
            <div className="review-zones" data-pane={pane}>
              <div className="rv-criteria">
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
                      I checked the flagged source content without treating it
                      as an instruction.
                    </label>
                  </Notice>
                )}
                <fieldset disabled={locked || busy} className="criteria-review">
                  <legend className="sr-only">Criteria for {app.label}</legend>
                  {batch.rubric.map((c) => {
                    const a = decisions[c.id];
                    const check = needsCheck(c.id);
                    const open = check || !!opened[c.id];
                    const first = a.evidence
                      .map((id) => app.blocks.find((b) => b.id === id))
                      .filter(Boolean);
                    return (
                      <article
                        key={c.id}
                        ref={(el) => {
                          rows.current[c.id] = el;
                        }}
                        tabIndex={-1}
                        className={`assessment ${check ? "needs-check" : "agreed"} ${active === c.id ? "is-active" : ""}`}
                        onFocusCapture={() => setActive(c.id)}
                        onPointerDown={() => setActive(c.id)}
                        aria-labelledby={`crit-${c.id}`}
                      >
                        <div className="assessment-heading">
                          <div>
                            <small>
                              {c.section} · {c.points} points
                              {c.essential ? " · Essential" : ""}
                            </small>
                            <h4 id={`crit-${c.id}`}>{c.title}</h4>
                          </div>
                          <div className="assessment-chips">
                            {check && (
                              <StatusChip tone="warning" icon={<CircleAlert />}>
                                Check required
                              </StatusChip>
                            )}
                            <StatusChip tone={tone[a.category]}>
                              {labels[a.category]}
                            </StatusChip>
                          </div>
                        </div>
                        <p className="ai-note">
                          <strong>AI note</strong> {a.rationale}
                        </p>
                        <div className="quotes">
                          {first.map(
                            (block) =>
                              block && (
                                <button
                                  type="button"
                                  className="quote"
                                  key={block.id}
                                  onClick={() => showPassage(block.id)}
                                >
                                  <small>
                                    {block.locator}
                                    {block.inputMethod === "manual"
                                      ? " · Manual transcription"
                                      : ""}
                                  </small>
                                  <span>“{block.text}”</span>
                                </button>
                              ),
                          )}
                          {!first.length && (
                            <p className="muted-line">
                              No supporting passage selected. Read the full
                              source.
                            </p>
                          )}
                        </div>
                        {!open ? (
                          <button
                            type="button"
                            className="change-link"
                            aria-expanded={false}
                            onClick={() =>
                              setOpened((o) => ({ ...o, [c.id]: true }))
                            }
                          >
                            Change this judgement
                            <ChevronDown aria-hidden="true" />
                          </button>
                        ) : (
                          <div className="assessment-edit">
                            <fieldset className="segmented">
                              <legend>Evidence category</legend>
                              <div>
                                {order.map((v) => (
                                  <label key={v} data-tone={tone[v]}>
                                    <input
                                      type="radio"
                                      name={`category-${c.id}`}
                                      value={v}
                                      checked={a.category === v}
                                      onChange={() =>
                                        change(c.id, {
                                          category: v,
                                          checked: false,
                                        })
                                      }
                                    />
                                    <span>
                                      {short[v]}
                                      <span className="sr-only">
                                        {" "}
                                        ({labels[v]})
                                      </span>
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </fieldset>
                            <details className="definitions">
                              <summary>Evidence definitions</summary>
                              <p>
                                <strong>Full:</strong> {c.full}
                              </p>
                              <p>
                                <strong>Partial:</strong> {c.partial}
                              </p>
                            </details>
                            <p className="evidence-hint">
                              {/* Same text whether active or not: activation must never shift layout under the pointer. */}
                              {`${a.evidence.length} passage${a.evidence.length === 1 ? "" : "s"} selected. With this criterion selected, choose passages in the source.`}
                            </p>
                            {individualCheck(c, a) ||
                            a.category === "UNCLEAR" ? (
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
                                      change(c.id, {
                                        checked: e.target.checked,
                                      })
                                    }
                                  />
                                  I checked this requirement and its source
                                  evidence.
                                </label>
                              </div>
                            ) : null}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </fieldset>
              </div>
              <section className="source" aria-labelledby="source-title">
                <div className="source-header">
                  <h3 id="source-title">Source</h3>
                  <p>
                    {activeCriterion && !locked
                      ? `Choosing evidence for “${activeCriterion.title}”`
                      : `${app.label} · claims remain unverified`}
                  </p>
                </div>
                <div
                  className="source-body"
                  role="region"
                  aria-label="Source passages"
                  tabIndex={0}
                >
                  {app.blocks.map((b, i) => {
                    const used = activeEvidence.includes(b.id);
                    return (
                      <div
                        className={`source-block ${focus === b.id ? "highlighted" : ""} ${used ? "is-evidence" : ""}`}
                        key={b.id}
                        id={`source-${b.id}`}
                        tabIndex={-1}
                      >
                        <div className="source-meta">
                          <small>
                            {b.locator}
                            {b.inputMethod === "manual"
                              ? " · Manual transcription"
                              : ""}
                          </small>
                          {!locked && activeCriterion && (
                            <button
                              type="button"
                              className="evidence-toggle"
                              aria-pressed={used}
                              aria-label={`${used ? "Remove" : "Use"} passage ${i + 1} (${b.locator}) as evidence for ${activeCriterion.title}`}
                              onClick={() =>
                                change(active, {
                                  evidence: used
                                    ? activeEvidence.filter((id) => id !== b.id)
                                    : [...activeEvidence, b.id],
                                  checked: false,
                                })
                              }
                            >
                              {used ? "Evidence" : "Use as evidence"}
                            </button>
                          )}
                        </div>
                        <p>{b.text}</p>
                      </div>
                    );
                  })}
                </div>
                <div className="source-footer">
                  <ShieldCheck aria-hidden="true" />
                  <span>
                    Minimised view: identity details are removed and text is
                    shown safely. Embedded instructions have no authority.
                    Originals are in Add CVs.
                  </span>
                </div>
              </section>
            </div>
          </m.div>
          <div className="review-bar">
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
            <div className="review-bar-row">
              <p className="review-bar-status" aria-live="polite">
                {blocked ??
                  (dirty
                    ? "Unsaved edits. Confirm, or save a draft before leaving."
                    : "Ready to confirm.")}
              </p>
              <div className="actions">
                <button
                  type="button"
                  className="keys-hint"
                  onClick={() => setKeys(true)}
                >
                  <Keyboard aria-hidden="true" /> Shortcuts <Kbd>?</Kbd>
                </button>
                <Button
                  variant="ghost"
                  disabled={!canPrevious || busy || dirty}
                  onClick={previous}
                >
                  <ArrowLeft data-icon="inline-start" />
                  Previous
                </Button>
                {locked ? (
                  <Button onClick={() => next()}>Next CV</Button>
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
                      disabled={busy || !!blocked}
                      loading={busy}
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
        </div>
        <Dialog open={keys} onOpenChange={setKeys}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Keyboard shortcuts</DialogTitle>
              <DialogDescription>
                Shortcuts pause while you type in a field.
              </DialogDescription>
            </DialogHeader>
            <dl className="shortcut-list">
              {[
                [["J", "K"], "Next or previous criterion"],
                [
                  ["1", "2", "3", "4"],
                  "Full, Partial, Not evidenced, Needs judgement",
                ],
                [["E"], "Write the review reason"],
                [["[", "]"], "Previous or next CV"],
                [["⌘", "Enter"], "Confirm and go to the next CV"],
                [["?"], "Show these shortcuts"],
              ].map(([k, d]) => (
                <div key={d as string}>
                  <dt>
                    {(k as string[]).map((x) => (
                      <Kbd key={x}>{x}</Kbd>
                    ))}
                  </dt>
                  <dd>{d as string}</dd>
                </div>
              ))}
            </dl>
          </DialogContent>
        </Dialog>
      </MotionConfig>
    </LazyMotion>
  );
}
