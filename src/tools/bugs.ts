import { assertProductAllowed, type AppConfig } from "../config.js";
import type { ZenTaoClient, BugRecord } from "../client/zentao-client.js";
import { extractBugItems, extractBugTotal } from "../client/zentao-client.js";
import { htmlToPlainText, extractHtmlImages, pickAccount, pickStatus } from "../utils/html.js";
import { ok, fail, type ToolEnvelope } from "../utils/envelope.js";
import type { TokenManager } from "../client/auth.js";
import type { ZenTaoHttpClient } from "../client/auth.js";

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

export type BugActionSummary = {
  action: string;
  actor: string | null;
  date?: string;
  commentPlain: string;
  images: Array<{ url: string; alt: string }>;
};

export type BugDetailSummary = BugSummary & {
  stepsPlain: string;
  /** Inline images in original bug steps (initial report). */
  stepsImages: Array<{ url: string; alt: string }>;
  /** Bug history / actions with plain-text comments. */
  history: BugActionSummary[];
  /** Inline images in history comments (resolve, activate, etc.). */
  historyImages: Array<{ url: string; alt: string }>;
  /** Deduped images from steps + history. */
  inlineImages: Array<{ url: string; alt: string }>;
  /** Most recent history entry that contains images (latest follow-up). */
  latestProgress?: {
    action: string;
    actor: string | null;
    date?: string;
    commentPlain: string;
    images: Array<{ url: string; alt: string }>;
  };
  storyTitle?: string;
  projectName?: string;
  executionName?: string;
  files: Array<{ id: number; name: string; downloadUrl?: string }>;
};

export type BugImageSource = "steps" | "history";

export type BugImageAsset = {
  url: string;
  alt: string;
  /** steps = original report; history = follow-up edits / fix records. */
  source: BugImageSource;
  action?: string;
  actor?: string | null;
  date?: string;
  mimeType?: string;
  sizeBytes?: number;
  base64?: string;
  fetchError?: string;
};

export type BugImagesBundle = {
  /** Images from original bug steps (initial report). */
  original: BugImageAsset[];
  /** Images from history / fix records (chronological). */
  followUp: BugImageAsset[];
  /** Latest history entry with images, for AI to see most recent progress. */
  latestProgress?: {
    action: string;
    actor: string | null;
    date?: string;
    commentPlain: string;
    images: BugImageAsset[];
  };
};

function summarizeBugHistory(
  bug: BugRecord,
  baseUrl?: string,
): BugActionSummary[] {
  const actions = Array.isArray(bug.actions) ? bug.actions : [];
  const history: BugActionSummary[] = [];

  for (const item of actions) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const comment =
      typeof record.comment === "string"
        ? record.comment
        : typeof record.history === "object" &&
            record.history !== null &&
            typeof (record.history as Record<string, unknown>).comment ===
              "string"
          ? String((record.history as Record<string, unknown>).comment)
          : "";

    history.push({
      action: String(record.action ?? record.actionType ?? "unknown"),
      actor: pickAccount(record.actor),
      date: typeof record.date === "string" ? record.date : undefined,
      commentPlain: htmlToPlainText(comment, baseUrl),
      images: extractHtmlImages(comment, baseUrl),
    });
  }

  return history;
}

function dedupeImages(
  images: Array<{ url: string; alt: string }>,
): Array<{ url: string; alt: string }> {
  const seen = new Set<string>();
  const out: Array<{ url: string; alt: string }> = [];
  for (const image of images) {
    if (!image.url || seen.has(image.url)) continue;
    seen.add(image.url);
    out.push(image);
  }
  return out;
}

function findLatestProgressWithImages(
  history: BugActionSummary[],
): BugDetailSummary["latestProgress"] {
  for (let i = history.length - 1; i >= 0; i--) {
    const entry = history[i];
    if (entry.images.length > 0) {
      return {
        action: entry.action,
        actor: entry.actor,
        date: entry.date,
        commentPlain: entry.commentPlain,
        images: entry.images,
      };
    }
  }
  return undefined;
}

