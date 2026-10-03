// Requires a real API key in process environment. A Claude subscription is not an API key.
import { assess, aiSettings } from "../lib/pipeline/ai";
import { sampleRubric, samples } from "../fixtures/synthetic/seed";
const config = aiSettings();
if (!config)
  throw new Error(
    "Enable direct API inference with an approved tested model and synthetic-only credentials.",
  );
const result = await assess(
  samples(sampleRubric, 1)[0],
  sampleRubric,
  undefined,
  undefined,
  "Customer success manager",
);
if (result.outputs.some((x) => x === null))
  throw new Error(
    "Provider capability spike did not produce two valid passes. No provider fallback used.",
  );
console.log(
  JSON.stringify({
    provider: "openai-direct",
    model: config.model,
    promptVersion: config.promptVersion,
    passes: result.outputs.length,
    usage: result.usage,
    semanticAccuracy: "unverified",
    geography: "requires customer confirmation",
  }),
);
