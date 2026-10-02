import { mkdir, readFile, writeFile } from "node:fs/promises";
import {
  evaluationFixtures,
  adversarialPairs,
} from "../fixtures/synthetic/evaluation";
import { digest, evaluate } from "../lib/evaluation";
import { assessSealed, sealManifest } from "../lib/evaluation-gates";
const out = process.env.EVALUATION_OUTPUT_DIR ?? "outputs/evaluation";
async function writeNew(path: string, value: unknown) {
  await writeFile(path, JSON.stringify(value, null, 2) + "\n", {
    flag: "wx",
    mode: 0o600,
  });
}
const requested = process.argv[2] ?? "generate";
const command = requested.endsWith(".json") ? "metrics" : requested;
await mkdir(out, { recursive: true, mode: 0o700 });
if (command === "generate") {
  await writeNew(`${out}/fixture-pack.json`, {
    synthetic: true,
    fixtures: evaluationFixtures.map((x) => ({
      fixtureId: x.id,
      role: x.role,
      split: x.split,
      text: x.text,
      sha256: digest(x.text),
    })),
    adversarialPairs: adversarialPairs.map((x) => ({
      id: x.id,
      fixtureId: x.fixtureId,
      clean: x.clean,
      altered: x.altered,
      cleanSha256: digest(x.clean),
      alteredSha256: digest(x.altered),
    })),
    labelTemplate: {
      rows: [],
      note: "Independent adjudicated labels and evidence records required before sealing.",
    },
  });
  console.log(
    "Synthetic fixture pack written. It is unassessed and cannot support release.",
  );
} else if (command === "seal") {
  const input = JSON.parse(await readFile(process.argv[3] ?? "", "utf8"));
  await writeNew(`${out}/sealed-manifest.json`, sealManifest(input));
  console.log(
    "Sealed synthetic evaluation manifest written. SHA-256 detects change; it does not prove independent judgement.",
  );
} else if (command === "assess") {
  if (process.argv.length !== 8)
    throw new Error(
      "assess requires manifest, rows, configuration, evidence and trusted release record paths.",
    );
  const [manifest, rows, configuration, evidence, trustedRecord] =
    await Promise.all(
      process.argv
        .slice(3, 8)
        .map((path) => readFile(path, "utf8").then(JSON.parse)),
    );
  await writeNew(
    `${out}/assessment.json`,
    assessSealed(manifest, rows, configuration, evidence, trustedRecord),
  );
  console.log("Assessment written. Real-data activation remains disabled.");
} else if (command === "metrics") {
  const rows = JSON.parse(
    await readFile(
      requested === "metrics" ? (process.argv[3] ?? "") : requested,
      "utf8",
    ),
  );
  await writeNew(`${out}/metrics.json`, evaluate(rows));
  console.log("Descriptive metrics written. They cannot support release.");
} else
  throw new Error(
    "Use generate, seal <input>, or assess <manifest> <rows> <configuration> <evidence>.",
  );
