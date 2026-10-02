import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
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
  aiEnabled: false,
  parserSnapshot: null,
  providerModel: null,
};
mkdirSync("docs", { recursive: true });
writeFileSync(
  "docs/release-manifest.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log("Release manifest written; no environment values included.");
