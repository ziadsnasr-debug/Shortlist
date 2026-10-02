import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
let commit = "unavailable", trackedChanges = null;
try {
  commit = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
  trackedChanges = execFileSync("git", ["diff", "--name-only", "HEAD"], {
    encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
  }).trim().length > 0;
} catch {}
const manifest = {
  release: pkg.version,
  commit,
  generatedAt: new Date().toISOString(),
  trackedChanges,
  generatorRuntime: process.version,
  requiredRuntime: pkg.engines.node,
  hostedRuntime: "Not verified by this local generator",
  dependencies: pkg.dependencies,
  devDependencies: pkg.devDependencies,
  specification: "1.2 / 2026-10-02",
  data: "synthetic only",
  defaultAiEnabled: false,
  evidencePromptVersion: "evidence-v2-openai",
  extractionVersion: "extract-v1",
  parserBundle: existsSync("work/parser/manifest.json")
    ? JSON.parse(readFileSync("work/parser/manifest.json", "utf8"))
    : null,
  activation:
    "Synthetic only; this inventory does not execute tests or establish deployment, model quality or acceptance",
  parserSnapshot: "Configured privately per deployment; not inspected by this generator",
  providerModel: "Configured privately per deployment; not inspected by this generator",
};
mkdirSync("outputs", { recursive: true });
writeFileSync(
  "outputs/release-manifest.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log("Release inventory written to outputs/release-manifest.json; no environment values included.");
