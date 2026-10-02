// Explicit opt-in fictional benchmark. No CV files, scores or app configuration changes.
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { assess, aiSettings } from "../../lib/pipeline/ai";
import { mergePasses } from "../../lib/assessment";
import { benchmarkCases } from "./fixtures";
import { callJev, JEV_MODEL } from "./jev";
if (
  process.env.REAL_CV_DATA_ENABLED === "true" ||
  process.env.BENCHMARK_SYNTHETIC_CONFIRM !== "FICTIONAL ONLY"
)
  throw new Error("Explicit fictional-only benchmark required.");
const config = aiSettings();
if (!config || config.model !== "gpt-6-luna")
  throw new Error("Benchmark pricing/model require configured gpt-6-luna.");
let key: string;
try {
  key = execFileSync(
    "security",
    ["find-generic-password", "-s", "zedsites-hub:typesafe-api-key", "-w"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  ).trim();
} catch {
  key = process.env.TYPESAFE_API_KEY ?? "";
}
if (!key) throw new Error("TypeSafe credentials unavailable.");
const results = [];
for (const fixture of benchmarkCases) {
  for (const provider of ["openai", "jev"] as const) {
    const start = performance.now();
    let outputs: unknown[] = [],
      usage: { inputTokens?: number; outputTokens?: number }[] = [],
      raw: unknown[] = [];
    if (provider === "openai") {
      const response = await assess(fixture.app, fixture.rubric);
      outputs = response.outputs;
      usage = response.usage.map((item) =>
        z
          .object({
            inputTokens: z.number().optional(),
            outputTokens: z.number().optional(),
          })
          .parse(item),
      );
      raw = response.outputs;
    } else {
      for (let pass = 0; pass < 2; pass++) {
        try {
          const response = await callJev(key, fixture.app, fixture.rubric);
          outputs.push(response.output);
          usage.push(response.usage);
          raw.push(response.rawChoices);
        } catch {
          outputs.push(null);
          usage.push({});
          raw.push({ error: "INVALID_OR_UNAVAILABLE_PASS" });
        }
      }
    }
    const guarded = mergePasses(
      outputs[0],
      outputs[1],
      fixture.rubric,
      fixture.app,
    ).c1;
    const input = usage.reduce((sum, u) => sum + (u.inputTokens ?? 0), 0),
      output = usage.reduce((sum, u) => sum + (u.outputTokens ?? 0), 0);
    results.push({
      case: fixture.id,
      provider,
      model: provider === "jev" ? JEV_MODEL : config.model,
      elapsedMs: Math.round(performance.now() - start),
      expected: fixture.expected,
      guardedCategory: guarded.category,
      categoryMatchesDeveloperExpectation:
        guarded.category === fixture.expected,
      evidence: guarded.evidence,
      supportMatchesDeveloperExpectation:
        fixture.support.length > 0
          ? fixture.support.every((id) => guarded.evidence.includes(id)) &&
            guarded.evidence.every((id) => fixture.support.includes(id))
          : guarded.evidence.length === 0,
      validPasses: outputs.filter(Boolean).length,
      raw,
      usage,
      usageComplete:
        usage.length === 2 &&
        usage.every(
          (u) => u.inputTokens !== undefined && u.outputTokens !== undefined,
        ),
      estimatedStandardUsd:
        usage.length !== 2 ||
        usage.some(
          (u) => u.inputTokens === undefined || u.outputTokens === undefined,
        )
          ? null
          : provider === "jev"
            ? (input * 0.042) / 1e6
            : (input * 0.1 + output * 0.5) / 1e6,
    });
    console.log(
      `${fixture.id}: ${provider}; ${outputs.filter(Boolean).length}/2 valid passes; ${guarded.category}; ${Math.round(performance.now() - start)}ms`,
    );
  }
}
const destination = resolve(
  process.argv[2] ?? "work/production/jev-benchmark.json",
);
await mkdir(resolve(destination, ".."), { recursive: true, mode: 0o700 });
await writeFile(
  destination,
  JSON.stringify(
    {
      at: new Date().toISOString(),
      fictionalOnly: true,
      labelSource: "Developer expectations, no independent labels",
      limitations: [
        "Small fixture feasibility test, not accuracy validation",
        "Two same-model passes test repeatability, not independent corroboration",
        "Jev single-source choice abstains on multipart evidence",
        "Probabilities/confidence are not calibrated correctness",
        "Different provider prompts, 15s Jev and 45s OpenAI pass deadlines",
        "Costs use published standard uncached rates on 2 October 2026; not an invoice",
      ],
      prices: {
        jev: "https://docs.typesafe.ai/models",
        openai: "https://developers.openai.com/api/docs/models/gpt-6-luna",
      },
      results,
    },
    null,
    2,
  ),
  { mode: 0o600 },
);
console.log("Fictional comparison saved; production provider unchanged.");
