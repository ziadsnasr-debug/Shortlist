"use client";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  FileText,
  ListChecks,
  Plus,
  ShieldCheck,
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  type Action,
  type Application,
  type Batch,
  type Criterion,
  type Vacancy,
  type Workspace,
  labels,
  individualCheck,
  highest,
} from "@/lib/workflow";
import { DocumentIntake } from "./document-intake";
import { Administration } from "./administration";
import {
  WeightChart,
  BatchProgress,
  ScoreBar,
  EvidenceComparison,
} from "./workspace-insights";
import { sampleRubric } from "@/fixtures/synthetic/seed";
type PublicApp = Omit<Application, "name"> & {
  name?: string;
  label: string;
  score: number | null;
  blockers: string[];
};
type PublicBatch = Omit<Batch, "applications"> & {
  applications: PublicApp[];
  ranking: { id: string; score: number; essentials: string[] }[] | null;
};
type PublicVacancy = Omit<Vacancy, "batches"> & { batches: PublicBatch[] };
type State = Omit<Workspace, "vacancies"> & {
  vacancies: PublicVacancy[];
  role: string;
  mode: string;
  capabilities?: { uploads: boolean; ai: boolean };
};
type Send = (action: Action, version?: number) => Promise<State | null>;
const steps = ["Criteria", "Add CVs", "Review", "Shortlist"];
function Notice({ children }: { children: React.ReactNode }) {
  return (
    <Alert>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
function Panel({ children }: { children: React.ReactNode }) {
  return <section className="panel">{children}</section>;
}
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
function Criteria({
  ai,
  vacancy,
  batch,
  send,
  busy,
  onNext,
  onDirty,
}: {
  vacancy: PublicVacancy;
  batch: PublicBatch;
  send: Send;
  busy: boolean;
  onNext: () => void;
  onDirty: (v: boolean) => void;
  ai: boolean;
}) {
  const [rubric, setRubric] = useState<Criterion[]>(batch.rubric),
    [dirty, setDirty] = useState(false);
  const total = rubric.reduce((n, c) => n + c.points, 0);
  function update(index: number, key: keyof Criterion, value: unknown) {
    setDirty(true);
    setRubric(rubric.map((c, i) => (i === index ? { ...c, [key]: value } : c)));
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
  return (
    <>
      <div className="sectionhead">
        <div>
          <h2>Set the criteria</h2>
          <p>
            Define observable evidence. Weights stay fixed for every CV in this
            batch.
          </p>
        </div>
        <Badge variant="secondary">{total} / 100 points</Badge>
      </div>
      <WeightChart rubric={rubric} />
      {!batch.published && (
        <Notice>
          Criteria suggestions are editable examples, not AI output. Employer
          approval is required before publication.
        </Notice>
      )}
      {!batch.published && (
        <div className="my-4">
          <Button
            variant="outline"
            disabled={!ai || busy}
            onClick={async () => {
              try {
                const r = await fetch("/api/criteria", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      vacancyId: vacancy.id,
                      synthetic: true,
                    }),
                  }),
                  d = await r.json();
                if (!r.ok) throw new Error(d.error);
                setRubric(d.rubric);
                setDirty(true);
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            Draft criteria with AI
          </Button>
          {!ai && (
            <p>
              AI drafting needs approved provider configuration. Edit example
              criteria directly.
            </p>
          )}
        </div>
      )}
      <Panel>
        <fieldset
          disabled={batch.published || busy}
          className="criteria-fieldset"
        >
          {rubric.map((c, i) => (
            <div className="criterion" key={c.id}>
              <FieldGroup>
                <div className="criterion-grid">
                  <Field>
                    <FieldLabel htmlFor={`section-${i}`}>Section</FieldLabel>
                    <Input
                      id={`section-${i}`}
                      value={c.section}
                      onChange={(e) => update(i, "section", e.target.value)}
                      maxLength={80}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`criterion-${i}`}>
                      Requirement
                    </FieldLabel>
                    <Input
                      id={`criterion-${i}`}
                      value={c.title}
                      onChange={(e) => update(i, "title", e.target.value)}
                      maxLength={200}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`points-${i}`}>Points</FieldLabel>
                    <Input
                      id={`points-${i}`}
                      type="number"
                      min={1}
                      max={100}
                      value={c.points}
                      onChange={(e) =>
                        update(i, "points", Number(e.target.value))
                      }
                    />
                  </Field>
                </div>
                <label className="check-line">
                  <input
                    type="checkbox"
                    checked={c.essential}
                    onChange={(e) => update(i, "essential", e.target.checked)}
                  />
                  Essential requirement
                </label>
                <details>
                  <summary>Evidence definitions</summary>
                  <div className="definition-grid">
                    <Field>
                      <FieldLabel htmlFor={`full-${i}`}>
                        Full evidence
                      </FieldLabel>
                      <Textarea
                        id={`full-${i}`}
                        value={c.full}
                        onChange={(e) => update(i, "full", e.target.value)}
                        maxLength={1000}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor={`partial-${i}`}>
                        Partial evidence
                      </FieldLabel>
                      <Textarea
                        id={`partial-${i}`}
                        value={c.partial}
                        onChange={(e) => update(i, "partial", e.target.value)}
                        maxLength={1000}
                      />
                    </Field>
                  </div>
                </details>
              </FieldGroup>
              {!batch.published && (
                <div className="actions mt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={i === 0}
                    onClick={() => {
                      const rows = [...rubric];
                      [rows[i - 1], rows[i]] = [rows[i], rows[i - 1]];
                      setRubric(rows);
                      setDirty(true);
                    }}
                  >
                    Move up
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setRubric(rubric.filter((_, j) => j !== i));
                      setDirty(true);
                    }}
                  >
                    Remove criterion
                  </Button>
                </div>
              )}
            </div>
          ))}
        </fieldset>
        {!batch.published && (
          <div className="panel-footer actions">
            <Button
              variant="outline"
              disabled={busy || rubric.length >= 12}
              onClick={() => {
                setRubric([
                  ...rubric,
                  {
                    id: crypto.randomUUID(),
                    section: "Skills",
                    title: "",
                    points: 10,
                    essential: false,
                    full: "",
                    partial: "",
                  },
                ]);
                setDirty(true);
              }}
            >
              Add criterion
              <Plus data-icon="inline-end" />
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setRubric(structuredClone(sampleRubric));
                setDirty(true);
              }}
            >
              Use editable example criteria
            </Button>
          </div>
        )}
      </Panel>
      <div className="footeractions">
        <p>
          {batch.published
            ? "Published criteria are frozen for this batch."
            : dirty
              ? "Unsaved changes. Save before leaving this step."
              : "Draft saved. Publication requires exactly 100 points."}
        </p>
        <div className="actions">
          {!batch.published ? (
            <>
              <Button
                variant="outline"
                disabled={busy}
                onClick={async () => {
                  if (
                    await send({
                      type: "rubric",
                      vacancyId: vacancy.id,
                      batchId: batch.id,
                      rubric,
                    })
                  ) {
                    setDirty(false);
                  }
                }}
              >
                Save criteria draft
              </Button>
              <Button
                disabled={busy || total !== 100 || dirty || !rubric.length}
                onClick={async () => {
                  if (
                    await send({
                      type: "publish",
                      vacancyId: vacancy.id,
                      batchId: batch.id,
                    })
                  )
                    onNext();
                }}
              >
                Publish criteria
                <ArrowRight data-icon="inline-end" />
              </Button>
            </>
          ) : (
            <Button onClick={onNext}>
              Continue to Add CVs
              <ArrowRight data-icon="inline-end" />
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
function Intake({
  vacancy,
  batch,
  send,
  busy,
  onNext,
  onRefresh,
  version,
  uploads,
}: {
  vacancy: PublicVacancy;
  batch: PublicBatch;
  send: Send;
  busy: boolean;
  onNext: () => void;
  onRefresh: () => void;
  version: number;
  uploads: boolean;
}) {
  const [disposition, setDisposition] = useState<PublicApp | null>(null);
  return (
    <>
      <div className="sectionhead">
        <div>
          <h2>Add CVs for this batch</h2>
          <p>
            Account for every document before review starts. Arrival order stays
            unchanged.
          </p>
        </div>
      </div>
      <Notice>
        Six fictional sample CVs cover agreed evidence, a disagreement, a tie
        and suspicious source content.
      </Notice>
      <DocumentIntake
        vacancyId={vacancy.id}
        batchId={batch.id}
        version={version}
        closed={batch.closed}
        applications={batch.applications}
        onRefresh={onRefresh}
        send={send}
        enabled={uploads}
      />
      <Panel>
        {!batch.applications.length ? (
          <div className="empty">
            <FileText aria-hidden="true" />
            <h2>Ready for your sample batch</h2>
            <p>
              {batch.published
                ? "Add fictional CVs to practise the complete review workflow."
                : "Publish criteria before adding sample CVs."}
            </p>
            <Button
              disabled={busy || !batch.published}
              onClick={() =>
                void send({
                  type: "samples",
                  vacancyId: vacancy.id,
                  batchId: batch.id,
                })
              }
            >
              Add sample CVs
              <Plus data-icon="inline-end" />
            </Button>
          </div>
        ) : (
          batch.applications.map((a) => (
            <div key={a.id} className="intake-row">
              <FileText aria-hidden="true" />
              <div>
                <strong>{a.label}</strong>
                <p>{a.file}</p>
                {a.dispositionReason && (
                  <p>
                    {a.disposition}: {a.dispositionReason}
                  </p>
                )}
              </div>
              <Badge variant="secondary">
                {a.state === "disposed"
                  ? "Disposition recorded"
                  : a.confirmed
                    ? "Reviewed"
                    : a.state === "ready"
                      ? "Ready to review"
                      : a.state === "processing"
                        ? "Processing"
                        : "Needs readable copy or attention"}
              </Badge>
              {!batch.closed && a.state !== "disposed" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDisposition(a)}
                >
                  Record disposition
                </Button>
              )}
            </div>
          ))
        )}
      </Panel>
      <div className="footeractions">
        <p>
          {batch.closed
            ? "Intake closed. New arrivals belong in the next batch."
            : "Start review explicitly closes intake for this batch."}
        </p>
        <Button
          disabled={
            busy ||
            !batch.published ||
            !batch.applications.length ||
            batch.applications.some(
              (a) => !["ready", "disposed"].includes(a.state),
            )
          }
          onClick={async () => {
            if (
              batch.closed ||
              (await send({
                type: "close",
                vacancyId: vacancy.id,
                batchId: batch.id,
              }))
            )
              onNext();
          }}
        >
          {batch.closed ? "Continue review" : "Start review"}
          <ArrowRight data-icon="inline-end" />
        </Button>
      </div>
      <Dialog
        open={!!disposition}
        onOpenChange={(v) => !v && setDisposition(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Account for {disposition?.label}</DialogTitle>
            <DialogDescription>
              Only genuine duplicates, withdrawals and wrong-vacancy
              submissions. Low scoring CVs still require review.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (
                await send({
                  type: "dispose",
                  vacancyId: vacancy.id,
                  batchId: batch.id,
                  applicationId: disposition!.id,
                  disposition: String(f.get("disposition")) as "duplicate",
                  reason: String(f.get("reason")),
                })
              )
                setDisposition(null);
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="disposition">Disposition</FieldLabel>
                <select id="disposition" name="disposition">
                  <option value="duplicate">Duplicate</option>
                  <option value="withdrawal">Withdrawal</option>
                  <option value="wrong_vacancy">Wrong vacancy</option>
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="disposition-reason">Reason</FieldLabel>
                <Textarea
                  id="disposition-reason"
                  name="reason"
                  required
                  maxLength={1000}
                />
              </Field>
            </FieldGroup>
            <DialogFooter className="mt-5">
              <Button disabled={busy}>Record disposition</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
function Review({
  vacancy,
  batch,
  send,
  busy,
  onNext,
  onDirty,
}: {
  vacancy: PublicVacancy;
  batch: PublicBatch;
  send: Send;
  busy: boolean;
  onNext: () => void;
  onDirty: (v: boolean) => void;
}) {
  const [index, setIndex] = useState(0);
  const apps = batch.applications.filter((a) => a.state !== "disposed");
  const app = apps[index];
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
  return (
    <>
      <div className="sectionhead">
        <div>
          <h2>Review the evidence</h2>
          <p>
            Read every application. Check the source, then confirm this CV once.
          </p>
        </div>
        <span>
          {batch.applications.filter((a) => a.confirmed).length} of{" "}
          {apps.length} reviewed
        </span>
      </div>
      <div className="review-selector">
        <strong>{app.label}</strong>
        <span>
          {app.file} · {index + 1} of {apps.length}
        </span>
        <Badge variant="secondary">
          {app.confirmed ? "Reviewed" : "Awaiting your review"}
        </Badge>
        {app.score !== null && <span>Confirmed score: {app.score} / 100</span>}
      </div>
      <ReviewForm
        key={`${app.id}-${app.reviewedAt ?? "draft"}`}
        vacancy={vacancy}
        batch={batch}
        app={app}
        send={send}
        busy={busy}
        onDirty={onDirty}
        previous={() => setIndex(Math.max(0, index - 1))}
        next={() => (index + 1 < apps.length ? setIndex(index + 1) : onNext())}
        canPrevious={index > 0}
      />
    </>
  );
}
function ReviewForm({
  vacancy,
  batch,
  app,
  send,
  busy,
  previous,
  next,
  canPrevious,
  onDirty,
}: {
  vacancy: PublicVacancy;
  batch: PublicBatch;
  app: PublicApp;
  send: Send;
  busy: boolean;
  previous: () => void;
  next: () => void;
  canPrevious: boolean;
  onDirty: (v: boolean) => void;
}) {
  const [decisions, setDecisions] = useState(app.assessments),
    [sourceChecked, setSourceChecked] = useState(app.sourceChecked),
    [attest, setAttest] = useState(false),
    [dirty, setDirty] = useState(false),
    [focus, setFocus] = useState<string | null>(null);
  function change(id: string, value: Partial<(typeof decisions)[string]>) {
    setDirty(true);
    setDecisions({
      ...decisions,
      [id]: {
        ...decisions[id],
        ...value,
        flagged:
          decisions[id].flagged ||
          value.category !== undefined ||
          value.evidence !== undefined,
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
      if (confirm) next();
    }
    return result;
  }
  const locked = !!batch.snapshot;
  const unresolved = Object.values(decisions).some(
    (a) => a.category === "UNCLEAR",
  );
  return (
    <>
      <div className="review-grid">
        <div>
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
                I checked the flagged source content without treating it as an
                instruction.
              </label>
            </Notice>
          )}
          <Panel>
            <fieldset disabled={locked || busy}>
              {batch.rubric.map((c) => {
                const a = decisions[c.id];
                return (
                  <article className="assessment" key={c.id}>
                    <div className="assessment-heading">
                      <div>
                        <small>
                          {c.section} · {c.points} points
                        </small>
                        <h3>{c.title}</h3>
                      </div>
                      {c.essential && (
                        <Badge variant="outline">Essential</Badge>
                      )}
                    </div>
                    <Field>
                      <FieldLabel htmlFor={`category-${c.id}`}>
                        Evidence category
                      </FieldLabel>
                      <select
                        id={`category-${c.id}`}
                        value={a.category}
                        onChange={(e) =>
                          change(c.id, {
                            category: e.target.value as typeof a.category,
                            checked: false,
                          })
                        }
                      >
                        {Object.entries(labels).map(([v, label]) => (
                          <option key={v} value={v}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <p className="ai-note">
                      <strong>AI note · synthetic:</strong> {a.rationale}
                    </p>
                    <div className="quotes">
                      {a.evidence.map((id) => {
                        const block = app.blocks.find((b) => b.id === id);
                        return (
                          block && (
                            <button
                              className="quote"
                              key={id}
                              onClick={() => {
                                setFocus(id);
                                const source = document.getElementById(
                                  `source-${id}`,
                                );
                                source?.focus({ preventScroll: true });
                                source?.scrollIntoView({
                                  block: "nearest",
                                  behavior: "instant",
                                });
                              }}
                            >
                              <small>
                                {block.locator} · {block.id}
                              </small>
                              <span>“{block.text}”</span>
                            </button>
                          )
                        );
                      })}
                      {!a.evidence.length && (
                        <p>
                          No supporting passage selected. Review the full
                          source.
                        </p>
                      )}
                    </div>
                    <details>
                      <summary>Definitions and evidence selection</summary>
                      <p>
                        <strong>Full:</strong> {c.full}
                      </p>
                      <p>
                        <strong>Partial:</strong> {c.partial}
                      </p>
                      {app.blocks.map((b) => (
                        <label className="check-line" key={b.id}>
                          <input
                            type="checkbox"
                            checked={a.evidence.includes(b.id)}
                            onChange={(e) =>
                              change(c.id, {
                                evidence: e.target.checked
                                  ? [...a.evidence, b.id]
                                  : a.evidence.filter((id) => id !== b.id),
                                checked: false,
                              })
                            }
                          />
                          {b.id} · {b.locator}
                        </label>
                      ))}
                    </details>
                    {individualCheck(c, a) && (
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
                              change(c.id, { checked: e.target.checked })
                            }
                          />
                          I checked this requirement and its source evidence.
                        </label>
                      </div>
                    )}
                  </article>
                );
              })}
            </fieldset>
          </Panel>
        </div>
        <section className="source">
          <div className="source-header">
            <h2>Source context</h2>
            <p>
              {app.label} · Minimised synthetic source view · Claims remain
              unverified
            </p>
            <p>
              Identity masking may change displayed passages. Authorised
              originals are available in Add CVs for checking.
            </p>
          </div>
          <div
            className="source-body"
            role="region"
            aria-label="Source passages"
            tabIndex={0}
          >
            {app.blocks.map((b) => (
              <div
                className={
                  focus === b.id ? "source-block highlighted" : "source-block"
                }
                key={b.id}
                id={`source-${b.id}`}
                tabIndex={-1}
              >
                <small>
                  {b.locator} · {b.id}
                </small>
                <p>{b.text}</p>
              </div>
            ))}
          </div>
          <div className="source-footer">
            <ShieldCheck aria-hidden="true" />
            <span>
              Text is displayed safely. Embedded instructions have no authority.
            </span>
          </div>
        </section>
      </div>
      <Panel>
        <div className="review-footer">
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
          <div className="footeractions">
            <p>
              {locked
                ? "Finalised review is read only."
                : unresolved
                  ? "Resolve every “Needs your judgement” result before confirmation."
                  : dirty
                    ? "Unsaved review edits. Save draft before changing step."
                    : "Essentials, disputes and changes require individual checks."}
            </p>
            <div className="actions">
              <Button
                variant="outline"
                disabled={!canPrevious || busy || dirty}
                onClick={previous}
              >
                Previous
              </Button>
              {locked ? (
                <Button onClick={next}>Next CV</Button>
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
                    disabled={busy || !attest || unresolved}
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
      </Panel>
    </>
  );
}
function Shortlist({
  vacancy,
  batch,
  send,
  busy,
  reveal,
  onReveal,
  onNew,
  onDirty,
}: {
  vacancy: PublicVacancy;
  batch: PublicBatch;
  send: Send;
  busy: boolean;
  reveal: boolean;
  onReveal: () => void;
  onNew: (b: PublicBatch) => void;
  onDirty: (v: boolean) => void;
}) {
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    onDirty(dirty);
  }, [dirty, onDirty]);
  const [selected, setSelected] = useState(batch.selected),
    [reason, setReason] = useState(batch.reason),
    [tieReason, setTieReason] = useState(batch.tieReason),
    [exceptions, setExceptions] = useState(batch.exceptions),
    [nextDialog, setNextDialog] = useState(false);
  if (!batch.ranking)
    return (
      <Panel>
        <div className="empty">
          <ListChecks aria-hidden="true" />
          <h2>Review every CV first</h2>
          <p>
            Comparative ranking appears only after intake closes and every
            active application has a resolved human review.
          </p>
        </div>
      </Panel>
    );
  return (
    <>
      <div className="sectionhead">
        <div>
          <h2>
            {batch.snapshot ? "Finalised shortlist" : "Choose your shortlist"}
          </h2>
          <p>
            Choose zero to three. Scores support your decision; essentials
            remain separate.
          </p>
        </div>
        <Button variant="outline" onClick={onReveal}>
          {reveal ? "Hide names" : "Reveal names"}
        </Button>
      </div>
      {batch.snapshot && (
        <Notice>
          Finalised{" "}
          {new Date(batch.snapshot.at).toLocaleString("en-GB", {
            timeZone: "Europe/London",
          })}
          . Decisions and batch membership are frozen.
        </Notice>
      )}
      <Panel>
        {batch.ranking.map((row) => {
          const app = batch.applications.find((a) => a.id === row.id)!;
          return (
            <div className="rank-row" key={row.id}>
              <input
                aria-label={`Select ${app.label}`}
                type="checkbox"
                checked={selected.includes(row.id)}
                disabled={
                  busy ||
                  !!batch.snapshot ||
                  (!selected.includes(row.id) && selected.length === 3)
                }
                onChange={(e) => {
                  setDirty(true);
                  setSelected(
                    e.target.checked
                      ? [...selected, row.id]
                      : selected.filter((id) => id !== row.id),
                  );
                }}
              />
              <div>
                <h3>{reveal ? app.name : app.label}</h3>
                <ScoreBar score={row.score} />
                <p>
                  {row.essentials.length
                    ? `Essential requirements not fully evidenced: ${row.essentials.join(", ")}`
                    : "All essential requirements fully evidenced"}
                </p>
                {selected.includes(row.id) && row.essentials.length > 0 && (
                  <Field className="mt-3">
                    <FieldLabel htmlFor={`exception-${row.id}`}>
                      Essential exception for {app.label}
                    </FieldLabel>
                    <Textarea
                      id={`exception-${row.id}`}
                      disabled={!!batch.snapshot}
                      value={exceptions[row.id] ?? ""}
                      onChange={(e) => {
                        setDirty(true);
                        setExceptions({
                          ...exceptions,
                          [row.id]: e.target.value,
                        });
                      }}
                      maxLength={1000}
                    />
                  </Field>
                )}
              </div>
              <strong className="score">
                {row.score}
                <small>/ 100</small>
              </strong>
            </div>
          );
        })}
        {!batch.ranking.length && (
          <div className="empty">
            <p>
              No active candidates. You may finalise an empty shortlist with a
              reason.
            </p>
          </div>
        )}
      </Panel>
      <EvidenceComparison
        rubric={batch.rubric}
        applications={batch.applications.filter((a) => selected.includes(a.id))}
      />
      {!batch.snapshot && (
        <div className="actions selection-tray my-5">
          <Button
            variant="outline"
            onClick={() => {
              const b = batch as unknown as Batch;
              setDirty(true);
              setSelected(highest(b));
              toast.info(
                "Selected highest scores. Boundary ties remain for your decision.",
              );
            }}
          >
            Select highest scores
          </Button>
          <span>{selected.length} of 3 selected</span>
        </div>
      )}
      <Panel>
        <div className="panel-body">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="selection-reason">
                Selection reason (required, including an empty shortlist)
              </FieldLabel>
              <Textarea
                id="selection-reason"
                disabled={!!batch.snapshot}
                value={reason}
                onChange={(e) => {
                  setDirty(true);
                  setReason(e.target.value);
                }}
                maxLength={2000}
              />
              <FieldDescription>
                Explain exceptions or selections outside the highest confirmed
                scores.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="tie-reason">
                Boundary tie decision
              </FieldLabel>
              <Textarea
                id="tie-reason"
                disabled={!!batch.snapshot}
                value={tieReason}
                onChange={(e) => {
                  setDirty(true);
                  setTieReason(e.target.value);
                }}
                maxLength={1000}
              />
              <FieldDescription>
                Required when selected and unselected applicants share the
                cutoff score. Arrival order is never a tie breaker.
              </FieldDescription>
            </Field>
          </FieldGroup>
        </div>
      </Panel>
      <div className="footeractions">
        <p>
          {batch.snapshot
            ? "Export reads the frozen snapshot. Names are excluded."
            : "Finalisation rechecks every application and locks this batch."}
        </p>
        <div className="actions">
          {batch.snapshot ? (
            <>
              <Button variant="outline" asChild>
                <a
                  href={`/api/workspace?vacancy=${vacancy.id}&export=${batch.id}`}
                >
                  Export review CSV
                </a>
              </Button>
              <Button onClick={() => setNextDialog(true)}>
                Start next batch
                <Plus data-icon="inline-end" />
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                disabled={busy}
                onClick={async () => {
                  if (
                    await send({
                      type: "selection",
                      vacancyId: vacancy.id,
                      batchId: batch.id,
                      selected,
                      reason,
                      tieReason,
                      exceptions,
                    })
                  )
                    setDirty(false);
                }}
              >
                Save selection draft
              </Button>
              <Button
                disabled={busy || !reason.trim()}
                onClick={async () => {
                  const result = await send({
                    type: "selection",
                    vacancyId: vacancy.id,
                    batchId: batch.id,
                    selected,
                    reason,
                    tieReason,
                    exceptions,
                  });
                  if (result) {
                    setDirty(false);
                    await send(
                      {
                        type: "finalise",
                        vacancyId: vacancy.id,
                        batchId: batch.id,
                      },
                      result.version,
                    );
                  }
                }}
              >
                Finalise shortlist
                <Check data-icon="inline-end" />
              </Button>
            </>
          )}
        </div>
      </div>
      <Dialog open={nextDialog} onOpenChange={setNextDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start next batch</DialogTitle>
            <DialogDescription>
              Copies criteria into an editable draft. Earlier decisions remain
              frozen.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const label = String(new FormData(e.currentTarget).get("label"));
              const result = await send({
                type: "next",
                vacancyId: vacancy.id,
                batchId: batch.id,
                label,
              });
              if (result) {
                const v = result.vacancies.find((v) => v.id === vacancy.id)!;
                onNew(v.batches.at(-1)!);
                setNextDialog(false);
              }
            }}
          >
            <Field>
              <FieldLabel htmlFor="batch-label">Batch period</FieldLabel>
              <Input
                id="batch-label"
                name="label"
                required
                maxLength={100}
                placeholder="Week of 5 October 2026"
              />
            </Field>
            <DialogFooter className="mt-5">
              <Button disabled={busy}>Create batch</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
