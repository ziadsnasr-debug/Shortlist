import { readFile, writeFile } from "node:fs/promises";
import { extract } from "./extract";
const timer = setTimeout(() => process.exit(124), 30000);
try {
  const result = await extract(await readFile("/tmp/document.bin"));
  await writeFile("/tmp/result.json", JSON.stringify(result), { mode: 0o600 });
} catch {
  await writeFile(
    "/tmp/result.json",
    JSON.stringify({ error: "NEEDS_READABLE_COPY" }),
    { mode: 0o600 },
  );
  process.exitCode = 2;
} finally {
  clearTimeout(timer);
}
