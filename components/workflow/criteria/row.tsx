"use client";
import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Copy,
  Ellipsis,
  Lightbulb,
  Minus,
  Plus,
  Sparkles,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { m } from "motion/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusChip } from "@/components/ui/status-chip";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { CriterionHint } from "@/lib/criteria-lint";
import { type Criterion } from "@/lib/workflow";
import { enterTransition, exitTransition, layoutSpring } from "./motion";
import { issues } from "./model";

const readOnlyField =
  "read-only:border-transparent read-only:bg-transparent read-only:px-0 read-only:hover:border-transparent";

function PointsStepper({
  label,
  points,
  editable,
  disabled,
  onChange,
  onRepeat,
}: {
  label: string;
  points: number;
  editable: boolean;
  disabled: boolean;
  onChange: (points: number) => void;
  onRepeat: () => void;
}) {
  // While typing, the field may be empty or out of range. Only valid whole
  // numbers reach the rubric; the field snaps back to the real value on blur.
  const [draft, setDraft] = useState<string | null>(null);
  const step = (delta: number) => {
    setDraft(null);
    onChange(Math.min(100, Math.max(1, points + delta)));
  };
  const repeatGuard = (e: React.KeyboardEvent) => {
    if (e.repeat) onRepeat();
  };
  return (
    <div
      role="group"
      aria-label={`Points for ${label}`}
      className="flex items-center gap-1"
    >
      {editable && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-8 max-[680px]:size-11"
          aria-label={`Decrease points for ${label}`}
          disabled={disabled || points <= 1}
          onClick={() => step(-1)}
          onKeyDown={repeatGuard}
        >
          <Minus aria-hidden="true" />
        </Button>
      )}
      <Input
        type="number"
        inputMode="numeric"
        min={1}
        max={100}
        step={1}
        aria-label="Points"
        className={`h-8 w-14 px-1 max-[680px]:h-11 text-center tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${readOnlyField}`}
        value={draft ?? String(points)}
        readOnly={!editable}
        disabled={disabled}
        onChange={(e) => {
          setDraft(e.target.value);
          const n = Number(e.target.value);
          if (
            e.target.value !== "" &&
            Number.isInteger(n) &&
            n >= 1 &&
            n <= 100
          )
            onChange(n);
        }}
        onBlur={() => setDraft(null)}
        onKeyDown={repeatGuard}
      />
      {editable && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-8 max-[680px]:size-11"
          aria-label={`Increase points for ${label}`}
          disabled={disabled || points >= 100}
          onClick={() => step(1)}
          onKeyDown={repeatGuard}
        >
          <Plus aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}

export type RowProps = {
  criterion: Criterion;
  hints: CriterionHint[];
  editable: boolean;
  busy: boolean;
  expanded: boolean;
  aiDraft: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canDuplicate: boolean;
  sections: string[];
  animateIn: boolean;
  enterDelay: number;
  instant: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<Criterion>) => void;
  onMove: (direction: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onRepeat: () => void;
  onMenuClose: (event: Event) => void;
};

export function CriterionRow({
  criterion: c,
  hints,
  editable,
  busy,
  expanded,
  aiDraft,
  canMoveUp,
  canMoveDown,
  canDuplicate,
  sections,
  animateIn,
  enterDelay,
  instant,
  onToggle,
  onChange,
  onMove,
  onDuplicate,
  onRemove,
  onRepeat,
  onMenuClose,
}: RowProps) {
  const [sectionDraft, setSectionDraft] = useState<string | null>(null);
  const problems = issues(c);
  const label = c.title.trim() || "new criterion";
  const lock = busy;
  const detailsId = `definitions-${c.id}`;
  const hintsId = `hints-${c.id}`;
  const showHints = editable && hints.length > 0;
  const commitSection = () => {
    if (sectionDraft !== null && sectionDraft.trim() !== c.section.trim())
      onChange({ section: sectionDraft.trim() });
    setSectionDraft(null);
  };
  return (
    <m.li
      layout={instant ? false : "position"}
      initial={animateIn ? { opacity: 0, y: 6 } : false}
      animate={{
        opacity: 1,
        y: 0,
        transition: { ...enterTransition, delay: enterDelay },
      }}
      exit={{ opacity: 0, y: -4, transition: exitTransition }}
      transition={{ layout: layoutSpring }}
      className="px-3 py-3 sm:px-4"
    >
      <div role="group" aria-label={c.title.trim() || "New criterion"}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="min-w-0 flex-[1_1_15rem]">
            <Input
              id={`criterion-title-${c.id}`}
              aria-label="Requirement"
              placeholder="Requirement, for example Customer onboarding"
              className={`h-9 scroll-mt-28 ${readOnlyField}`}
              value={c.title}
              maxLength={200}
              readOnly={!editable}
              disabled={lock}
              aria-describedby={showHints ? hintsId : undefined}
              onChange={(e) => onChange({ title: e.target.value })}
            />
          </div>
          <PointsStepper
            label={label}
            points={c.points}
            editable={editable}
            disabled={lock}
            onChange={(points) => onChange({ points })}
            onRepeat={onRepeat}
          />
          <div className="flex items-center gap-2">
            <Switch
              id={`essential-${c.id}`}
              className="min-h-0"
              checked={c.essential}
              disabled={!editable || lock}
              onCheckedChange={(essential) => onChange({ essential })}
            />
            <Label htmlFor={`essential-${c.id}`} className="text-sm">
              Essential
            </Label>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-mx-1"
            aria-expanded={expanded}
            aria-controls={detailsId}
            onClick={onToggle}
          >
            Evidence definitions
            <ChevronDown
              aria-hidden="true"
              className={`transition-transform duration-(--dur-fast) ease-(--ease-out) motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`}
            />
          </Button>
          {editable && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 max-[680px]:size-11"
                  aria-label={`More actions for ${c.title.trim() || "criterion"}`}
                  disabled={lock}
                >
                  <Ellipsis aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onCloseAutoFocus={onMenuClose}>
                <DropdownMenuItem
                  disabled={!canMoveUp}
                  onSelect={() => onMove(-1)}
                >
                  <ArrowUp aria-hidden="true" /> Move up
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!canMoveDown}
                  onSelect={() => onMove(1)}
                >
                  <ArrowDown aria-hidden="true" /> Move down
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!canDuplicate}
                  onSelect={onDuplicate}
                >
                  <Copy aria-hidden="true" /> Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem destructive onSelect={onRemove}>
                  <Trash2 aria-hidden="true" /> Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {(aiDraft || problems.title || problems.definitions) && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {aiDraft && (
              <StatusChip tone="accent" icon={<Sparkles />}>
                AI draft · edit freely
              </StatusChip>
            )}
            {problems.title && editable && (
              <StatusChip tone="warning" icon={<TriangleAlert />}>
                Needs a requirement
              </StatusChip>
            )}
            {problems.definitions && editable && (
              <StatusChip tone="warning" icon={<TriangleAlert />}>
                Needs definitions
              </StatusChip>
            )}
          </div>
        )}
        {showHints && (
          <ul
            id={hintsId}
            className="mt-2 grid gap-1 text-sm text-muted-foreground"
          >
            {hints.map((hint) => (
              <li key={hint.code} className="flex items-start gap-2">
                <Lightbulb
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0"
                />
                <span>{hint.message}</span>
              </li>
            ))}
          </ul>
        )}
        {expanded && (
          <p className="mt-3 text-sm text-muted-foreground">
            Essential criteria need full evidence. Partial or missing evidence
            needs a written exception at shortlist.
          </p>
        )}
        {expanded && (
          <m.div
            id={detailsId}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0, transition: enterTransition }}
            className="mt-3 grid gap-4 sm:grid-cols-2"
          >
            <div className="grid gap-1.5">
              <Label htmlFor={`full-${c.id}`}>Full evidence</Label>
              <Textarea
                id={`full-${c.id}`}
                value={c.full}
                maxLength={1000}
                readOnly={!editable}
                disabled={lock}
                aria-describedby={showHints ? hintsId : undefined}
                placeholder="What the CV shows when this is fully met, for example “Owned a portfolio of customer accounts”"
                onChange={(e) => onChange({ full: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`partial-${c.id}`}>Partial evidence</Label>
              <Textarea
                id={`partial-${c.id}`}
                value={c.partial}
                maxLength={1000}
                readOnly={!editable}
                disabled={lock}
                aria-describedby={showHints ? hintsId : undefined}
                placeholder="Some evidence, but short of full, for example “Supported accounts owned by someone else”. Anything less is not evidenced."
                onChange={(e) => onChange({ partial: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5 sm:col-span-2 sm:max-w-xs">
              <Label htmlFor={`section-${c.id}`}>Section</Label>
              <Input
                id={`section-${c.id}`}
                list={`sections-${c.id}`}
                value={sectionDraft ?? c.section}
                maxLength={80}
                readOnly={!editable}
                disabled={lock}
                onChange={(e) => setSectionDraft(e.target.value)}
                onBlur={commitSection}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitSection();
                }}
              />
              <datalist id={`sections-${c.id}`}>
                {sections.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
          </m.div>
        )}
      </div>
    </m.li>
  );
}
