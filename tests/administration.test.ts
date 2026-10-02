import { it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
vi.mock("server-only", () => ({}));
const mock = vi.hoisted(() => ({
  owner: vi.fn(),
  consume: vi.fn(),
  deletion: vi.fn(),
  rate: vi.fn(),
  insert: vi.fn(),
}));
vi.mock("../lib/store", () => ({ owner: mock.owner }));
vi.mock("../lib/rate-limit", () => ({ rateLimit: mock.rate }));
vi.mock("../lib/supabase", () => ({
  databaseClient: () => ({ from: () => ({ insert: mock.insert }) }),
}));
vi.mock("../lib/pipeline/consumer", () => ({ consumeDocuments: mock.consume }));
vi.mock("../lib/pipeline/deletion", () => ({
  recoverDeletions: mock.deletion,
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
  mock.consume.mockResolvedValue({ completed: 1, failed: 0 });
  mock.deletion.mockResolvedValue(0);
  mock.insert.mockResolvedValue({ error: null });
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
  expect(mock.consume).not.toHaveBeenCalled();
});
it("cross-origin processing cannot reach privileged worker", async () => {
  expect((await POST(req("https://example.invalid"))).status).toBe(403);
  expect(mock.consume).not.toHaveBeenCalled();
});
it("rate denial occurs before the queue is consumed", async () => {
  mock.rate.mockRejectedValueOnce(new Error("limited"));
  expect((await POST(req())).status).toBe(503);
  expect(mock.consume).not.toHaveBeenCalled();
});
