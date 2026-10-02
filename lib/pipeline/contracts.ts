import { z } from "zod";
import { createHash } from "node:crypto";
export const LIMITS = {
  input: 5242880,
  pages: 10,
  expanded: 52428800,
  entries: 500,
  characters: 100000,
  blocks: 5000,
  parserMs: 30000,
  output: 2000000,
} as const;
export const EXTRACTION_VERSION = "extract-v1";
export const ParsedDocument = z
  .object({
    version: z.literal(EXTRACTION_VERSION),
    hash: z.string().regex(/^[a-f0-9]{64}$/),
    quality: z.enum(["readable", "readable_copy"]),
    flags: z
      .array(
        z.enum([
          "suspicious_instructions",
          "hidden_content",
          "uncertain_identity",
          "incomplete_text",
          "unsupported_document",
        ]),
      )
      .max(5),
    blocks: z
      .array(
        z
          .object({
            id: z.string().regex(/^(P\d+_B\d+|D_B\d+)$/),
            locator: z.string().max(100),
            text: z.string().max(LIMITS.characters),
            assessmentText: z.string().max(LIMITS.characters),
            inputMethod: z.literal("parsed"),
          })
          .strict(),
      )
      .max(LIMITS.blocks),
  })
  .strict()
  .superRefine((d, ctx) => {
    if (
      new Set(d.blocks.map((b) => b.id)).size !== d.blocks.length ||
      d.blocks.reduce((n, b) => n + b.text.length, 0) > LIMITS.characters ||
      d.blocks.reduce((n, b) => n + b.assessmentText.length, 0) >
        LIMITS.characters ||
      (d.quality === "readable" && !d.blocks.length)
    )
      ctx.addIssue({ code: "custom", message: "Invalid extraction bounds." });
  });
export type ParsedDocument = z.infer<typeof ParsedDocument>;
export function documentType(bytes: Uint8Array): "pdf" | "docx" {
  if (!bytes.length || bytes.length > LIMITS.input)
    throw new Error("FILE_SIZE");
  if (Buffer.from(bytes.subarray(0, 5)).toString() === "%PDF-") return "pdf";
  if (
    Buffer.from(bytes.subarray(0, 4)).equals(
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    )
  )
    return "docx";
  throw new Error("FILE_SIGNATURE");
}
export function hash(bytes: Uint8Array | string) {
  return createHash("sha256").update(bytes).digest("hex");
}
export function processingKey(
  documentHash: string,
  application: string,
  rubricVersion: number,
  config: string,
) {
  return hash(
    JSON.stringify([documentHash, application, rubricVersion, config]),
  );
}
export { minimise } from "../minimisation";
