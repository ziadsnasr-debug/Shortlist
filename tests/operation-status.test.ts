import { describe, expect, it } from "vitest";
import {
  ageSeconds,
  documentStage,
  formatAge,
  operationSummary,
  safeErrorMessage,
} from "../lib/operation-status";

const base = {
  attempts: 0,
  reserved_at: "2026-10-02T12:00:00.000Z",
  safe_error_code: null,
  deletion_state: "retained",
};

describe("operation status", () => {
  it("keeps reservation and queue states honest", () => {
    expect(documentStage({ ...base, status: "reserved" })).toBe("awaiting_upload");
    expect(documentStage({ ...base, status: "queued", attempts: 2 })).toBe(
      "queued",
    );
    expect(documentStage({ ...base, status: "processing", attempts: 1 })).toBe(
      "processing",
    );
    expect(documentStage({ ...base, status: "complete" })).toBe("ready");
    expect(documentStage({ ...base, status: "readable_copy" })).toBe(
      "needs_readable_copy",
    );
  });

  it("summarises retained operations and hides deleted rows from counts", () => {
    expect(
      operationSummary([
        { ...base, status: "reserved" },
        { ...base, status: "queued" },
        { ...base, status: "processing" },
        { ...base, status: "complete" },
        { ...base, status: "readable_copy" },
        { ...base, status: "attention" },
        { ...base, status: "deleted", deletion_state: "pending" },
      ]),
    ).toEqual({
      total: 7,
      awaiting_upload: 1,
      queued_or_processing: 2,
      ready: 1,
      attention: 2,
    });
  });

  it("returns safe error wording without exposing provider details", () => {
    expect(safeErrorMessage("NEEDS_READABLE_COPY")).toBe(
      "Needs a checked readable copy.",
    );
    expect(safeErrorMessage("provider-secret")).toBe(
      "Processing needs attention.",
    );
    expect(safeErrorMessage(null)).toBeNull();
  });

  it("calculates reservation age and handles invalid timestamps", () => {
    expect(ageSeconds("2026-10-02T12:00:00.000Z", Date.parse("2026-10-02T12:01:05.000Z"))).toBe(65);
    expect(formatAge(65)).toBe("1m");
    expect(ageSeconds("invalid")).toBeNull();
    expect(formatAge(null)).toBe("Age unavailable");
  });
});
