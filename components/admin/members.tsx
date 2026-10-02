"use client";
import { useState } from "react";
import { CircleCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusChip } from "@/components/ui/status-chip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { shortId, type AdminMember, type Busy, type SendAction } from "./types";

const roleLabel = (role: string) =>
  role === "administrator" ? "Administrator" : "Reviewer";

export function MembersTab({
  members,
  busy,
  send,
}: {
  members: AdminMember[];
  busy: Busy;
  send: SendAction;
}) {
  const [email, setEmail] = useState(""),
    [role, setRole] = useState("reviewer"),
    [removing, setRemoving] = useState<AdminMember | null>(null);
  const working = busy !== null;

  const change = (m: AdminMember, active: boolean) =>
    send(
      { type: "member", userId: m.user_id, role: m.role, active },
      active ? "Access restored." : "Access removed.",
    );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8">
      <section
        aria-labelledby="invite-heading"
        className="grid grid-cols-[minmax(0,1fr)] gap-4"
      >
        <div className="grid grid-cols-[minmax(0,1fr)] gap-1">
          <h2 id="invite-heading">Invite a person</h2>
          <p className="max-w-prose text-sm">
            They receive an email with a link to sign in. Reviewers read and
            judge CVs. Administrators also manage people, controls and data.
          </p>
        </div>
        <form
          className="grid items-end gap-4 sm:grid-cols-[minmax(0,1fr)_12rem_auto]"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await send({ type: "invite", email, role }, "Invitation sent."))
              setEmail("");
          }}
        >
          <div className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
            <Label htmlFor="invite-email">Email address</Label>
            <Input
              id="invite-email"
              name="email"
              type="email"
              autoComplete="off"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
            <Label htmlFor="invite-role">Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="reviewer">Reviewer</SelectItem>
                <SelectItem value="administrator">Administrator</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" loading={busy === "invite"} disabled={working}>
            Send invitation
          </Button>
        </form>
      </section>

      <section
        aria-labelledby="team-heading"
        className="grid grid-cols-[minmax(0,1fr)] gap-3"
      >
        <h2 id="team-heading">Team access</h2>
        {members.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-sm">
            No members yet. Invite a reviewer to begin.
          </p>
        ) : (
          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead scope="col">Member</TableHead>
                  <TableHead scope="col">Role</TableHead>
                  <TableHead scope="col">Status</TableHead>
                  <TableHead scope="col" className="text-right">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.user_id}>
                    <TableCell>
                      <span title={m.user_id} className="font-mono text-xs">
                        <span aria-hidden="true">{shortId(m.user_id)}</span>
                        <span className="sr-only">{m.user_id}</span>
                      </span>
                    </TableCell>
                    <TableCell>{roleLabel(m.role)}</TableCell>
                    <TableCell>
                      {m.active ? (
                        <StatusChip tone="success" icon={<CircleCheck />}>
                          Active
                        </StatusChip>
                      ) : (
                        <StatusChip tone="neutral" icon={<UserX />}>
                          Removed
                        </StatusChip>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={working}
                        onClick={() =>
                          m.active ? setRemoving(m) : void change(m, true)
                        }
                      >
                        {m.active ? "Remove access" : "Restore access"}
                        <span className="sr-only">
                          {" "}
                          for member {shortId(m.user_id)}
                        </span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <Dialog
        open={removing !== null}
        onOpenChange={(open) => !open && !working && setRemoving(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Remove access for member{" "}
              <span className="font-mono">
                {removing ? shortId(removing.user_id) : ""}
              </span>
              ?
            </DialogTitle>
            <DialogDescription>
              This{" "}
              {removing ? roleLabel(removing.role).toLowerCase() : "member"} can
              no longer sign in to this workspace. Their past reviews are kept,
              and you can restore access at any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              disabled={working}
              onClick={() => setRemoving(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={busy === "member"}
              disabled={working}
              onClick={async () => {
                if (removing) await change(removing, false);
                setRemoving(null);
              }}
            >
              Remove access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
