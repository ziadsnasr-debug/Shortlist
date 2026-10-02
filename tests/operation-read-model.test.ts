import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  pagedRows: vi.fn(),
  databaseClient: vi.fn(),
  readState: vi.fn(),
}));
vi.mock("../lib/recovery-export", () => ({ pagedRows: mocks.pagedRows }));
vi.mock("../lib/supabase", () => ({ databaseClient: mocks.databaseClient }));
vi.mock("../lib/store", () => ({ readState: mocks.readState }));

import { administration } from "../lib/administration";
import { documentsFor } from "../lib/pipeline/documents";

const access = {
  local: false,
  actor: "00000000-0000-4000-8000-000000000001",
  workspaceId: "00000000-0000-4000-8000-000000000002",
  role: "administrator" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.readState.mockResolvedValue({ version: 4 });
});

describe("operation read models", () => {
  it("scopes retained document reads and does not turn attempts into active processing", async () => {
    mocks.pagedRows.mockResolvedValue([
      {
        id: "document",
        application_key: "CV-1",
        status: "queued",
        safe_error_code: null,
        attempts: 2,
        reserved_at: "2026-10-02T12:00:00.000Z",
        deletion_state: "retained",
      },
    ]);
    mocks.databaseClient.mockReturnValue({});

    const result = await documentsFor(access);

    expect(mocks.pagedRows).toHaveBeenCalledWith(
      {},
      "documents",
      { workspace_id: access.workspaceId, deletion_state: "retained" },
      "id",
      expect.stringContaining("reserved_at"),
    );
    expect(result.documents[0]).toMatchObject({
      stage: "queued",
      attempts: 2,
      reservation_age_seconds: expect.any(Number),
    });
  });

  it("projects safe attention and ready_after without presenting a deadline", async () => {
    const workspaceQuery = {
      select: () => workspaceQuery,
      eq: () => workspaceQuery,
      single: vi.fn().mockResolvedValue({
        data: {
          settings: { paused: false, retentionDays: null, incidentOwner: "" },
        },
        error: null,
      }),
    };
    mocks.databaseClient.mockReturnValue({
      from: () => workspaceQuery,
    });
    mocks.pagedRows
      .mockResolvedValueOnce([{ user_id: "user", role: "administrator", active: true }])
      .mockResolvedValueOnce([
        {
          id: "document",
          application_key: "CV-1",
          status: "readable_copy",
          safe_error_code: "NEEDS_READABLE_COPY",
          attempts: 3,
          reserved_at: "2026-10-02T12:00:00.000Z",
          deletion_state: "retained",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "deletion",
          entity_id: "application",
          ready_after: "2026-10-02T14:10:00.000Z",
          completed_at: null,
        },
      ]);

    const result = await administration(access);

    expect(result.documents[0]).toMatchObject({
      stage: "needs_readable_copy",
      safe_error_message: "Needs a checked readable copy.",
    });
    expect(result.processing).toMatchObject({
      total: 1,
      attention: 1,
      ready: 0,
      queued_or_processing: 0,
    });
    expect(result.deletions[0].ready_after).toBe("2026-10-02T14:10:00.000Z");
    expect(mocks.pagedRows.mock.calls[1][2]).toEqual({
      workspace_id: access.workspaceId,
      deletion_state: "retained",
    });
    expect(mocks.pagedRows.mock.calls[2][4]).toContain("ready_after");
  });
});
