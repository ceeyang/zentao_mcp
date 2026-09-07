import type { ZenTaoHttpClient } from "./auth.js";

/**
 * Story (需求) and task (任务) endpoints of ZenTao REST API v1.
 *
 * Route names mirror ZenTao's own config/apiv1.php route table, e.g.
 *   /products/:id/stories -> stories      /stories/:id -> story
 *   /executions/:id/tasks -> tasks        /tasks/:id   -> task
 */

export type ListQuery = Record<string, string | number | undefined>;

export type StoryRecord = Record<string, unknown>;
export type TaskRecord = Record<string, unknown>;

export type PagedResponse<T> = {
  page?: number;
  total?: number;
  limit?: number;
  stories?: T[];
  tasks?: T[];
  data?: T[];
};

export type StoryScope = "product" | "project" | "execution";

export type ListStoriesParams = {
  scope: StoryScope;
  id: number;
  status?: string;
  /** story | requirement | epic. ZenTao calls this `type` on product scope. */
  storyType?: string;
  branch?: string;
  order?: string;
  page?: number;
  limit?: number;
};

export type CreateStoryBody = {
  product: number;
  title: string;
  spec: string;
  /** ZenTao requires `category`; the tool layer supplies a default. */
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
  sourceNote?: string;
  keywords?: string;
  mailto?: string[];
  parent?: number;
  status?: string;
};

export type UpdateStoryBody = {
  title?: string;
  pri?: number;
  category?: string;
  type?: string;
  module?: number;
  plan?: number;
  estimate?: number;
  source?: string;
  sourceNote?: string;
  keywords?: string;
  mailto?: string[];
  reviewer?: string[];
  stage?: string;
  status?: string;
  parent?: number;
  product?: number;
};

/** Spec/verify edits go through /stories/:id/change, not PUT. */
export type ChangeStoryBody = {
  title?: string;
  spec?: string;
  verify?: string;
  comment?: string;
  reviewer?: string[];
};

export type CloseStoryBody = {
  closedReason: string;
  duplicateStory?: number;
  comment?: string;
};

export type AssignStoryBody = {
  assignedTo: string;
  comment?: string;
};

export type ListTasksParams = {
  /** Omit to list the current user's tasks (ZenTao's /tasks default). */
  executionId?: number;
  status?: string;
  assignedTo?: string;
  /** Only for the my-tasks listing: assignedTo | openedBy | finishedBy. */
  type?: string;
  order?: string;
  page?: number;
  limit?: number;
};

export type CreateTaskBody = {
  execution: number;
  name: string;
  type: string;
  assignedTo: string;
  estStarted: string;
  deadline: string;
  story?: number;
  module?: number;
  pri?: number;
  estimate?: number;
  desc?: string;
  mailto?: string[];
};

export type UpdateTaskBody = {
  name?: string;
  type?: string;
  desc?: string;
  assignedTo?: string;
  pri?: number;
  estimate?: number;
  left?: number;
  consumed?: number;
  story?: number;
  module?: number;
  status?: string;
  estStarted?: string;
  deadline?: string;
  mailto?: string[];
};

export type StartTaskBody = {
  assignedTo?: string;
  consumed?: number;
  left?: number;
  comment?: string;
  realStarted?: string;
};

export type FinishTaskBody = {
  currentConsumed: number;
  realStarted?: string;
  finishedDate?: string;
  assignedTo?: string;
  comment?: string;
};

export type CloseTaskBody = {
  comment?: string;
};

export type AssignTaskBody = {
  assignedTo: string;
  left?: number;
  comment?: string;
};

export class StoryTaskClient {
  private readonly http: ZenTaoHttpClient;

  constructor(http: ZenTaoHttpClient) {
    this.http = http;
  }

  /* ---------------------------------------------------------------- scopes */

  async listProducts(params: { page?: number; limit?: number } = {}): Promise<unknown> {
    return this.http.request("/products", {
      query: { page: params.page ?? 1, limit: params.limit ?? 20 },
    });
  }

  async listProjects(params: { page?: number; limit?: number } = {}): Promise<unknown> {
    return this.http.request("/projects", {
      query: { page: params.page ?? 1, limit: params.limit ?? 20 },
    });
  }

  async listExecutions(
    params: { projectId?: number; page?: number; limit?: number } = {},
  ): Promise<unknown> {
    const path = params.projectId
      ? `/projects/${params.projectId}/executions`
      : "/executions";
    return this.http.request(path, {
      query: { page: params.page ?? 1, limit: params.limit ?? 20 },
    });
  }

  /* --------------------------------------------------------------- stories */

