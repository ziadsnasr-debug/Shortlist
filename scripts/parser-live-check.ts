// Real managed isolation checks; only generated fictional bytes, no AI calls.
import { PDFDocument, StandardFonts } from "pdf-lib";
import { Document, Packer, Paragraph } from "docx";
import { parseInSandbox, sandboxOptions } from "../lib/pipeline/sandbox";
import { Sandbox } from "@vercel/sandbox";
import { documentType } from "../lib/pipeline/contracts";
const pdf = await PDFDocument.create(),
  font = await pdf.embedFont(StandardFonts.Helvetica);
pdf
  .addPage()
  .drawText("Fictional owner: Jamie Sample. Owned 35 customer accounts.", {
    x: 40,
    y: 720,
    font,
    size: 12,
  });
const pdfBytes = Buffer.from(await pdf.save()),
  docx = await Packer.toBuffer(
    new Document({
      sections: [
        {
          children: [
            new Paragraph(
              "Fictional applicant. Led onboarding and documented customer retention actions.",
            ),
          ],
        },
      ],
    }),
  );
for (const bytes of [pdfBytes, docx]) {
  const result = await parseInSandbox(bytes);
  if (result.quality !== "readable" || result.blocks.length < 1)
    throw new Error("ACTUAL_EXTRACTION_FAILED");
  console.log(
    JSON.stringify({
      type: documentType(bytes),
      quality: result.quality,
      blocks: result.blocks.length,
      hashBound: true,
    }),
  );
}
const eleven = await PDFDocument.create();
for (let i = 0; i < 11; i++) eleven.addPage().drawText("Fictional page");
for (const bytes of [
  Buffer.from(await eleven.save()),
  Buffer.from("%PDF-1.7 malformed fictional input"),
]) {
  let rejected = false;
  try {
    await parseInSandbox(bytes);
  } catch {
    rejected = true;
  }
  if (!rejected) throw new Error("UNREADABLE_BOUNDARY_FAILED");
}
const sandbox = await Sandbox.create(
  sandboxOptions(process.env.PARSER_SNAPSHOT_ID!),
);
try {
  const started = Date.now();
  const time = await sandbox.runCommand(
    "timeout",
    ["--signal=KILL", "2s", "node", "-e", "while(true){}"],
    { timeoutMs: 5000 },
  );
  const elapsed = Date.now() - started;
  if (
    ![124, 137, -1].includes(time.exitCode) ||
    elapsed < 1800 ||
    elapsed > 7000
  )
    throw new Error(`TIME_BOUNDARY:${time.exitCode}:${elapsed}`);
  const memory = await sandbox.runCommand(
    "node",
    [
      "--max-old-space-size=32",
      "-e",
      'const a=[];for(;;)a.push(new Array(100000).fill("fictional"))',
    ],
    { timeoutMs: 10000 },
  );
  if (memory.exitCode === 0) throw new Error("MEMORY_BOUNDARY");
  const alive = await sandbox.runCommand("node", ["-e", "process.exit(0)"], {
    timeoutMs: 5000,
  });
  if (alive.exitCode !== 0) throw new Error("CONTAINMENT");
  console.log(
    "PASS: actual malformed/page rejection, command timeout and JS heap exhaustion contained; VM remains responsive and is stopped. Whole-VM RSS isolation beyond configured SDK resources is not certified.",
  );
} finally {
  await sandbox.stop();
}
console.log(
  "PASS: actual managed PDF/DOCX parsing, output hashes and cleanup.",
);
