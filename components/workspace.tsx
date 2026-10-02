"use client";
import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Plus,
  BriefcaseBusiness,
  CircleHelp,
  Settings2,
  ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Administration } from "./administration";
import { BatchProgress } from "./workspace-insights";
import { Notice, Panel } from "./workflow/common";
import {
  steps,
  type PublicVacancy,
  type State,
  type Send,
} from "./workflow/types";
import { Criteria } from "./workflow/criteria";
import { Intake } from "./workflow/intake";
import { Review } from "./workflow/review";
import { Shortlist } from "./workflow/shortlist";
export function WorkspaceApp() {
  const [admin, setAdmin] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const [state, setState] = useState<State | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [step, setStep] = useState(0),
    [vacancyId, setVacancyId] = useState("customer-success"),
    [batchId, setBatchId] = useState("first-batch"),
    [home, setHome] = useState(false),
    [dialog, setDialog] = useState(false),
    [help, setHelp] = useState(false),
    [reveal, setReveal] = useState(false);
  const load = useCallback(async (revealNames = false) => {
    try {
      const response = await fetch(`/api/workspace?reveal=${revealNames}`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setState(data);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const refresh = useCallback(() => {
    void load();
  }, [load]);
  const vacancy =
    state?.vacancies.find((v) => v.id === vacancyId) ?? state?.vacancies[0];
  const batch =
    vacancy?.batches.find((b) => b.id === batchId) ?? vacancy?.batches.at(-1);
  const send: Send = async (action, version) => {
    if (!state || busy) return null;
    setBusy(true);
    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: version ?? state.version, action }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setState(data);
      setReveal(false);
      toast.success("Saved");
      return data;
    } catch (e) {
      toast.error((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  };
  function open(v: PublicVacancy) {
    if (unsaved) {
      toast.info("Save your draft before leaving this step.");
      return;
    }
    const b = v.batches.at(-1)!;
    setVacancyId(v.id);
    setBatchId(b.id);
    setAdmin(false);
    setHome(false);
    setReveal(false);
    setStep(b.snapshot ? 3 : b.closed ? 2 : b.published ? 1 : 0);
  }
  return (
    <div className="shell">
      <a className="skip-link" href="#main-content">
        Skip to workspace
      </a>
      <aside className="sidebar">
        <Logo className="brand" />
        <div className="workspace-label">
          <span className="workspace-avatar">S</span>
          <div>
            Recruiter workspace<small>Evidence first. You decide.</small>
          </div>
        </div>
        <nav aria-label="Main navigation">
          <Button
            variant="ghost"
            onClick={() => {
              if (unsaved) {
                toast.info("Save your draft before leaving this step.");
                return;
              }
              setAdmin(false);
              setHome(true);
            }}
          >
            <BriefcaseBusiness aria-hidden="true" /> Vacancies
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              if (unsaved) {
                toast.info("Save your draft before leaving this step.");
                return;
              }
              setDialog(true);
            }}
          >
            <Plus data-icon="inline-start" />
            New vacancy
          </Button>
        </nav>
        <div className="side-roles">
          <small>YOUR VACANCIES</small>
          {state?.vacancies.map((v) => (
            <button
              key={v.id}
              className={v.id === vacancy?.id && !home ? "current" : ""}
              onClick={() => open(v)}
            >
              {v.title}
            </button>
          ))}
        </div>
        <div className="sidefoot">
          <span className="eyebrow">YOUR WORKSPACE</span>
          <Button
            variant="ghost"
            onClick={() => {
              if (unsaved) {
                toast.info("Save your draft before leaving this step.");
                return;
              }
              setAdmin(true);
            }}
          >
            <Settings2 aria-hidden="true" />
            Administration
          </Button>
          <Button variant="ghost" onClick={() => setHelp(true)}>
            <CircleHelp aria-hidden="true" /> How it works
          </Button>
        </div>
      </aside>
      <main id="main-content" tabIndex={-1}>
        <div className="demo-banner">
          <span>
            <strong>Synthetic POC.</strong> Fictional CVs only. Real applicant
            data remains disabled.
          </span>
          <span className="save-status" role="status">
            {busy
              ? "Saving changes…"
              : unsaved
                ? "Unsaved changes"
                : state
                  ? "Workspace ready"
                  : "Connecting…"}
          </span>
        </div>
        <div className="page">
          {error ? (
            <Panel>
              <h1>Workspace unavailable</h1>
              <p role="alert">{error}</p>
              <div className="actions">
                <Button onClick={() => void load()}>Try again</Button>
                <Button variant="outline" asChild>
                  <a href="/login">Invited account sign in</a>
                </Button>
              </div>
            </Panel>
          ) : !state || !vacancy || !batch ? (
            <div className="workspace-loading" role="status">
              <span className="eyebrow">SHORTLIST</span>
              <h1>Preparing your workspace</h1>
              <p>Your criteria, applications and review progress.</p>
              <div className="loading-line" />
              <div className="loading-line" />
              <span className="sr-only">Loading your workspace…</span>
            </div>
          ) : admin ? (
            <>
              <Button variant="outline" onClick={() => setAdmin(false)}>
                Back to workspace
              </Button>
              <Administration />
            </>
          ) : home ? (
            <>
              <Button
                className="mobile-admin"
                variant="outline"
                onClick={() => setAdmin(true)}
              >
                Administration
              </Button>
              <header className="pagehead">
                <div>
                  <span className="eyebrow">WORKSPACE OVERVIEW</span>
                  <h1>Your vacancies</h1>
                  <p>Set criteria. Check evidence. Choose your shortlist.</p>
                </div>
                <Button
                  onClick={() => {
                    if (unsaved) {
                      toast.info("Save your draft before leaving this step.");
                      return;
                    }
                    setDialog(true);
                  }}
                >
                  New vacancy
                  <Plus data-icon="inline-end" />
                </Button>
              </header>
              <BatchProgress
                applications={state.vacancies.flatMap(
                  (v) => v.batches.at(-1)?.applications ?? [],
                )}
              />
              <Panel>
                {state.vacancies.map((v) => (
                  <div className="vacancy-row" key={v.id}>
                    <div>
                      <h2>{v.title}</h2>
                      <p>
                        {v.team} · {v.batches.at(-1)!.label}
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {
                        v.batches
                          .at(-1)!
                          .applications.filter((a) => a.confirmed).length
                      }{" "}
                      reviewed
                    </Badge>
                    <Button variant="outline" onClick={() => open(v)}>
                      Continue
                      <ArrowUpRight data-icon="inline-end" />
                    </Button>
                  </div>
                ))}
              </Panel>
            </>
          ) : (
            <>
              <div className="breadcrumb">
                <button
                  onClick={() => {
                    if (unsaved) {
                      toast.info("Save your draft before leaving this step.");
                      return;
                    }
                    setHome(true);
                  }}
                >
                  Vacancies
                </button>
                <span>›</span>
                <span>{vacancy.team}</span>
              </div>
              <header className="pagehead">
                <div>
                  <span className="eyebrow">HIRING WORKSPACE</span>
                  <h1>{vacancy.title}</h1>
                  <p>
                    {batch.label} ·{" "}
                    {batch.snapshot
                      ? "Finalised batch"
                      : batch.closed
                        ? "Intake closed"
                        : "Open for CVs"}
                  </p>
                </div>
                <div className="actions">
                  <Badge variant="outline">
                    {reveal ? "Names revealed" : "Names hidden during review"}
                  </Badge>
                  {vacancy.batches.length > 1 && (
                    <select
                      aria-label="Choose batch"
                      disabled={unsaved}
                      value={batch.id}
                      onChange={(e) => {
                        setBatchId(e.target.value);
                        setStep(0);
                        setReveal(false);
                      }}
                    >
                      {vacancy.batches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.label}
                          {b.snapshot ? " · Finalised" : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </header>
              <nav className="steps" aria-label="Vacancy workflow">
                {steps.map((name, i) => {
                  const complete = [
                    batch.published,
                    batch.closed,
                    batch.applications.length > 0 &&
                      batch.applications.every(
                        (a) => a.confirmed || a.state === "disposed",
                      ),
                    !!batch.snapshot,
                  ][i];
                  return (
                    <button
                      key={name}
                      aria-current={step === i ? "step" : undefined}
                      onClick={() => {
                        if (unsaved) {
                          toast.info(
                            "Save your draft before leaving this step.",
                          );
                          return;
                        }
                        setStep(i);
                      }}
                      className={step === i ? "active" : ""}
                    >
                      <span className="step-number">
                        {complete ? <Check aria-hidden="true" /> : i + 1}
                      </span>
                      <span>
                        <strong>{name}</strong>
                        <small>
                          {
                            [
                              batch.published ? "Published" : "100 points",
                              `${batch.applications.length} documents`,
                              `${batch.applications.filter((a) => a.confirmed).length} reviewed`,
                              batch.snapshot ? "Finalised" : "Up to 3",
                            ][i]
                          }
                        </small>
                      </span>
                    </button>
                  );
                })}
              </nav>
              {step > 0 && <BatchProgress applications={batch.applications} />}
              <div className="workflow-content" key={`${batch.id}-${step}`}>
                {step === 0 && (
                  <Criteria
                    ai={state.capabilities?.ai ?? false}
                    key={`${batch.id}-${batch.published}`}
                    vacancy={vacancy}
                    batch={batch}
                    send={send}
                    busy={busy}
                    onDirty={setUnsaved}
                    onNext={() => setStep(1)}
                  />
                )}
                {step === 1 && (
                  <Intake
                    vacancy={vacancy}
                    batch={batch}
                    send={send}
                    busy={busy}
                    onNext={() => setStep(2)}
                    onRefresh={refresh}
                    version={state.version}
                    uploads={state.capabilities?.uploads ?? false}
                  />
                )}
                {step === 2 && (
                  <Review
                    key={batch.id}
                    vacancy={vacancy}
                    batch={batch}
                    send={send}
                    busy={busy}
                    onDirty={setUnsaved}
                    onNext={() => setStep(3)}
                  />
                )}
                {step === 3 && (
                  <Shortlist
                    key={`${batch.id}-${!!batch.snapshot}`}
                    vacancy={vacancy}
                    batch={batch}
                    send={send}
                    busy={busy}
                    onDirty={setUnsaved}
                    reveal={reveal}
                    onReveal={() => {
                      setReveal(!reveal);
                      void load(!reveal);
                    }}
                    onNew={(b) => {
                      setBatchId(b.id);
                      setStep(0);
                    }}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </main>
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a vacancy</DialogTitle>
            <DialogDescription>
              Define role requirements. Use synthetic descriptions only during
              this POC.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const next = await send({
                type: "create",
                title: String(f.get("title")),
                team: String(f.get("team")),
                description: String(f.get("description")),
              });
              if (next) {
                open(next.vacancies.at(-1)!);
                setDialog(false);
              }
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="title">Job title</FieldLabel>
                <Input id="title" name="title" required maxLength={100} />
              </Field>
              <Field>
                <FieldLabel htmlFor="team">Team</FieldLabel>
                <Input id="team" name="team" maxLength={80} />
              </Field>
              <Field>
                <FieldLabel htmlFor="description">Job description</FieldLabel>
                <Textarea
                  id="description"
                  name="description"
                  required
                  maxLength={6000}
                />
              </Field>
            </FieldGroup>
            <DialogFooter className="mt-5">
              <Button disabled={busy}>Create vacancy</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Evidence first. You decide.</DialogTitle>
            <DialogDescription>
              Four steps, with human authority throughout.
            </DialogDescription>
          </DialogHeader>
          <ol className="help-list">
            <li>Publish observable criteria totalling exactly 100 points.</li>
            <li>Add synthetic CVs and explicitly close intake.</li>
            <li>
              Read every CV. Check essentials, disagreements and source
              evidence. Confirm each application once.
            </li>
            <li>
              Compare confirmed scores, choose zero to three and record reasons.
              Finalisation freezes the snapshot.
            </li>
          </ol>
          <Notice>
            AI classification, parser isolation and real-data approval are later
            stages. This POC makes no accuracy or fairness claim.
          </Notice>
        </DialogContent>
      </Dialog>
    </div>
  );
}