  async listStories(params: ListStoriesParams): Promise<PagedResponse<StoryRecord>> {
    const query: ListQuery = {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      order: params.order ?? "id_desc",
    };
    if (params.status) query.status = params.status;
    if (params.branch) query.branch = params.branch;
    if (params.storyType) {
      // Product scope names it `type`; execution scope names it `storyType`.
      query[params.scope === "execution" ? "storyType" : "type"] = params.storyType;
    }
    return this.http.request<PagedResponse<StoryRecord>>(
      `${storyScopePath(params.scope, params.id)}/stories`,
      { query },
    );
  }

  async getStory(storyId: number): Promise<StoryRecord> {
    return this.http.request<StoryRecord>(`/stories/${storyId}`);
  }

  async createStory(body: CreateStoryBody): Promise<StoryRecord> {
    return this.http.request<StoryRecord>(`/products/${body.product}/stories`, {
      method: "POST",
      body,
    });
  }

  async updateStory(storyId: number, body: UpdateStoryBody): Promise<StoryRecord> {
    return this.http.request<StoryRecord>(`/stories/${storyId}`, {
      method: "PUT",
      body,
    });
  }

  async changeStory(storyId: number, body: ChangeStoryBody): Promise<StoryRecord> {
    return this.http.request<StoryRecord>(`/stories/${storyId}/change`, {
      method: "POST",
      body,
    });
  }

  async closeStory(storyId: number, body: CloseStoryBody): Promise<StoryRecord> {
    return this.http.request<StoryRecord>(`/stories/${storyId}/close`, {
      method: "POST",
      body,
    });
  }

  async assignStory(storyId: number, body: AssignStoryBody): Promise<StoryRecord> {
    return this.http.request<StoryRecord>(`/stories/${storyId}/assign`, {
      method: "POST",
      body,
    });
  }

  /* ----------------------------------------------------------------- tasks */

  async listTasks(params: ListTasksParams): Promise<PagedResponse<TaskRecord>> {
    const query: ListQuery = {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      order: params.order ?? "id_desc",
    };
    if (params.status) query.status = params.status;
    if (params.assignedTo) query.assignedTo = params.assignedTo;

    if (params.executionId) {
      return this.http.request<PagedResponse<TaskRecord>>(
        `/executions/${params.executionId}/tasks`,
        { query },
      );
    }
    // No execution: ZenTao's /tasks falls back to "my tasks".
    query.type = params.type ?? "assignedTo";
    return this.http.request<PagedResponse<TaskRecord>>("/tasks", { query });
  }

  async getTask(taskId: number): Promise<TaskRecord> {
    return this.http.request<TaskRecord>(`/tasks/${taskId}`);
  }

  async createTask(body: CreateTaskBody): Promise<TaskRecord> {
    return this.http.request<TaskRecord>(`/executions/${body.execution}/tasks`, {
      method: "POST",
      body,
    });
  }

  async updateTask(taskId: number, body: UpdateTaskBody): Promise<TaskRecord> {
    return this.http.request<TaskRecord>(`/tasks/${taskId}`, {
      method: "PUT",
      body,
    });
  }

  async startTask(taskId: number, body: StartTaskBody = {}): Promise<TaskRecord> {
    return this.http.request<TaskRecord>(`/tasks/${taskId}/start`, {
      method: "POST",
      body,
    });
  }

  async finishTask(taskId: number, body: FinishTaskBody): Promise<TaskRecord> {
    return this.http.request<TaskRecord>(`/tasks/${taskId}/finish`, {
      method: "POST",
      body,
    });
  }

  async closeTask(taskId: number, body: CloseTaskBody = {}): Promise<TaskRecord> {
    return this.http.request<TaskRecord>(`/tasks/${taskId}/close`, {
      method: "POST",
      body,
    });
  }

  async assignTask(taskId: number, body: AssignTaskBody): Promise<TaskRecord> {
    return this.http.request<TaskRecord>(`/tasks/${taskId}/assignto`, {
      method: "POST",
      body,
    });
  }
}

function storyScopePath(scope: StoryScope, id: number): string {
  switch (scope) {
    case "product":
      return `/products/${id}`;
    case "project":
      return `/projects/${id}`;
    case "execution":
      return `/executions/${id}`;
  }
}

export function extractStoryItems(payload: PagedResponse<StoryRecord>): StoryRecord[] {
  if (Array.isArray(payload.stories)) return payload.stories;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

export function extractTaskItems(payload: PagedResponse<TaskRecord>): TaskRecord[] {
  if (Array.isArray(payload.tasks)) return payload.tasks;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}
