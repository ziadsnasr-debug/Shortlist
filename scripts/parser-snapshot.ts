// Run only in an explicitly configured Vercel project. No CV or secret enters the snapshot.
import { Sandbox } from "@vercel/sandbox";
import { readFile } from "node:fs/promises";
const content = await readFile("work/parser/runner.mjs"),
  manifest = JSON.parse(await readFile("work/parser/manifest.json", "utf8"));
process.env.SHORTLIST_SECRET_CANARY = "synthetic-canary-not-a-credential";
const sandbox = await Sandbox.create({
  region: "lhr1",
  failoverRegions: [],
  networkPolicy: "deny-all",
  persistent: false,
  timeout: 60000,
  resources: { vcpus: 1 },
  env: {},
});
try {
  const mkdir = await sandbox.runCommand("mkdir", ["-p", "/opt/shortlist"], {
    timeoutMs: 5000,
  });
  if (mkdir.exitCode !== 0) throw new Error("SNAPSHOT_DIRECTORY");
  await sandbox.writeFiles([{ path: "/opt/shortlist/runner.mjs", content }]);
  const probe = await sandbox.runCommand(
    "node",
    [
      "-e",
      'const dns=require("node:dns"); Promise.all([fetch("https://example.com",{signal:AbortSignal.timeout(4000)}).then(()=>false,()=>true),new Promise(r=>dns.lookup("example.com",e=>r(!!e)))]).then(v=>process.exit(v.every(Boolean)?0:1))',
    ],
    { timeoutMs: 7000 },
  );
  if (probe.exitCode !== 0) throw new Error("NETWORK_ISOLATION_FAILED");
  const env = await sandbox.runCommand(
    "node",
    [
      "-e",
      "process.exit(Object.keys(process.env).some(k=>/OPENAI|ANTHROPIC|SUPABASE|VERCEL_TOKEN|OIDC_TOKEN|CRON_SECRET|SHORTLIST_SECRET_CANARY/.test(k))?1:0)",
    ],
    { timeoutMs: 5000 },
  );
  if (env.exitCode !== 0) throw new Error("SECRET_ISOLATION_FAILED");
  const snapshot = await sandbox.snapshot();
  console.log(
    JSON.stringify({
      snapshotId: snapshot.snapshotId,
      sha256: manifest.sha256,
      region: "lhr1",
      networkProbe: "denied",
      secretProbe: "absent",
    }),
  );
} finally {
  await sandbox.stop();
}
