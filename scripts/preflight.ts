import { readiness } from "../lib/readiness";

// Run explicitly with private values already in the process environment, for example:
// node --env-file=.env.local --import tsx scripts/preflight.ts --check
// Only check names and statuses are printed; no values or network calls are used.
if (!process.argv.slice(2).includes("--check")) {
  process.stderr.write("Preflight is opt-in. Re-run with --check.\n");
  process.exitCode = 2;
} else {
  const report = readiness();
  process.stdout.write(`${JSON.stringify(report)}\n`);
  if (report.status !== "configuration_ready") process.exitCode = 1;
}
