"use client";
import { useRef, useState } from "react";
import { UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

const maxBytes = 5 * 1024 * 1024;
export const maxFiles = 30;

type Rejected = { name: string; reason: string };

function fileType(name: string) {
  const lower = name.toLowerCase();
  return lower.endsWith(".pdf")
    ? ("pdf" as const)
    : lower.endsWith(".docx")
      ? ("docx" as const)
      : null;
}

async function post(body: unknown) {
  const r = await fetch("/api/documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error);
  return d;
}

export function UploadZone({
  vacancyId,
  batchId,
  existing,
  disabled,
  onUploaded,
}: {
  vacancyId: string;
  batchId: string;
  existing: number;
  disabled: boolean;
  onUploaded: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [synthetic, setSynthetic] = useState(false),
    [over, setOver] = useState(false),
    [uploading, setUploading] = useState<string | null>(null),
    [queue, setQueue] = useState(0),
    [rejected, setRejected] = useState<Rejected[]>([]),
    [uploadStep, setUploadStep] = useState<
      "idle" | "reserving" | "transferring" | "queueing"
    >("idle");
  const busy = uploading !== null;
  const blocked = disabled || !synthetic || busy;

  async function upload(files: File[]) {
    if (blocked || !files.length) return;
    const rejects: Rejected[] = [];
    const room = maxFiles - existing;
    const accepted = files.filter((f) => {
      if (!fileType(f.name))
        rejects.push({ name: f.name, reason: "Only PDF or DOCX files." });
      else if (f.size > maxBytes)
        rejects.push({ name: f.name, reason: "Over the 5 MB limit." });
      else return true;
      return false;
    });
    accepted.splice(Math.max(0, room)).forEach((f) =>
      rejects.push({
        name: f.name,
        reason: `A batch holds up to ${maxFiles} CVs. Start the next batch for more.`,
      }),
    );
    setRejected(rejects);
    setQueue(accepted.length);
    let done = 0;
    for (const file of accepted) {
      setUploading(file.name);
      try {
        // Each reservation is checked against the current workspace version.
        setUploadStep("reserving");
        const fresh = await fetch("/api/workspace", { cache: "no-store" });
        const { version } = await fresh.json();
        const type = fileType(file.name)!;
        const reservation = await post({
          type: "reserve",
          version,
          vacancyId,
          batchId,
          filename: file.name,
          size: file.size,
          fileType: type,
          synthetic: true,
        });
        setUploadStep("transferring");
        const put = await fetch(reservation.uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type":
              type === "pdf"
                ? "application/pdf"
                : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          },
          body: file,
        });
        if (!put.ok)
          throw new Error(
            "The upload didn't finish. The file stays listed so you can retry or record a disposition.",
          );
        setUploadStep("queueing");
        await post({ type: "finalise", documentId: reservation.documentId });
        done++;
      } catch (e) {
        setRejected((r) => [
          ...r,
          { name: file.name, reason: (e as Error).message },
        ]);
      } finally {
        setQueue((q) => q - 1);
        onUploaded();
      }
    }
    setUploading(null);
    setUploadStep("idle");
    if (done)
      toast.success(
        done === 1
          ? "CV queued. Processing continues even if you close this page."
          : `${done} CVs queued. Processing continues even if you close this page.`,
      );
  }

  return (
    <section className="upload panel" aria-labelledby="upload-title">
      <div className="upload-head">
        <h3 id="upload-title">Upload fictional CVs</h3>
        <p>
          PDF or DOCX, up to 5 MB and 10 pages each, up to {maxFiles} per batch.
          Files stay private.
        </p>
      </div>
      <label className="check-line upload-confirm">
        <Checkbox
          checked={synthetic}
          onCheckedChange={(v) => setSynthetic(v === true)}
          disabled={disabled}
        />
        I confirm these files contain fictional data only.
      </label>
      <div
        className={cn(
          "dropzone",
          over && !blocked && "is-over",
          blocked && "is-blocked",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void upload([...e.dataTransfer.files]);
        }}
      >
        <UploadCloud aria-hidden="true" />
        <p>
          {busy
            ? `Uploading ${uploading}${queue > 1 ? ` · ${queue - 1} more waiting` : ""}`
            : !synthetic
              ? "Confirm the files are fictional to enable uploading."
              : "Drop CVs here, or"}
        </p>
        <input
          ref={input}
          id="synthetic-file"
          className="sr-only"
          type="file"
          multiple
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          disabled={blocked}
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = "";
            void upload(files);
          }}
        />
        <label htmlFor="synthetic-file" className="browse">
          Choose fictional CV
        </label>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {uploadStep === "reserving" && "Reserving a private upload slot."}
        {uploadStep === "transferring" && "Uploading the fictional file."}
        {uploadStep === "queueing" && "Queueing the uploaded file."}
      </p>
      {rejected.length > 0 && (
        <div className="rejected" role="alert">
          <div className="rejected-head">
            <strong>
              {rejected.length === 1
                ? "1 file wasn't added"
                : `${rejected.length} files weren't added`}
            </strong>
            <button
              type="button"
              onClick={() => setRejected([])}
              aria-label="Dismiss upload messages"
            >
              <X aria-hidden="true" />
            </button>
          </div>
          <ul>
            {rejected.map((r, i) => (
              <li key={`${r.name}-${i}`}>
                <span className="mono">{r.name}</span> {r.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
