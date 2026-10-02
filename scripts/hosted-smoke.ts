import { runHostedSmoke } from "../lib/hosted-smoke";

const rawUrl = process.env.SHORTLIST_HOSTED_URL;
if (!rawUrl) throw new Error("Set SHORTLIST_HOSTED_URL to the approved hosted synthetic URL.");
const result = await runHostedSmoke({ rawUrl, temporaryPublic: process.env.HOSTED_EXPECT_TEMPORARY_PUBLIC === "true" });
console.log(`PASS: hosted ${result.mode} smoke (${result.base}); protected surfaces deny unauthenticated access.`);
