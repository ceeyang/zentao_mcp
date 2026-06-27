import { assertProductAllowed, type AppConfig } from "../config.js";
import type { ZenTaoClient, BugRecord } from "../client/zentao-client.js";
import { extractBugItems, extractBugTotal } from "../client/zentao-client.js";
import { htmlToPlainText, pickAccount, pickStatus } from "../utils/html.js";
import { ok, fail, type ToolEnvelope } from "../utils/envelope.js";
import type { TokenManager } from "../client/auth.js";

export type HealthCheckInput = {
  forceTokenRefresh?: boolean;
};

export type HealthCheckOutput = {
  configured: boolean;
  baseUrl: string;
  apiBasePath: string;
  authenticated: boolean;
  authError?: unknown;
  credentials: {
    tokenConfigured: boolean;
    accountConfigured: boolean;
    passwordConfigured: boolean;
  };
  writeGates: {
    resolveBugEnabled: boolean;
    closeBugEnabled: boolean;
    activateBugEnabled: boolean;
  };
  allowedProducts?: number[];
  defaultProductId?: number;
};

export async function healthCheck(
  config: AppConfig,
  auth: TokenManager,
  client: ZenTaoClient,
  input: HealthCheckInput = {},
): Promise<ToolEnvelope<HealthCheckOutput>> {
  const output: HealthCheckOutput = {
    configured: true,
    baseUrl: config.url,
    apiBasePath: "/api.php/v1",
    authenticated: false,
    credentials: {
      tokenConfigured: Boolean(config.token),
      accountConfigured: Boolean(config.account),
      passwordConfigured: config.password !== undefined,
    },
    writeGates: {
      resolveBugEnabled: config.allowResolveBug,
      closeBugEnabled: config.allowCloseBug,
      activateBugEnabled: config.allowActivateBug,
    },
    allowedProducts: config.allowedProducts,
    defaultProductId: config.defaultProductId,
  };

  try {
    if (input.forceTokenRefresh) {
      auth.invalidate();
      await auth.refreshToken();
    } else {
      await auth.ensureToken();
    }
    await client.listProducts(1);
    output.authenticated = true;
    return ok(output);
  } catch (error) {
    output.authenticated = false;
    output.authError = error instanceof Error ? error.message : error;
    return fail("HEALTH_CHECK_FAILED", "ZenTao health check failed", output);
  }
}

export type BugSummary = {
  id: number;
  title: string;
  status: string;
  severity?: number;
  pri?: number;
  type?: string;
  assignedTo?: string | null;
  openedBy?: string | null;
  product?: number;
  project?: number;
  execution?: number;
};

export function summarizeBugListItem(bug: BugRecord): BugSummary {
  return {
    id: Number(bug.id),
    title: String(bug.title ?? ""),
    status: pickStatus(bug.status),
    severity: bug.severity != null ? Number(bug.severity) : undefined,
    pri: bug.pri != null ? Number(bug.pri) : undefined,
    type: bug.type != null ? String(bug.type) : undefined,
    assignedTo: pickAccount(bug.assignedTo),
    openedBy: pickAccount(bug.openedBy),
    product: bug.product != null ? Number(bug.product) : undefined,
    project: bug.project != null ? Number(bug.project) : undefined,
    execution: bug.execution != null ? Number(bug.execution) : undefined,
  };
}

export type BugDetailSummary = BugSummary & {
  stepsPlain: string;
  storyTitle?: string;
  projectName?: string;
  executionName?: string;
  files: Array<{ id: number; name: string }>;
};

export function summarizeBugDetail(bug: BugRecord): BugDetailSummary {
  const base = summarizeBugListItem(bug);
  const filesRaw = Array.isArray(bug.files) ? bug.files : [];
  const files = filesRaw
    .map((file) => {
      if (!file || typeof file !== "object") return null;
      const record = file as Record<string, unknown>;
      const id = Number(record.id);
      const name = String(record.title ?? record.name ?? record.filename ?? "");
      if (!Number.isFinite(id) || !name) return null;
      return { id, name };
    })
    .filter((item): item is { id: number; name: string } => item !== null);

  return {
    ...base,
    stepsPlain: htmlToPlainText(
      typeof bug.steps === "string" ? bug.steps : undefined,
    ),
    storyTitle:
      typeof bug.storyTitle === "string" ? bug.storyTitle : undefined,
    projectName:
      typeof bug.projectName === "string" ? bug.projectName : undefined,
    executionName:
      typeof bug.executionName === "string" ? bug.executionName : undefined,
    files,
  };
}

export type ListMyBugsInput = {
  type?: string;
  order?: string;
  page?: number;
  limit?: number;
};

export async function listMyBugs(
  client: ZenTaoClient,
  input: ListMyBugsInput = {},
): Promise<
  ToolEnvelope<{
    page: number;
    limit: number;
    total: number;
    items: BugSummary[];
  }>
> {
  try {
    const payload = await client.listMyBugs(input);
    const bugs = extractBugItems(payload);
    return ok({
      page: payload.page ?? input.page ?? 1,
      limit: payload.limit ?? input.limit ?? 20,
      total: extractBugTotal(payload) ?? bugs.length,
      items: bugs.map(summarizeBugListItem),
    });
  } catch (error) {
    return fail(
      "LIST_MY_BUGS_FAILED",
      error instanceof Error ? error.message : "Failed to list my bugs",
    );
  }
}

