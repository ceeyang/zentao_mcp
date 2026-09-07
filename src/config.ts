import { z } from "zod";

function parseBoolean(value: string | undefined, defaultValue = false): boolean {
  if (value === undefined || value === "") return defaultValue;
  return value.toLowerCase() === "true" || value === "1";
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  if (!value?.trim()) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function parseIdList(value: string | undefined): number[] | undefined {
  if (!value?.trim()) return undefined;
  const ids = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isFinite(n));
  return ids.length > 0 ? ids : undefined;
}

const configSchema = z.object({
  url: z.string().url("ZENTAO_URL must be a valid URL"),
  token: z.string().optional(),
  account: z.string().optional(),
  password: z.string().optional(),
  skipSsl: z.boolean(),
  allowResolveBug: z.boolean(),
  allowCloseBug: z.boolean(),
  allowActivateBug: z.boolean(),
  allowWriteStory: z.boolean(),
  allowWriteTask: z.boolean(),
  defaultProductId: z.number().optional(),
  allowedProducts: z.array(z.number()).optional(),
});

export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const url = env.ZENTAO_URL?.replace(/\/$/, "");
  if (!url) {
    throw new Error(
      "Missing ZENTAO_URL. Set it in MCP env or .env (e.g. https://zentao.example.com)",
    );
  }

  const token = env.ZENTAO_TOKEN?.trim() || undefined;
  const account = env.ZENTAO_ACCOUNT?.trim() || undefined;
  const password = env.ZENTAO_PASSWORD ?? undefined;

  if (!token && (!account || password === undefined)) {
    throw new Error(
      "Missing credentials. Set ZENTAO_TOKEN or both ZENTAO_ACCOUNT and ZENTAO_PASSWORD.",
    );
  }

  return configSchema.parse({
    url,
    token,
    account,
    password,
    skipSsl: parseBoolean(env.ZENTAO_SKIP_SSL),
    allowResolveBug: parseBoolean(env.ZENTAO_ALLOW_RESOLVE_BUG),
    allowCloseBug: parseBoolean(env.ZENTAO_ALLOW_CLOSE_BUG),
    allowActivateBug: parseBoolean(env.ZENTAO_ALLOW_ACTIVATE_BUG),
    allowWriteStory: parseBoolean(env.ZENTAO_ALLOW_WRITE_STORY),
    allowWriteTask: parseBoolean(env.ZENTAO_ALLOW_WRITE_TASK),
    defaultProductId: parseOptionalNumber(env.ZENTAO_DEFAULT_PRODUCT_ID),
    allowedProducts: parseIdList(env.ZENTAO_ALLOWED_PRODUCTS),
  });
}

export function assertProductAllowed(
  config: AppConfig,
  productId: number,
): void {
  if (!config.allowedProducts?.length) return;
  if (!config.allowedProducts.includes(productId)) {
    throw new Error(
      `Product ${productId} is not in ZENTAO_ALLOWED_PRODUCTS allowlist`,
    );
  }
}
