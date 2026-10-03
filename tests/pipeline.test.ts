import { it, expect, vi, afterEach } from "vitest";
import { Readable } from "node:stream";
vi.mock("server-only", () => ({}));
const mock = vi.hoisted(() => ({ generate: vi.fn(), create: vi.fn() }));
vi.mock("ai", () => ({
  generateText: mock.generate,
  Output: { object: (input: unknown) => input },
}));
vi.mock("@vercel/sandbox", () => ({ Sandbox: { create: mock.create } }));
import { assess, draftCriteria } from "../lib/pipeline/ai";
import { parseInSandbox } from "../lib/pipeline/sandbox";
import { sampleRubric, samples } from "../fixtures/synthetic/seed";
import { hash } from "../lib/pipeline/contracts";
const original = { ...process.env };
afterEach(() => {
  process.env = { ...original };
  vi.clearAllMocks();
});
function enable() {
  process.env.AI_ENABLED = "true";
  process.env.OPENAI_API_KEY = "synthetic-placeholder";
  process.env.AI_MODEL_ID = "gpt-6-luna";
}
const app = () => samples(sampleRubric, 1)[0];
it("performs exactly two fresh bounded calls with no tools, scores, other CVs or pass leakage", async () => {
  enable();
  const a = app();
  const output = {
    criteria: sampleRubric.map((c) => ({
      criterion_id: c.id,
      category: "PARTIAL",
      evidence_ids: [a.blocks[0].id],
      rationale: "The source describes supporting responsibilities.",
    })),
  };
  mock.generate.mockResolvedValue({
    output,
    usage: { inputTokens: 10, outputTokens: 10 },
  });
  const result = await assess(a, sampleRubric);
  expect(mock.generate).toHaveBeenCalledTimes(2);
  const [first, second] = mock.generate.mock.calls.map((c) => c[0]);
  expect(first.prompt).toBe(second.prompt);
  expect(first).not.toHaveProperty("tools");
  expect(first).not.toHaveProperty("messages");
  expect(first.maxRetries).toBe(0);
  expect(first.providerOptions.openai).toEqual({
    store: false,
    reasoningEffort: "low",
    strictJsonSchema: true,
  });
  expect(first.experimental_telemetry.isEnabled).toBe(false);
  expect(first.prompt).not.toContain("Morgan Ellis");
  expect(result.assessments[sampleRubric[0].id].category).toBe("PARTIAL");
  expect(result).not.toHaveProperty("score");
});
it("sends only the approved criteria definitions and the vacancy title", async () => {
  enable();
  const a = app();
  mock.generate.mockResolvedValue({ output: { criteria: [] }, usage: {} });
  const rubric = sampleRubric.map((c, i) => {
    if (i === 0) return { ...c, equivalents: "Ran a customer community" };
    if (i === 1) return { ...c, equivalents: undefined };
    return c;
  });
  await assess(a, rubric, undefined, undefined, "Customer success manager");
  const [first, second] = mock.generate.mock.calls.map((c) => c[0]);
  expect(first.prompt).toBe(second.prompt);
  const sent = JSON.parse(first.prompt);
  expect(sent.vacancyTitle).toBe("Customer success manager");
  expect(Object.keys(sent).sort()).toEqual([
    "approvedCriteria",
    "untrustedSource",
    "vacancyTitle",
  ]);
  expect(sent.approvedCriteria[0]).toEqual({
    id: rubric[0].id,
    section: rubric[0].section,
    title: rubric[0].title,
    full: rubric[0].full,
    partial: rubric[0].partial,
    equivalents: "Ran a customer community",
  });
  expect(sent.approvedCriteria[1]).not.toHaveProperty("equivalents");
  expect(first.prompt).not.toContain("essential");
  expect(first.prompt).not.toContain("points");
  expect(first.prompt).not.toContain("Morgan Ellis");
  expect(first.system).toContain("untrusted data");
});
it("hostile model output and a failed second call remain unresolved", async () => {
  enable();
  mock.generate
    .mockResolvedValueOnce({
      output: { criteria: [], score: 100, command: "delete" },
      usage: {},
    })
    .mockRejectedValueOnce(new Error("raw private provider error"));
  const result = await assess(app(), sampleRubric);
  expect(
    Object.values(result.assessments).every((a) => a.category === "UNCLEAR"),
  ).toBe(true);
  expect(JSON.stringify(result)).not.toContain("raw private");
});
it("disabled AI produces manual unresolved work without network calls", async () => {
  process.env.AI_ENABLED = "false";
  const result = await assess(app(), sampleRubric);
  expect(mock.generate).not.toHaveBeenCalled();
  expect(result.mode).toBe("manual");
  expect(
    Object.values(result.assessments).every((a) => a.category === "UNCLEAR"),
  ).toBe(true);
});
it("does not start a second model pass after the shared processing signal expires", async () => {
  enable();
  const controller = new AbortController();
  mock.generate.mockImplementationOnce(async () => {
    controller.abort(new DOMException("Deadline exceeded", "TimeoutError"));
    return { output: { criteria: [] }, usage: {} };
  });
  await expect(
    assess(app(), sampleRubric, undefined, controller.signal),
  ).rejects.toMatchObject({
    name: "TimeoutError",
  });
  expect(mock.generate).toHaveBeenCalledTimes(1);
});
const draftOf = (
  count: number,
  over: Partial<{ title: string; points: number; equivalents: string }> = {},
) => ({
  criteria: Array.from({ length: count }, (_, i) => ({
    section: "Skills",
    title: `Requirement ${i + 1}`,
    points: 1,
    essential: false,
    full: "Full evidence.",
    partial: "Partial evidence.",
    equivalents: "",
    ...over,
  })),
});
it("AI criteria are normalised to 100 points before they reach the recruiter", async () => {
  enable();
  mock.generate.mockResolvedValue({
    output: {
      criteria: sampleRubric.map((c) => ({
        section: c.section,
        title: c.title,
        points: 1,
        essential: c.essential,
        full: c.full,
        partial: c.partial,
        equivalents: "",
      })),
    },
    usage: {},
  });
  const rubric = await draftCriteria("Fictional role", "Customer success");
  expect(rubric.reduce((n, c) => n + c.points, 0)).toBe(100);
  expect(rubric.map((c) => c.id)).toEqual(
    sampleRubric.map((_, i) => `c${i + 1}`),
  );
});
it("drafting sends the title as untrusted data and drops empty equivalents", async () => {
  enable();
  mock.generate.mockResolvedValue({
    output: {
      criteria: [
        ...draftOf(1).criteria,
        ...draftOf(1, { equivalents: " Ran a user group " }).criteria,
      ],
    },
    usage: {},
  });
  const rubric = await draftCriteria(
    "Fictional description",
    "Fictional title",
  );
  const call = mock.generate.mock.calls[0][0];
  expect(JSON.parse(call.prompt)).toEqual({
    untrustedJobTitle: "Fictional title",
    untrustedJobDescription: "Fictional description",
  });
  expect(call.providerOptions.openai).toEqual({
    store: false,
    reasoningEffort: "medium",
    strictJsonSchema: true,
  });
  expect(rubric[0]).not.toHaveProperty("equivalents");
  expect(rubric[1].equivalents).toBe("Ran a user group");
});
it("other invalid AI criteria still reject", async () => {
  enable();
  for (const output of [draftOf(13), draftOf(2, { title: "" })]) {
    mock.generate.mockResolvedValueOnce({ output, usage: {} });
    await expect(draftCriteria("Fictional role", "Title")).rejects.toThrow();
  }
});
it("denied network, empty sandbox env and cleanup hold on malformed output", async () => {
  process.env.PARSER_SNAPSHOT_ID = "synthetic-snapshot";
  process.env.PARSER_BUNDLE_SHA256 = "a".repeat(64);
  process.env.OPENAI_API_KEY = "synthetic-placeholder";
  const stop = vi.fn(),
    write = vi.fn();
  mock.create.mockResolvedValue({
    runCommand: vi
      .fn()
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: async () =>
          process.env.PARSER_BUNDLE_SHA256 + "  /opt/shortlist/runner.mjs",
      })
      .mockResolvedValueOnce({ exitCode: 0 }),
    writeFiles: write,
    readFile: async () => Readable.from([Buffer.from('{"score":100}')]),
    stop,
  });
  await expect(parseInSandbox(Buffer.from("%PDF-1.7"))).rejects.toThrow();
  expect(mock.create.mock.calls[0][0]).toMatchObject({
    networkPolicy: "deny-all",
    env: {},
    region: "lhr1",
    failoverRegions: [],
    persistent: false,
  });
  expect(stop).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(write.mock.calls)).not.toContain(
    "synthetic-placeholder",
  );
});
it("cancels sandbox work while using a fresh signal for cleanup", async () => {
  process.env.PARSER_SNAPSHOT_ID = "synthetic-snapshot";
  process.env.PARSER_BUNDLE_SHA256 = "a".repeat(64);
  const controller = new AbortController();
  const stop = vi.fn().mockResolvedValue(undefined);
  mock.create.mockResolvedValue({
    runCommand: vi.fn().mockResolvedValue({
      exitCode: 0,
      stdout: async () =>
        process.env.PARSER_BUNDLE_SHA256 + "  /opt/shortlist/runner.mjs",
    }),
    writeFiles: async () => {
      controller.abort(new DOMException("Deadline exceeded", "TimeoutError"));
      throw controller.signal.reason;
    },
    stop,
  });
  await expect(
    parseInSandbox(Buffer.from("%PDF-1.7"), controller.signal),
  ).rejects.toMatchObject({ name: "TimeoutError" });
  expect(mock.create.mock.calls[0][0].signal).toBe(controller.signal);
  expect(stop).toHaveBeenCalledTimes(1);
  expect(stop.mock.calls[0][0].signal.aborted).toBe(false);
});
it("sandbox output must bind to actual transferred bytes", async () => {
  process.env.PARSER_SNAPSHOT_ID = "synthetic-snapshot";
  process.env.PARSER_BUNDLE_SHA256 = "a".repeat(64);
  const bytes = Buffer.from("%PDF-1.7"),
    stop = vi.fn();
  mock.create.mockResolvedValue({
    runCommand: vi
      .fn()
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: async () =>
          process.env.PARSER_BUNDLE_SHA256 + "  /opt/shortlist/runner.mjs",
      })
      .mockResolvedValueOnce({ exitCode: 0 }),
    writeFiles: vi.fn(),
    readFile: async () =>
      Readable.from([
        Buffer.from(
          JSON.stringify({
            version: "extract-v1",
            hash: hash("different"),
            quality: "readable_copy",
            flags: ["incomplete_text"],
            blocks: [],
          }),
        ),
      ]),
    stop,
  });
  await expect(parseInSandbox(bytes)).rejects.toThrow("PARSER_HASH");
  expect(stop).toHaveBeenCalledTimes(1);
});

it("administrator pause prevents the second inference call", async () => {
  enable();
  mock.generate.mockResolvedValue({ output: { criteria: [] }, usage: {} });
  const before = vi
    .fn()
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error("PROCESSING_PAUSED"));
  await expect(assess(app(), sampleRubric, before)).rejects.toThrow(
    "PROCESSING_PAUSED",
  );
  expect(mock.generate).toHaveBeenCalledTimes(1);
});
