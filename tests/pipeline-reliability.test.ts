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
import { runPipelineCycle } from "../lib/pipeline/coordinator";
import { recoverDeletions } from "../lib/pipeline/deletion";
import {
  CONSUMER_WORK_RESERVE_MS,
  DELETION_START_RESERVE_MS,
} from "../lib/pipeline/deadline";

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

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

it("hands processing off with a guard before the deletion reserve", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-03T09:00:00Z"));
  const deadline = Date.now() + 220_000;
  const rpc = vi.fn(async () => ({ data: [], error: null }));
  mocks.databaseClient.mockReturnValue({ rpc });

  await consumeDocuments(deadline);

  expect(CONSUMER_WORK_RESERVE_MS).toBe(DELETION_START_RESERVE_MS + 25_000);
  expect(mocks.databaseClient).toHaveBeenCalledWith(
    deadline - CONSUMER_WORK_RESERVE_MS,
  );
});

it("runs real deletion recovery after slow processing reaches the guarded handoff", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-03T09:00:00Z"));
  const deadline = Date.now() + 220_000;
  const ledger = {
    workspace_id: "6c3485b3-9320-4290-a884-95735676e046",
    entity_id: "69be61bb-332f-4e9a-9663-94fb1724fc6c",
    ready_after: "2026-10-03T08:59:00.000Z",
  };
  const calls: string[] = [];
  const finish = vi.fn(async () => {
    calls.push("finish");
    return { error: null };
  });
  const remove = vi.fn(async () => {
    calls.push("remove");
    return { error: null };
  });
  const from = vi.fn((table: string) => {
    if (table === "deletion_ledger") {
      const query = {
        select: () => query,
        is: () => query,
        order: () => query,
        limit: async () => {
          // The first bounded deletion-ledger lookup consumes its full 15s.
          vi.setSystemTime(new Date(Date.now() + 15_000));
          return { data: [ledger], error: null };
        },
      };
      return query;
    }
    const query = {
      select: () => query,
      eq: () => query,
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve({
          data: [{ private_object_key: "private/cv.pdf" }],
          error: null,
        }).then(resolve),
    };
    return query;
  });
  mocks.databaseClient.mockImplementation((absoluteDeadline?: number) => {
    if (absoluteDeadline === deadline - 5_000)
      return {
        from,
        rpc: finish,
        storage: { from: () => ({ remove }) },
      };
    return {
      rpc: async (name: string) => {
        expect(name).toBe("read_document_queue");
        // Sandbox cleanup and the handoff consume five seconds after the
        // consumer cutoff. Recovery then performs its real 15-second lookup.
        // The 60-second reserve leaves 40 seconds; the old 35-second reserve
        // leaves 30 and refuses to start recovery.
        vi.setSystemTime(new Date((absoluteDeadline ?? deadline) + 5_000));
        return { data: [], error: null };
      },
    };
  });

  const result = await runPipelineCycle(deadline);

  expect(result).toEqual({ completed: 0, failed: 0, deletions: 1 });
  expect(remove).toHaveBeenCalledWith(["private/cv.pdf"]);
  expect(finish).toHaveBeenCalledWith("finish_deletion", {
    p_workspace: ledger.workspace_id,
    p_entity: ledger.entity_id,
  });
  expect(calls).toEqual(["remove", "finish"]);
});

it("leaves a deletion ledger entry eligible for the next recovery after the cutoff", async () => {
  const deadline = Date.now() + 220_000;
  const controller = new AbortController();
  vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
  const finish = vi.fn(async () => ({ error: null }));
  const remove = vi.fn(async () => {
    controller.abort();
    return { error: null };
  });
  const ledgerQuery = {
    select: () => ledgerQuery,
    is: () => ledgerQuery,
    order: () => ledgerQuery,
    limit: async () => ({
      data: [
        {
          workspace_id: "6c3485b3-9320-4290-a884-95735676e046",
          entity_id: "69be61bb-332f-4e9a-9663-94fb1724fc6c",
          ready_after: "2026-10-03T08:59:00.000Z",
        },
      ],
      error: null,
    }),
  };
  const docsQuery = {
    select: () => docsQuery,
    eq: () => docsQuery,
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve({
        data: [{ private_object_key: "private/cv.pdf" }],
        error: null,
      }).then(resolve),
  };
  mocks.databaseClient.mockReturnValue({
    from: (table: string) =>
      table === "deletion_ledger" ? ledgerQuery : docsQuery,
    rpc: finish,
    storage: { from: () => ({ remove }) },
  });

  expect(await recoverDeletions(deadline)).toBe(0);
  expect(remove).toHaveBeenCalledTimes(1);
  expect(finish).not.toHaveBeenCalled();
});

it("attempts deletion recovery when processing throws and preserves the failure", async () => {
  const recover = vi.fn(async () => 1);
  await expect(
    runPipelineCycle(Date.now() + 220_000, {
      consumeDocuments: async () => {
        throw new Error("QUEUE_UNAVAILABLE");
      },
      recoverDeletions: recover,
    }),
  ).rejects.toThrow("QUEUE_UNAVAILABLE");
  expect(recover).toHaveBeenCalledTimes(1);
});

it("leaves the queue message for redelivery when the document lookup fails", async () => {
  const rpc = vi.fn(async () => ({
    data: [
      {
        msg_id: 2,
        message: { document_id: "69be61bb-332f-4e9a-9663-94fb1724fc6c" },
      },
    ],
    error: null,
  }));
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({ data: null, error: { code: "TRANSIENT" } }),
  };
  mocks.databaseClient.mockReturnValue({ rpc, from: () => query });
  expect(await consumeDocuments(Date.now() + 220000)).toEqual({
    completed: 0,
    failed: 0,
  });
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith("read_document_queue");
});
