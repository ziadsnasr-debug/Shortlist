"use client";

import * as React from "react";
import { ProcessingDemo } from "@/components/workflow/processing-demo";
import {
  AlertCircle,
  CheckCircle2,
  CircleDashed,
  Download,
  MoreHorizontal,
  Plus,
  TriangleAlert,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip } from "@/components/ui/status-chip";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <h2 id={id} className="text-xl font-semibold tracking-tight">
        {title}
      </h2>
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

function Cell({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
      <h3 className="text-xs font-medium text-muted-foreground">{label}</h3>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

const SAMPLE_ROWS = [
  { id: "C-101", name: "Candidate 101", score: 82, status: "Reviewed" },
  { id: "C-102", name: "Candidate 102", score: 74, status: "Needs review" },
  { id: "C-103", name: "Candidate 103", score: 61, status: "Reviewed" },
];

export function DesignGallery() {
  const [segment, setSegment] = React.useState("list");
  const [notify, setNotify] = React.useState(true);
  const [flagged, setFlagged] = React.useState(false);
  const [sort, setSort] = React.useState("score");
  const [progress, setProgress] = React.useState(40);

  return (
    <TooltipProvider>
      <main
        id="main"
        className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-10 sm:px-6"
      >
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Design gallery
          </h1>
          <p className="max-w-prose text-sm text-muted-foreground">
            Every UI primitive in each state, using fictional content. Available
            only in local synthetic development.
          </p>
        </header>

        <Section id="g-processing" title="Processing">
          <ProcessingDemo />
        </Section>
        <Section id="g-button" title="Button">
          <Cell
            label="Default"
            hint="Hover, press and focus with the keyboard."
          >
            <Button>Save draft</Button>
            <Button size="sm">Small</Button>
            <Button size="lg">Large</Button>
            <Button size="icon" aria-label="Add item">
              <Plus />
            </Button>
          </Cell>
          <Cell label="Secondary and outline">
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
          </Cell>
          <Cell label="Ghost and link">
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link style</Button>
          </Cell>
          <Cell label="Destructive (error)">
            <Button variant="destructive">Delete vacancy</Button>
          </Cell>
          <Cell label="Disabled">
            <Button disabled>Publish criteria</Button>
            <Button variant="outline" disabled>
              Disabled outline
            </Button>
          </Cell>
          <Cell
            label="Loading"
            hint="Width stays fixed while the spinner shows."
          >
            <Button loading>Saving review</Button>
            <Button variant="outline" loading>
              Exporting
            </Button>
          </Cell>
          <Cell label="With icon">
            <Button variant="outline">
              <Download /> Export CSV
            </Button>
          </Cell>
          <Cell label="As child (link)">
            <Button asChild variant="secondary">
              <a href="#g-button">Jump to buttons</a>
            </Button>
          </Cell>
        </Section>

        <Section id="g-badge" title="Badge and status chip">
          <Cell label="Badge variants">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="destructive">Destructive</Badge>
          </Cell>
          <Cell label="Status chip tones" hint="Icon and label always render.">
            <StatusChip tone="neutral" icon={<CircleDashed />}>
              Not started
            </StatusChip>
            <StatusChip tone="accent" icon={<Plus />}>
              In review
            </StatusChip>
            <StatusChip tone="success" icon={<CheckCircle2 />}>
              Published
            </StatusChip>
            <StatusChip tone="warning" icon={<TriangleAlert />}>
              Needs judgement
            </StatusChip>
            <StatusChip tone="danger" icon={<AlertCircle />}>
              Failed to parse
            </StatusChip>
          </Cell>
        </Section>

        <Section id="g-forms" title="Form controls">
          <Cell label="Input: default">
            <div className="flex w-full flex-col gap-1.5">
              <Label htmlFor="g-input-default">Vacancy title</Label>
              <Input
                id="g-input-default"
                defaultValue="Customer success lead"
              />
            </div>
          </Cell>
          <Cell label="Input: disabled">
            <div className="flex w-full flex-col gap-1.5">
              <Label htmlFor="g-input-disabled">Locked field</Label>
              <Input id="g-input-disabled" defaultValue="Read only" disabled />
            </div>
          </Cell>
          <Cell label="Input: error">
            <div className="flex w-full flex-col gap-1.5">
              <Label htmlFor="g-input-error">Points</Label>
              <Input
                id="g-input-error"
                defaultValue="120"
                aria-invalid="true"
                aria-describedby="g-input-error-msg"
              />
              <p id="g-input-error-msg" className="text-xs text-destructive">
                Points must add up to 100.
              </p>
            </div>
          </Cell>
          <Cell label="Textarea">
            <div className="flex w-full flex-col gap-1.5">
              <Label htmlFor="g-textarea">Reviewer note</Label>
              <Textarea
                id="g-textarea"
                defaultValue="Strong evidence in section 2."
              />
            </div>
          </Cell>
          <Cell label="Checkbox: unchecked, checked, disabled">
            <div className="flex items-center gap-2">
              <Checkbox id="g-cb-1" />
              <Label htmlFor="g-cb-1">Include</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="g-cb-2" defaultChecked />
              <Label htmlFor="g-cb-2">Selected</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="g-cb-3" disabled />
              <Label htmlFor="g-cb-3">Disabled</Label>
            </div>
          </Cell>
          <Cell label="Switch: off, on, disabled">
            <div className="flex items-center gap-2">
              <Switch
                id="g-sw-1"
                checked={notify}
                onCheckedChange={setNotify}
              />
              <Label htmlFor="g-sw-1">
                Notify me ({notify ? "on" : "off"})
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="g-sw-2"
                checked={flagged}
                onCheckedChange={setFlagged}
              />
              <Label htmlFor="g-sw-2">
                Flag ties ({flagged ? "on" : "off"})
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="g-sw-3" disabled />
              <Label htmlFor="g-sw-3">Disabled</Label>
            </div>
          </Cell>
          <Cell label="Select: default and selected">
            <div className="flex w-full flex-col gap-1.5">
              <Label id="g-select-label">Sort candidates by</Label>
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger aria-labelledby="g-select-label">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="score">Score</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="date">Date added</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Cell>
          <Cell label="Select: placeholder, disabled, error">
            <Select>
              <SelectTrigger aria-label="Choose stage (placeholder)">
                <SelectValue placeholder="Choose stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="intake">Intake</SelectItem>
                <SelectItem value="review">Review</SelectItem>
              </SelectContent>
            </Select>
            <Select disabled>
              <SelectTrigger aria-label="Stage (disabled)">
                <SelectValue placeholder="Disabled" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="intake">Intake</SelectItem>
              </SelectContent>
            </Select>
            <Select>
              <SelectTrigger aria-label="Stage (error)" aria-invalid="true">
                <SelectValue placeholder="Required" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="intake">Intake</SelectItem>
              </SelectContent>
            </Select>
          </Cell>
          <Cell label="Segmented control (toggle group)">
            <ToggleGroup
              type="single"
              value={segment}
              onValueChange={(v) => v && setSegment(v)}
              aria-label="View mode"
            >
              <ToggleGroupItem value="list">List</ToggleGroupItem>
              <ToggleGroupItem value="grid">Grid</ToggleGroupItem>
              <ToggleGroupItem value="table">Table</ToggleGroupItem>
              <ToggleGroupItem value="disabled" disabled>
                Disabled
              </ToggleGroupItem>
            </ToggleGroup>
          </Cell>
        </Section>

        <Section id="g-nav" title="Navigation and overlays">
          <Cell label="Tabs: selected, default, disabled">
            <Tabs defaultValue="criteria" className="w-full">
              <TabsList aria-label="Vacancy sections">
                <TabsTrigger value="criteria">Criteria</TabsTrigger>
                <TabsTrigger value="cvs">CVs</TabsTrigger>
                <TabsTrigger value="export" disabled>
                  Export
                </TabsTrigger>
              </TabsList>
              <TabsContent value="criteria">
                <p className="text-sm text-muted-foreground">
                  Criteria content for a fictional vacancy.
                </p>
              </TabsContent>
              <TabsContent value="cvs">
                <p className="text-sm text-muted-foreground">Sample CV list.</p>
              </TabsContent>
            </Tabs>
          </Cell>
          <Cell
            label="Tooltip"
            hint="Hover or focus the button; opens after 300ms."
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline">Hover for hint</Button>
              </TooltipTrigger>
              <TooltipContent>Scores update when you confirm.</TooltipContent>
            </Tooltip>
          </Cell>
          <Cell label="Popover">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">Open popover</Button>
              </PopoverTrigger>
              <PopoverContent>
                <p className="text-sm">
                  Scales from the trigger. Press Escape to close.
                </p>
              </PopoverContent>
            </Popover>
          </Cell>
          <Cell label="Dropdown menu">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="More actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Candidate 101</DropdownMenuLabel>
                <DropdownMenuItem>
                  Open review <DropdownMenuShortcut>R</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuCheckboxItem
                  checked={flagged}
                  onCheckedChange={setFlagged}
                >
                  Flag for tie-break
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={sort} onValueChange={setSort}>
                  <DropdownMenuRadioItem value="score">
                    Sort by score
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="name">
                    Sort by name
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive>Remove</DropdownMenuItem>
                <DropdownMenuItem disabled>Disabled action</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </Cell>
          <Cell label="Dialog">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Open dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Publish criteria?</DialogTitle>
                  <DialogDescription>
                    Publishing locks the weights for this fictional vacancy.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button>Publish</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Cell>
          <Cell
            label="Sheet"
            hint="Slides from the right; Escape closes and focus returns here."
          >
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline">Open sheet</Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Candidate 101</SheetTitle>
                  <SheetDescription>
                    Evidence summary for a fictional candidate.
                  </SheetDescription>
                </SheetHeader>
                <p className="text-sm text-muted-foreground">
                  Sheet body content goes here.
                </p>
                <SheetFooter>
                  <Button>Confirm</Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </Cell>
        </Section>

        <Section id="g-feedback" title="Feedback and layout">
          <Cell label="Progress">
            <div className="flex w-full flex-col gap-2">
              <Progress
                value={progress}
                aria-label="Fictional upload progress"
              />
              <div className="flex items-center justify-between text-xs tabular-nums text-muted-foreground">
                <span>{progress}% complete</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setProgress((p) => (p >= 100 ? 0 : p + 20))}
                >
                  Advance
                </Button>
              </div>
            </div>
          </Cell>
          <Cell label="Skeleton (static tint)">
            <div className="flex w-full flex-col gap-2" aria-busy="true">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </Cell>
          <Cell label="Kbd">
            <span className="flex items-center gap-1 text-sm">
              Next CV <Kbd>J</Kbd>
            </span>
            <span className="flex items-center gap-1 text-sm">
              Palette <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </span>
          </Cell>
          <Cell label="Alert: default and destructive">
            <Alert className="w-full">
              <AlertTitle>Heads up</AlertTitle>
              <AlertDescription>
                Five sample CVs are waiting for review.
              </AlertDescription>
            </Alert>
            <Alert variant="destructive" className="w-full">
              <AlertTitle>Could not parse</AlertTitle>
              <AlertDescription>
                Sample file C-104 has no readable text.
              </AlertDescription>
            </Alert>
          </Cell>
          <Cell label="Separator">
            <div className="flex w-full flex-col gap-2 text-sm">
              <span>Above</span>
              <Separator />
              <span>Below</span>
            </div>
          </Cell>
          <Cell label="Scroll area">
            <ScrollArea className="h-28 w-full rounded-md border border-border">
              <ul className="flex flex-col gap-1 p-3 text-sm">
                {Array.from({ length: 12 }, (_, i) => (
                  <li key={i}>
                    <a
                      className="underline underline-offset-4"
                      href="#g-feedback"
                    >
                      Fictional item {i + 1}
                    </a>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </Cell>
        </Section>

        <section aria-labelledby="g-table" className="flex flex-col gap-4">
          <h2 id="g-table" className="text-xl font-semibold tracking-tight">
            Table
          </h2>
          <div className="rounded-lg border border-border bg-card p-2">
            <Table>
              <TableCaption>
                Sample ranking of fictional candidates.
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SAMPLE_ROWS.map((row, i) => (
                  <TableRow
                    key={row.id}
                    data-state={i === 0 ? "selected" : undefined}
                  >
                    <TableCell className="font-mono text-xs">
                      {row.name}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.score}
                    </TableCell>
                    <TableCell>
                      <StatusChip
                        tone={row.status === "Reviewed" ? "success" : "warning"}
                        icon={
                          row.status === "Reviewed" ? (
                            <CheckCircle2 />
                          ) : (
                            <TriangleAlert />
                          )
                        }
                      >
                        {row.status}
                      </StatusChip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      </main>
    </TooltipProvider>
  );
}
