"use client";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Notice } from "./common";
import { NavLink, type Navigate } from "./nav-link";
import { pathFor } from "./routes";
import type { Send } from "./types";

export function NewVacancy({
  isAdmin,
  busy,
  send,
  navigate,
}: {
  isAdmin: boolean;
  busy: boolean;
  send: Send;
  navigate: Navigate;
}) {
  return (
    <div className="narrow-page">
      <NavLink
        className="back-link"
        href={pathFor({ view: "home" })}
        navigate={navigate}
      >
        <ArrowLeft aria-hidden="true" /> Vacancies
      </NavLink>
      <header className="pagehead">
        <div>
          <h1 id="page-title" tabIndex={-1}>
            New vacancy
          </h1>
          <p>
            Three details to start. Criteria come next and stay editable until
            you publish them.
          </p>
        </div>
      </header>
      {!isAdmin ? (
        <Notice>
          Only administrators can create vacancies. Ask an administrator to set
          this one up.
        </Notice>
      ) : (
        <form
          className="panel panel-body"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const next = await send({
              type: "create",
              title: String(f.get("title")),
              team: String(f.get("team")),
              description: String(f.get("description")),
            });
            const v = next?.vacancies.at(-1);
            const b = v?.batches.at(-1);
            if (v && b)
              navigate(
                pathFor({
                  view: "batch",
                  vacancyId: v.id,
                  batchId: b.id,
                  step: 0,
                }),
                { replace: true },
              );
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="title">Job title</FieldLabel>
              <Input id="title" name="title" required maxLength={100} />
            </Field>
            <Field>
              <FieldLabel htmlFor="team">Team</FieldLabel>
              <Input id="team" name="team" maxLength={80} />
            </Field>
            <Field>
              <FieldLabel htmlFor="description">Job description</FieldLabel>
              <Textarea
                id="description"
                name="description"
                required
                maxLength={6000}
                rows={8}
              />
              <FieldDescription>
                Use synthetic descriptions only during this proof of concept.
              </FieldDescription>
            </Field>
          </FieldGroup>
          <div className="actions mt-6">
            <Button type="submit" loading={busy}>
              Create and set criteria
            </Button>
            <Button variant="ghost" asChild>
              <NavLink href={pathFor({ view: "home" })} navigate={navigate}>
                Cancel
              </NavLink>
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