type ImageFetchItem = {
  url: string;
  alt: string;
  source: BugImageSource;
  action?: string;
  actor?: string | null;
  date?: string;
};

function buildImageFetchQueue(summary: BugDetailSummary): ImageFetchItem[] {
  const seen = new Set<string>();
  const queue: ImageFetchItem[] = [];

  for (const image of summary.stepsImages) {
    if (!image.url || seen.has(image.url)) continue;
    seen.add(image.url);
    queue.push({ ...image, source: "steps" });
  }
  for (const entry of summary.history) {
    for (const image of entry.images) {
      if (!image.url || seen.has(image.url)) continue;
      seen.add(image.url);
      queue.push({
        ...image,
        source: "history",
        action: entry.action,
        actor: entry.actor,
        date: entry.date,
      });
    }
  }
  return queue;
}

function buildImagesBundle(
  summary: BugDetailSummary,
  assets: BugImageAsset[],
): BugImagesBundle {
  const original = assets.filter((item) => item.source === "steps");
  const followUp = assets.filter((item) => item.source === "history");
  const latest = summary.latestProgress;
  let latestProgress: BugImagesBundle["latestProgress"];
  if (latest && latest.images.length > 0) {
    const urls = new Set(latest.images.map((item) => item.url));
    latestProgress = {
      action: latest.action,
      actor: latest.actor,
      date: latest.date,
      commentPlain: latest.commentPlain,
      images: assets.filter(
        (item) => item.source === "history" && urls.has(item.url),
      ),
    };
  }
  return { original, followUp, latestProgress };
}

export function stripBugImagesBase64(bundle: BugImagesBundle): BugImagesBundle {
  const strip = (items: BugImageAsset[]) =>
    items.map(({ base64: _base64, ...rest }) => rest);
  return {
    original: strip(bundle.original),
    followUp: strip(bundle.followUp),
    latestProgress: bundle.latestProgress
      ? {
          ...bundle.latestProgress,
          images: strip(bundle.latestProgress.images),
        }
      : undefined,
  };
}

export type McpContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string };

/** Labeled image blocks so AI can tell original vs follow-up screenshots apart. */
export function buildBugImageMcpContent(bundle: BugImagesBundle): McpContentBlock[] {
  const content: McpContentBlock[] = [];

  const emitGroup = (
    title: string,
    items: BugImageAsset[],
    detail?: string,
  ) => {
    const downloadable = items.filter((item) => item.base64 && item.mimeType);
    if (downloadable.length === 0) return;
    const lines = [title];
    if (detail) lines.push(detail);
    downloadable.forEach((item, index) => {
      const meta =
        item.source === "history"
          ? ` (${item.action ?? "history"}${item.date ? ` ${item.date}` : ""}${item.actor ? ` by ${item.actor}` : ""})`
          : "";
      lines.push(`${index + 1}. ${item.url}${meta}`);
    });
    content.push({ type: "text", text: lines.join("\n") });
    for (const item of downloadable) {
      content.push({
        type: "image",
        data: item.base64!,
        mimeType: item.mimeType!,
      });
    }
  };

  emitGroup("【原始截图 · 复现步骤】", bundle.original);
  emitGroup("【后续编辑 / 修复记录截图】", bundle.followUp);

  if (bundle.latestProgress) {
    const latest = bundle.latestProgress;
    const parts = [
      `【最新进展 · ${latest.action}】`,
      latest.date,
      latest.actor ? `by ${latest.actor}` : undefined,
      latest.commentPlain || undefined,
    ].filter(Boolean);
    if (latest.images.some((item) => item.base64)) {
      parts.push(
        `附图: ${latest.images.map((item) => item.url).join(", ")}`,
      );
    }
    content.push({ type: "text", text: parts.join("\n") });
  }

  return content;
}

