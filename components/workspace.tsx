"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { EyeOff, Eye, FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Administration } from "./administration";
import { BatchProgress } from "./workspace-insights";
import { Notice, Panel } from "./workflow/common";
import { steps, type State, type Send } from "./workflow/types";
import { Criteria } from "./workflow/criteria";
import { Intake } from "./workflow/intake";
import { Review } from "./workflow/review";
import { Shortlist } from "./workflow/shortlist";
import { NavLink, type Navigate } from "./workflow/nav-link";
import { defaultStep, parsePath, pathFor } from "./workflow/routes";
import { Stepper } from "./workflow/stepper";
import { Sidebar } from "./workflow/sidebar";
import { VacanciesHome } from "./workflow/home";
import { NewVacancy } from "./workflow/new-vacancy";

const leaveMessage = "Save your draft before leaving this step.";

export function WorkspaceApp() {
  const pathname = usePathname();
  // The path is the source of truth for location. It only diverges from the
  // browser's pathname while a back/forward move is refused for unsaved work.
  const [path, setPath] = useState(pathname);
  const [unsaved, setUnsaved] = useState(false);
  const unsavedRef = useRef(false);
  const [state, setState] = useState<State | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [help, setHelp] = useState(false),
    [reveal, setReveal] = useState(false);
  const firstRender = useRef(true);
  useEffect(() => {
    unsavedRef.current = unsaved;
  }, [unsaved]);

  const navigate: Navigate = useCallback(
    (to, opts) => {
      if (to === path) return true;
      if (unsavedRef.current && !opts?.force) {
        toast.info(leaveMessage);
        return false;
      }
      window.history[opts?.replace ? "replaceState" : "pushState"](
        null,
        "",
        to,
      );
      setPath(to);
      return true;
    },
    [path],
  );

  // Browser back/forward: follow it, unless a draft would be lost.
  useEffect(() => {
    if (pathname === path) return;
    if (unsavedRef.current) {
      window.history.pushState(null, "", path);
      toast.info(leaveMessage);
    } else setPath(pathname);
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const route = parsePath(path);
  const isAdmin = state?.role === "administrator";
  const vacancy =
    route.view === "batch"
      ? state?.vacancies.find((v) => v.id === route.vacancyId)
      : undefined;
  const batch =
    route.view === "batch"
      ? vacancy?.batches.find((b) => b.id === route.batchId)
      : undefined;
  const batchKey =
    route.view === "batch" ? `${route.vacancyId}/${route.batchId}` : "";
  const stepIndex = route.view === "batch" ? route.step : -1;

  // "/" is the vacancy list; give it its canonical address.
  useEffect(() => {
    if (path === "/") {
      window.history.replaceState(null, "", "/vacancies");
      setPath("/vacancies");
    }
  }, [path]);

  // Names are revealed per batch and hidden again whenever the batch changes.
  useEffect(() => {
    setReveal(false);
  }, [batchKey]);

  // Each move lands on the page heading for keyboard and screen-reader users.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    requestAnimationFrame(() =>
      document.getElementById("page-title")?.focus({ preventScroll: true }),
    );
  }, [path]);

  const vacancyTitle = vacancy?.title;
  useEffect(() => {
    const where =
      route.view === "batch" && vacancyTitle
        ? `${vacancyTitle} · ${steps[stepIndex]}`
        : route.view === "new"
          ? "New vacancy"
          : route.view === "admin"
            ? "Administration"
            : "Vacancies";
    document.title = `${where} · Shortlist`;
  }, [route.view, stepIndex, vacancyTitle]);

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

  const stepPath = (step: number, candidate?: number) =>
    route.view === "batch"
      ? pathFor({ ...route, step, candidate })
      : pathFor({ view: "home" });

  let page: React.ReactNode;
  if (error)
    page = (
      <Panel>
        <div className="panel-body">
          <h1 id="page-title" tabIndex={-1}>
            Workspace unavailable
          </h1>
          <p role="alert">{error}</p>
          <div className="actions mt-5">
            <Button onClick={() => void load()}>Try again</Button>
            <Button variant="outline" asChild>
              <Link href="/login">Invited account sign in</Link>
            </Button>
          </div>
        </div>
      </Panel>
    );
  else if (!state)
    page = (
      <div className="workspace-loading" role="status">
        <h1 id="page-title" tabIndex={-1}>
          Preparing your workspace
        </h1>
        <p>Your criteria, applications and review progress.</p>
        <div className="loading-line" />
        <div className="loading-line" />
      </div>
    );
  else if (route.view === "home")
    page = (
      <VacanciesHome
        vacancies={state.vacancies}
        isAdmin={isAdmin}
        navigate={navigate}
      />
    );
  else if (route.view === "new")
    page = (
      <NewVacancy
        isAdmin={isAdmin}
        busy={busy}
        send={send}
        navigate={navigate}
      />
    );
  else if (route.view === "admin")
    page = isAdmin && !state?.temporaryPublic ? (
      <Administration />
    ) : (
      <>
        <h1 id="page-title" tabIndex={-1}>
          Administration
        </h1>
        <Notice>
          Administration is available to workspace administrators only.
        </Notice>
      </>
    );
  else if (route.view === "missing" || !vacancy || !batch)
    page = (
      <section className="panel empty">
        <h1 id="page-title" tabIndex={-1}>
          This page does not exist
        </h1>
        <p>
          The vacancy or batch may have been removed, or the address is
          incomplete.
        </p>
        <Button asChild>
          <NavLink href={pathFor({ view: "home" })} navigate={navigate}>
            Go to vacancies
          </NavLink>
        </Button>
      </section>
    );
  else {
    const step = route.step;
    page = (
      <>
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <NavLink href={pathFor({ view: "home" })} navigate={navigate}>
            Vacancies
          </NavLink>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{vacancy.title}</span>
        </nav>
        <header className="pagehead">
          <div>
            <h1 id="page-title" tabIndex={-1}>
              {vacancy.title}
            </h1>
            <p>
              {[vacancy.team, batch.label].filter(Boolean).join(" · ")} ·{" "}
              {batch.snapshot
                ? "Finalised batch"
                : batch.closed
                  ? "Intake closed"
                  : "Open for CVs"}
            </p>
          </div>
          <div className="actions">
            <StatusChip
              tone={reveal ? "warning" : "neutral"}
              icon={reveal ? <Eye /> : <EyeOff />}
            >
              {reveal ? "Names revealed" : "Names hidden during review"}
            </StatusChip>
            {vacancy.batches.length > 1 && (
              <Select
                value={batch.id}
                disabled={unsaved}
                onValueChange={(id) => {
                  const b = vacancy.batches.find((x) => x.id === id)!;
                  navigate(
                    pathFor({
                      view: "batch",
                      vacancyId: vacancy.id,
                      batchId: b.id,
                      step: defaultStep(b),
                    }),
                  );
                }}
              >
                <SelectTrigger aria-label="Choose batch" className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {vacancy.batches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.label}
                      {b.snapshot ? " · Finalised" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </header>
        <Stepper
          vacancyId={vacancy.id}
          batch={batch}
          step={step}
          navigate={navigate}
        />
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
              canEdit={isAdmin}
              onDirty={setUnsaved}
              onNext={() => navigate(stepPath(1))}
              version={state.version}
              onReload={refresh}
            />
          )}
          {step === 1 && (
            <Intake
              vacancy={vacancy}
              batch={batch}
              send={send}
              busy={busy}
              canDispose={isAdmin}
              onNext={() => navigate(stepPath(2))}
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
              onNext={() => navigate(stepPath(3), { force: true })}
              candidate={route.candidate}
              onCandidate={(n, force) => navigate(stepPath(2, n), { force })}
            />
          )}
          {step === 3 && (
            <Shortlist
              key={`${batch.id}-${!!batch.snapshot}`}
              vacancy={vacancy}
              batch={batch}
              send={send}
              busy={busy}
              canStartNext={isAdmin}
              onDirty={setUnsaved}
              reveal={reveal}
              onReveal={() => {
                setReveal(!reveal);
                void load(!reveal);
              }}
              onNew={(b) =>
                navigate(
                  pathFor({
                    view: "batch",
                    vacancyId: vacancy.id,
                    batchId: b.id,
                    step: 0,
                  }),
                )
              }
            />
          )}
        </div>
      </>
    );
  }

  return (
    <div className="shell">
      <a className="skip-link" href="#main-content">
        Skip to workspace
      </a>
      <Sidebar
        vacancies={state?.vacancies ?? []}
        route={route}
        isAdmin={isAdmin && !state?.temporaryPublic}
        role={state?.role ?? "reviewer"}
        canSignOut={state?.mode === "Supabase synthetic"}
        navigate={navigate}
        onHelp={() => setHelp(true)}
      />
      <main id="main-content" tabIndex={-1}>
        <div className="demo-banner">
          <span className="demo-chip">
            <FlaskConical aria-hidden="true" />
            <span>
              <strong>Synthetic proof of concept.</strong> Fictional CVs only.
              Real applicant data is disabled.
              {state?.temporaryPublic && " Temporary access: no sign-in required."}
            </span>
          </span>
          <span className="save-status" role="status">
            {busy
              ? "Saving changes…"
              : unsaved
                ? "Unsaved changes"
                : state
                  ? "All changes saved"
                  : "Connecting…"}
          </span>
        </div>
        <div className="page">{page}</div>
      </main>
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
