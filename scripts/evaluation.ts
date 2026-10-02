import { writeFile, mkdir, readFile } from "node:fs/promises";
import {
  evaluationFixtures,
  adversarialPairs,
} from "../fixtures/synthetic/evaluation";
import { evaluate } from "../lib/evaluation";
await mkdir("outputs/evaluation", { recursive: true });
if (process.argv[2]) {
  const report = evaluate(JSON.parse(await readFile(process.argv[2], "utf8")));
  await writeFile(
    "outputs/evaluation/results.json",
    JSON.stringify(report, null, 2),
  );
  console.log(
    "Human-labelled evaluation report written; overall release still requires all other gates.",
  );
} else {
  await writeFile(
    "outputs/evaluation/fixtures.json",
    JSON.stringify(evaluationFixtures, null, 2),
  );
  await writeFile(
    "outputs/evaluation/adversarial-pairs.json",
    JSON.stringify(adversarialPairs, null, 2),
  );
  await writeFile(
    "outputs/evaluation/label-template.json",
    JSON.stringify(
      {
        status: "Pending independent recruiter labels",
        requiredFields: [
          "fixtureId",
          "role",
          "criterionId",
          "expected",
          "actual",
          "validSupport",
          "essential",
          "essentialReviewed",
          "humanLabelledBy",
          "independentOfModel",
        ],
        rows: [],
      },
      null,
      2,
    ),
  );
  console.log(
    "45 fictional fixtures (15 development, 30 held out), 20 paired attacks and label template written. No model quality results claimed.",
  );
}
