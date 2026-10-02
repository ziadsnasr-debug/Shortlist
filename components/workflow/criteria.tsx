"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Plus, Sparkles } from "lucide-react";
import { AnimatePresence, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { type Criterion } from "@/lib/workflow";
import { WeightChart } from "../workspace-insights";
import { sampleRubric } from "@/fixtures/synthetic/seed";
import { Notice } from "./common";
import {
  INCOMPLETE_REASON,
  MAX_CRITERIA,
  groupCriteria,
  groupOrder,
  isComplete,
  newCriterion,
  totalPoints,
} from "./criteria/model";
import { CriteriaMotion } from "./criteria/motion";
import { CriterionRow } from "./criteria/row";
import type { PublicBatch, PublicVacancy, Send } from "./types";

const footerNote = "criteria-footer-note";

export function Criteria({
  ai,
  vacancy,
  batch,
  send,
  busy,
  onNext,
  onDirty,
  canEdit,
  version,
  onReload,
}: {
  canEdit: boolean;
  vacancy: PublicVacancy;
  batch: PublicBatch;
  send: Send;
  busy: boolean;
  onNext: () => void;
  onDirty: (v: boolean) => void;
  ai: boolean;
  /** Workspace version this screen was loaded at, used to recognise a stale save. */
  version?: number;
  /** Reloads the workspace from the server. */
  onReload?: () => void;
}) {
  const [rubric, setRubric] = useState<Criterion[]>(batch.rubric),
    [dirty, setDirty] = useState(false),
    [expanded, setExpanded] = useState<Set<string>>(() => new Set()),
    [fresh, setFresh] = useState<Set<string>>(() => new Set()),
    [aiIds, setAiIds] = useState<string[]>([]),
    [drafting, setDrafting] = useState(false),
    [conflict, setConflict] = useState(false),
    [reloading, setReloading] = useState(false),
    [confirmOpen, setConfirmOpen] = useState(false),
    [instant, setInstant] = useState(false),
    [announcement, setAnnouncement] = useState(""),
    [seenRubric, setSeenRubric] = useState(batch.rubric);
  const reduceMotion = useReducedMotion();
  const instantTimer = useRef<number | undefined>(undefined);
  const restoreMenuFocus = useRef(false);
  const pendingFocus = useRef<string | null>(null);

  const editable = !batch.published && canEdit;
  const total = totalPoints(rubric);
  const groups = groupCriteria(rubric);
  const ordered = groups.flatMap((g) => g.rows);
  const sections = groups.map((g) => g.key).filter(Boolean);
  const incomplete = rubric.some((c) => !isComplete(c));
  const essentials = rubric.filter((c) => c.essential).length;

  // Load latest: once the refreshed workspace arrives, adopt its criteria and
  // drop the local draft. The draft is never replaced before then.
  if (batch.rubric !== seenRubric) {
    setSeenRubric(batch.rubric);
    if (reloading) {
      setReloading(false);
      setRubric(batch.rubric);
      setDirty(false);
      setConflict(false);
      setAiIds([]);
      setExpanded(new Set());
      setFresh(new Set());
    }
  }

  function mutate(change: (rows: Criterion[]) => Criterion[]) {
    setRubric((rows) => groupOrder(change(groupOrder(rows))));
    setDirty(true);
  }
  function markFresh(ids: string[]) {
    setFresh((prev) => new Set([...prev, ...ids]));
  }
  function markRepeat() {
    setInstant(true);
    window.clearTimeout(instantTimer.current);
    instantTimer.current = window.setTimeout(() => setInstant(false), 400);
  }
  function edit(id: string, patch: Partial<Criterion>) {
    setAiIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev,
    );
    mutate((rows) => rows.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }
  function move(id: string, direction: -1 | 1) {
    const title = ordered.find((c) => c.id === id)?.title.trim() || "criterion";
    mutate((rows) => {
      const i = rows.findIndex((c) => c.id === id);
      const j = i + direction;
      if (i < 0 || !rows[j] || rows[j].section !== rows[i].section) return rows;
      const next = [...rows];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setAnnouncement(`Moved ${title} ${direction < 0 ? "up" : "down"}.`);
  }
  function add() {
    const row = newCriterion(ordered.at(-1)?.section ?? "");
    pendingFocus.current = `criterion-title-${row.id}`;
    markFresh([row.id]);
    setExpanded((prev) => new Set(prev).add(row.id));
    mutate((rows) => [...rows, row]);
    setAnnouncement("Added a criterion.");
  }
  function duplicate(id: string) {
    const original = ordered.find((c) => c.id === id);
    if (!original) return;
    const copy = { ...original, id: crypto.randomUUID() };
    restoreMenuFocus.current = true;
    pendingFocus.current = `criterion-title-${copy.id}`;
    markFresh([copy.id]);
    setExpanded((prev) => new Set(prev).add(copy.id));
    mutate((rows) => {
      const next = [...rows];
      next.splice(rows.findIndex((c) => c.id === id) + 1, 0, copy);
      return next;
    });
    setAnnouncement("Duplicated the criterion. Edit the copy.");
  }
  function remove(id: string) {
    const index = ordered.findIndex((c) => c.id === id);
    const removed = ordered[index];
    if (!removed) return;
    const neighbour = ordered[index + 1] ?? ordered[index - 1];
    restoreMenuFocus.current = true;
    pendingFocus.current = neighbour
      ? `criterion-title-${neighbour.id}`
      : "add-criterion";
    const title = removed.title.trim() || "Untitled criterion";
    mutate((rows) => rows.filter((c) => c.id !== id));
    setAnnouncement(`Removed ${title}.`);
    toast(`Removed "${title}"`, {
      duration: 8000,
      action: {
        label: "Undo",
        onClick: () => {
          markFresh([removed.id]);
          mutate((rows) => {
            if (rows.some((c) => c.id === removed.id)) return rows;
            const next = [...rows];
            next.splice(Math.min(index, next.length), 0, removed);
            return next;
          });
          setAnnouncement(`Restored ${title}.`);
        },
      },
    });
  }
  function replaceAll(next: Criterion[], message: string, aiDraft = false) {
    const before = rubric;
    const wasDirty = dirty;
    const beforeAi = aiIds;
    markFresh(next.map((c) => c.id));
    setExpanded(new Set());
    setAiIds(aiDraft ? next.map((c) => c.id) : []);
    setRubric(groupOrder(next));
    setDirty(true);
    setAnnouncement(message);
    toast(message, {
      duration: 8000,
      action: {
        label: "Undo",
        onClick: () => {
          setRubric(before);
          setDirty(wasDirty);
          setAiIds(beforeAi);
          markFresh(before.map((c) => c.id));
        },
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
  useEffect(() => () => window.clearTimeout(instantTimer.current), []);
  useEffect(() => {
    const id = pendingFocus.current;
    if (!id) return;
    pendingFocus.current = null;
    requestAnimationFrame(() => document.getElementById(id)?.focus());
  }, [rubric]);

  // The send helper reports failures as a toast and returns nothing, so a
  // moved workspace version is how a stale save is told apart from a rule.
  async function checkForConflict() {
    if (version === undefined) return;
    try {
      const response = await fetch("/api/workspace", { cache: "no-store" });
      const latest = await response.json();
      if (response.ok && latest.version !== version) setConflict(true);
    } catch {
      /* The toast from the failed save already explains it. */
    }
  }
  async function save() {
    const saved = await send({
      type: "rubric",
      vacancyId: vacancy.id,
      batchId: batch.id,
      rubric: groupOrder(rubric),
    });
    if (saved) {
      setDirty(false);
      setConflict(false);
    } else await checkForConflict();
  }
  async function publish() {
    const published = await send({
      type: "publish",
      vacancyId: vacancy.id,
      batchId: batch.id,
    });
    setConfirmOpen(false);
    if (published) onNext();
    else await checkForConflict();
  }
  async function draftWithAi() {
    setDrafting(true);
    try {
      const r = await fetch("/api/criteria", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vacancyId: vacancy.id, synthetic: true }),
        }),
        d = await r.json();
      if (!r.ok) throw new Error(d.error);
      replaceAll(d.rubric as Criterion[], "Draft criteria added.", true);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDrafting(false);
    }
  }
  function loadLatest() {
    setReloading(true);
    onReload?.();
  }

  const note = batch.published
    ? "Published criteria are frozen for this batch."
    : !canEdit
      ? "Waiting for an administrator to publish these criteria."
      : incomplete
        ? INCOMPLETE_REASON
        : dirty
          ? "Unsaved changes. Save the draft before publishing or leaving this step."
          : !rubric.length
            ? "Add at least one criterion before publishing."
            : total !== 100
              ? `Publishing needs exactly 100 points. ${total < 100 ? `Add ${100 - total} more.` : `Remove ${total - 100}.`}`
              : "Ready to publish. Publishing freezes these criteria for this batch.";
  const stagger = (id: string) => {
    const i = aiIds.indexOf(id);
    return reduceMotion || i < 0 ? 0 : Math.min(i * 0.04, 0.36);
  };

  return (
    <CriteriaMotion>
      <div className="sectionhead">
        <div>
          <h2>Set the criteria</h2>
          <p>
            Define observable evidence. Weights stay fixed for every CV in this
            batch.
          </p>
        </div>
      </div>
      <WeightChart rubric={rubric} instant={instant} />
      {!batch.published && !canEdit && (
        <div className="mt-4">
          <Notice>
            Only administrators can edit and publish criteria. You can read the
            draft here.
          </Notice>
        </div>
      )}
      {editable && (
        <div className="mt-4">
          <Notice>
            Criteria suggestions are editable examples, not AI output. Employer
            approval is required before publication.
          </Notice>
        </div>
      )}
      {conflict && (
        <Alert className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p>
            Another save changed this workspace. Your draft is still here and
            has not been saved.
          </p>
          {onReload && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={reloading}
              onClick={loadLatest}
            >
              Load latest
            </Button>
          )}
        </Alert>
      )}
      {editable && (
        <div className="my-4">
          <Button
            variant="outline"
            disabled={!ai || busy}
            loading={drafting}
            onClick={draftWithAi}
          >
            <Sparkles aria-hidden="true" />
            Draft criteria with AI
          </Button>
          {!ai && (
            <p className="mt-2 text-sm text-muted-foreground">
              AI drafting needs approved provider configuration. Edit example
              criteria directly.
            </p>
          )}
        </div>
      )}
      <div className="mt-4 grid gap-6" aria-busy={drafting || undefined}>
        {drafting ? (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <p role="status" className="sr-only">
              Drafting criteria
            </p>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="grid gap-3 border-b border-border p-4 last:border-b-0"
              >
                <Skeleton className="h-9 w-full max-w-lg" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            ))}
          </div>
        ) : (
          groups.map((g) => (
            <section key={g.key} aria-labelledby={`section-${g.key || "none"}`}>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <h3
                  id={`section-${g.key || "none"}`}
                  className="text-base font-semibold"
                >
                  {g.name}
                </h3>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {g.points} {g.points === 1 ? "point" : "points"}
                </span>
              </div>
              <ul className="relative divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                <AnimatePresence initial={false} mode="popLayout">
                  {g.rows.map((c, i) => (
                    <CriterionRow
                      key={c.id}
                      criterion={c}
                      editable={editable}
                      busy={busy}
                      expanded={expanded.has(c.id)}
                      aiDraft={aiIds.includes(c.id)}
                      canMoveUp={i > 0}
                      canMoveDown={i < g.rows.length - 1}
                      canDuplicate={rubric.length < MAX_CRITERIA}
                      sections={sections}
                      animateIn={fresh.has(c.id)}
                      enterDelay={stagger(c.id)}
                      instant={instant}
                      onToggle={() =>
                        setExpanded((prev) => {
                          const next = new Set(prev);
                          if (!next.delete(c.id)) next.add(c.id);
                          return next;
                        })
                      }
                      onChange={(patch) => edit(c.id, patch)}
                      onMove={(direction) => move(c.id, direction)}
                      onDuplicate={() => duplicate(c.id)}
                      onRemove={() => remove(c.id)}
                      onRepeat={markRepeat}
                      onMenuClose={(event) => {
                        if (restoreMenuFocus.current) {
                          event.preventDefault();
                          restoreMenuFocus.current = false;
                        }
                      }}
                    />
                  ))}
                </AnimatePresence>
              </ul>
            </section>
          ))
        )}
        {!drafting && !rubric.length && (
          <p className="text-sm text-muted-foreground">
            No criteria yet. Add one, or start from the editable examples.
          </p>
        )}
      </div>
      {editable && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            id="add-criterion"
            variant="outline"
            disabled={busy || drafting || rubric.length >= MAX_CRITERIA}
            onClick={add}
          >
            Add criterion
            <Plus data-icon="inline-end" />
          </Button>
          <Button
            variant="outline"
            disabled={busy || drafting}
            onClick={() =>
              replaceAll(
                structuredClone(sampleRubric),
                "Example criteria loaded.",
              )
            }
          >
            Use editable example criteria
          </Button>
          {rubric.length >= MAX_CRITERIA && (
            <p className="text-sm text-muted-foreground">
              A rubric can have up to {MAX_CRITERIA} criteria.
            </p>
          )}
        </div>
      )}
      <div className="footeractions">
        <p id={footerNote}>{note}</p>
        <div className="actions">
          {editable ? (
            <>
              <Button
                variant="outline"
                aria-describedby={footerNote}
                disabled={busy || drafting || incomplete}
                onClick={save}
              >
                Save criteria draft
              </Button>
              <Button
                aria-describedby={footerNote}
                disabled={
                  busy ||
                  drafting ||
                  incomplete ||
                  total !== 100 ||
                  dirty ||
                  !rubric.length
                }
                onClick={() => setConfirmOpen(true)}
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
      <div role="status" className="sr-only">
        {announcement}
      </div>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish these criteria?</DialogTitle>
            <DialogDescription>
              Publishing freezes these criteria for this batch. You can&apos;t
              change them after CVs are added.
            </DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-3 gap-3 rounded-lg bg-surface-2 p-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Criteria</dt>
              <dd className="text-base font-semibold tabular-nums">
                {rubric.length}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Essential</dt>
              <dd className="text-base font-semibold tabular-nums">
                {essentials}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Total points</dt>
              <dd className="text-base font-semibold tabular-nums">{total}</dd>
            </div>
          </dl>
          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose asChild>
              <Button variant="outline" disabled={busy}>
                Cancel
              </Button>
            </DialogClose>
            <Button loading={busy} onClick={publish}>
              Publish criteria
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CriteriaMotion>
  );
}