export function summarizeBugDetail(
  bug: BugRecord,
  baseUrl?: string,
): BugDetailSummary {
  const base = summarizeBugListItem(bug);
  const stepsHtml = typeof bug.steps === "string" ? bug.steps : undefined;
  const stepsImages = extractHtmlImages(stepsHtml, baseUrl);
  const history = summarizeBugHistory(bug, baseUrl);
  const historyImages = dedupeImages(history.flatMap((item) => item.images));
  const inlineImages = dedupeImages([...stepsImages, ...historyImages]);
  const filesRaw = Array.isArray(bug.files) ? bug.files : [];
  const files = filesRaw
    .map((file) => {
      if (!file || typeof file !== "object") return null;
      const record = file as Record<string, unknown>;
      const id = Number(record.id);
      const name = String(record.title ?? record.name ?? record.filename ?? "");
      if (!Number.isFinite(id) || !name) return null;
      const downloadUrl = baseUrl
        ? `${baseUrl.replace(/\/$/, "")}/file-download-${id}.html`
        : undefined;
      return { id, name, downloadUrl };
    })
    .filter(
      (item): item is { id: number; name: string; downloadUrl?: string } =>
        item !== null,
    );

  return {
    ...base,
    stepsPlain: htmlToPlainText(stepsHtml, baseUrl),
    stepsImages,
    history,
    historyImages,
    inlineImages,
    latestProgress: findLatestProgressWithImages(history),
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
  /** Download inline images (default true). Set false to skip binary fetch. */
  includeImages?: boolean;
};

const MAX_IMAGES = 24;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

async function fetchInlineImages(
  http: ZenTaoHttpClient,
  images: ImageFetchItem[],
): Promise<BugImageAsset[]> {
  const assets: BugImageAsset[] = [];
  for (const image of images.slice(0, MAX_IMAGES)) {
    const asset: BugImageAsset = {
      url: image.url,
      alt: image.alt,
      source: image.source,
      action: image.action,
      actor: image.actor,
      date: image.date,
    };
    try {
      const { data, contentType } = await http.fetchBinary(image.url);
      if (!contentType.startsWith("image/")) {
        asset.fetchError = `Not an image: ${contentType}`;
        assets.push(asset);
        continue;
      }
      if (data.byteLength > MAX_IMAGE_BYTES) {
        asset.mimeType = contentType;
        asset.sizeBytes = data.byteLength;
        asset.fetchError = `Image too large (${data.byteLength} bytes, max ${MAX_IMAGE_BYTES})`;
        assets.push(asset);
        continue;
      }
      asset.mimeType = contentType.split(";")[0].trim();
      asset.sizeBytes = data.byteLength;
      asset.base64 = Buffer.from(data).toString("base64");
      assets.push(asset);
    } catch (error) {
      asset.fetchError =
        error instanceof Error ? error.message : "Failed to fetch image";
      assets.push(asset);
    }
  }
  return assets;
}

export async function getBug(
  client: ZenTaoClient,
  http: ZenTaoHttpClient,
  baseUrl: string,
  input: GetBugInput,
): Promise<
  ToolEnvelope<{
    raw: BugRecord;
    summary: BugDetailSummary;
    images?: BugImagesBundle;
  }>
> {
  try {
    const raw = await client.getBug(input.bugId);
    const summary = summarizeBugDetail(raw, baseUrl);
    const includeImages = input.includeImages !== false;
    const result: {
      raw: BugRecord;
      summary: BugDetailSummary;
      images?: BugImagesBundle;
    } = { raw, summary };

    if (includeImages && summary.inlineImages.length > 0) {
      const queue = buildImageFetchQueue(summary);
      const assets = await fetchInlineImages(http, queue);
      result.images = buildImagesBundle(summary, assets);
    }

    return ok(result);
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
    return ok({ raw, summary: summarizeBugDetail(raw, config.url) });
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
    return ok({ raw, summary: summarizeBugDetail(raw, config.url) });
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
    return ok({ raw, summary: summarizeBugDetail(raw, config.url) });
  } catch (error) {
    return fail(
      "ACTIVATE_BUG_FAILED",
      error instanceof Error ? error.message : "Failed to activate bug",
    );
  }
}
