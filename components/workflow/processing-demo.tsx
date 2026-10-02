"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  type FileStage,
  ProcessingGlyph,
  inFlight,
  stageHelp,
  stageLabel,
} from "./processing";

// Fictional files cycling through the real stage vocabulary, so the
// processing experience can be seen and tested without the staging backend.
const files: { label: string; file: string; path: FileStage[] }[] = [
  {
    label: "Candidate 01",
    file: "fictional-a.pdf",
    path: ["queued", "reading", "ready"],
  },
  {
    label: "Candidate 02",
    file: "fictional-b.docx",
    path: ["queued", "reading", "ready"],
  },
  {
    label: "Candidate 03",
    file: "fictional-c.pdf",
    path: ["queued", "reading", "readable_copy"],
  },
  {
    label: "Candidate 04",
    file: "fictional-d.pdf",
    path: ["awaiting_upload", "queued", "reading", "ready"],
  },
];

export function ProcessingDemo() {
  const [stages, setStages] = useState<FileStage[]>(() =>
    files.map((f) => f.path.at(-1)!),
  );
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const play = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setStages(files.map((f) => f.path[0]));
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStages(files.map((f) => f.path.at(-1)!));
      return;
    }
    files.forEach((f, i) =>
      f.path
        .slice(1)
        .forEach((stage, j) =>
          timers.current.push(
            setTimeout(
              () => setStages((s) => s.map((x, k) => (k === i ? stage : x))),
              600 + i * 900 + (j + 1) * 1800,
            ),
          ),
        ),
    );
  };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const ready = stages.filter((s) => s === "ready").length;
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 sm:col-span-2 xl:col-span-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">CV processing</h3>
          <p className="text-xs text-muted-foreground">
            Fictional files. Real uploads use the same stages and copy.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={play}>
          Replay processing
        </Button>
      </div>
      <div className="batch-status">
        <div className="batch-status-text">
          <strong className="tabular-nums">
            {ready} of {files.length} ready
          </strong>
          <span>
            {stages.some(inFlight)
              ? "Processing continues even if you leave this page."
              : "1 needs attention"}
          </span>
        </div>
        <Progress
          value={(ready / files.length) * 100}
          aria-label="Demo CVs ready to review"
          aria-valuetext={`${ready} of ${files.length} ready`}
        />
      </div>
      <ul className="file-list">
        {files.map((f, i) => (
          <li key={f.label} className={`file-row stage-${stages[i]}`}>
            <div className="file-main">
              <ProcessingGlyph stage={stages[i]} />
              <div className="file-text">
                <strong className="mono">{f.label}</strong>
                <span className="file-name">{f.file}</span>
                <span className="file-stage">{stageLabel[stages[i]]}</span>
                {stageHelp(stages[i]) && (
                  <span className="file-help">{stageHelp(stages[i])}</span>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
