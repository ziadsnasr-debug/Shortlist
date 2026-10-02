import { type CSSProperties } from "react";
import { BarChart3, CheckCheck, Files, ShieldCheck } from "lucide-react";
import { type Application, type Criterion, labels } from "@/lib/workflow";

export function WeightChart({ rubric }: { rubric: Criterion[] }) {
  const sections = new Map<string, number>();
  for (const c of rubric)
    sections.set(
      c.section || "Untitled section",
      (sections.get(c.section || "Untitled section") ?? 0) +
        (Number.isFinite(c.points) ? c.points : 0),
    );
  const total = [...sections.values()].reduce((sum, n) => sum + n, 0);
  return (
    <section
      className="insight-panel weight-chart"
      aria-label="Criteria weight allocation"
    >
      <div className="insight-title">
        <span className="eyebrow">
          <BarChart3 aria-hidden="true" /> SCORING FRAMEWORK
        </span>
        <strong>
          {total === 100
            ? "Every point has a purpose."
            : total < 100
              ? `${100 - total} points left to allocate`
              : `${total - 100} points over the limit`}
        </strong>
        <p>One consistent framework for every application.</p>
      </div>
      <div className="weight-rows">
        {[...sections].map(([name, value], i) => (
          <div className="weight-row" key={name}>
            <div>
              <span>{name}</span>
              <strong>
                {value} <small>pts</small>
              </strong>
            </div>
            <div className="bar-track" aria-hidden="true">
              <span
                className={`bar-fill series-${i % 3}`}
                style={
                  {
                    "--bar-size": Math.min(100, Math.max(0, value)) / 100,
                  } as CSSProperties
                }
              />
            </div>
          </div>
        ))}
      </div>
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
