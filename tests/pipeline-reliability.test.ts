import { afterEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  databaseClient: vi.fn(),
  parse: vi.fn(),
  assess: vi.fn(),
}));
vi.mock("../lib/supabase", () => ({ databaseClient: mocks.databaseClient }));
vi.mock("../lib/pipeline/sandbox", () => ({ parseInSandbox: mocks.parse }));
vi.mock("../lib/pipeline/ai", () => ({ assess: mocks.assess }));
import { consumeDocuments } from "../lib/pipeline/consumer";

afterEach(() => vi.clearAllMocks());

it("does not reserve an attempt or inference budget for a manual source that superseded queued work", async () => {
  const document = {
    id: "69be61bb-332f-4e9a-9663-94fb1724fc6c",
    workspace_id: "6c3485b3-9320-4290-a884-95735676e046",
    vacancy_key: "vacancy",
    batch_key: "batch",
    application_key: "application",
    status: "queued",
    deletion_state: "retained",
  };
  const payload = {
    vacancies: [
      {
        id: "vacancy",
        batches: [
          {
            id: "batch",
            closed: false,
            applications: [{ id: "application", state: "ready" }],
          },
        ],
      },
    ],
  };
  const rpc = vi.fn(async (name: string) => {
    if (name === "read_document_queue")
      return {
        data: [{ msg_id: 1, message: { document_id: document.id } }],
        error: null,
      };
    if (name === "ack_document_queue") return { data: true, error: null };
    throw new Error(`Unexpected RPC: ${name}`);
  });
  const from = vi.fn((table: string) => {
    const result = table === "documents" ? document : { payload };
    const query = {
      select: () => query,
      eq: () => query,
      maybeSingle: async () => ({ data: result, error: null }),
      single: async () => ({ data: result, error: null }),
    };
    return query;
  });
  mocks.databaseClient.mockReturnValue({ rpc, from });
  expect(await consumeDocuments(Date.now() + 220000)).toEqual({
    completed: 0,
    failed: 0,
  });
  expect(rpc.mock.calls.map(([name]) => name)).toEqual([
    "read_document_queue",
    "ack_document_queue",
  ]);
  expect(mocks.parse).not.toHaveBeenCalled();
  expect(mocks.assess).not.toHaveBeenCalled();
});

it("does not claim queue work when insufficient invocation time remains", async () => {
  expect(await consumeDocuments(Date.now() + 1000)).toEqual({
    completed: 0,
    failed: 0,
  });
  expect(mocks.databaseClient).not.toHaveBeenCalled();
});

it("leaves the queue message for redelivery when the document lookup fails", async () => {
  const rpc = vi.fn(async () => ({
    data: [{ msg_id: 2, message: { document_id: "69be61bb-332f-4e9a-9663-94fb1724fc6c" } }],
    error: null,
  }));
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({ data: null, error: { code: "TRANSIENT" } }),
  };
  mocks.databaseClient.mockReturnValue({ rpc, from: () => query });
  expect(await consumeDocuments(Date.now() + 220000)).toEqual({ completed: 0, failed: 0 });
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith("read_document_queue");
});
