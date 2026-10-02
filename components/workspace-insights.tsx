import { type CSSProperties } from "react";
import {
  BarChart3,
  Check,
  CheckCheck,
  Files,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { allocationText } from "./workflow/criteria/model";
import type { Application } from "@/lib/workflow";
import { type Criterion, labels } from "@/lib/rules";

/**
 * Sticky allocation bar for the criteria step. Each criterion is a segment
 * sized by its points. Segments move with transform (translateX + scaleX), so
 * resizing never triggers layout. Essentials carry a diamond as well as a
 * stronger fill, so the difference is never colour alone.
 */
export function WeightChart({
  rubric,
  instant = false,
}: {
  rubric: Criterion[];
  /** Skip the transition, for keyboard-repeated edits. */
  instant?: boolean;
}) {
  const items = rubric.map((c) => ({
    ...c,
    points: Number.isFinite(c.points) ? c.points : 0,
  }));
  const total = items.reduce((n, c) => n + c.points, 0);
  const scale = Math.max(100, total);
  const segments = items.map((c, i) => ({
    c,
    start: items.slice(0, i).reduce((n, x) => n + x.points, 0) / scale,
    size: c.points / scale,
  }));
  const move = instant
    ? "transition-none"
    : "transition-transform duration-(--dur-base) ease-(--ease-out) motion-reduce:transition-none";
  const ready = total === 100;
  const over = total > 100;
  return (
    <section
      aria-label="Criteria weight allocation"
      className="sticky top-0 z-10 rounded-lg border border-border bg-card px-4 py-3 max-md:top-(--mobile-bar-height,3.5rem)"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p
          role="status"
          className="flex items-center gap-2 text-sm font-medium tabular-nums"
        >
          {ready ? (
            <Check aria-hidden="true" className="size-4 text-success" />
          ) : over ? (
            <TriangleAlert
              aria-hidden="true"
              className="size-4 text-destructive"
            />
          ) : null}
          {allocationText(total)}
        </p>
        <span aria-hidden="true" className="text-xs text-muted-foreground">
          ◆ Essential
        </span>
      </div>
      <TooltipProvider delayDuration={120}>
        <div className="relative mt-2 h-4 w-full overflow-hidden rounded-sm bg-surface-2">
          {segments.map(({ c, start, size }) => (
            <div
              key={c.id}
              aria-hidden="true"
              className={`absolute inset-y-0 left-0 w-full origin-left ${move} ${c.essential ? "bg-primary" : "bg-ev-partial"}`}
              style={{
                transform: `translateX(${start * 100}%) scaleX(${size})`,
              }}
            />
          ))}
          {segments.slice(1).map(({ c, start }) => (
            <div
              key={`gap-${c.id}`}
              aria-hidden="true"
              className={`pointer-events-none absolute inset-y-0 left-0 w-full ${move}`}
              style={{ transform: `translateX(${start * 100}%)` }}
            >
              <div className="absolute inset-y-0 left-0 -ml-px w-0.5 bg-card" />
            </div>
          ))}
          {over ? (
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute inset-y-0 left-0 w-full ${move}`}
              style={{ transform: `translateX(${(100 / scale) * 100}%)` }}
            >
              <div className="absolute inset-y-0 left-0 -ml-px w-0.5 bg-foreground" />
            </div>
          ) : null}
          <div className="absolute inset-0" aria-hidden="true">
            {segments.map(({ c, start, size }) => (
              <Tooltip key={c.id}>
                <TooltipTrigger asChild>
                  <span
                    className="absolute inset-y-0 flex items-center justify-center text-[10px] leading-none text-primary-foreground"
                    style={{
                      left: `${start * 100}%`,
                      width: `${size * 100}%`,
                    }}
                  >
                    {c.essential && size >= 0.05 ? "◆" : null}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {c.essential ? "◆ " : ""}
                  {c.title.trim() || "Untitled criterion"} · {c.points} points
                  {c.essential ? " · Essential" : ""}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      </TooltipProvider>
      <ul className="sr-only">
        {items.map((c) => (
          <li key={c.id}>
            {c.title.trim() || "Untitled criterion"}, {c.points} points
            {c.essential ? ", essential" : ""}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function BatchProgress({
  applications,
}: {
  applications: Pick<Application, "state" | "confirmed">[];
}) {
  const active = applications.filter((a) => a.state !== "disposed");
  const reviewed = active.filter((a) => a.confirmed).length;
  const attention = active.filter((a) =>
    ["readable_copy", "attention"].includes(a.state),
  ).length;
  return (
    <section className="batch-progress" aria-label="Batch progress">
      <div>
        <Files aria-hidden="true" />
        <span>
          <strong>{active.length}</strong> active applications
        </span>
      </div>
      <div>
        <CheckCheck aria-hidden="true" />
        <span>
          <strong>{reviewed}</strong> reviewed
        </span>
      </div>
      <div>
        <ShieldCheck aria-hidden="true" />
        <span>
          {attention ? (
            <>
              <strong>{attention}</strong> need attention
            </>
          ) : (
            "Human review at every step"
          )}
        </span>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-label="Applications reviewed"
        aria-valuemin={0}
        aria-valuemax={active.length || 1}
        aria-valuenow={reviewed}
        aria-valuetext={`${reviewed} of ${active.length} active applications reviewed`}
      >
        <span
          style={{
            transform: `scaleX(${active.length ? reviewed / active.length : 0})`,
          }}
        />
      </div>
    </section>
  );
}

export function ScoreBar({ score }: { score: number }) {
  return (
    <div className="score-track" aria-hidden="true">
      <span style={{ "--bar-size": score / 100 } as CSSProperties} />
    </div>
  );
}

export function EvidenceComparison({
  rubric,
  applications,
}: {
  rubric: Criterion[];
  applications: (Pick<Application, "id" | "assessments"> & {
    label: string;
  })[];
}) {
  if (!applications.length)
    return (
      <section className="comparison-empty">
        <BarChart3 aria-hidden="true" />
        <div>
          <h3>See the evidence side by side</h3>
          <p>Select up to three applications to compare each requirement.</p>
        </div>
      </section>
    );
  return (
    <section
      className="comparison-panel"
      aria-label="Selected application comparison"
    >
      <div className="panel-body">
        <span className="eyebrow">SIDE BY SIDE</span>
        <h2>Compare the evidence</h2>
        <p>
          Confirmed categories against the same published criteria. Essentials
          stay separate.
        </p>
      </div>
      <div
        className="comparison-scroll"
        role="region"
        aria-label="Evidence comparison table"
        tabIndex={0}
      >
        <table>
          <caption className="sr-only">
            Evidence categories for selected applications. Each row shows the
            maximum available points.
          </caption>
          <thead>
            <tr>
              <th scope="col">Requirement</th>
              {applications.map((a) => (
                <th scope="col" key={a.id}>
                  {a.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rubric.map((c) => (
              <tr key={c.id}>
                <th scope="row">
                  {c.title}
                  <small>
                    {c.points} points{c.essential ? " · Essential" : ""}
                  </small>
                </th>
                {applications.map((a) => {
                  const category = a.assessments[c.id]?.category;
                  return (
                    <td key={a.id}>
                      <span
                        className={`evidence-status ${category?.toLowerCase() ?? "unclear"}`}
                      >
                        {category ? labels[category] : "Needs your judgement"}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
