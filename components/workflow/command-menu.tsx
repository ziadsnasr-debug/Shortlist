"use client";
import { useEffect } from "react";
import { useTheme } from "next-themes";
import {
  BriefcaseBusiness,
  CircleHelp,
  FileText,
  Monitor,
  Moon,
  Plus,
  Settings2,
  Sun,
} from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Navigate } from "./nav-link";
import { defaultStep, pathFor, type Route } from "./routes";
import { steps, type PublicVacancy } from "./types";

// Jump anywhere with the keyboard. Every move goes through `navigate`, so the
// unsaved-draft guard still applies.
export function CommandMenu({
  open,
  onOpenChange,
  vacancies,
  route,
  isAdmin,
  navigate,
  onHelp,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vacancies: PublicVacancy[];
  route: Route;
  isAdmin: boolean;
  navigate: Navigate;
  onHelp: () => void;
}) {
  const { setTheme } = useTheme();
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const run = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };
  const current =
    route.view === "batch"
      ? vacancies.find((v) => v.id === route.vacancyId)
      : undefined;
  const batch =
    current && route.view === "batch"
      ? current.batches.find((b) => b.id === route.batchId)
      : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-lg">
        <DialogTitle className="sr-only">Jump to</DialogTitle>
        <DialogDescription className="sr-only">
          Search vacancies, steps, CVs and settings.
        </DialogDescription>
        <Command label="Jump to">
          <CommandInput placeholder="Jump to a vacancy, step or CV…" />
          <CommandList>
            <CommandEmpty>
              Nothing matches. Try a vacancy or step name.
            </CommandEmpty>
            <CommandGroup heading="Go to">
              <CommandItem
                onSelect={() => run(() => navigate(pathFor({ view: "home" })))}
              >
                <BriefcaseBusiness aria-hidden="true" /> Vacancies
              </CommandItem>
              {isAdmin && (
                <CommandItem
                  onSelect={() => run(() => navigate(pathFor({ view: "new" })))}
                >
                  <Plus aria-hidden="true" /> New vacancy
                </CommandItem>
              )}
              {isAdmin && (
                <CommandItem
                  onSelect={() =>
                    run(() => navigate(pathFor({ view: "admin" })))
                  }
                >
                  <Settings2 aria-hidden="true" /> Administration
                </CommandItem>
              )}
            </CommandGroup>
            {current && batch && route.view === "batch" && (
              <CommandGroup heading={current.title}>
                {steps.map((name, i) => (
                  <CommandItem
                    key={name}
                    value={`${current.title} ${name}`}
                    onSelect={() =>
                      run(() => navigate(pathFor({ ...route, step: i })))
                    }
                  >
                    <span className="w-5 text-center font-mono text-xs text-muted-foreground">
                      {i + 1}
                    </span>
                    {name}
                  </CommandItem>
                ))}
                {batch.closed &&
                  batch.applications
                    .filter((a) => a.state !== "disposed")
                    .map((a) => {
                      const n = batch.applications.indexOf(a) + 1;
                      return (
                        <CommandItem
                          key={a.id}
                          value={`Review ${a.label}`}
                          onSelect={() =>
                            run(() =>
                              navigate(
                                pathFor({ ...route, step: 2, candidate: n }),
                              ),
                            )
                          }
                        >
                          <FileText aria-hidden="true" /> Review{" "}
                          <span className="font-mono">{a.label}</span>
                          {a.confirmed && (
                            <span className="ml-auto text-xs text-muted-foreground">
                              Reviewed
                            </span>
                          )}
                        </CommandItem>
                      );
                    })}
              </CommandGroup>
            )}
            {vacancies.length > 0 && (
              <CommandGroup heading="Vacancies">
                {vacancies.map((v) => {
                  const b = v.batches.at(-1)!;
                  return (
                    <CommandItem
                      key={v.id}
                      value={`${v.title} ${v.team}`}
                      onSelect={() =>
                        run(() =>
                          navigate(
                            pathFor({
                              view: "batch",
                              vacancyId: v.id,
                              batchId: b.id,
                              step: defaultStep(b),
                            }),
                          ),
                        )
                      }
                    >
                      <BriefcaseBusiness aria-hidden="true" />
                      {v.title}
                      {v.team && (
                        <span className="ml-auto text-xs text-muted-foreground">
                          {v.team}
                        </span>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
            <CommandGroup heading="Appearance">
              <CommandItem onSelect={() => run(() => setTheme("light"))}>
                <Sun aria-hidden="true" /> Light theme
              </CommandItem>
              <CommandItem onSelect={() => run(() => setTheme("dark"))}>
                <Moon aria-hidden="true" /> Dark theme
              </CommandItem>
              <CommandItem onSelect={() => run(() => setTheme("system"))}>
                <Monitor aria-hidden="true" /> Match system theme
              </CommandItem>
            </CommandGroup>
            <CommandGroup heading="Help">
              <CommandItem onSelect={() => run(onHelp)}>
                <CircleHelp aria-hidden="true" /> How it works
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