export type ListBugsInput = {
  scope: "product" | "project" | "execution";
  id: number;
  status?: string;
  browseType?: string;
  assignedTo?: string;
  keyword?: string;
  page?: number;
  limit?: number;
};

export async function listBugs(
  config: AppConfig,
  client: ZenTaoClient,
  input: ListBugsInput,
): Promise<
  ToolEnvelope<{
    scope: string;
    id: number;
    page: number;
    limit: number;
    total: number;
    items: BugSummary[];
  }>
> {
  try {
    if (input.scope === "product") {
      assertProductAllowed(config, input.id);
    }
    const payload = await client.listBugs(input);
    const bugs = extractBugItems(payload);
    return ok({
      scope: input.scope,
      id: input.id,
      page: payload.page ?? input.page ?? 1,
      limit: payload.limit ?? input.limit ?? 20,
      total: payload.total ?? bugs.length,
      items: bugs.map(summarizeBugListItem),
    });
  } catch (error) {
    return fail(
      "LIST_BUGS_FAILED",
      error instanceof Error ? error.message : "Failed to list bugs",
    );
  }
}

export type GetBugInput = {
  bugId: number;
};

export async function getBug(
  client: ZenTaoClient,
  input: GetBugInput,
): Promise<
  ToolEnvelope<{
    raw: BugRecord;
    summary: BugDetailSummary;
  }>
> {
  try {
    const raw = await client.getBug(input.bugId);
    return ok({
      raw,
      summary: summarizeBugDetail(raw),
    });
  } catch (error) {
    return fail(
      "GET_BUG_FAILED",
      error instanceof Error ? error.message : "Failed to get bug",
    );
  }
}

export type ResolveBugInput = {
  bugId: number;
  resolution: string;
  resolvedBuild?: string;
  assignedTo?: string;
  comment?: string;
  duplicateBug?: number;
  dryRun?: boolean;
};

export async function resolveBug(
  config: AppConfig,
  client: ZenTaoClient,
  input: ResolveBugInput,
): Promise<ToolEnvelope<unknown>> {
  const body = {
    resolution: input.resolution,
    resolvedBuild: input.resolvedBuild ?? "trunk",
    assignedTo: input.assignedTo,
    comment: input.comment,
    duplicateBug: input.duplicateBug,
  };
  const request = {
    method: "POST" as const,
    path: `/bugs/${input.bugId}/resolve`,
    body,
  };

  if (input.dryRun) {
    return ok({ dryRun: true, request });
  }
  if (!config.allowResolveBug) {
    return fail(
      "WRITE_FORBIDDEN",
      "Resolve bug is disabled. Set ZENTAO_ALLOW_RESOLVE_BUG=true to enable.",
      request,
    );
  }

  try {
    const raw = await client.resolveBug(input.bugId, body);
    return ok({ raw, summary: summarizeBugDetail(raw) });
  } catch (error) {
    return fail(
      "RESOLVE_BUG_FAILED",
      error instanceof Error ? error.message : "Failed to resolve bug",
    );
  }
}

export type CloseBugInput = {
  bugId: number;
  comment?: string;
  dryRun?: boolean;
};

export async function closeBug(
  config: AppConfig,
  client: ZenTaoClient,
  input: CloseBugInput,
): Promise<ToolEnvelope<unknown>> {
  const body = { comment: input.comment };
  const request = {
    method: "POST" as const,
    path: `/bugs/${input.bugId}/close`,
    body,
  };

  if (input.dryRun) {
    return ok({ dryRun: true, request });
  }
  if (!config.allowCloseBug) {
    return fail(
      "WRITE_FORBIDDEN",
      "Close bug is disabled. Set ZENTAO_ALLOW_CLOSE_BUG=true to enable.",
      request,
    );
  }

  try {
    const raw = await client.closeBug(input.bugId, body);
    return ok({ raw, summary: summarizeBugDetail(raw) });
  } catch (error) {
    return fail(
      "CLOSE_BUG_FAILED",
      error instanceof Error ? error.message : "Failed to close bug",
    );
  }
}

export type ActivateBugInput = {
  bugId: number;
  assignedTo?: string;
  openedBuild?: string[];
  comment?: string;
  dryRun?: boolean;
};

export async function activateBug(
  config: AppConfig,
  client: ZenTaoClient,
  input: ActivateBugInput,
): Promise<ToolEnvelope<unknown>> {
  const body = {
    assignedTo: input.assignedTo,
    openedBuild: input.openedBuild ?? ["trunk"],
    comment: input.comment,
  };
  const request = {
    method: "POST" as const,
    path: `/bugs/${input.bugId}/active`,
    body,
  };

  if (input.dryRun) {
    return ok({ dryRun: true, request });
  }
  if (!config.allowActivateBug) {
    return fail(
      "WRITE_FORBIDDEN",
      "Activate bug is disabled. Set ZENTAO_ALLOW_ACTIVATE_BUG=true to enable.",
      request,
    );
  }

  try {
    const raw = await client.activateBug(input.bugId, body);
    return ok({ raw, summary: summarizeBugDetail(raw) });
  } catch (error) {
    return fail(
      "ACTIVATE_BUG_FAILED",
      error instanceof Error ? error.message : "Failed to activate bug",
    );
  }
}
