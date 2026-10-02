"use client";
import { Check, Lock } from "lucide-react";
import { NavLink, type Navigate } from "./nav-link";
import { batchSummary } from "./progress";
import { pathFor } from "./routes";
import { steps, type PublicBatch } from "./types";

export function Stepper({
  vacancyId,
  batch,
  step,
  navigate,
}: {
  vacancyId: string;
  batch: PublicBatch;
  step: number;
  navigate: Navigate;
}) {
  const s = batchSummary(batch);
  const allReviewed = s.done[2];
  const locked = [false, !batch.published, !batch.closed, !allReviewed];
  const detail = [
    batch.published ? "Published · 100 points" : `${s.points} of 100 points`,
    !batch.published
      ? "Publish criteria first"
      : `${s.active.length} CV${s.active.length === 1 ? "" : "s"}${batch.closed ? " · intake closed" : s.attention ? ` · ${s.attention} need attention` : ""}`,
    !batch.closed
      ? "Close intake first"
      : `${s.reviewed} of ${s.active.length} reviewed`,
    batch.snapshot
      ? "Finalised"
      : allReviewed
        ? "Choose up to 3"
        : `Opens after ${s.toReview} more review${s.toReview === 1 ? "" : "s"}`,
  ];
  return (
    <nav className="steps" aria-label="Vacancy workflow">
      <ol>
        {steps.map((name, i) => {
          const href = pathFor({
            view: "batch",
            vacancyId,
            batchId: batch.id,
            step: i,
          });
          const state = s.done[i]
            ? "done"
            : locked[i] && i !== step
              ? "locked"
              : "open";
          return (
            <li key={name}>
              <NavLink
                href={href}
                navigate={navigate}
                aria-current={step === i ? "step" : undefined}
                className={`step ${step === i ? "active" : ""} ${state}`}
              >
                <span className="step-number" aria-hidden="true">
                  {state === "done" ? (
                    <Check />
                  ) : state === "locked" ? (
                    <Lock />
                  ) : (
                    i + 1
                  )}
                </span>
                <span>
                  <strong>{name}</strong>
                  <small>
                    <span className="sr-only">
                      {state === "done"
                        ? "Complete. "
                        : state === "locked"
                          ? "Not available yet. "
                          : ""}
                    </span>
                    {detail[i]}
                  </small>
                </span>
              </NavLink>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
