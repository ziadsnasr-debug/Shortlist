# Hosted Shortlist

As of 2 October 2026:

- Production: https://shortlist-steel-ten.vercel.app
- Supabase project: `owapstoqjhscfmaclotp`, Shortlist, London (`eu-west-2`).
- Organisation: `ozxhqittmqfsmzdscfkl`, Free plan. No paid project created.
- Persistence: `supabase-synthetic`; real CV processing remains disabled.
- Public signup disabled; administrator membership and TOTP MFA required.
- Originals bucket is private. Server owns document access and processing.
- Production environment variables are encrypted in Vercel; no values belong in this repository.

## Local account routing

The original Supabase connector and default CLI account remain unchanged.
The separate Shortlist account is available through:

```sh
supabase projects list --profile /Users/ziadnasr/.supabase/profiles/shortlist.json
```

The profile contains only public endpoint configuration. Authentication is
stored separately in macOS Keychain by Supabase CLI. Always pass this profile
for Shortlist management operations; do not globally switch or log out the
original account. The hosted Supabase MCP connector still targets the original
account; use the explicit CLI profile for Shortlist.

## Limits

Free projects may pause after a week of inactivity. OpenAI and Vercel usage are
separate from Supabase's free plan. Deployment readiness does not establish
successful authenticated document processing; record that acceptance separately.
