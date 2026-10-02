import { readBoundedText } from "@/lib/http";
import { validOrigin } from "@/lib/origin";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sessionClient } from "@/lib/supabase";
import { WorkflowError } from "@/lib/workflow";
import { rateLimit } from "@/lib/rate-limit";
import { configuration } from "@/lib/config";
export async function POST(req: NextRequest) {
  const headers = { "Cache-Control": "private, no-store" };
  if (!validOrigin(req))
    return NextResponse.json(
      { error: "Origin denied." },
      { status: 403, headers },
    );
  try {
    if (configuration().mode !== "supabase-synthetic")
      return NextResponse.json(
        { error: "Local synthetic mode needs no sign in." },
        { status: 400, headers },
      );
    await rateLimit(
      process.env.VERCEL
        ? (req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown")
        : "loopback",
      "auth",
      20,
      60,
    );
    const raw = await readBoundedText(req, 10000);
    if (raw.length > 10000) throw new Error();
    const input = z
      .discriminatedUnion("type", [
        z
          .object({
            type: z.literal("login"),
            email: z.email(),
            password: z.string().min(1).max(1000),
          })
          .strict(),
        z.object({ type: z.literal("enroll") }).strict(),
        z
          .object({
            type: z.literal("verify"),
            factorId: z.uuid(),
            code: z.string().regex(/^\d{6}$/),
          })
          .strict(),
        z.object({ type: z.literal("logout") }).strict(),
        z
          .object({
            type: z.literal("session"),
            accessToken: z.string().min(1).max(6000),
            refreshToken: z.string().min(1).max(2000),
          })
          .strict(),
        z
          .object({
            type: z.literal("password"),
            password: z.string().min(12).max(200),
          })
          .strict(),
      ])
      .parse(JSON.parse(raw));
    const client = await sessionClient();
    if (input.type === "session") {
      const { error } = await client.auth.setSession({
        access_token: input.accessToken,
        refresh_token: input.refreshToken,
      });
      if (error) throw new Error();
      const { data } = await client.auth.getUser();
      if (!data.user) throw new Error();
      return NextResponse.json({ ok: true }, { headers });
    }
    if (input.type === "password") {
      const { data } = await client.auth.getUser();
      if (!data.user) throw new Error();
      const { error } = await client.auth.updateUser({
        password: input.password,
      });
      if (error) throw new Error();
      return NextResponse.json({ ok: true }, { headers });
    }
    if (input.type === "login") {
      const { error } = await client.auth.signInWithPassword({
        email: input.email,
        password: input.password,
      });
      if (error) throw new Error();
      const { data } = await client.auth.mfa.listFactors();
      return NextResponse.json(
        {
          factorId: data?.totp.find((f) => f.status === "verified")?.id ?? null,
        },
        { headers },
      );
    }
    if (input.type === "enroll") {
      const {
        data: { user },
      } = await client.auth.getUser();
      if (!user) throw new Error();
      const { data, error } = await client.auth.mfa.enroll({
        factorType: "totp",
      });
      if (error) throw new Error();
      return NextResponse.json(
        { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret },
        { headers },
      );
    }
    if (input.type === "verify") {
      const { error } = await client.auth.mfa.challengeAndVerify({
        factorId: input.factorId,
        code: input.code,
      });
      if (error) throw new Error();
      return NextResponse.json({ ok: true }, { headers });
    }
    const { error } = await client.auth.signOut();
    if (error) throw new Error();
    return NextResponse.json({ ok: true }, { headers });
  } catch (error) {
    if (error instanceof WorkflowError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers },
      );
    return NextResponse.json(
      {
        error: "Authentication failed. Check your invitation and credentials.",
      },
      { status: 401, headers },
    );
  }
}
