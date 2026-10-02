"use client";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { formatAge } from "@/lib/operation-status";
const stageLabels: { [stage: string]: string } = {
  awaiting_upload: "Awaiting upload",
  queued: "Queued or processing",
  processing: "Processing",
  ready: "Ready for review",
  needs_readable_copy: "Needs readable copy",
  attention: "Needs attention",
  deleted: "Deleted",
};
type Admin = {
  settings: {
    paused: boolean;
    retentionDays: number | null;
    incidentOwner: string;
  };
  members: { user_id: string; active: boolean; role: string }[];
  documents: {
    id: string;
    application_key: string;
    status: string;
    stage: string;
    attempts: number;
    reserved_at: string;
    reservation_age_seconds: number | null;
    safe_error_code: string | null;
    safe_error_message: string | null;
    deletion_state: string;
  }[];
  deletions: {
    id: string;
    entity_id: string;
    ready_after: string;
    completed_at: string | null;
  }[];
  processing: {
    total: number;
    awaiting_upload: number;
    queued_or_processing: number;
    ready: number;
    attention: number;
  };
};
export function Administration() {
  const [data, setData] = useState<Admin | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  async function load() {
    const r = await fetch("/api/administration", { cache: "no-store" }),
      d = await r.json();
    if (!r.ok) throw new Error(d.error);
    setData(d);
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  async function send(body: unknown) {
    setBusy(true);
    try {
      const r = await fetch("/api/administration", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
        d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setError("");
      setNotice(
        "completed" in d
          ? `${d.completed} files processed; ${d.failed} need recovery. Refresh status after pending jobs finish.`
          : "Saved.",
      );
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <h1 id="page-title" tabIndex={-1}>
        Administration
      </h1>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {data && (
        <>
          <h2>Workspace controls</h2>
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void send({
                type: "settings",
                paused: f.get("paused") === "on",
                retentionDays: f.get("days") ? Number(f.get("days")) : null,
                incidentOwner: String(f.get("owner")),
              });
            }}
          >
            <label>
              <input
                name="paused"
                type="checkbox"
                defaultChecked={data.settings.paused}
              />
              Pause intake and inference
            </label>
            <label htmlFor="retention">Customer-approved retention days</label>
            <Input
              id="retention"
              name="days"
              type="number"
              min={1}
              max={3650}
              defaultValue={data.settings.retentionDays ?? ""}
            />
            <label htmlFor="incident-owner">Incident owner role</label>
            <Input
              id="incident-owner"
              name="owner"
              maxLength={100}
              defaultValue={data.settings.incidentOwner}
            />
            <Button disabled={busy}>Save controls</Button>
          </form>
          <h2 className="mt-6">Invite a reviewer</h2>
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void send({
                type: "invite",
                email: String(f.get("email")),
                role: String(f.get("role")),
              });
            }}
          >
            <label htmlFor="invite-email">Email address</label>
            <Input id="invite-email" name="email" type="email" required />
            <label htmlFor="invite-role">Role</label>
            <select id="invite-role" name="role">
              <option value="reviewer">Reviewer</option>
              <option value="administrator">Administrator</option>
            </select>
            <Button disabled={busy}>Send invitation</Button>
          </form>
          <h2 className="mt-6">Team access</h2>
          {data.members.map((m) => (
            <div className="intake-row" key={m.user_id}>
              <span>
                {m.user_id} · {m.role} · {m.active ? "Active" : "Removed"}
              </span>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void send({
                    type: "member",
                    userId: m.user_id,
                    role: m.role,
                    active: !m.active,
                  })
                }
              >
                {m.active ? "Remove access" : "Restore access"}
              </Button>
            </div>
          ))}
          <h2 className="mt-6">Processing and deletion</h2>
          <p>
            Uploads start processing automatically. Scheduled recovery runs
            daily on the current plan. Process up to two pending files now, or
            refresh to check an existing job.
          </p>
          <div className="flex flex-wrap gap-2 my-3">
            <Button
              disabled={busy || data.settings.paused}
              onClick={() => void send({ type: "process" })}
            >
              {busy ? "Working…" : "Process pending files"}
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void load().catch((e) => setError(e.message))}
            >
              Refresh status
            </Button>
          </div>
          {data.settings.paused && (
            <p>
              Processing is paused. Resume in Workspace controls before
              processing files.
            </p>
          )}
          <h3>Processing status</h3>
          <p role="status">
            {data.processing.total} retained files:{" "}
            {data.processing.awaiting_upload} awaiting upload,{" "}
            {data.processing.queued_or_processing} queued or processing,{" "}
            {data.processing.ready} ready, {data.processing.attention} needing
            attention.
          </p>
          {data.documents.map((d) => (
            <div className="intake-row" key={d.id}>
              <span>
                {d.application_key} ·{" "}
                {stageLabels[d.stage] ?? "Status unavailable"} ·{" "}
                {d.attempts} attempts ·{" "}
                reservation age {formatAge(d.reservation_age_seconds)}
                {d.safe_error_message &&
                  " · " + d.safe_error_message}
              </span>
            </div>
          ))}
          <form
            className="grid gap-3 mt-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                const r = await fetch("/api/deletion", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      applicationId: String(f.get("application")),
                      confirm: String(f.get("confirm")),
                    }),
                  }),
                  d = await r.json();
                if (!r.ok) throw new Error(d.error);
                await load();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <h3>Delete application content</h3>
            <p>
              Removes original files, source text, model outputs and review
              content. Finalised content is purged with an integrity receipt;
              decisions cannot be reopened. External exports and approved backup
              retention require the documented process.
            </p>
            <label htmlFor="delete-application">Application ID</label>
            <Input id="delete-application" name="application" required />
            <label htmlFor="delete-confirm">Type DELETE CONTENT</label>
            <Input
              id="delete-confirm"
              name="confirm"
              required
              pattern="DELETE CONTENT"
            />
            <Button variant="outline">Delete content</Button>
          </form>
          <p>
            {data.deletions.filter((d) => !d.completed_at).length} pending
            deletion records. Use documented recovery and deletion runbooks.
          </p>
          {data.deletions.some((d) => !d.completed_at) && (
            <p>
              Earliest safe deletion completion (not an SLA):{" "}
              {new Date(
                data.deletions
                  .filter((d) => !d.completed_at)
                  .map((d) => d.ready_after)
                  .sort()[0],
              ).toLocaleString()}
            </p>
          )}
        </>
      )}
    </section>
  );
}
