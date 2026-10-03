// Phase 4 criteria benchmark. Explicit opt-in, fictional CVs only.
// Arms: A = v2 prompt + v1 templates, B = v3 prompt + v2 templates (production),
// C = v3 prompt + v1 templates, D = v2 prompt + v2 templates (C and D explain, not decide).
// No Jev or TypeSafe. Costs live API calls: arms x cases x 2 passes (about 180 by default).
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { aiSettings, runPasses } from "../../../lib/pipeline/ai";
import { mergePasses } from "../../../lib/assessment";
import { ARMS } from "./arms";
import { criteriaCases, injectionBlocks } from "./fixtures";
import { criteriaLabels } from "./labels";
import { decide, PRE_REGISTERED_RULE, summarise, cellKey } from "./metrics";
import { markdownReport } from "./report";
import { ROLE_TITLES, rubricFor } from "./templates-v1";
import type { ArmId, Result } from "./types";

if (
  process.env.REAL_CV_DATA_ENABLED === "true" ||
  process.env.BENCHMARK_SYNTHETIC_CONFIRM !== "FICTIONAL ONLY"
)
  throw new Error("Explicit fictional-only benchmark required.");
const config = aiSettings();
if (!config || config.model !== "gpt-6-luna")
  throw new Error("Benchmark pricing/model require configured gpt-6-luna.");

function arg(name: string) {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}
const wanted = (arg("--arms") ?? "A,B,C,D").split(",").map((s) => s.trim());
const armIds = new Set<string>(ARMS.map((a) => a.id));
if (wanted.some((id) => !armIds.has(id)))
  throw new Error("--arms accepts A,B,C,D.");
const repeats = Number(arg("--repeats") ?? 2);
if (!Number.isInteger(repeats) || repeats < 1 || repeats > 3)
  throw new Error("--repeats must be 1, 2 or 3.");
const arms = ARMS.filter((a) => wanted.includes(a.id));
const repeatsFor = (id: ArmId) => (id === "A" || id === "B" ? repeats : 1);
const plannedCalls =
  arms.reduce((n, a) => n + repeatsFor(a.id), 0) * criteriaCases.length * 2;
if (plannedCalls > 240)
  throw new Error(`Planned ${plannedCalls} calls exceeds the 240-call budget.`);

// Refuse to spend anything unless every case x rubric criterion is labelled.
const labelKeys = new Set(
  criteriaLabels.map((l) => cellKey(l.caseId, l.rubricVersion, l.criterionId)),
);
for (const c of criteriaCases)
  for (const arm of arms)
    for (const crit of rubricFor(arm.templateVersion, c.role))
      if (!labelKeys.has(cellKey(c.id, arm.templateVersion, crit.id)))
        throw new Error(
          `Missing label: ${c.id} v${arm.templateVersion} ${crit.id}`,
        );

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const git = (...args: string[]) =>
  execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
const sha256 = (path: string) =>
  createHash("sha256").update(readFileSync(path)).digest("hex");
const stamp = new Date().toISOString();
const destination = resolve(
  repoRoot,
  "work/criteria-benchmark",
  `${stamp.replace(/[:]/g, "-")}.json`,
);
mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });

const PRICES = {
  note: "Published standard uncached rates for gpt-6-luna on 2 October 2026; same as scripts/benchmark/run.ts. Not an invoice.",
  inputUsdPerMillion: 0.1,
  outputUsdPerMillion: 0.5,
  source: "https://developers.openai.com/api/docs/models/gpt-6-luna",
};
const LIMITATIONS = [
  "Fictional CVs and developer-written labels, not independent adjudication; labels were written before results but by the same team that wrote the criteria.",
  "Small sample: every cell is one case x one criterion; confidence intervals are wide and cells within a case are not independent.",
  "Two same-model passes measure repeatability, not independent corroboration.",
  "Noise floor is the between-repeat changed-cell fraction of arm A only; arms C and D have a single repeat.",
  "v1 and v2 rubrics differ in criterion count, so rates (not counts) are compared; labels differ per rubric version.",
  "Prompt versions differ in more than one respect (system text, vacancy title, section, equivalents), so B versus A cannot attribute gains to a single change; C and D are explanatory only.",
  "Model behaviour may change with provider updates; results describe the run date and model only.",
  "Costs use published standard rates and are not an invoice.",
];

