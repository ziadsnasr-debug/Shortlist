"use client";
import { useState } from "react";
import { Check, Circle, CircleAlert, CircleDot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notice } from "./common";
import { ReviewForm } from "./review-form";
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
  // `force` only after a successful save; queue clicks keep the draft guard.
  onCandidate: (n: number, force?: boolean) => void;
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
  const app = apps[index];
  // Direction of travel, so the next CV slides in from the side it came from.
  const [last, setLast] = useState(index);
  const [direction, setDirection] = useState(1);
  if (last !== index) {
    setDirection(index > last ? 1 : -1);
    setLast(index);
  }

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
  const reviewed = apps.filter((a) => a.confirmed).length;
  return (
    <>
      <div className="sectionhead">
        <div>
          <h2>Review the evidence</h2>
          <p>Read every CV. Check the source, then confirm each one once.</p>
        </div>
        <span className="review-count tabular-nums">
          {reviewed} of {apps.length} reviewed
        </span>
      </div>
      <div className="review-layout">
        <nav className="review-queue" aria-label="CVs in this batch">
          <ol>
            {apps.map((a, i) => {
              const unresolved = Object.values(a.assessments).some(
                (x) => x.category === "UNCLEAR",
              );
              const state = a.confirmed
                ? "Reviewed"
                : unresolved
                  ? "Needs your judgement"
                  : "To review";
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    aria-current={i === index ? "true" : undefined}
                    onClick={() => i !== index && onCandidate(number(a))}
                  >
                    {a.confirmed ? (
                      <Check aria-hidden="true" className="q-done" />
                    ) : i === index ? (
                      <CircleDot aria-hidden="true" className="q-current" />
                    ) : unresolved ? (
                      <CircleAlert aria-hidden="true" className="q-warn" />
                    ) : (
                      <Circle aria-hidden="true" />
                    )}
                    <span className="mono">{a.label}</span>
                    <span className="sr-only">, {state}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
        <ReviewForm
          key={`${app.id}-${app.reviewedAt ?? "draft"}`}
          vacancy={vacancy}
          batch={batch}
          app={app}
          position={`${index + 1} of ${apps.length}`}
          direction={direction}
          send={send}
          busy={busy}
          onDirty={onDirty}
          previous={() => onCandidate(number(apps[Math.max(0, index - 1)]))}
          next={(force) =>
            index + 1 < apps.length
              ? onCandidate(number(apps[index + 1]), force)
              : onNext()
          }
          canPrevious={index > 0}
          canNext={index + 1 < apps.length}
        />
      </div>
    </>
  );
}
