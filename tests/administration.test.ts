import { it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
vi.mock("server-only", () => ({}));
const mock = vi.hoisted(() => ({
  owner: vi.fn(),
  pipeline: vi.fn(),
  rate: vi.fn(),
  insert: vi.fn(),
  database: vi.fn(),
}));
vi.mock("../lib/store", () => ({ owner: mock.owner }));
vi.mock("../lib/rate-limit", () => ({ rateLimit: mock.rate }));
vi.mock("../lib/supabase", () => ({
  databaseClient: mock.database,
}));
vi.mock("../lib/pipeline/coordinator", () => ({
  runPipelineCycle: mock.pipeline,
}));
import { POST } from "../app/api/administration/route";
function req(origin = "http://127.0.0.1:3217") {
  return new NextRequest("http://127.0.0.1:3217/api/administration", {
    method: "POST",
    headers: {
      origin,
      host: "127.0.0.1:3217",
      "content-type": "application/json",
    },
    body: JSON.stringify({ type: "process" }),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  mock.owner.mockResolvedValue({
    local: false,
    actor: "actor",
    workspaceId: "workspace",
    role: "administrator",
  });
  mock.pipeline.mockResolvedValue({ completed: 1, failed: 0, deletions: 0 });
  mock.insert.mockResolvedValue({ error: null });
  mock.database.mockReturnValue({ from: () => ({ insert: mock.insert }) });
});
it("administrator processing is rate bounded, audited and returns no source data", async () => {
  const response = await POST(req());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    ok: true,
    completed: 1,
    failed: 0,
    deletions: 0,
  });
  expect(mock.rate).toHaveBeenCalledWith("actor", "admin-write", 10, 60);
  expect(mock.database).toHaveBeenCalledWith(expect.any(Number));
  expect(mock.insert).toHaveBeenCalledWith({
    workspace_id: "workspace",
    actor: "actor",
    operation: "manual_processing",
    entity_id: "workspace",
    safe_metadata: { completed: 1, failed: 0, deletions: 0 },
  });
});
it("reviewer cannot start administrative processing", async () => {
  mock.owner.mockResolvedValue({ local: false, role: "reviewer" });
  expect((await POST(req())).status).toBe(403);
  expect(mock.pipeline).not.toHaveBeenCalled();
});
it("cross-origin processing cannot reach privileged worker", async () => {
  expect((await POST(req("https://example.invalid"))).status).toBe(403);
  expect(mock.pipeline).not.toHaveBeenCalled();
});
it("rate denial occurs before the queue is consumed", async () => {
  mock.rate.mockRejectedValueOnce(new Error("limited"));
  expect((await POST(req())).status).toBe(503);
  expect(mock.pipeline).not.toHaveBeenCalled();
});
it("returns a safe failure when processing and its recovery cycle fails", async () => {
  mock.pipeline.mockRejectedValueOnce(new Error("QUEUE_UNAVAILABLE"));
  const response = await POST(req());
  expect(response.status).toBe(503);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(await response.json()).toEqual({
    error: "Operation unavailable. Check configuration or reload saved state.",
  });
  expect(mock.insert).not.toHaveBeenCalled();
});

it("includes slow authorization in the processing and audit deadline", async () => {
  const started = Date.now();
  let now = started;
  const clock = vi.spyOn(Date, "now").mockImplementation(() => now);
  try {
    mock.owner.mockImplementationOnce(async () => {
      now += 50_000;
      return { local: false, actor: "actor", workspaceId: "workspace", role: "administrator" };
    });
    const response = await POST(req());
    expect(response.status).toBe(200);
    expect(mock.pipeline).toHaveBeenCalledWith(started + 220_000);
    expect(mock.database).toHaveBeenCalledWith(started + 220_000);
  } finally {
    clock.mockRestore();
  }
});
