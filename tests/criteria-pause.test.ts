import { expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({
  owner: vi.fn(),
  state: vi.fn(),
  status: vi.fn(),
  rpc: vi.fn(),
  draft: vi.fn(),
}));
vi.mock("../lib/store", () => ({ owner: m.owner, readState: m.state }));
vi.mock("../lib/rate-limit", () => ({ rateLimit: vi.fn() }));
vi.mock("../lib/pipeline/ai", () => ({ draftCriteria: m.draft }));
vi.mock("../lib/supabase", () => ({
  databaseClient: () => ({
    rpc: m.rpc,
    from: () => ({ select: () => ({ eq: () => ({ single: m.status }) }) }),
  }),
}));
import { POST } from "../app/api/criteria/route";
function request() {
  return new NextRequest("http://127.0.0.1:3217/api/criteria", {
    method: "POST",
    headers: {
      origin: "http://127.0.0.1:3217",
      host: "127.0.0.1:3217",
      "content-type": "application/json",
    },
    body: JSON.stringify({ vacancyId: "v", synthetic: true }),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  m.owner.mockResolvedValue({
    local: false,
    role: "administrator",
    actor: "a",
    workspaceId: "w",
  });
  m.state.mockResolvedValue({
    vacancies: [{ id: "v", description: "Fictional role" }],
  });
  m.status.mockResolvedValue({
    data: { settings: { paused: false } },
    error: null,
  });
  m.rpc.mockResolvedValue({ error: null });
  m.draft.mockResolvedValue([]);
});
it("pause prevents provider execution and quota charge", async () => {
  m.status.mockResolvedValue({
    data: { settings: { paused: true } },
    error: null,
  });
  expect((await POST(request())).status).toBe(409);
  expect(m.rpc).not.toHaveBeenCalled();
  expect(m.draft).not.toHaveBeenCalled();
});
it("a pause between budget and inference prevents the provider request", async () => {
  m.status
    .mockResolvedValueOnce({
      data: { settings: { paused: false } },
      error: null,
    })
    .mockResolvedValueOnce({
      data: { settings: { paused: true } },
      error: null,
    });
  expect((await POST(request())).status).toBe(409);
  expect(m.draft).not.toHaveBeenCalled();
});
it("unknown processing status fails closed", async () => {
  m.status.mockResolvedValue({ data: null, error: {} });
  expect((await POST(request())).status).toBe(503);
  expect(m.draft).not.toHaveBeenCalled();
});
it("approved synthetic drafting stays unpublished", async () => {
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ rubric: [], published: false });
  expect(m.draft).toHaveBeenCalledOnce();
});
