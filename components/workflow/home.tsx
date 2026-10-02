"use client";
import { ArrowRight, BriefcaseBusiness, Plus } from "lucide-react";
import { Atmosphere } from "@/components/brand/atmosphere";
import { Button } from "@/components/ui/button";
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
  // The single most useful next step across open vacancies.
  const open = vacancies
    .map((vacancy) => ({ vacancy, batch: vacancy.batches.at(-1)! }))
    .filter(({ batch }) => !batch.snapshot);
  const pick =
    open.find(
      ({ batch }) => batch.closed && batchSummary(batch).toReview > 0,
    ) ?? open[0];
  const focus =
    pick &&
    (() => {
      const s = batchSummary(pick.batch);
      const action = nextAction(pick.batch, isAdmin);
      const sentence = !pick.batch.published
        ? "The criteria are still a draft. Publish them to start adding CVs."
        : !pick.batch.closed
          ? s.active.length
            ? `${s.active.length} CV${s.active.length === 1 ? " is" : "s are"} in this batch. Start the review when every file is ready.`
            : "Criteria are published. Add CVs to begin."
          : s.toReview > 0
            ? `${s.toReview} CV${s.toReview === 1 ? " is" : "s are"} waiting for your review. Each one needs a person to confirm it.`
            : "Every CV is reviewed. Compare the evidence and choose up to three.";
      return {
        vacancy: pick.vacancy,
        action,
        sentence,
        meta: [pick.vacancy.team, pick.batch.label].filter(Boolean).join(" · "),
        href: pathFor({
          view: "batch",
          vacancyId: pick.vacancy.id,
          batchId: pick.batch.id,
          step: action.step,
        }),
      };
    })();
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
      {focus && (
        <section className="focus-card" aria-labelledby="focus-title">
          <Atmosphere />
          <span className="focus-eyebrow">Pick up where you left off</span>
          <h2 id="focus-title">{focus.vacancy.title}</h2>
          <p>{focus.sentence}</p>
          <div className="focus-actions">
            <NavLink
              className="focus-primary"
              href={focus.href}
              navigate={navigate}
            >
              {focus.action.label}
              <ArrowRight aria-hidden="true" />
            </NavLink>
            <span className="focus-meta">{focus.meta}</span>
          </div>
        </section>
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
                    {batch.snapshot
                      ? `Finalised · ${batch.selected.length} shortlisted`
                      : s.active.length
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
