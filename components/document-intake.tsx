"use client";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { toast } from "sonner";
import type { Action, Application } from "@/lib/workflow";
type Record = {
  id: string;
  application_key: string;
  status: string;
  attempts: number;
};
export function DocumentIntake({
  vacancyId,
  batchId,
  version,
  closed,
  applications,
  onRefresh,
  send,
  enabled,
}: {
  vacancyId: string;
  batchId: string;
  version: number;
  closed: boolean;
  applications: (Pick<Application, "id" | "state"> & { label: string })[];
  onRefresh: () => void;
  send: (a: Action) => Promise<unknown>;
  enabled: boolean;
}) {
  const [docs, setDocs] = useState<Record[]>([]),
    [busy, setBusy] = useState(false),
    [synthetic, setSynthetic] = useState(false),
    [manual, setManual] = useState(""),
    [error, setError] = useState("");
  async function action(body: unknown) {
    const r = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      d = await r.json();
    if (!r.ok) throw new Error(d.error);
    return d;
  }
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    async function refresh() {
      try {
        const r = await fetch("/api/documents", { cache: "no-store" }),
          d = await r.json();
        if (alive && r.ok) setDocs(d.documents);
      } catch {}
    }
    void refresh();
    const timer = setInterval(() => {
      void refresh();
      onRefresh();
    }, 6000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [enabled, onRefresh]);
  return (
    <section className="panel">
      <h3>Synthetic document intake</h3>
      <p>
        PDF or DOCX, maximum 5 MiB. Files stay private. Use generated fictional
        fixtures only.
      </p>
      {error && <p role="alert">{error}</p>}
      {!enabled ? (
        <p>
          File intake needs configured Supabase staging and a verified parser
          snapshot. Sample CV workflow remains available.
        </p>
      ) : (
        <>
          <label className="flex gap-2 my-4">
            <input
              type="checkbox"
              checked={synthetic}
              onChange={(e) => setSynthetic(e.target.checked)}
            />
            I confirm these files contain fictional data only.
          </label>
          <label htmlFor="synthetic-file">Choose fictional CV</label>
          <Input
            id="synthetic-file"
            type="file"
            accept=".pdf,.docx"
            disabled={!synthetic || closed || busy}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setBusy(true);
              setError("");
              try {
                const type = file.name.toLowerCase().endsWith(".pdf")
                  ? "pdf"
                  : file.name.toLowerCase().endsWith(".docx")
                    ? "docx"
                    : null;
                if (!type || file.size > 5242880)
                  throw new Error("Choose PDF or DOCX up to 5 MiB.");
                const reservation = await action({
                  type: "reserve",
                  version,
                  vacancyId,
                  batchId,
                  filename: file.name,
                  size: file.size,
                  fileType: type,
                  synthetic: true,
                });
                const uploaded = await fetch(reservation.uploadUrl, {
                  method: "PUT",
                  headers: {
                    "Content-Type":
                      type === "pdf"
                        ? "application/pdf"
                        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                  },
                  body: file,
                });
                if (!uploaded.ok)
                  throw new Error(
                    "Upload incomplete; reserved item remains visible.",
                  );
                await action({
                  type: "finalise",
                  documentId: reservation.documentId,
                });
                toast.success(
                  "Document queued. Processing continues without this browser.",
                );
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
                onRefresh();
                e.target.value = "";
              }
            }}
          />
          {docs.map((d) => (
            <div className="intake-row" key={d.id}>
              <span>
                {applications.find((a) => a.id === d.application_key)?.label ??
                  "Candidate"}
              </span>
              <span>
                {d.status} · {d.attempts} attempts
              </span>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    const r = await fetch("/api/documents?download=" + d.id, {
                        cache: "no-store",
                      }),
                      data = await r.json();
                    if (!r.ok) throw new Error(data.error);
                    const a = document.createElement("a");
                    a.href = data.url;
                    a.rel = "noopener noreferrer";
                    a.download = "";
                    a.click();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Download original (identity may be visible)
              </Button>
              {!closed && ["attention", "readable_copy"].includes(d.status) && (
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      await action({ type: "retry", documentId: d.id });
                      onRefresh();
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  Retry processing
                </Button>
              )}
            </div>
          ))}
        </>
      )}
      {!closed &&
        applications
          .filter((a) =>
            ["readable_copy", "attention", "processing"].includes(a.state),
          )
          .map((a) => (
            <div className="my-3" key={a.id}>
              <Button variant="outline" onClick={() => setManual(a.id)}>
                Provide checked manual passages for {a.label}
              </Button>
              {manual === a.id && (
                <form
                  className="my-4"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    const ok = await send({
                      type: "manual_source",
                      vacancyId,
                      batchId,
                      applicationId: a.id,
                      name: String(f.get("name")),
                      passages: [
                        {
                          locator: String(f.get("locator")),
                          text: String(f.get("text")),
                        },
                      ],
                      reason: String(f.get("reason")),
                      attest: true,
                    });
                    if (ok) {
                      setManual("");
                      onRefresh();
                    }
                  }}
                >
                  <label htmlFor="manual-name">
                    Fictional candidate name (kept hidden during review)
                  </label>
                  <Input id="manual-name" name="name" maxLength={100} />
                  <label htmlFor="manual-locator">
                    Original page or DOCX paragraph reference
                  </label>
                  <Input
                    id="manual-locator"
                    name="locator"
                    required
                    maxLength={100}
                  />
                  <label htmlFor="manual-text">Relevant transcription</label>
                  <Textarea
                    id="manual-text"
                    name="text"
                    required
                    maxLength={10000}
                  />
                  <label htmlFor="manual-reason">
                    Reason for manual handling
                  </label>
                  <Input
                    id="manual-reason"
                    name="reason"
                    required
                    maxLength={1000}
                  />
                  <label className="flex gap-2 my-3">
                    <input type="checkbox" required />I checked these passages
                    against the original document.
                  </label>
                  <Button>Save checked passages</Button>
                </form>
              )}
            </div>
          ))}
    </section>
  );
}
