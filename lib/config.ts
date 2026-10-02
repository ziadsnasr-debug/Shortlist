import "server-only";
export function configuration() {
  const mode = process.env.PERSISTENCE_MODE ?? "local-synthetic";
  if (!["local-synthetic", "supabase-synthetic"].includes(mode))
    throw new Error("Only synthetic persistence modes are implemented.");
  if (process.env.REAL_CV_DATA_ENABLED === "true")
    throw new Error("Real CV processing is not implemented or approved.");
  if (mode === "local-synthetic" && process.env.VERCEL)
    throw new Error(
      "Hosted environments require Supabase ownership and persistence.",
    );
  return {
    mode,
    appUrl: process.env.APP_URL,
    ai: {
      enabled:
        process.env.AI_ENABLED === "true" &&
        !!process.env.OPENAI_API_KEY &&
        !!process.env.AI_MODEL_ID,
      provider: "openai",
      model: process.env.AI_MODEL_ID ?? null,
      promptVersion: "evidence-v2-openai",
      schemaVersion: 1,
      timeoutMs: 45000,
      passes: 2,
      maxOutputTokens: 4000,
    },
    limits: {
      files: 30,
      inputBytes: 5 * 1024 * 1024,
      pdfPages: 10,
      criteria: 12,
      expandedDocxBytes: 50 * 1024 * 1024,
      archiveEntries: 500,
      textCharacters: 100000,
      parserMs: 30000,
    },
  } as const;
}

export function processingVersion() {
  const c = configuration();
  return `${c.ai.promptVersion}:${c.ai.provider}:${process.env.AI_ENABLED === "true" ? (c.ai.model ?? "unconfigured") : "manual"}:${process.env.PARSER_BUNDLE_SHA256 ?? "unconfigured"}`;
}
