"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { Admin, Busy, SendAction } from "./types";

export function ControlsTab({
  settings,
  busy,
  send,
}: {
  settings: Admin["settings"];
  busy: Busy;
  send: SendAction;
}) {
  const [paused, setPaused] = useState(settings.paused);
  return (
    <section
      aria-labelledby="controls-heading"
      className="grid grid-cols-[minmax(0,1fr)] gap-4"
    >
      <h2 id="controls-heading">Workspace controls</h2>
      <form
        className="grid grid-cols-[minmax(0,1fr)] max-w-xl gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void send(
            {
              type: "settings",
              paused,
              retentionDays: f.get("days") ? Number(f.get("days")) : null,
              incidentOwner: String(f.get("owner")),
            },
            "Controls saved.",
          );
        }}
      >
        <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
          <Switch
            id="pause-switch"
            checked={paused}
            onCheckedChange={setPaused}
            aria-describedby="pause-help"
            className="mt-0.5"
          />
          <div className="grid grid-cols-[minmax(0,1fr)] gap-1">
            <Label htmlFor="pause-switch">Pause intake and inference</Label>
            <p id="pause-help" className="text-sm">
              While paused, new uploads wait in the queue and no CV is sent for
              reading. Reviewing and results keep working. Files continue when
              you turn this off and save.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
          <Label htmlFor="retention">Customer-approved retention days</Label>
          <Input
            id="retention"
            name="days"
            type="number"
            min={1}
            max={3650}
            aria-describedby="retention-help"
            defaultValue={settings.retentionDays ?? ""}
          />
          <p id="retention-help" className="text-sm">
            Between 1 and 3650 days. Leave empty until the customer approves a
            retention period.
          </p>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
          <Label htmlFor="incident-owner">Incident owner role</Label>
          <Input
            id="incident-owner"
            name="owner"
            maxLength={100}
            aria-describedby="owner-help"
            defaultValue={settings.incidentOwner}
          />
          <p id="owner-help" className="text-sm">
            The role responsible when something goes wrong, for example
            Operations lead.
          </p>
        </div>
        <div>
          <Button
            type="submit"
            loading={busy === "settings"}
            disabled={busy !== null}
          >
            Save controls
          </Button>
        </div>
      </form>
    </section>
  );
}
