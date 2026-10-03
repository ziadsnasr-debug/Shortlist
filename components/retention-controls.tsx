"use client";
import { useEffect, useState } from "react";
import {
  CircleAlert,
  CircleCheck,
  Info,
  Lock,
  LockOpen,
  RefreshCw,
} from "lucide-react";
import { shortId } from "./admin/types";
import { Button } from "./ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "./ui/field";
import { Input } from "./ui/input";
import { NativeSelect } from "./ui/native-select";
import { Skeleton } from "./ui/skeleton";
import { StatusChip } from "./ui/status-chip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

type Retention = {
  policy: {
    version: number;
    proposedDays: number | null;
    automationEnabled: false;
  } | null;
  preview: {
    status: "not_configured" | "hypothetical";
    eligibleCount: number;
    heldCount: number;
    candidates: {
      applicationId: string;
      batchId: string;
      eligibleAt: string;
      holdState: string;
    }[];
  };
  holds: {
    id: string;
    scope: string;
    applicationId: string | null;
    reasonCode: string;
    active: boolean;
    createdAt: string;
    releasedAt: string | null;
  }[];
};

type Action = { action: string; [field: string]: unknown };

const reasonLabels: Record<string, string> = {
  legal: "Legal",
  investigation: "Investigation",
  subject_request: "Subject request",
  operational: "Operational",
};

const reasonLabel = (code: string) =>
  reasonLabels[code] ??
  code.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "–"
    : date.toLocaleDateString("en-GB", { dateStyle: "medium" });
}

/** Short id for sighted users, the full id for screen readers and on hover. */
function ApplicationId({ id }: { id: string }) {
  return (
    <span title={id} className="font-mono text-xs">
      <span aria-hidden="true">{shortId(id)}</span>
      <span className="sr-only">{id}</span>
    </span>
  );
}

function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="grid gap-1 rounded-lg border border-dashed border-border p-6 text-sm">
      <p className="text-foreground">{title}</p>
      {children && <p>{children}</p>}
    </div>
  );
}

