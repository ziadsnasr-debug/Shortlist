import { describe, expect, it } from "vitest";
import {
  fileStage,
  inFlight,
  needsAttention,
  stageHelp,
} from "@/components/workflow/processing";

const doc = (status: string, attempts = 0) => ({
  id: "d1",
  application_key: "a1",
  status,
  attempts,
});

describe("file stages", () => {
  it("follows the application before the document", () => {
    expect(fileStage({ state: "ready", confirmed: false })).toBe("ready");
    expect(fileStage({ state: "ready", confirmed: true })).toBe("reviewed");
    expect(fileStage({ state: "disposed", confirmed: false })).toBe("disposed");
    expect(
      fileStage({ state: "ready", confirmed: false }, doc("queued", 2)),
    ).toBe("ready");
  });

  it("distinguishes only the stages the queue reports", () => {
    const processing = { state: "processing" as const, confirmed: false };
    expect(fileStage(processing, doc("reserved"))).toBe("awaiting_upload");
    expect(fileStage(processing, doc("queued", 0))).toBe("queued");
    expect(fileStage(processing, doc("queued", 1))).toBe("queued");
    expect(fileStage(processing)).toBe("queued");
    expect(fileStage(processing, doc("processing", 1))).toBe("reading");
  });

  it("surfaces problems from either record", () => {
    const processing = { state: "processing" as const, confirmed: false };
    expect(fileStage(processing, doc("readable_copy", 1))).toBe(
      "readable_copy",
    );
    expect(fileStage(processing, doc("attention", 3))).toBe("attention");
    expect(fileStage({ state: "attention", confirmed: false })).toBe(
      "attention",
    );
  });

  it("groups stages for polling and pinning", () => {
    expect(
      ["awaiting_upload", "queued", "reading"].every((s) => inFlight(s as never)),
    ).toBe(true);
    expect(inFlight("ready")).toBe(false);
    expect(needsAttention("readable_copy")).toBe(true);
    expect(needsAttention("reading")).toBe(false);
  });

  it("explains every problem with a next step and never implies a score", () => {
    expect(stageHelp("readable_copy")).toMatch(/text-based copy/);
    expect(stageHelp("attention", "BUDGET_EXHAUSTED")).toMatch(/administrator/);
    expect(stageHelp("attention")).toMatch(/never counts as zero points/);
    expect(stageHelp("ready")).toBeNull();
  });
});
