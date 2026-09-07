import { assertProductAllowed, type AppConfig } from "../config.js";
import type {
  StoryTaskClient,
  StoryRecord,
  StoryScope,
} from "../client/story-task-client.js";
import { extractStoryItems } from "../client/story-task-client.js";
import { htmlToPlainText, extractHtmlImages, pickAccount, pickStatus } from "../utils/html.js";
import { ok, fail, type ToolEnvelope } from "../utils/envelope.js";

export type StorySummary = {
  id: number;
  title: string;
  status: string;
  stage?: string;
  pri?: number;
  type?: string;
  category?: string;
  estimate?: number;
  product?: number;
  module?: number;
  plan?: string | number;
  assignedTo?: string | null;
  openedBy?: string | null;
  parent?: number;
};

export function summarizeStoryListItem(story: StoryRecord): StorySummary {
  return {
    id: Number(story.id),
    title: String(story.title ?? ""),
    status: pickStatus(story.status),
    stage: story.stage != null ? String(story.stage) : undefined,
    pri: story.pri != null ? Number(story.pri) : undefined,
    type: story.type != null ? String(story.type) : undefined,
    category: story.category != null ? String(story.category) : undefined,
    estimate: story.estimate != null ? Number(story.estimate) : undefined,
    product: story.product != null ? Number(story.product) : undefined,
    module: story.module != null ? Number(story.module) : undefined,
    plan: story.plan != null ? (story.plan as string | number) : undefined,
    assignedTo: pickAccount(story.assignedTo),
    openedBy: pickAccount(story.openedBy),
    parent: story.parent != null ? Number(story.parent) : undefined,
  };
}

export type StoryDetailSummary = StorySummary & {
  /** Rich-text spec (需求描述) converted to plain text. */
  specPlain: string;
  /** Rich-text verify (验收标准) converted to plain text. */
  verifyPlain: string;
  inlineImages: Array<{ url: string; alt: string }>;
  productName?: string;
  moduleTitle?: string;
  /** Tasks broken down from this story. */
  tasks: Array<{ id: number; name: string; status: string; assignedTo?: string | null }>;
  /** Bugs linked to this story. */
  bugs: Array<{ id: number; title: string; status: string }>;
};

export function summarizeStoryDetail(
  story: StoryRecord,
  baseUrl?: string,
): StoryDetailSummary {
  const spec = typeof story.spec === "string" ? story.spec : undefined;
  const verify = typeof story.verify === "string" ? story.verify : undefined;

  const tasksRaw = Array.isArray(story.tasks) ? story.tasks : [];
  const bugsRaw = Array.isArray(story.bugs) ? story.bugs : [];

  return {
    ...summarizeStoryListItem(story),
    specPlain: htmlToPlainText(spec, baseUrl),
    verifyPlain: htmlToPlainText(verify, baseUrl),
    inlineImages: dedupe([
      ...extractHtmlImages(spec, baseUrl),
      ...extractHtmlImages(verify, baseUrl),
    ]),
    productName:
      typeof story.productName === "string" ? story.productName : undefined,
    moduleTitle:
      typeof story.moduleTitle === "string" ? story.moduleTitle : undefined,
    tasks: tasksRaw
      .filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
      .map((t) => ({
        id: Number(t.id),
        name: String(t.name ?? ""),
        status: pickStatus(t.status),
        assignedTo: pickAccount(t.assignedTo),
      })),
    bugs: bugsRaw
      .filter((b): b is Record<string, unknown> => !!b && typeof b === "object")
      .map((b) => ({
        id: Number(b.id),
        title: String(b.title ?? ""),
        status: pickStatus(b.status),
      })),
  };
}

