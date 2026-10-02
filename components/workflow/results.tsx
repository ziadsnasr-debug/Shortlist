"use client";
import { Check, Scale } from "lucide-react";
import { StatusChip } from "@/components/ui/status-chip";
import type { Criterion } from "@/lib/workflow";
import type { PublicApp, PublicBatch } from "./types";

export type RankRow = NonNullable<PublicBatch["ranking"]>[number];

// Points from full and partial evidence, from the confirmed categories. The
// server's score is authoritative; this only splits it for display.
export function composition(rubric: Criterion[], app: PublicApp) {
  let full = 0,
    partial = 0;
  for (const c of rubric) {
    const category = app.assessments[c.id]?.category;
    if (category === "FULL") full += c.points;
    if (category === "PARTIAL") partial += c.points / 2;
  }
  return { full, partial };
}

export const points = (n: number) =>
  Number.isInteger(n) ? String(n) : n.toFixed(1);

export function cutTie(ranking: RankRow[]) {
  const straddles = ranking.length > 3 && ranking[2].score === ranking[3].score;
  return straddles ? ranking[2].score : null;
}

// Mirrors the server's boundaryTie for the current, unsaved selection.
export function tieAtSelection(ranking: RankRow[], selected: string[]) {
  if (!selected.length) return false;
  const lowest = Math.min(
    ...ranking.filter((r) => selected.includes(r.id)).map((r) => r.score),
  );
  return ranking.some((r) => !selected.includes(r.id) && r.score === lowest);
}

export function ScoreChart({
  batch,
  ranking,
  selected,
  reveal,
  locked,
  busy,
  onToggle,
  exceptionFor,
}: {
  batch: PublicBatch;
  ranking: RankRow[];
  selected: string[];
  reveal: boolean;
  locked: boolean;
  busy: boolean;
  onToggle: (id: string, on: boolean) => void;
  exceptionFor: (row: RankRow) => React.ReactNode;
}) {
  const tie = cutTie(ranking);
  return (
    <ol className="score-chart" aria-label="Confirmed scores, highest first">
      {ranking.map((row, i) => {
        const app = batch.applications.find((a) => a.id === row.id)!;
        const { full, partial } = composition(batch.rubric, app);
        const isSelected = selected.includes(row.id);
        const name = reveal && app.name ? app.name : app.label;
        return (
          <li
            key={row.id}
            className={`score-row ${isSelected ? "is-selected" : ""} ${i === 3 ? "below-cut" : ""}`}
          >
            <div className="score-row-main">
              <input
                type="checkbox"
                aria-label={`Select ${app.label}`}
                checked={isSelected}
                disabled={
                  busy || locked || (!isSelected && selected.length === 3)
                }
                onChange={(e) => onToggle(row.id, e.target.checked)}
              />
              <div className="score-who">
                <h3 className={reveal && app.name ? "" : "mono"}>{name}</h3>
                <p>
                  {row.essentials.length
                    ? `Essential not fully evidenced: ${row.essentials.join(", ")}`
                    : "All essentials fully evidenced"}
                </p>
                <div className="score-chips">
                  {tie !== null && row.score === tie && (
                    <StatusChip tone="warning" icon={<Scale />}>
                      Tie at {points(tie)}
                    </StatusChip>
                  )}
                  {isSelected && (
                    <StatusChip tone="accent" icon={<Check />}>
                      Shortlisted
                    </StatusChip>
                  )}
                </div>
              </div>
              <div className="score-bar-cell">
                <div
                  className="score-composition"
                  role="img"
                  aria-label={`${points(row.score)} of 100: ${points(full)} points from full evidence, ${points(partial)} from partial evidence`}
                >
                  <span
                    className="seg-full"
                    style={{ transform: `scaleX(${full / 100})` }}
                  />
                  <span
                    className="seg-partial"
                    style={{
                      transform: `translateX(calc(${full}% + ${full && partial ? 2 : 0}px)) scaleX(${partial / 100})`,
                    }}
                  />
                </div>
                <span className="score-split">
                  {points(full)} full · {points(partial)} partial
                </span>
              </div>
              <strong className="score-value">
                {points(row.score)}
                <small>/ 100</small>
              </strong>
            </div>
            {exceptionFor(row)}
          </li>
        );
      })}
    </ol>
  );
}

export function ScoreTable({
  batch,
  ranking,
  selected,
  reveal,
}: {
  batch: PublicBatch;
  ranking: RankRow[];
  selected: string[];
  reveal: boolean;
}) {
  return (
    <div
      className="comparison-scroll"
      role="region"
      aria-label="Confirmed scores table"
      tabIndex={0}
    >
      <table className="score-table">
        <caption className="sr-only">
          Confirmed scores, highest first, split by evidence category
        </caption>
        <thead>
          <tr>
            <th scope="col">Candidate</th>
            <th scope="col" className="num">
              Full evidence
            </th>
            <th scope="col" className="num">
              Partial evidence
            </th>
            <th scope="col" className="num">
              Score
            </th>
            <th scope="col">Essentials</th>
            <th scope="col">Shortlisted</th>
          </tr>
        </thead>
        <tbody>
          {ranking.map((row) => {
            const app = batch.applications.find((a) => a.id === row.id)!;
            const { full, partial } = composition(batch.rubric, app);
            return (
              <tr key={row.id}>
                <th scope="row">{reveal && app.name ? app.name : app.label}</th>
                <td className="num">{points(full)}</td>
                <td className="num">{points(partial)}</td>
                <td className="num">
                  <strong>{points(row.score)}</strong>
                </td>
                <td>
                  {row.essentials.length
                    ? `Not fully evidenced: ${row.essentials.join(", ")}`
                    : "All fully evidenced"}
                </td>
                <td>{selected.includes(row.id) ? "Yes" : "No"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// The logo's three bars draw in, the top one turns teal and a check resolves.
// Plays once on finalisation; static under reduced motion.
export function FinishMark({ play }: { play: boolean }) {
  return (
    <svg
      viewBox="0 0 132 112"
      className={`finish-mark ${play ? "play" : ""}`}
      aria-hidden="true"
    >
      <rect className="fb fb1" x="8" y="14" width="116" height="22" rx="11" />
      <rect className="fb fb2" x="8" y="46" width="84" height="22" rx="11" />
      <rect className="fb fb3" x="8" y="78" width="52" height="22" rx="11" />
      <path className="fcheck" d="M96 25l6 6 11-11" />
    </svg>
  );
}