export function RetentionControls() {
  const [data, setData] = useState<Retention | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  // Which action is in flight, so only its button spins; null when idle.
  const [busy, setBusy] = useState<string | null>(null);
  const [scope, setScope] = useState("workspace");
  const working = busy !== null;
  async function load() {
    const response = await fetch("/api/retention", { cache: "no-store" });
    if (!response.ok)
      throw new Error("Retention controls unavailable. Try refreshing.");
    setData(await response.json());
    setError("");
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, []);
  async function send(body: Action, key: string = body.action) {
    setBusy(key);
    setNotice("");
    try {
      const response = await fetch("/api/retention", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Retention change unavailable.");
      await load();
      setNotice("Saved. Automatic deletion remains disabled.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  const activeHolds = data?.holds.filter((h) => h.active) ?? [];
  const preview = data?.preview;
  return (
    <section
      aria-labelledby="retention-title"
      className="mb-8 grid grid-cols-[minmax(0,1fr)] gap-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid max-w-prose gap-1">
          <h2 id="retention-title">Retention preview and deletion holds</h2>
          <p className="text-sm">
            See when applications would reach a retention date and protect
            content with deletion holds. This preview assumes the clock starts
            when a batch is finalised. A draft is not customer approval; it
            never deletes content.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={working}
          onClick={() => void load().catch((e) => setError(e.message))}
        >
          <RefreshCw aria-hidden="true" />
          Refresh retention controls
        </Button>
      </div>

      <div className="flex max-w-prose items-start gap-3 rounded-lg border border-border bg-surface-2 p-4 text-sm">
        <Info
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        />
        <div className="grid gap-1">
          <p className="font-medium text-foreground">
            Automatic deletion is disabled.
          </p>
          <p>
            Nothing on this page removes content. Periods, scope, holds, exports
            and backups must be agreed with the customer before anything can be
            activated.
          </p>
        </div>
      </div>

      <div role="status" className="empty:hidden text-sm">
        {notice && (
          <p className="flex items-center gap-2 text-foreground">
            <CircleCheck
              aria-hidden="true"
              className="size-4 shrink-0 text-success"
            />
            {notice}
          </p>
        )}
      </div>
      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 text-sm text-destructive"
        >
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      {!data && !error && (
        <div aria-busy="true" className="grid gap-3">
          <span role="status" className="sr-only">
            Loading retention controls
          </span>
          <Skeleton className="h-10 w-full max-w-xl" />
          <Skeleton className="h-10 w-3/4 max-w-xl" />
        </div>
      )}

      {data && preview && (
        <>
          <section
            aria-labelledby="retention-period-heading"
            className="grid grid-cols-[minmax(0,1fr)] gap-3"
          >
            <h3 id="retention-period-heading" className="text-base font-medium">
              Hypothetical retention period
            </h3>
            <form
              key={data.policy?.version ?? "none"}
              className="grid max-w-xl grid-cols-[minmax(0,1fr)] gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void send({
                  action: "draft_policy",
                  proposedDays: f.get("days") ? Number(f.get("days")) : null,
                  startEvent: "batch_finalised_at",
                });
              }}
            >
              <Field>
                <FieldLabel htmlFor="proposed-retention-days">
                  Hypothetical retention days
                </FieldLabel>
                <Input
                  id="proposed-retention-days"
                  name="days"
                  type="number"
                  min={1}
                  max={3650}
                  inputMode="numeric"
                  className="max-w-40 tabular-nums"
                  aria-describedby="retention-days-help"
                  defaultValue={data.policy?.proposedDays ?? ""}
                />
                <FieldDescription id="retention-days-help">
                  Leave blank to remove the hypothetical period. The customer
                  must agree periods, scope, holds, exports and backups before
                  activation.
                </FieldDescription>
              </Field>
              <div>
                <Button
                  type="submit"
                  loading={busy === "draft_policy"}
                  disabled={working}
                >
                  Save preview draft
                </Button>
              </div>
            </form>
          </section>

          <section
            aria-labelledby="retention-preview-heading"
            className="grid grid-cols-[minmax(0,1fr)] gap-3"
          >
            <h3
              id="retention-preview-heading"
              className="text-base font-medium"
            >
              Preview
            </h3>
            {preview.status === "not_configured" ? (
              <EmptyState title="No hypothetical period configured.">
                Save a number of days above to see which applications would
                reach the date.
              </EmptyState>
            ) : (
              <>
                <p role="status" className="max-w-prose text-sm">
                  {preview.eligibleCount}{" "}
                  {preview.eligibleCount === 1
                    ? "application reaches"
                    : "applications reach"}{" "}
                  the hypothetical date; {preview.heldCount} protected by holds.
                  No content will be deleted.
                </p>
                {preview.candidates.length === 0 ? (
                  <EmptyState title="No applications reach the hypothetical date yet." />
                ) : (
                  <div className="rounded-lg border border-border bg-card">
                    <Table>
                      <caption className="sr-only">
                        Applications and their hypothetical retention dates
                      </caption>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead scope="col">Application</TableHead>
                          <TableHead scope="col">Hypothetical date</TableHead>
                          <TableHead scope="col">Hold state</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.candidates.map((c) => (
                          <TableRow key={c.applicationId}>
                            <TableCell>
                              <ApplicationId id={c.applicationId} />
                            </TableCell>
                            <TableCell className="whitespace-nowrap tabular-nums">
                              <time dateTime={c.eligibleAt}>
                                {formatDate(c.eligibleAt)}
                              </time>
                            </TableCell>
                            <TableCell>
                              {c.holdState === "held" ? (
                                <StatusChip tone="accent" icon={<Lock />}>
                                  Held
                                </StatusChip>
                              ) : (
                                <StatusChip tone="neutral" icon={<LockOpen />}>
                                  {c.holdState === "not_held"
                                    ? "Not held"
                                    : c.holdState.replaceAll("_", " ")}
                                </StatusChip>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </>
            )}
          </section>

          <section
            aria-labelledby="retention-holds-heading"
            className="grid grid-cols-[minmax(0,1fr)] gap-5"
          >
            <div className="grid max-w-prose gap-1">
              <h3
                id="retention-holds-heading"
                className="text-base font-medium"
              >
                Deletion holds
              </h3>
              <p className="text-sm">
                Holds block future deletion requests for content still retained.
                Exported copies and offline backups need separate agreed
                controls.
              </p>
            </div>

            <form
              aria-labelledby="place-hold-heading"
              className="grid max-w-xl grid-cols-[minmax(0,1fr)] gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void send({
                  action: "place_hold",
                  scope,
                  ...(scope === "application"
                    ? { applicationId: String(f.get("application")) }
                    : {}),
                  reasonCode: String(f.get("reason")),
                });
              }}
            >
              <h4 id="place-hold-heading" className="text-sm font-medium">
                Place a hold
              </h4>
              <FieldGroup className="gap-4">
                <Field>
                  <FieldLabel htmlFor="hold-scope">Hold scope</FieldLabel>
                  <NativeSelect
                    id="hold-scope"
                    value={scope}
                    onChange={(e) => setScope(e.target.value)}
                    disabled={working}
                  >
                    <option value="workspace">Entire workspace</option>
                    <option value="application">One application</option>
                  </NativeSelect>
                </Field>
                {scope === "application" && (
                  <Field>
                    <FieldLabel htmlFor="hold-application">
                      Application ID for hold
                    </FieldLabel>
                    <Input
                      id="hold-application"
                      name="application"
                      autoComplete="off"
                      required
                      maxLength={100}
                      className="font-mono"
                    />
                  </Field>
                )}
                <Field>
                  <FieldLabel htmlFor="hold-reason">Hold reason</FieldLabel>
                  <NativeSelect
                    id="hold-reason"
                    name="reason"
                    disabled={working}
                  >
                    <option value="legal">Legal</option>
                    <option value="investigation">Investigation</option>
                    <option value="subject_request">Subject request</option>
                    <option value="operational">Operational</option>
                  </NativeSelect>
                </Field>
              </FieldGroup>
              <div>
                <Button
                  type="submit"
                  loading={busy === "place_hold"}
                  disabled={working}
                >
                  Place deletion hold
                </Button>
              </div>
            </form>

            <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
              <h4 className="text-sm font-medium">Active holds</h4>
              {activeHolds.length === 0 ? (
                <EmptyState title="No active deletion holds." />
              ) : (
                <div className="rounded-lg border border-border bg-card">
                  <Table>
                    <caption className="sr-only">Active deletion holds</caption>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead scope="col">Applies to</TableHead>
                        <TableHead scope="col">Reason</TableHead>
                        <TableHead scope="col">Placed</TableHead>
                        <TableHead scope="col" className="text-right">
                          <span className="sr-only">Action</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeHolds.map((h) => {
                        const whole =
                          h.scope === "workspace" || !h.applicationId;
                        return (
                          <TableRow key={h.id}>
                            <TableCell>
                              {whole ? (
                                "Entire workspace"
                              ) : (
                                <ApplicationId id={h.applicationId!} />
                              )}
                            </TableCell>
                            <TableCell>{reasonLabel(h.reasonCode)}</TableCell>
                            <TableCell className="whitespace-nowrap tabular-nums">
                              <time dateTime={h.createdAt}>
                                {formatDate(h.createdAt)}
                              </time>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                loading={busy === `release_hold:${h.id}`}
                                disabled={working}
                                onClick={() =>
                                  void send(
                                    { action: "release_hold", holdId: h.id },
                                    `release_hold:${h.id}`,
                                  )
                                }
                              >
                                Release hold
                                <span className="sr-only">
                                  {" "}
                                  for{" "}
                                  {whole ? "entire workspace" : h.applicationId}
                                </span>
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </section>
  );
}
