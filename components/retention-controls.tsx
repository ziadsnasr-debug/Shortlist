"use client";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
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
export function RetentionControls() {
  const [data, setData] = useState<Retention | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [scope, setScope] = useState("workspace");
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
  async function send(body: unknown) {
    setBusy(true);
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
      setBusy(false);
    }
  }
  return (
    <section aria-labelledby="retention-title" className="mt-6">
      <h2 id="retention-title">Retention preview and deletion holds</h2>
      <p>
        Automatic deletion is disabled. This preview assumes the clock starts
        when a batch is finalised. A draft is not customer approval; it never
        deletes content.
      </p>
      <p>
        Holds block future deletion requests for content still retained. Exported copies and
        offline backups need separate agreed controls.
      </p>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <Button
        variant="outline"
        disabled={busy}
        onClick={() => void load().catch((e) => setError(e.message))}
      >
        Refresh retention controls
      </Button>
      {data && (
        <>
          <form
            key={data.policy?.version ?? "none"}
            className="grid gap-3 mt-4"
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
            <label htmlFor="proposed-retention-days">
              Hypothetical retention days
            </label>
            <Input
              id="proposed-retention-days"
              name="days"
              type="number"
              min={1}
              max={3650}
              defaultValue={data.policy?.proposedDays ?? ""}
            />
            <p>
              Leave blank to remove the hypothetical period. Customer must agree
              periods, scope, holds, exports and backups before activation.
            </p>
            <Button disabled={busy}>Save preview draft</Button>
          </form>
          {data.preview.status === "not_configured" ? (
            <p>No hypothetical period configured.</p>
          ) : (
            <>
              <p role="status">
                {data.preview.eligibleCount} applications reach the hypothetical
                date; {data.preview.heldCount} protected by holds. No content
                will be deleted.
              </p>
              <ul>
                {data.preview.candidates.map((c) => (
                  <li key={c.applicationId}>
                    {c.applicationId} · hypothetical date{" "}
                    {new Date(c.eligibleAt).toLocaleDateString()} ·{" "}
                    {c.holdState}
                  </li>
                ))}
              </ul>
            </>
          )}
          <form
            className="grid gap-3 mt-4"
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
            <h3>Place a deletion hold</h3>
            <label htmlFor="hold-scope">Hold scope</label>
            <select
              id="hold-scope"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              disabled={busy}
            >
              <option value="workspace">Entire workspace</option>
              <option value="application">One application</option>
            </select>
            {scope === "application" && (
              <>
                <label htmlFor="hold-application">
                  Application ID for hold
                </label>
                <Input
                  id="hold-application"
                  name="application"
                  required
                  maxLength={100}
                />
              </>
            )}
            <label htmlFor="hold-reason">Hold reason</label>
            <select id="hold-reason" name="reason" disabled={busy}>
              <option value="legal">Legal</option>
              <option value="investigation">Investigation</option>
              <option value="subject_request">Subject request</option>
              <option value="operational">Operational</option>
            </select>
            <Button disabled={busy}>Place deletion hold</Button>
          </form>
          <h3 className="mt-4">Active deletion holds</h3>
          {!data.holds.some((h) => h.active) && (
            <p>No active deletion holds.</p>
          )}
          {data.holds
            .filter((h) => h.active)
            .map((h) => (
              <div className="intake-row" key={h.id}>
                <span>
                  {h.scope === "workspace"
                    ? "Entire workspace"
                    : h.applicationId}{" "}
                  · {h.reasonCode.replaceAll("_", " ")}
                </span>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void send({ action: "release_hold", holdId: h.id })
                  }
                >
                  Release hold
                </Button>
              </div>
            ))}
        </>
      )}
    </section>
  );
}
