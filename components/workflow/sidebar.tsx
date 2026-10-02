"use client";
import {
  BriefcaseBusiness,
  Search,
  ChevronsUpDown,
  CircleHelp,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Plus,
  Settings2,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Kbd } from "@/components/ui/kbd";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NavLink, type Navigate } from "./nav-link";
import { batchSummary } from "./progress";
import { defaultStep, pathFor, type Route } from "./routes";
import type { PublicVacancy } from "./types";

type SidebarProps = {
  vacancies: PublicVacancy[];
  route: Route;
  isAdmin: boolean;
  role: string;
  canSignOut: boolean;
  navigate: Navigate;
  onHelp: () => void;
  onJump: () => void;
};

function ProgressRing({ value }: { value: number }) {
  const r = 6,
    c = 2 * Math.PI * r;
  return (
    <svg className="progress-ring" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r={r} />
      <circle
        cx="8"
        cy="8"
        r={r}
        strokeDasharray={c}
        strokeDashoffset={c * (1 - value)}
      />
    </svg>
  );
}

function SidebarNav({
  vacancies,
  route,
  isAdmin,
  navigate,
  onNavigate,
  onJump,
}: SidebarProps & { onNavigate?: () => void }) {
  const go: Navigate = (to, opts) => {
    const moved = navigate(to, opts);
    if (moved) onNavigate?.();
    return moved;
  };
  return (
    <>
      <button
        type="button"
        className="jump-button"
        onClick={() => {
          onNavigate?.();
          onJump();
        }}
      >
        <Search aria-hidden="true" />
        <span className="side-label">Jump to</span>
        <Kbd className="ml-auto side-label">⌘K</Kbd>
      </button>
      <nav aria-label="Main navigation" className="side-nav">
        <NavLink
          href={pathFor({ view: "home" })}
          navigate={go}
          aria-current={route.view === "home" ? "page" : undefined}
        >
          <BriefcaseBusiness aria-hidden="true" />
          <span className="side-label">Vacancies</span>
        </NavLink>
        {isAdmin && (
          <NavLink
            href={pathFor({ view: "new" })}
            navigate={go}
            aria-current={route.view === "new" ? "page" : undefined}
          >
            <Plus aria-hidden="true" />
            <span className="side-label">New vacancy</span>
          </NavLink>
        )}
      </nav>
      {vacancies.length > 0 && (
        <nav aria-label="Your vacancies" className="side-roles">
          <h2>Your vacancies</h2>
          <ul>
            {vacancies.map((v) => {
              const b = v.batches.at(-1)!;
              const s = batchSummary(b);
              const current =
                route.view === "batch" && route.vacancyId === v.id;
              return (
                <li key={v.id}>
                  <NavLink
                    href={pathFor({
                      view: "batch",
                      vacancyId: v.id,
                      batchId: b.id,
                      step: defaultStep(b),
                    })}
                    navigate={go}
                    aria-current={current ? "page" : undefined}
                    className={current ? "current" : ""}
                  >
                    <ProgressRing
                      value={s.done.filter(Boolean).length / s.done.length}
                    />
                    <span className="side-label" title={v.title}>
                      {v.title}
                    </span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </>
  );
}

function AccountMenu({
  role,
  canSignOut,
  onHelp,
}: Pick<SidebarProps, "role" | "canSignOut" | "onHelp">) {
  const { theme = "system", setTheme } = useTheme();
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="account-trigger">
        <span className="workspace-avatar" aria-hidden="true">
          S
        </span>
        <span className="account-text">
          Recruiter workspace
          <small>
            {role === "administrator" ? "Administrator" : "Reviewer"}
          </small>
        </span>
        <ChevronsUpDown aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-60">
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="system">
            <Monitor aria-hidden="true" /> Match system
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="light">
            <Sun aria-hidden="true" /> Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon aria-hidden="true" /> Dark
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onHelp}>
          <CircleHelp aria-hidden="true" /> How it works
        </DropdownMenuItem>
        {canSignOut && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={async () => {
                await fetch("/api/auth", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ type: "logout" }),
                }).catch(() => undefined);
                router.replace("/login");
                router.refresh();
              }}
            >
              <LogOut aria-hidden="true" /> Sign out
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Sidebar(props: SidebarProps) {
  const [open, setOpen] = useState(false);
  const footer = (
    <div className="sidefoot">
      {props.isAdmin && (
        <NavLink
          className="side-link"
          href={pathFor({ view: "admin" })}
          navigate={(to) => {
            const moved = props.navigate(to);
            if (moved) setOpen(false);
            return moved;
          }}
          aria-current={props.route.view === "admin" ? "page" : undefined}
        >
          <Settings2 aria-hidden="true" />
          <span className="side-label">Administration</span>
        </NavLink>
      )}
      <AccountMenu {...props} />
    </div>
  );
  return (
    <>
      <aside className="sidebar" aria-label="Workspace">
        <Logo className="brand" />
        <SidebarNav {...props} />
        {footer}
      </aside>
      <header className="mobile-bar">
        <Logo className="brand" />
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger className="mobile-menu" aria-label="Open menu">
            <Menu aria-hidden="true" />
          </SheetTrigger>
          <SheetContent className="sidebar-sheet">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <SheetDescription className="sr-only">
              Vacancies, administration and account settings
            </SheetDescription>
            <Logo className="brand" />
            <SidebarNav {...props} onNavigate={() => setOpen(false)} />
            {footer}
          </SheetContent>
        </Sheet>
      </header>
    </>
  );
}
