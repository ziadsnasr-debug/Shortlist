import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
let commit = "uncommitted";
try {
  commit = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
} catch {}
const manifest = {
  release: pkg.version,
  commit,
  runtime: process.version,
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
    "Synthetic implementation; local and authenticated hosted managed-parser/OpenAI workflow passed; independent evaluation and customer real-data acceptance pending",
  parserSnapshot: "Configured privately per deployment; actual London synthetic probes passed",
  providerModel: "gpt-6-luna (live synthetic two-pass spike verified)",
};
mkdirSync("docs", { recursive: true });
writeFileSync(
  "docs/release-manifest.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log("Release manifest written; no environment values included.");