type RunRecord = {
  arm: ArmId;
  repeat: number;
  caseId: string;
  role: string;
  rubricVersion: 1 | 2;
  elapsedMs: number;
  outputs: unknown[];
  usage: unknown[];
};
const results: Result[] = [];
const runs: RunRecord[] = [];

function save(partial: boolean) {
  const summary = summarise(results, criteriaLabels, injectionBlocks);
  const decision = decide(summary);
  const tokens = runs
    .flatMap((r) => r.usage)
    .reduce<{ i: number; o: number }>(
      (t, u) => {
        const x = u as { inputTokens?: number; outputTokens?: number };
        return {
          i: t.i + (x.inputTokens ?? 0),
          o: t.o + (x.outputTokens ?? 0),
        };
      },
      { i: 0, o: 0 },
    );
  writeFileSync(
    destination,
    JSON.stringify(
      {
        at: stamp,
        partial,
        fictionalOnly: true,
        gitHead: git("rev-parse", "HEAD"),
        gitDirty: git("status", "--porcelain").length > 0,
        fixturesSha256: sha256(resolve(here, "fixtures.ts")),
        labelsSha256: sha256(resolve(here, "labels.ts")),
        model: config!.model,
        prices: PRICES,
        estimatedStandardUsd:
          (tokens.i * PRICES.inputUsdPerMillion +
            tokens.o * PRICES.outputUsdPerMillion) /
          1e6,
        arms: arms.map(({ id, label, promptVersion, templateVersion }) => ({
          id,
          label,
          promptVersion,
          templateVersion,
          repeats: repeatsFor(id),
        })),
        plannedCalls,
        preRegisteredRule: PRE_REGISTERED_RULE,
        limitations: LIMITATIONS,
        decision,
        summary,
        results,
        runs,
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
}

let calls = 0;
try {
  for (let repeat = 1; repeat <= repeats; repeat++) {
    for (const fixture of criteriaCases) {
      for (const arm of arms) {
        if (repeat > repeatsFor(arm.id)) continue;
        const rubric = rubricFor(arm.templateVersion, fixture.role);
        const { system, prompt } = arm.build(
          fixture.app,
          rubric,
          ROLE_TITLES[fixture.role],
        );
        const start = performance.now();
        const { outputs, usage } = await runPasses({
          system,
          prompt,
          rubric,
          app: fixture.app,
          config,
        });
        calls += 2;
        const elapsedMs = Math.round(performance.now() - start);
        const merged = mergePasses(outputs[0], outputs[1], rubric, fixture.app);
        const pick = (
          out: unknown,
          id: string,
        ): { category: Result["pass1Category"]; evidence: string[] } => {
          const found = (
            out as {
              criteria: {
                criterion_id: string;
                category: NonNullable<Result["pass1Category"]>;
                evidence_ids: string[];
              }[];
            } | null
          )?.criteria.find((c) => c.criterion_id === id);
          return found
            ? { category: found.category, evidence: found.evidence_ids }
            : { category: null, evidence: [] };
        };
        for (const crit of rubric) {
          const p1 = pick(outputs[0], crit.id),
            p2 = pick(outputs[1], crit.id);
          results.push({
            arm: arm.id,
            repeat,
            caseId: fixture.id,
            rubricVersion: arm.templateVersion,
            criterionId: crit.id,
            essential: crit.essential,
            pass1Category: p1.category,
            pass2Category: p2.category,
            pass1Evidence: p1.evidence,
            pass2Evidence: p2.evidence,
            guardedCategory: merged[crit.id].category,
            guardedEvidence: merged[crit.id].evidence,
          });
        }
        runs.push({
          arm: arm.id,
          repeat,
          caseId: fixture.id,
          role: fixture.role,
          rubricVersion: arm.templateVersion,
          elapsedMs,
          outputs,
          usage,
        });
        console.log(
          `${arm.id} r${repeat} ${fixture.id}: ${outputs.filter(Boolean).length}/2 valid; ${elapsedMs}ms (${calls}/${plannedCalls} calls)`,
        );
        save(true);
      }
    }
  }
} catch (error) {
  save(true);
  console.error(`Aborted after ${calls} calls; partial results saved.`);
  throw error;
}
save(false);
const summary = summarise(results, criteriaLabels, injectionBlocks);
console.log(`\n${markdownReport(summary, decide(summary))}\n`);
console.log(`Saved ${destination}`);
