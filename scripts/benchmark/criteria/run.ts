// Phase 4 criteria benchmark. Explicit opt-in, fictional CVs only.
// Arms: A = v2 prompt + v1 templates, B = v3 prompt + v2 templates (production),
// C = v3 prompt + v1 templates, D = v2 prompt + v2 templates (C and D explain, not decide).
// --set confirm runs the confirmation set (fixtures-confirm.ts, labels-confirm.ts):
// E = v4 prompt + v2 templates against control B, with D as reference only.
// No Jev or TypeSafe. Costs live API calls: arms x repeats x cases x 2 passes
// (180 by default for dev, 150 for confirm). Hard cap 240.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { aiSettings, runPasses } from "../../../lib/pipeline/ai";
import { mergePasses } from "../../../lib/assessment";
import { ALL_ARMS } from "./arms";
import { criteriaCases, injectionBlocks } from "./fixtures";
import { confirmCases, confirmInjectionBlocks } from "./fixtures-confirm";
import { criteriaLabels } from "./labels";
import { confirmLabels } from "./labels-confirm";
import {
  cellKey,
  CONFIRM_RULE,
  decide,
  decideConfirm,
  PRE_REGISTERED_RULE,
  summarise,
} from "./metrics";
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
const set = arg("--set") ?? "dev";
if (set !== "dev" && set !== "confirm")
  throw new Error("--set accepts dev or confirm.");
const isConfirm = set === "confirm";
const cases = isConfirm ? confirmCases : criteriaCases;
const labels = isConfirm ? confirmLabels : criteriaLabels;
const injected = isConfirm ? confirmInjectionBlocks : injectionBlocks;
const allowedArms = isConfirm ? ["B", "D", "E"] : ["A", "B", "C", "D"];
const wanted = (arg("--arms") ?? (isConfirm ? "B,E,D" : "A,B,C,D"))
  .split(",")
  .map((s) => s.trim());
if (wanted.some((id) => !allowedArms.includes(id)))
  throw new Error(`--arms accepts ${allowedArms.join(",")} for --set ${set}.`);
const repeats = Number(arg("--repeats") ?? 2);
if (!Number.isInteger(repeats) || repeats < 1 || repeats > 3)
  throw new Error("--repeats must be 1, 2 or 3.");
const arms = ALL_ARMS.filter((a) => wanted.includes(a.id));
const repeated: ArmId[] = isConfirm ? ["B", "E"] : ["A", "B"];
const repeatsFor = (id: ArmId) => (repeated.includes(id) ? repeats : 1);
const plannedCalls =
  arms.reduce((n, a) => n + repeatsFor(a.id), 0) * cases.length * 2;
if (plannedCalls > 240)
  throw new Error(`Planned ${plannedCalls} calls exceeds the 240-call budget.`);

// Refuse to spend anything unless every case x rubric criterion is labelled.
const labelKeys = new Set(
  labels.map((l) => cellKey(l.caseId, l.rubricVersion, l.criterionId)),
);
for (const c of cases)
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
  `${stamp.replace(/[:]/g, "-")}-${set}.json`,
);
mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });

const PRICES = {
  note: "Published standard uncached rates for gpt-6-luna on 2 October 2026; same as scripts/benchmark/run.ts. Not an invoice.",
  inputUsdPerMillion: 0.1,
  outputUsdPerMillion: 0.5,
  source: "https://developers.openai.com/api/docs/models/gpt-6-luna",
};
const CONFIRM_LIMITATIONS = [
  "Fictional CVs and developer-written labels, not independent adjudication; labels were written before results but by the same team that wrote the criteria.",
  "Small sample: 15 cases x 6 criteria; confidence intervals are wide and cells within a case are not independent.",
  "Two same-model passes measure repeatability, not independent corroboration.",
  "Noise floor is arm B's between-repeat changed-cell fraction (the control); arm D has a single repeat and is reference only.",
  "Arm E differs from B in system text only; the prompt JSON and v2 templates are identical.",
  "The confirmation set is single-use: if v3 stays, it is not reused for prompt tuning.",
  "Model behaviour may change with provider updates; results describe the run date and model only.",
  "Costs use published standard rates and are not an invoice.",
];
const DEV_LIMITATIONS = [
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
const LIMITATIONS = isConfirm ? CONFIRM_LIMITATIONS : DEV_LIMITATIONS;
const fixturesFile = isConfirm ? "fixtures-confirm.ts" : "fixtures.ts";
const labelsFile = isConfirm ? "labels-confirm.ts" : "labels.ts";
const decideFor = (summary: ReturnType<typeof summarise>) =>
  isConfirm
    ? { decision: null, confirmDecision: decideConfirm(summary) }
    : { decision: decide(summary), confirmDecision: null };
const results: Result[] = [];
const runs: RunRecord[] = [];

function save(partial: boolean) {
  const summary = summarise(results, labels, injected);
  const { decision, confirmDecision } = decideFor(summary);
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
        set,
        fictionalOnly: true,
        gitHead: git("rev-parse", "HEAD"),
        gitDirty: git("status", "--porcelain").length > 0,
        fixturesFile,
        fixturesSha256: sha256(resolve(here, fixturesFile)),
        labelsFile,
        labelsSha256: sha256(resolve(here, labelsFile)),
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
        preRegisteredRule: isConfirm ? CONFIRM_RULE : PRE_REGISTERED_RULE,
        limitations: LIMITATIONS,
        decision: isConfirm ? confirmDecision : decision,
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
    for (const fixture of cases) {
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
const summary = summarise(results, labels, injected);
const final = decideFor(summary);
console.log(
  `\n${markdownReport(summary, final.decision, final.confirmDecision)}\n`,
);
console.log(`Saved ${destination}`);
