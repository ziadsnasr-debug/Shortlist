"use client";
import { ArrowRight, BriefcaseBusiness, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BatchProgress } from "../workspace-insights";
import { NavLink, type Navigate } from "./nav-link";
import { batchSummary, nextAction } from "./progress";
import { pathFor } from "./routes";
import { steps, type PublicVacancy } from "./types";

export function VacanciesHome({
  vacancies,
  isAdmin,
  navigate,
}: {
  vacancies: PublicVacancy[];
  isAdmin: boolean;
  navigate: Navigate;
}) {
  return (
    <>
      <header className="pagehead">
        <div>
          <h1 id="page-title" tabIndex={-1}>
            Vacancies
          </h1>
          <p>Set criteria, check the evidence, then choose your shortlist.</p>
        </div>
        {isAdmin && (
          <Button asChild>
            <NavLink href={pathFor({ view: "new" })} navigate={navigate}>
              <Plus data-icon="inline-start" />
              New vacancy
            </NavLink>
          </Button>
        )}
      </header>
      {vacancies.length > 0 && (
        <BatchProgress
          applications={vacancies.flatMap(
            (v) => v.batches.at(-1)?.applications ?? [],
          )}
        />
      )}
      {vacancies.length === 0 ? (
        <section className="panel empty">
          <BriefcaseBusiness aria-hidden="true" />
          <h2>No vacancies yet</h2>
          <p>
            {isAdmin
              ? "Create a vacancy, publish its criteria, then add CVs and review them one by one."
              : "An administrator creates vacancies and publishes their criteria. They will appear here."}
          </p>
          {isAdmin && (
            <Button asChild>
              <NavLink href={pathFor({ view: "new" })} navigate={navigate}>
                Create vacancy
              </NavLink>
            </Button>
          )}
        </section>
      ) : (
        <ul className="vacancy-list" aria-label="Vacancies">
          {vacancies.map((v) => {
            const batch = v.batches.at(-1)!;
            const s = batchSummary(batch);
            const action = nextAction(batch, isAdmin);
            const href = pathFor({
              view: "batch",
              vacancyId: v.id,
              batchId: batch.id,
              step: action.step,
            });
            return (
              <li className="vacancy-row" key={v.id}>
                <div className="vacancy-main">
                  <h2>
                    <NavLink href={href} navigate={navigate}>
                      {v.title}
                    </NavLink>
                  </h2>
                  <p>{[v.team, batch.label].filter(Boolean).join(" · ")}</p>
                </div>
                <div className="vacancy-progress">
                  <ol
                    className="step-strip"
                    aria-label={`Progress: ${s.done.filter(Boolean).length} of 4 steps complete`}
                  >
                    {steps.map((name, i) => (
                      <li
                        key={name}
                        className={s.done[i] ? "done" : ""}
                        title={name}
                      />
                    ))}
                  </ol>
                  <span className="tabular-nums">
                    {s.active.length
                      ? `${s.reviewed} of ${s.active.length} reviewed`
                      : "No CVs yet"}
                  </span>
                </div>
                <Button variant="outline" asChild>
                  <NavLink
                    href={href}
                    navigate={navigate}
                    aria-label={`${action.label} for ${v.title}`}
                  >
                    {action.label}
                    <ArrowRight data-icon="inline-end" />
                  </NavLink>
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
