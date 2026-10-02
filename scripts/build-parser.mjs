import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
await mkdir("work/parser", { recursive: true });
await build({
  entryPoints: ["parser/runner.ts"],
  outfile: "work/parser/runner.mjs",
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  banner: {
    js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
  },
  logLevel: "silent",
});
const bytes = await readFile("work/parser/runner.mjs");
await writeFile(
  "work/parser/manifest.json",
  JSON.stringify(
    {
      extractionVersion: "extract-v1",
      sha256: createHash("sha256").update(bytes).digest("hex"),
      bytes: bytes.length,
    },
    null,
    2,
  ),
);
console.log(
  "Parser bundle built; dependency-only artifact under ignored work/parser.",
);
