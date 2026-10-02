"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, CircleAlert, Copy } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { OtpInput } from "@/components/ui/otp-input";
import { focusRing } from "@/components/ui/focus-ring";
import "@/components/ui/motion.css";

type Step = "signin" | "enroll" | "setup" | "verify";

/** What the server says when it will not say why (see app/api/auth/route.ts). */
const GENERIC_SERVER_ERROR =
  "Authentication failed. Check your invitation and credentials.";

const FRIENDLY_FALLBACK: Record<string, string> = {
  login:
    "That email and password did not match an invited member. Check both and try again, or ask your administrator to confirm your invitation.",
  enroll:
    "Authenticator setup could not start. Try again, or sign in again if it keeps failing.",
  verify:
    "That code didn't match. Check your authenticator's current code and try again.",
};
const NETWORK_ERROR =
  "Could not reach the server. Check your connection and try again.";

export default function Login() {
  const router = useRouter();
  const [factor, setFactor] = useState<string | null>(null),
    [qr, setQr] = useState(""),
    [secret, setSecret] = useState(""),
    [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [signed, setSigned] = useState(false),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");
  const heading = useRef<HTMLHeadingElement>(null),
    secretText = useRef<HTMLElement>(null),
    codeInput = useRef<HTMLInputElement>(null),
    copyTimer = useRef<ReturnType<typeof setTimeout>>(undefined),
    mounted = useRef(false);

  const step: Step = !signed
    ? "signin"
    : !factor
      ? "enroll"
      : qr
        ? "setup"
        : "verify";

  // After a step change the control the user pressed is gone; move focus to
  // the new heading so keyboard and screen reader users land on the new step.
  useEffect(() => {
    if (mounted.current) heading.current?.focus();
    mounted.current = true;
  }, [step]);
  useEffect(() => () => clearTimeout(copyTimer.current), []);

  async function action(body: { type: string } & Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        const message = typeof d?.error === "string" ? d.error : "";
        throw new Error(
          !message || message === GENERIC_SERVER_ERROR
            ? (FRIENDLY_FALLBACK[body.type] ?? GENERIC_SERVER_ERROR)
            : message,
        );
      }
      return d;
    } catch (e) {
      setError(
        e instanceof TypeError
          ? NETWORK_ERROR
          : e instanceof Error && e.message
            ? e.message
            : (FRIENDLY_FALLBACK[body.type] ?? GENERIC_SERVER_ERROR),
      );
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function copySecret() {
    clearTimeout(copyTimer.current);
    try {
      await navigator.clipboard.writeText(secret);
      setCopied("copied");
    } catch {
      // Clipboard blocked (permissions, insecure context): select the key so
      // the user can copy it by hand.
      if (secretText.current)
        window.getSelection()?.selectAllChildren(secretText.current);
      setCopied("failed");
    }
    copyTimer.current = setTimeout(() => setCopied("idle"), 1500);
  }

  function verify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("Enter all six digits of the code from your authenticator.");
      codeInput.current?.focus();
      return;
    }
    void (async () => {
      if (await action({ type: "verify", factorId: factor, code })) {
        setDone(true);
        router.push("/");
      } else {
        setCode("");
        codeInput.current?.focus();
      }
    })();
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground min-[900px]:grid min-[900px]:grid-cols-[2fr_3fr]">
      <header className="flex h-14 shrink-0 items-center bg-sidebar px-4 text-sidebar-foreground min-[900px]:sticky min-[900px]:top-0 min-[900px]:h-dvh min-[900px]:flex-col min-[900px]:items-start min-[900px]:justify-between min-[900px]:px-12 min-[900px]:py-12">
        <div className="[--logo-accent:var(--sidebar-accent)]">
          <Logo className="gap-2.5 text-lg font-semibold tracking-[-0.02em]" />
        </div>
        <div className="hidden max-w-sm min-[900px]:block">
          <p className="text-balance text-[1.75rem] leading-tight font-semibold tracking-[-0.03em] text-sidebar-foreground!">
            Evidence first. You decide.
          </p>
          <p className="mt-4 text-sm text-(--sidebar-muted)!">
            This is a synthetic proof of concept. It uses fictional CVs only.
          </p>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10 min-[900px]:px-12">
        <div className="w-full max-w-[25rem]">
          <div
            key={step}
            className="animate-[ui-fade-in_var(--dur-base)_var(--ease-out)] motion-reduce:animate-none"
          >
            <div className="mb-6">
              <h1
                ref={heading}
                tabIndex={-1}
                className="text-foreground outline-none!"
              >
                {step === "signin"
                  ? "Sign in"
                  : step === "verify"
                    ? "Enter your code"
                    : "Set up authenticator"}
              </h1>
              <p className="mt-2">
                {step === "signin"
                  ? "Invited workspace members only. Multi-factor authentication is required."
                  : step === "enroll"
                    ? "You are signed in. Link an authenticator app to protect your account before you continue."
                    : step === "setup"
                      ? "Scan this QR code with your authenticator app, then enter the code it shows."
                      : "Open your authenticator app and enter the current code."}
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="mb-5 flex items-start gap-2 text-sm text-destructive"
              >
                <CircleAlert
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0"
                />
                <span>{error}</span>
              </div>
            )}

            {step === "signin" && (
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
                <FieldGroup className="gap-5">
                  <Field>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="username"
                      required
                      className="h-10"
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
                      className="h-10"
                    />
                  </Field>
                </FieldGroup>
                <Button
                  type="submit"
                  size="lg"
                  className="mt-6 w-full px-4"
                  loading={busy}
                >
                  Sign in
                </Button>
              </form>
            )}

            {step === "enroll" && (
              <Button
                size="lg"
                className="w-full px-4"
                loading={busy}
                onClick={async () => {
                  const d = await action({ type: "enroll" });
                  if (d) {
                    setFactor(d.factorId);
                    setQr(d.qr);
                    setSecret(typeof d.secret === "string" ? d.secret : "");
                  }
                }}
              >
                Set up authenticator
              </Button>
            )}

            {step === "setup" && (
              <div className="mb-6">
                {/* Supabase-generated QR is an image, never injected markup. The
                    tile stays light in every theme so the code scans in dark mode;
                    --sidebar-foreground is the one token that is light in both. */}
                <div className="w-fit rounded-lg bg-sidebar-foreground p-3">
                  <img
                    src={
                      qr.startsWith("data:image/")
                        ? qr
                        : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr)}`
                    }
                    alt="Authenticator setup QR"
                    width="200"
                    height="200"
                  />
                </div>
                {secret && (
                  <details className="group mt-4">
                    <summary
                      className={`flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-md py-1.5 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden ${focusRing}`}
                    >
                      <ChevronRight
                        aria-hidden="true"
                        className="size-4 transition-transform duration-(--dur-fast) ease-(--ease-out) group-open:rotate-90 motion-reduce:transition-none"
                      />
                      Can’t scan? Enter a setup key instead
                    </summary>
                    <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
                      <code
                        ref={secretText}
                        className="block flex-1 rounded-md border border-input bg-surface-2 px-3 py-2 font-mono text-sm tracking-wider break-words text-foreground select-all"
                      >
                        {secret}
                      </code>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={copySecret}
                        className="shrink-0"
                      >
                        {copied === "copied" ? (
                          <Check aria-hidden="true" />
                        ) : (
                          <Copy aria-hidden="true" />
                        )}
                        {copied === "copied" ? "Copied" : "Copy"}
                      </Button>
                    </div>
                    <span role="status" className="sr-only">
                      {copied === "copied" ? "Key copied to clipboard" : ""}
                    </span>
                    {copied === "failed" && (
                      <p className="mt-2 text-sm">
                        Could not copy automatically. The key is selected, so
                        copy it with your keyboard.
                      </p>
                    )}
                  </details>
                )}
                <h2 className="mt-6 border-t pt-6 text-foreground">
                  Enter the 6-digit code to finish
                </h2>
              </div>
            )}

            {(step === "setup" || step === "verify") && (
              <form onSubmit={verify} noValidate>
                <Field>
                  <FieldLabel htmlFor="code">
                    Six digit authenticator code
                  </FieldLabel>
                  <OtpInput
                    ref={codeInput}
                    value={code}
                    onChange={setCode}
                    disabled={done}
                    invalid={Boolean(error)}
                  />
                </Field>
                <Button
                  type="submit"
                  size="lg"
                  className="mt-6 w-full px-4"
                  loading={busy || done}
                >
                  Verify and continue
                </Button>
              </form>
            )}
          </div>

          <p className="mt-8 text-sm min-[900px]:hidden">
            This is a synthetic proof of concept. It uses fictional CVs only.
          </p>
        </div>
      </main>
    </div>
  );
}
