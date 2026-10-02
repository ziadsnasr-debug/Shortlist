import "server-only";
import { Sandbox } from "@vercel/sandbox";
import { ParsedDocument, documentType, hash, LIMITS } from "./contracts";
export function sandboxOptions(snapshotId: string) {
  return {
    source: { type: "snapshot" as const, snapshotId },
    region: "lhr1" as const,
    failoverRegions: [],
    persistent: false,
    networkPolicy: "deny-all" as const,
    env: {},
    timeout: 60000,
    resources: { vcpus: 1 },
  };
}
export async function parseInSandbox(bytes: Buffer) {
  documentType(bytes);
  const snapshotId = process.env.PARSER_SNAPSHOT_ID;
  if (!snapshotId || !process.env.PARSER_BUNDLE_SHA256)
    throw new Error("PARSER_NOT_CONFIGURED");
  const sandbox = await Sandbox.create(sandboxOptions(snapshotId));
  try {
    const integrity = await sandbox.runCommand(
      "sha256sum",
      ["/opt/shortlist/runner.mjs"],
      { timeoutMs: 5000 },
    );
    if (
      integrity.exitCode !== 0 ||
      !(await integrity.stdout()).startsWith(
        process.env.PARSER_BUNDLE_SHA256 + " ",
      )
    )
      throw new Error("PARSER_INTEGRITY");
    await sandbox.writeFiles([{ path: "/tmp/document.bin", content: bytes }]);
    // Filename and command are fixed; no original filename or controller environment is forwarded.
    const result = await sandbox.runCommand(
      "timeout",
      [
        "--signal=KILL",
        "30s",
        "node",
        "--max-old-space-size=256",
        "/opt/shortlist/runner.mjs",
      ],
      { timeoutMs: LIMITS.parserMs + 2000 },
    );
    if (result.exitCode !== 0) throw new Error("NEEDS_READABLE_COPY");
    const stream = await sandbox.readFile({ path: "/tmp/result.json" });
    if (!stream) throw new Error("PARSER_OUTPUT");
    const chunks: Buffer[] = [];
    let count = 0;
    for await (const chunk of stream) {
      const b = Buffer.from(chunk);
      count += b.length;
      if (count > LIMITS.output) {
        throw new Error("PARSER_OUTPUT_LIMIT");
      }
      chunks.push(b);
    }
    const parsed = ParsedDocument.parse(
      JSON.parse(Buffer.concat(chunks).toString()),
    );
    if (parsed.hash !== hash(bytes)) throw new Error("PARSER_HASH");
    return parsed;
  } finally {
    await sandbox.stop();
  }
}
