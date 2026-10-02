"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export default function Invitation() {
  const router = useRouter();
  const [tokens, setTokens] = useState<{
      accessToken: string;
      refreshToken: string;
    } | null>(null),
    [signed, setSigned] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const f = new URLSearchParams(window.location.hash.slice(1));
    if (f.get("access_token") && f.get("refresh_token"))
      setTokens({
        accessToken: f.get("access_token")!,
        refreshToken: f.get("refresh_token")!,
      });
    window.history.replaceState(null, "", "/auth/confirm");
  }, []);
  async function submit(body: unknown) {
    const r = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      d = await r.json();
    if (!r.ok) throw new Error(d.error);
  }
  return (
    <main className="login panel">
      <h1>Accept your invitation</h1>
      <p>
        Invited team members only. Set a password, then enrol multi-factor
        authentication.
      </p>
      {error && <p role="alert">{error}</p>}
      {!signed ? (
        <Button
          disabled={!tokens}
          onClick={async () => {
            try {
              await submit({ type: "session", ...tokens });
              setTokens(null);
              setSigned(true);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Continue securely
        </Button>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await submit({
                type: "password",
                password: new FormData(e.currentTarget).get("password"),
              });
              router.push("/login");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <label htmlFor="new-password">
            New password (at least 12 characters)
          </label>
          <Input
            id="new-password"
            name="password"
            type="password"
            minLength={12}
            required
            autoComplete="new-password"
          />
          <Button className="mt-4">Save password and sign in</Button>
        </form>
      )}
    </main>
  );
}
