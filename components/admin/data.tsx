"use client";
import { ShieldAlert } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Busy } from "./types";

export function DataTab({
  pending,
  busy,
  deleteContent,
}: {
  pending: number;
  busy: Busy;
  deleteContent: (applicationId: string, confirm: string) => Promise<boolean>;
}) {
  const [application, setApplication] = useState(""),
    [confirm, setConfirm] = useState("");
  return (
    <section
      aria-labelledby="danger-heading"
      className="grid grid-cols-[minmax(0,1fr)] max-w-2xl gap-4 rounded-lg border border-destructive/50 bg-card p-5"
    >
      <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
        <h2
          id="danger-heading"
          className="flex items-center gap-2 text-destructive"
        >
          <ShieldAlert aria-hidden="true" className="size-5" />
          Delete application content
        </h2>
        <p className="text-sm">
          Removes original files, source text, model outputs and review content.
          Finalised content is purged with an integrity receipt; decisions
          cannot be reopened. External exports and approved backup retention
          require the documented process.
        </p>
      </div>
      <form
        className="grid grid-cols-[minmax(0,1fr)] gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await deleteContent(application, confirm)) {
            setApplication("");
            setConfirm("");
          }
        }}
      >
        <div className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
          <Label htmlFor="delete-application">Application ID</Label>
          <Input
            id="delete-application"
            name="application"
            autoComplete="off"
            required
            value={application}
            onChange={(e) => setApplication(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
          <Label htmlFor="delete-confirm">Type DELETE CONTENT</Label>
          <Input
            id="delete-confirm"
            name="confirm"
            autoComplete="off"
            required
            pattern="DELETE CONTENT"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <div>
          <Button
            type="submit"
            variant="destructive"
            loading={busy === "delete"}
            disabled={busy !== null}
          >
            Delete content
          </Button>
        </div>
      </form>
      <p className="border-t border-border pt-3 text-sm">
        {pending} pending deletion {pending === 1 ? "record" : "records"}. Use
        documented recovery and deletion runbooks.
      </p>
    </section>
  );
}
