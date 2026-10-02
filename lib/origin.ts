import { NextRequest } from "next/server";
export function validOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const configured = process.env.APP_URL;
  if (configured) {
    try {
      return origin === new URL(configured).origin;
    } catch {
      return false;
    }
  }
  // Next.js internally normalises loopback URLs; use the actual browser Host.
  if (process.env.VERCEL) return false;
  const host = request.headers.get("host");
  if (!host || !/^(127\.0\.0\.1|localhost):\d+$/.test(host)) return false;
  return origin === `${request.nextUrl.protocol}//${host}`;
}
