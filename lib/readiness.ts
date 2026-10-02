export type ReadinessStatus = "pass" | "fail" | "not_applicable";
export type ReadinessCheck = {
  name: string;
  status: ReadinessStatus;
};

export type ReadinessReport = {
  status: "configuration_ready" | "blocked";
  checks: ReadinessCheck[];
};

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const VALID_ENVIRONMENTS = new Set(["local", "staging", "production"]);
const MAX_MONTHLY_ALLOWANCE = 1_000;

function configured(value: string | undefined) {
  return value !== undefined && value.trim().length > 0;
}

function parsedUrl(value: string | undefined) {
  if (!configured(value)) return null;
  try {
    const url = new URL(value!);
    if (url.origin !== value || url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

function isLoopback(url: URL) {
  return LOOPBACK_HOSTS.has(url.hostname.toLowerCase());
}

function allowanceValid(value: string | undefined) {
  if (!configured(value)) return true; // Application default is 240.
  if (!/^\d+$/.test(value!.trim())) return false;
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount >= 1 && amount <= MAX_MONTHLY_ALLOWANCE;
}

/**
 * Static configuration gate only. A passing result is not a deployment,
 * security, privacy, model-quality, or real-data approval.
 */
export function readiness(
  env: Record<string, string | undefined> = process.env,
): ReadinessReport {
  const mode = env.PERSISTENCE_MODE ?? "local-synthetic";
  const appEnvironment = env.APP_ENV;
  const localMode = mode === "local-synthetic";
  const hostedMode = mode === "supabase-synthetic";
  const localEnvironment = appEnvironment === "local";
  const hostedEnvironment = appEnvironment === "staging" || appEnvironment === "production";
  const appUrl = parsedUrl(env.APP_URL);
  const supabaseUrl = parsedUrl(env.NEXT_PUBLIC_SUPABASE_URL);
  const aiEnabled = env.AI_ENABLED === "true";
  const allowanceOk = allowanceValid(env.MONTHLY_PROCESSING_ALLOWANCE);

  const checks: ReadinessCheck[] = [
    {
      name: "app_environment",
      status: VALID_ENVIRONMENTS.has(appEnvironment ?? "") ? "pass" : "fail",
    },
    {
      name: "persistence_mode",
      status: localMode || hostedMode ? "pass" : "fail",
    },
    {
      name: "environment_mode_match",
      status:
        (localEnvironment && (localMode || hostedMode)) ||
        (hostedEnvironment && hostedMode)
          ? "pass"
          : "fail",
    },
    {
      name: "application_origin",
      status: localEnvironment
        ? !configured(env.APP_URL) ||
          (!!appUrl && appUrl.protocol === "http:" && isLoopback(appUrl))
          ? "pass"
          : "fail"
        : !!appUrl && appUrl.protocol === "https:" && !isLoopback(appUrl)
          ? "pass"
          : "fail",
    },
    {
      name: "supabase_configuration",
      status: localMode
        ? "not_applicable"
        : hostedMode &&
            !!supabaseUrl &&
            (localEnvironment
              ? ["http:", "https:"].includes(supabaseUrl.protocol) && isLoopback(supabaseUrl)
              : supabaseUrl.protocol === "https:" && !isLoopback(supabaseUrl)) &&
            configured(env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
            configured(env.SUPABASE_SERVICE_ROLE_KEY) &&
            configured(env.WORKSPACE_ID)
          ? "pass"
          : "fail",
    },
    {
      name: "hosted_runtime_mode",
      status: env.VERCEL && (!hostedMode || localEnvironment)
        ? "fail"
        : localMode && env.VERCEL
          ? "fail"
          : "pass",
    },
    {
      name: "direct_ai_configuration",
      status: aiEnabled
        ? configured(env.OPENAI_API_KEY) &&
          configured(env.AI_MODEL_ID) &&
          !configured(env.OPENAI_BASE_URL)
          ? "pass"
          : "fail"
        : "not_applicable",
    },
    {
      name: "parser_snapshot_configuration",
      status: localMode
        ? "not_applicable"
        : hostedMode &&
            configured(env.PARSER_SNAPSHOT_ID) &&
            /^[a-f0-9]{64}$/i.test(env.PARSER_BUNDLE_SHA256 ?? "")
          ? "pass"
          : "fail",
    },
    {
      name: "cron_configuration",
      status: localEnvironment || localMode
        ? "not_applicable"
        : hostedMode &&
            configured(env.CRON_SECRET) &&
            env.CRON_SECRET!.length >= 32
          ? "pass"
          : "fail",
    },
    {
      name: "monthly_allowance",
      status: allowanceOk ? "pass" : "fail",
    },
    {
      name: "real_data_disabled",
      status: env.REAL_CV_DATA_ENABLED === "true" ? "fail" : "pass",
    },
  ];

  return {
    status:
      checks.every((check) => check.status !== "fail")
        ? "configuration_ready"
        : "blocked",
    checks,
  };
}
