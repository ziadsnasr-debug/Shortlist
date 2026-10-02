// This module executes inside the dependency-only denied-network sandbox.
import { fromBuffer, type ZipFile, type Entry } from "yauzl";
import mammoth from "mammoth";
import { getDocumentProxy } from "unpdf";
import {
  documentType,
  hash,
  minimise,
  LIMITS,
  EXTRACTION_VERSION,
  ParsedDocument,
} from "../lib/pipeline/contracts";
async function inspectDocx(bytes: Buffer) {
  return new Promise<{ hidden: boolean }>((resolve, reject) => {
    let expanded = 0,
      count = 0,
      document = false,
      contentTypes = false,
      hidden = false;
    fromBuffer(
      bytes,
      { lazyEntries: true, validateEntrySizes: true, strictFileNames: true },
      (error, zip?: ZipFile) => {
        if (error || !zip) return reject(new Error("DOCX_ARCHIVE"));
        const fail = () => {
          zip.close();
          reject(new Error("DOCX_ARCHIVE"));
        };
        zip.on("error", fail);
        zip.on("end", () =>
          document && contentTypes
            ? resolve({ hidden })
            : reject(new Error("DOCX_STRUCTURE")),
        );
        zip.on("entry", (entry: Entry) => {
          if (
            ++count > LIMITS.entries ||
            entry.uncompressedSize > LIMITS.expanded ||
            entry.generalPurposeBitFlag & 1 ||
            entry.fileName.includes("..") ||
            entry.fileName.startsWith("/") ||
            /vbaProject|embeddings\//i.test(entry.fileName)
          )
            return fail();
          if (/\/$/.test(entry.fileName)) return zip.readEntry();
          zip.openReadStream(entry, (err, stream) => {
            if (err || !stream) return fail();
            let total = 0;
            const chunks: Buffer[] = [];
            stream.on("error", fail);
            stream.on("data", (chunk: Buffer) => {
              total += chunk.length;
              expanded += chunk.length;
              if (expanded > LIMITS.expanded) {
                stream.destroy();
                fail();
              } else if (entry.fileName === "word/document.xml")
                chunks.push(chunk);
            });
            stream.on("end", () => {
              if (total !== entry.uncompressedSize) return fail();
              if (entry.fileName === "word/document.xml") {
                document = true;
                hidden =
                  /<w:(?:vanish|webHidden)\b|<w:color[^>]*w:val="FFFFFF"/i.test(
                    Buffer.concat(chunks).toString(),
                  );
              }
              if (entry.fileName === "[Content_Types].xml") contentTypes = true;
              zip.readEntry();
            });
          });
        });
        zip.readEntry();
      },
    );
  });
}
export async function extract(bytes: Buffer): Promise<ParsedDocument> {
  const type = documentType(bytes),
    blocks: ParsedDocument["blocks"] = [],
    flags: ParsedDocument["flags"] = [];
  let total = 0;
  function add(id: string, locator: string, text: string) {
    total += text.length;
    if (total > LIMITS.characters || blocks.length >= LIMITS.blocks)
      throw new Error("TEXT_LIMIT");
    if (text.trim())
      blocks.push({
        id,
        locator,
        text,
        assessmentText: minimise(text),
        inputMethod: "parsed",
      });
  }
  if (type === "pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    try {
      if (pdf.numPages > LIMITS.pages) throw new Error("PAGE_LIMIT");
      for (let page = 1; page <= pdf.numPages; page++) {
        const p = await pdf.getPage(page),
          content = await p.getTextContent();
        let index = 0;
        for (const item of content.items)
          if ("str" in item && item.str.trim()) {
            index++;
            add(
              `P${page}_B${index}`,
              `Page ${page}, item ${index}, x ${Math.round(item.transform[4])}, y ${Math.round(item.transform[5])}`,
              item.str,
            );
            if (
              Math.abs(item.height) < 2 ||
              item.transform[4] < 0 ||
              item.transform[5] < 0
            )
              flags.push("hidden_content");
          }
        if (!index) flags.push("incomplete_text");
        p.cleanup();
      }
    } finally {
      await pdf.loadingTask.destroy();
    }
  } else {
    const inspected = await inspectDocx(bytes);
    if (inspected.hidden) flags.push("hidden_content");
    const result = await mammoth.extractRawText({ buffer: bytes });
    for (const [i, text] of result.value.split(/\n\n/).entries())
      add(`D_B${i + 1}`, `DOCX paragraph ${i + 1}`, text.replace(/\n$/, ""));
    if (result.messages.length) flags.push("incomplete_text");
  }
  if (!blocks.length) flags.push("incomplete_text");
  if (
    blocks.some((b) =>
      /ignore\s+(?:previous|all|prior)|system\s*prompt|award\s+(?:full|100)|rank\s+me|<\/?(?:script|system)>/i.test(
        b.text,
      ),
    )
  )
    flags.push("suspicious_instructions");
  flags.push("uncertain_identity"); // Names/addresses without labelled fields may remain; reviewer inspects masking.
  return ParsedDocument.parse({
    version: EXTRACTION_VERSION,
    hash: hash(bytes),
    quality: flags.includes("incomplete_text") ? "readable_copy" : "readable",
    flags: [...new Set(flags)],
    blocks,
  });
}
