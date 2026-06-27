import { createHash } from "node:crypto";

export type AuthConfig = {
  url: string;
  token?: string;
  account?: string;
  password?: string;
  skipSsl?: boolean;
};

export class TokenManager {
  private token: string | null;
  private readonly config: AuthConfig;

  constructor(config: AuthConfig) {
    this.config = config;
    this.token = config.token ?? null;
  }

  getToken(): string | null {
    return this.token;
  }

  hasStaticToken(): boolean {
    return Boolean(this.config.token);
  }

  async ensureToken(): Promise<string> {
    if (this.token) return this.token;
    await this.refreshToken();
    if (!this.token) {
      throw new Error("Failed to obtain ZenTao API token");
    }
    return this.token;
  }

  invalidate(): void {
    if (!this.config.token) {
      this.token = null;
    }
  }

  async refreshToken(): Promise<string> {
    if (this.config.token) {
      this.token = this.config.token;
      return this.token;
    }

    const account = this.config.account;
    const password = this.config.password;
    if (!account || password === undefined) {
      throw new Error(
        "ZENTAO_ACCOUNT and ZENTAO_PASSWORD are required when ZENTAO_TOKEN is not set",
      );
    }

    const url = `${this.config.url}/api.php/v1/tokens`;
    const attempts: Array<{ label: string; body: Record<string, string> }> = [
      { label: "plain", body: { account, password } },
      { label: "md5", body: { account, password: md5(password) } },
    ];

    let lastError: unknown;
    for (const attempt of attempts) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(attempt.body),
        });
        const payload = (await response.json()) as Record<string, unknown>;
        if (!response.ok) {
          lastError = payload;
          continue;
        }
        const token = extractToken(payload);
        if (!token) {
          lastError = payload;
          continue;
        }
        this.token = token;
        return token;
      } catch (error) {
        lastError = error;
      }
    }

    throw new Error(`ZenTao token request failed: ${formatError(lastError)}`);
  }
}

function md5(value: string): string {
  return createHash("md5").update(value).digest("hex");
}

function extractToken(payload: Record<string, unknown>): string | null {
  if (typeof payload.token === "string" && payload.token) return payload.token;
  const data = payload.data;
  if (data && typeof data === "object" && "token" in data) {
    const token = (data as { token?: unknown }).token;
    if (typeof token === "string" && token) return token;
  }
  return null;
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export type ZenTaoRequestInit = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: Record<string, string | number | undefined>;
  body?: unknown;
};

export class ZenTaoHttpClient {
  private readonly auth: TokenManager;
  private readonly baseUrl: string;

  constructor(auth: TokenManager, baseUrl: string) {
    this.auth = auth;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async request<T = unknown>(
    path: string,
    init: ZenTaoRequestInit = {},
  ): Promise<T> {
    const method = init.method ?? "GET";
    const url = buildUrl(`${this.baseUrl}/api.php/v1${path}`, init.query);

    const doRequest = async (): Promise<Response> => {
      const token = await this.auth.ensureToken();
      return fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Token: token,
        },
        body:
          init.body !== undefined ? JSON.stringify(init.body) : undefined,
      });
    };

    let response = await doRequest();
    if (response.status === 401 && !this.auth.hasStaticToken()) {
      this.auth.invalidate();
      response = await doRequest();
    }

    const text = await response.text();
    let payload: unknown = text;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }

    if (!response.ok) {
      throw new ZenTaoApiError(response.status, payload);
    }

    return payload as T;
  }
}

export class ZenTaoApiError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(status: number, payload: unknown) {
    super(`ZenTao API error (${status}): ${formatError(payload)}`);
    this.name = "ZenTaoApiError";
    this.status = status;
    this.payload = payload;
  }
}

function buildUrl(
  base: string,
  query?: Record<string, string | number | undefined>,
): string {
  if (!query) return base;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === "") continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}
