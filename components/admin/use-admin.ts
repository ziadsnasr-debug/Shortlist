"use client";
import { useCallback, useEffect, useState } from "react";
import type { Admin, Busy, SendAction } from "./types";

type Load = "loading" | "ready" | "unavailable";

async function readJson(r: Response) {
  try {
    return (await r.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** All server calls for the screen. Endpoints and payloads are unchanged. */
export function useAdmin() {
  const [data, setData] = useState<Admin | null>(null),
    [load, setLoad] = useState<Load>("loading"),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState<Busy>(null);

  const fetchAdmin = useCallback(async () => {
    const r = await fetch("/api/administration", { cache: "no-store" }),
      d = await readJson(r);
    if (!r.ok)
      throw new Error(String(d.error ?? "Administration is unavailable."));
    setData(d as unknown as Admin);
    setLoad("ready");
  }, []);

  const initial = useCallback(() => {
    setLoad("loading");
    fetchAdmin().catch((e: Error) => {
      setReason(e.message);
      setLoad("unavailable");
    });
  }, [fetchAdmin]);

  useEffect(() => {
    initial();
  }, [initial]);

  const run = useCallback(
    async (kind: Exclude<Busy, null>, work: () => Promise<string>) => {
      setBusy(kind);
      setNotice("");
      try {
        const message = await work();
        setError("");
        setNotice(message);
        await fetchAdmin();
        return true;
      } catch (e) {
        setError((e as Error).message);
        return false;
      } finally {
        setBusy(null);
      }
    },
    [fetchAdmin],
  );

  const send: SendAction = (body, done = "Saved.") => {
    const type = (body as { type: string }).type;
    const kind: Exclude<Busy, null> =
      type === "invite" || type === "member" || type === "process"
        ? type
        : "settings";
    return run(kind, async () => {
      const r = await fetch("/api/administration", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
        d = await readJson(r);
      if (!r.ok) throw new Error(String(d.error ?? "That did not work."));
      return "completed" in d
        ? `${d.completed} files processed; ${d.failed} need recovery. Refresh status after pending jobs finish.`
        : done;
    });
  };

  const deleteContent = (applicationId: string, confirm: string) =>
    run("delete", async () => {
      const r = await fetch("/api/deletion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ applicationId, confirm }),
        }),
        d = await readJson(r);
      if (!r.ok) throw new Error(String(d.error ?? "That did not work."));
      return `Deletion recorded for application ${applicationId}. Refresh status to check progress.`;
    });

  const refresh = async () => {
    setBusy("refresh");
    setNotice("");
    try {
      await fetchAdmin();
      setError("");
      setNotice("Status refreshed.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return {
    data,
    load,
    reason,
    error,
    notice,
    busy,
    send,
    deleteContent,
    refresh,
    retry: initial,
  };
}
