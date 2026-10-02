import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validOrigin } from "./origin";
import { WorkflowError } from "./workflow";
export const privateHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};
export async function jsonBody<T>(
  req: NextRequest,
  schema: z.ZodType<T>,
  cap = 20000,
): Promise<T> {
  if (!validOrigin(req)) throw new WorkflowError("Request origin denied.", 403);
  if (Number(req.headers.get("content-length") ?? 0) > cap)
    throw new WorkflowError("Request too large.", 413);
  const body = await readBoundedText(req, cap);
  return schema.parse(JSON.parse(body));
}
export function fail(error: unknown) {
  return NextResponse.json(
    {
      error:
        error instanceof WorkflowError
          ? error.message
          : "Operation unavailable. Check configuration or reload saved state.",
    },
    {
      status:
        error instanceof WorkflowError
          ? error.status
          : error instanceof z.ZodError
            ? 422
            : 503,
      headers: privateHeaders,
    },
  );
}

export async function readBoundedText(req: Request, cap: number) {
  const reader = req.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > cap) {
        await reader.cancel();
        throw new WorkflowError("Request too large.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(output);
}
