import type { StoryTaskClient } from "../client/story-task-client.js";
import { ok, fail, type ToolEnvelope } from "../utils/envelope.js";
import { message } from "./stories.js";

/**
 * Discovery helpers. Creating a story needs a product ID and creating a task
 * needs an execution ID, so the AI needs a way to find them by name first.
 */

export type ScopeItem = {
  id: number;
  name: string;
  code?: string;
  type?: string;
  status?: string;
  project?: number;
  begin?: string;
  end?: string;
};

function summarize(record: unknown): ScopeItem | null {
  if (!record || typeof record !== "object") return null;
  const r = record as Record<string, unknown>;
  const id = Number(r.id);
  if (!Number.isFinite(id)) return null;
  return {
    id,
    name: String(r.name ?? ""),
    code: r.code ? String(r.code) : undefined,
    type: r.type ? String(r.type) : undefined,
    status: r.status ? String(r.status) : undefined,
    project: r.project != null ? Number(r.project) : undefined,
    begin: r.begin ? String(r.begin) : undefined,
    end: r.end ? String(r.end) : undefined,
  };
}

function pickList(payload: unknown, ...keys: string[]): unknown[] {
  if (!payload || typeof payload !== "object") return [];
  const p = payload as Record<string, unknown>;
  for (const key of keys) {
    if (Array.isArray(p[key])) return p[key] as unknown[];
  }
  return [];
}

function pickTotal(payload: unknown, fallback: number): number {
  if (payload && typeof payload === "object") {
    const total = (payload as Record<string, unknown>).total;
    if (typeof total === "number") return total;
  }
  return fallback;
}

export type ListScopesInput = {
  kind: "product" | "project" | "execution";
  /** Only for kind=execution: narrow to one project. */
  projectId?: number;
  page?: number;
  limit?: number;
};

export async function listScopes(
  client: StoryTaskClient,
  input: ListScopesInput,
): Promise<
  ToolEnvelope<{ kind: string; total: number; items: ScopeItem[] }>
> {
  try {
    const params = { page: input.page, limit: input.limit };
    let payload: unknown;
    let items: unknown[];

    switch (input.kind) {
      case "product":
        payload = await client.listProducts(params);
        items = pickList(payload, "products", "data");
        break;
      case "project":
        payload = await client.listProjects(params);
        items = pickList(payload, "projects", "data");
        break;
      case "execution":
        payload = await client.listExecutions({
          ...params,
          projectId: input.projectId,
        });
        items = pickList(payload, "executions", "data");
        break;
    }

    const summarized = items
      .map(summarize)
      .filter((item): item is ScopeItem => item !== null);
    return ok({
      kind: input.kind,
      total: pickTotal(payload, summarized.length),
      items: summarized,
    });
  } catch (error) {
    return fail("LIST_SCOPES_FAILED", message(error, "Failed to list scopes"));
  }
}
