"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
export default function Login() {
  const router = useRouter();
  const [factor, setFactor] = useState<string | null>(null),
    [qr, setQr] = useState(""),
    [setupKey, setSetupKey] = useState(""),
    [error, setError] = useState(""),
    [signed, setSigned] = useState(false),
    [busy, setBusy] = useState(false);
  async function action(body: unknown) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      return d;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login panel">
      <h1>Shortlist sign in</h1>
      <p className="mb-5">
        Invited workspace members only. An authenticator code protects your workspace
        after you sign in.
      </p>
      {error && (
        <p role="alert" className="mb-4">
          {error}
        </p>
      )}
      {!signed ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const d = await action({
              type: "login",
              email: f.get("email"),
              password: f.get("password"),
            });
            if (d) {
              setSigned(true);
              setFactor(d.factorId);
            }
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </Field>
          </FieldGroup>
          <Button className="mt-5" disabled={busy}>
            Sign in
          </Button>
        </form>
      ) : !factor ? (
        <Button
          disabled={busy}
          onClick={async () => {
            const d = await action({ type: "enroll" });
            if (d) {
              setFactor(d.factorId);
              setQr(d.qr);
              setSetupKey(d.secret);
            }
          }}
        >
          Set up authenticator
        </Button>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            if (
              await action({
                type: "verify",
                factorId: factor,
                code: f.get("code"),
              })
            )
              router.push("/");
          }}
        >
          {qr && (
            <>
              <p>Scan this private QR code with your authenticator.</p>
              {/* Supabase-generated QR is an image, never injected markup. */}
              <img
                src={qr}
                alt="Authenticator setup QR"
                width="200"
                height="200"
              />
              {setupKey && (
                <details className="my-4">
                  <summary>Can’t scan? Enter a setup key instead</summary>
                  <p className="mt-3">
                    In your authenticator app, add an account manually. Name it
                    Shortlist, choose a time-based code, and enter this private key:
                  </p>
                  <code className="block break-all select-all my-3">{setupKey}</code>
                  <p>Then enter the six-digit code from your authenticator below.</p>
                </details>
              )}
            </>
          )}
          <Field>
            <FieldLabel htmlFor="code">Six digit authenticator code</FieldLabel>
            <Input
              id="code"
              name="code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoComplete="one-time-code"
            />
          </Field>
          <Button className="mt-5" disabled={busy}>
            Verify and continue
          </Button>
        </form>
      )}
    </main>
  );
}