function dedupe(
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

/* ------------------------------------------------------------------- read */

export type ListStoriesInput = {
  scope: StoryScope;
  id: number;
  status?: string;
  storyType?: string;
  branch?: string;
  order?: string;
  page?: number;
  limit?: number;
};

export async function listStories(
  config: AppConfig,
  client: StoryTaskClient,
  input: ListStoriesInput,
): Promise<
  ToolEnvelope<{
    scope: string;
    id: number;
    page: number;
    limit: number;
    total: number;
    items: StorySummary[];
  }>
> {
  try {
    if (input.scope === "product") assertProductAllowed(config, input.id);
    const payload = await client.listStories(input);
    const stories = extractStoryItems(payload);
    return ok({
      scope: input.scope,
      id: input.id,
      page: payload.page ?? input.page ?? 1,
      limit: payload.limit ?? input.limit ?? 20,
      total: payload.total ?? stories.length,
      items: stories.map(summarizeStoryListItem),
    });
  } catch (error) {
    return fail("LIST_STORIES_FAILED", message(error, "Failed to list stories"));
  }
}

export async function getStory(
  client: StoryTaskClient,
  baseUrl: string,
  input: { storyId: number },
): Promise<ToolEnvelope<{ raw: StoryRecord; summary: StoryDetailSummary }>> {
  try {
    const raw = await client.getStory(input.storyId);
    return ok({ raw, summary: summarizeStoryDetail(raw, baseUrl) });
  } catch (error) {
    return fail("GET_STORY_FAILED", message(error, "Failed to get story"));
  }
}

/* ------------------------------------------------------------------ write */

export type CreateStoryInput = {
  product: number;
  title: string;
  spec: string;
  category?: string;
  pri?: number;
  type?: string;
  verify?: string;
  module?: number;
  plan?: number;
  branch?: number;
  reviewer?: string[];
  estimate?: number;
  source?: string;
  keywords?: string;
  parent?: number;
  dryRun?: boolean;
};

export async function createStory(
  config: AppConfig,
  client: StoryTaskClient,
  input: CreateStoryInput,
): Promise<ToolEnvelope<unknown>> {
  // ZenTao requires title, spec, pri and category on create.
  const body = dropUndefined({
    product: input.product,
    title: input.title,
    spec: input.spec,
    category: input.category ?? "feature",
    pri: input.pri ?? 3,
    type: input.type ?? "story",
    verify: input.verify,
    module: input.module,
    plan: input.plan,
    branch: input.branch,
    reviewer: input.reviewer,
    estimate: input.estimate,
    source: input.source,
    keywords: input.keywords,
    parent: input.parent,
  }) as { product: number; title: string; spec: string };
  const request = {
    method: "POST" as const,
    path: `/products/${input.product}/stories`,
    body,
  };

  if (input.dryRun) return ok({ dryRun: true, request });
  const gate = checkStoryGate(config, request);
  if (gate) return gate;

  try {
    assertProductAllowed(config, input.product);
    const raw = await client.createStory(body);
    return ok({ raw, summary: summarizeStoryDetail(raw, config.url) });
  } catch (error) {
    return fail("CREATE_STORY_FAILED", message(error, "Failed to create story"));
  }
}

export type UpdateStoryInput = {
  storyId: number;
  title?: string;
  pri?: number;
  category?: string;
  type?: string;
  module?: number;
  plan?: number;
  estimate?: number;
  source?: string;
  keywords?: string;
  stage?: string;
  status?: string;
  reviewer?: string[];
  dryRun?: boolean;
};

export async function updateStory(
  config: AppConfig,
  client: StoryTaskClient,
  input: UpdateStoryInput,
): Promise<ToolEnvelope<unknown>> {
  const { storyId, dryRun: _dryRun, ...rest } = input;
  // ZenTao rejects a story edit that has no reviewers unless needNotReview is
  // set (story/model.php: `if(!$this->post->needNotReview and empty($_POST['reviewer']))`).
  const body = withReviewFallback(dropUndefined(rest), input.reviewer);
  const request = { method: "PUT" as const, path: `/stories/${storyId}`, body };

  if (input.dryRun) return ok({ dryRun: true, request });
  const gate = checkStoryGate(config, request);
  if (gate) return gate;

  try {
    const raw = await client.updateStory(storyId, body);
    return ok({ raw, summary: summarizeStoryDetail(raw, config.url) });
  } catch (error) {
    if (isReviewerRequiredError(error)) {
      return fail(
        "REVIEWER_REQUIRED",
        "ZenTao rejected the edit because this story has no reviewers. " +
          "ZenTao 18.x does not accept needNotReview over the REST API, so pass " +
          "`reviewer` (e.g. [\"admin\"]) with this call, or edit spec/verify via " +
          "zentao_change_story instead.",
        request,
      );
    }
    return fail("UPDATE_STORY_FAILED", message(error, "Failed to update story"));
  }
}

export type ChangeStoryInput = {
  storyId: number;
  title?: string;
  spec?: string;
  verify?: string;
  comment?: string;
  reviewer?: string[];
  dryRun?: boolean;
};

/**
 * ZenTao versions spec/verify separately from other fields: editing them goes
 * through /stories/:id/change, which bumps the story version and may re-open
 * review. A plain PUT ignores spec/verify.
 */
export async function changeStory(
  config: AppConfig,
  client: StoryTaskClient,
  input: ChangeStoryInput,
): Promise<ToolEnvelope<unknown>> {
  const { storyId, dryRun: _dryRun, ...rest } = input;
  const body = dropUndefined(rest);
  const request = {
    method: "POST" as const,
    path: `/stories/${storyId}/change`,
    body,
  };

  if (input.dryRun) return ok({ dryRun: true, request });
  const gate = checkStoryGate(config, request);
  if (gate) return gate;

  try {
    const raw = await client.changeStory(storyId, body);
    return ok({ raw, summary: summarizeStoryDetail(raw, config.url) });
  } catch (error) {
    return fail("CHANGE_STORY_FAILED", message(error, "Failed to change story"));
  }
}

export type CloseStoryInput = {
  storyId: number;
  closedReason?: string;
  duplicateStory?: number;
  comment?: string;
  dryRun?: boolean;
};

export async function closeStory(
  config: AppConfig,
  client: StoryTaskClient,
  input: CloseStoryInput,
): Promise<ToolEnvelope<unknown>> {
  const body = dropUndefined({
    closedReason: input.closedReason ?? "done",
    duplicateStory: input.duplicateStory,
    comment: input.comment,
  }) as { closedReason: string; duplicateStory?: number; comment?: string };
  const request = {
    method: "POST" as const,
    path: `/stories/${input.storyId}/close`,
    body,
  };

  if (input.dryRun) return ok({ dryRun: true, request });
  const gate = checkStoryGate(config, request);
  if (gate) return gate;

  try {
    const raw = await client.closeStory(input.storyId, body);
    return ok({ raw, summary: summarizeStoryDetail(raw, config.url) });
  } catch (error) {
    return fail("CLOSE_STORY_FAILED", message(error, "Failed to close story"));
  }
}

export type AssignStoryInput = {
  storyId: number;
  assignedTo: string;
  comment?: string;
  dryRun?: boolean;
};

export async function assignStory(
  config: AppConfig,
  client: StoryTaskClient,
  input: AssignStoryInput,
): Promise<ToolEnvelope<unknown>> {
  const body = dropUndefined({
    assignedTo: input.assignedTo,
    comment: input.comment,
  }) as { assignedTo: string; comment?: string };
  const request = {
    method: "POST" as const,
    path: `/stories/${input.storyId}/assign`,
    body,
  };

  if (input.dryRun) return ok({ dryRun: true, request });
  const gate = checkStoryGate(config, request);
  if (gate) return gate;

  try {
    const raw = await client.assignStory(input.storyId, body);
    return ok({ raw, summary: summarizeStoryDetail(raw, config.url) });
  } catch (error) {
    return fail("ASSIGN_STORY_FAILED", message(error, "Failed to assign story"));
  }
}

/** ZenTao answers 400 with a `reviewer` field error when review info is missing. */
function isReviewerRequiredError(error: unknown): boolean {
  return error instanceof Error && /"reviewer"\s*:/.test(error.message);
}

/**
 * Tell ZenTao "no review needed" when the caller supplied no reviewers,
 * otherwise the edit is rejected with 『评审人员』不能为空.
 */
function withReviewFallback<T extends Record<string, unknown>>(
  body: T,
  reviewer: string[] | undefined,
): T & { needNotReview?: number } {
  if (reviewer && reviewer.length > 0) return body;
  return { ...body, needNotReview: 1 };
}

function checkStoryGate(
  config: AppConfig,
  request: unknown,
): ToolEnvelope<never> | null {
  if (config.allowWriteStory) return null;
  return fail(
    "WRITE_FORBIDDEN",
    "Story write is disabled. Set ZENTAO_ALLOW_WRITE_STORY=true to enable.",
    request,
  );
}

export function dropUndefined<T extends Record<string, unknown>>(input: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) out[key] = value;
  }
  return out as T;
}

export function message(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
