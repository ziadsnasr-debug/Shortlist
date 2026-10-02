// Local synthetic owner only. Enrol a test authenticator; never print password or seed.
import { readFile, writeFile, chmod } from "node:fs/promises";
import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
export function totp(secret: string) {
  let bits = "";
  for (const c of secret.toUpperCase()) {
    const i = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".indexOf(c);
    if (i >= 0) bits += i.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8)
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = createHmac("sha1", Buffer.from(bytes)).update(counter).digest();
  return ((h.readUInt32BE(h[19] & 15) & 0x7fffffff) % 1000000)
    .toString()
    .padStart(6, "0");
}
if (import.meta.url.endsWith(process.argv[1]?.split("/").at(-1) ?? "never")) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (new URL(url).hostname !== "127.0.0.1") throw new Error("LOCAL_ONLY");
  const owner = JSON.parse(await readFile("work/local-owner.json", "utf8"));
  const client = createClient(url, key, { auth: { persistSession: false } });
  if (
    (
      await client.auth.signInWithPassword({
        email: owner.email,
        password: owner.password,
      })
    ).error
  )
    throw new Error("LOCAL_LOGIN");
  if (!owner.secret) {
    const { data, error } = await client.auth.mfa.enroll({
      factorType: "totp",
    });
    if (error || !data) throw new Error("LOCAL_ENROLL");
    owner.secret = data.totp.secret;
    owner.factorId = data.id;
  }
  if (
    (
      await client.auth.mfa.challengeAndVerify({
        factorId: owner.factorId,
        code: totp(owner.secret),
      })
    ).error
  )
    throw new Error("LOCAL_VERIFY");
  await writeFile("work/local-owner.json", JSON.stringify(owner), {
    mode: 0o600,
  });
  await chmod("work/local-owner.json", 0o600);
  console.log(
    "Local synthetic owner MFA verified; private credentials retained locally.",
  );
}
