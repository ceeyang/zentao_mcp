import type { AppConfig } from "../config.js";
import type { StoryTaskClient, TaskRecord } from "../client/story-task-client.js";
import { extractTaskItems } from "../client/story-task-client.js";
import { htmlToPlainText, extractHtmlImages, pickAccount, pickStatus } from "../utils/html.js";
import { ok, fail, type ToolEnvelope } from "../utils/envelope.js";
import { dropUndefined, message } from "./stories.js";

export type TaskSummary = {
  id: number;
  name: string;
  status: string;
  type?: string;
  pri?: number;
  execution?: number;
  project?: number;
  story?: number;
  module?: number;
  assignedTo?: string | null;
  openedBy?: string | null;
  estimate?: number;
  consumed?: number;
  left?: number;
  estStarted?: string;
  deadline?: string;
  parent?: number;
};

export function summarizeTaskListItem(task: TaskRecord): TaskSummary {
  return {
    id: Number(task.id),
    name: String(task.name ?? ""),
    status: pickStatus(task.status),
    type: task.type != null ? String(task.type) : undefined,
    pri: task.pri != null ? Number(task.pri) : undefined,
    execution: task.execution != null ? Number(task.execution) : undefined,
    project: task.project != null ? Number(task.project) : undefined,
    story: task.story != null ? Number(task.story) : undefined,
    module: task.module != null ? Number(task.module) : undefined,
    assignedTo: pickAccount(task.assignedTo),
    openedBy: pickAccount(task.openedBy),
    estimate: task.estimate != null ? Number(task.estimate) : undefined,
    consumed: task.consumed != null ? Number(task.consumed) : undefined,
    left: task.left != null ? Number(task.left) : undefined,
    estStarted: asDate(task.estStarted),
    deadline: asDate(task.deadline),
    parent: task.parent != null ? Number(task.parent) : undefined,
  };
}

export type TaskDetailSummary = TaskSummary & {
  /** Rich-text desc (任务描述) converted to plain text. */
  descPlain: string;
  inlineImages: Array<{ url: string; alt: string }>;
  executionName?: string;
  storyTitle?: string;
  moduleTitle?: string;
  /** Task history (actions) with plain-text comments. */
  history: Array<{
    action: string;
    actor: string | null;
    date?: string;
    commentPlain: string;
  }>;
};

export function summarizeTaskDetail(
  task: TaskRecord,
  baseUrl?: string,
): TaskDetailSummary {
  const desc = typeof task.desc === "string" ? task.desc : undefined;
  const actions = Array.isArray(task.actions) ? task.actions : [];

  return {
    ...summarizeTaskListItem(task),
    descPlain: htmlToPlainText(desc, baseUrl),
    inlineImages: extractHtmlImages(desc, baseUrl),
    executionName:
      typeof task.executionName === "string" ? task.executionName : undefined,
    storyTitle: typeof task.storyTitle === "string" ? task.storyTitle : undefined,
    moduleTitle:
      typeof task.moduleTitle === "string" ? task.moduleTitle : undefined,
    history: actions
      .filter((a): a is Record<string, unknown> => !!a && typeof a === "object")
      .map((a) => ({
        action: String(a.action ?? a.actionType ?? "unknown"),
        actor: pickAccount(a.actor),
        date: typeof a.date === "string" ? a.date : undefined,
        commentPlain: htmlToPlainText(
          typeof a.comment === "string" ? a.comment : "",
          baseUrl,
        ),
      })),
  };
}

function asDate(value: unknown): string | undefined {
  if (typeof value !== "string" || !value) return undefined;
  // ZenTao returns 0000-00-00 for "unset".
  return value.startsWith("0000-00-00") ? undefined : value;
}

/* ------------------------------------------------------------------- read */

export type ListTasksInput = {
  executionId?: number;
  status?: string;
  assignedTo?: string;
  type?: string;
  order?: string;
  page?: number;
  limit?: number;
};

export async function listTasks(
  client: StoryTaskClient,
  input: ListTasksInput = {},
): Promise<
  ToolEnvelope<{
    executionId?: number;
    page: number;
    limit: number;
    total: number;
    items: TaskSummary[];
  }>
> {
  try {
    const payload = await client.listTasks(input);
    const tasks = extractTaskItems(payload);
    return ok({
      executionId: input.executionId,
      page: payload.page ?? input.page ?? 1,
      limit: payload.limit ?? input.limit ?? 20,
      total: payload.total ?? tasks.length,
      items: tasks.map(summarizeTaskListItem),
    });
  } catch (error) {
    return fail("LIST_TASKS_FAILED", message(error, "Failed to list tasks"));
  }
}

export async function getTask(
  client: StoryTaskClient,
  baseUrl: string,
  input: { taskId: number },
): Promise<ToolEnvelope<{ raw: TaskRecord; summary: TaskDetailSummary }>> {
  try {
    const raw = await client.getTask(input.taskId);
    return ok({ raw, summary: summarizeTaskDetail(raw, baseUrl) });
  } catch (error) {
    return fail("GET_TASK_FAILED", message(error, "Failed to get task"));
  }
}

/* ------------------------------------------------------------------ write */

export type CreateTaskInput = {
  execution: number;
  name: string;
  assignedTo: string;
  estStarted: string;
  deadline: string;
  type?: string;
  story?: number;
  module?: number;
  pri?: number;
  estimate?: number;
  desc?: string;
  dryRun?: boolean;
};

export async function createTask(
  config: AppConfig,
  client: StoryTaskClient,
  input: CreateTaskInput,
): Promise<ToolEnvelope<unknown>> {
  // ZenTao requires name, assignedTo, type, estStarted and deadline on create.
  const body = dropUndefined({
    execution: input.execution,
    name: input.name,
    type: input.type ?? "devel",
    assignedTo: input.assignedTo,
    estStarted: input.estStarted,
    deadline: input.deadline,
    story: input.story,
    module: input.module,
    pri: input.pri ?? 3,
    estimate: input.estimate,
    desc: input.desc,
  }) as {
    execution: number;
    name: string;
    type: string;
    assignedTo: string;
    estStarted: string;
    deadline: string;
  };
  const request = {
    method: "POST" as const,
    path: `/executions/${input.execution}/tasks`,
    body,
  };

  if (input.dryRun) return ok({ dryRun: true, request });
  const gate = checkTaskGate(config, request);
  if (gate) return gate;

  try {
    const raw = await client.createTask(body);
    return ok({ raw, summary: summarizeTaskDetail(raw, config.url) });
  } catch (error) {
    return fail("CREATE_TASK_FAILED", message(error, "Failed to create task"));
  }
}

export type UpdateTaskInput = {
  taskId: number;
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
  dryRun?: boolean;
};

export async function updateTask(
  config: AppConfig,
  client: StoryTaskClient,
  input: UpdateTaskInput,
): Promise<ToolEnvelope<unknown>> {
  const { taskId, dryRun: _dryRun, ...rest } = input;
  const body = dropUndefined(rest);
  const request = { method: "PUT" as const, path: `/tasks/${taskId}`, body };

  if (input.dryRun) return ok({ dryRun: true, request });
  const gate = checkTaskGate(config, request);
  if (gate) return gate;

  try {
    const raw = await client.updateTask(taskId, body);
    return ok({ raw, summary: summarizeTaskDetail(raw, config.url) });
  } catch (error) {
    return fail("UPDATE_TASK_FAILED", message(error, "Failed to update task"));
  }
}

export type StartTaskInput = {
  taskId: number;
  assignedTo?: string;
  consumed?: number;
  left?: number;
  realStarted?: string;
  comment?: string;
  dryRun?: boolean;
};

export async function startTask(
  config: AppConfig,
  client: StoryTaskClient,
  input: StartTaskInput,
): Promise<ToolEnvelope<unknown>> {
  const { taskId, dryRun: _dryRun, ...rest } = input;
  const body = dropUndefined(rest);
  const request = {
    method: "POST" as const,
    path: `/tasks/${taskId}/start`,
    body,
  };

  if (input.dryRun) return ok({ dryRun: true, request });
  const gate = checkTaskGate(config, request);
  if (gate) return gate;

  try {
    const raw = await client.startTask(taskId, body);
    return ok({ raw, summary: summarizeTaskDetail(raw, config.url) });
  } catch (error) {
    return fail("START_TASK_FAILED", message(error, "Failed to start task"));
  }
}

export type FinishTaskInput = {
  taskId: number;
  currentConsumed: number;
  realStarted?: string;
  finishedDate?: string;
  assignedTo?: string;
  comment?: string;
  dryRun?: boolean;
};

export async function finishTask(
  config: AppConfig,
  client: StoryTaskClient,
  input: FinishTaskInput,
): Promise<ToolEnvelope<unknown>> {
  const { taskId, dryRun: _dryRun, ...rest } = input;
  // ZenTao requires currentConsumed, realStarted and finishedDate on finish.
  const now = zentaoNow();
  const body = dropUndefined({
    ...rest,
    realStarted: input.realStarted ?? now,
    finishedDate: input.finishedDate ?? now,
  }) as { currentConsumed: number; realStarted: string; finishedDate: string };
  const request = {
    method: "POST" as const,
    path: `/tasks/${taskId}/finish`,
    body,
  };

  if (input.dryRun) return ok({ dryRun: true, request });
  const gate = checkTaskGate(config, request);
  if (gate) return gate;

  try {
    const raw = await client.finishTask(taskId, body);
    return ok({ raw, summary: summarizeTaskDetail(raw, config.url) });
  } catch (error) {
    return fail("FINISH_TASK_FAILED", message(error, "Failed to finish task"));
  }
}

export type CloseTaskInput = {
  taskId: number;
  comment?: string;
  dryRun?: boolean;
};

export async function closeTask(
  config: AppConfig,
  client: StoryTaskClient,
  input: CloseTaskInput,
): Promise<ToolEnvelope<unknown>> {
  const body = dropUndefined({ comment: input.comment });
  const request = {
    method: "POST" as const,
    path: `/tasks/${input.taskId}/close`,
    body,
  };

  if (input.dryRun) return ok({ dryRun: true, request });
  const gate = checkTaskGate(config, request);
  if (gate) return gate;

  try {
    const raw = await client.closeTask(input.taskId, body);
    return ok({ raw, summary: summarizeTaskDetail(raw, config.url) });
  } catch (error) {
    return fail("CLOSE_TASK_FAILED", message(error, "Failed to close task"));
  }
}

export type AssignTaskInput = {
  taskId: number;
  assignedTo: string;
  left?: number;
  comment?: string;
  dryRun?: boolean;
};

export async function assignTask(
  config: AppConfig,
  client: StoryTaskClient,
  input: AssignTaskInput,
): Promise<ToolEnvelope<unknown>> {
  const body = dropUndefined({
    assignedTo: input.assignedTo,
    left: input.left,
    comment: input.comment,
  }) as { assignedTo: string; left?: number; comment?: string };
  const request = {
    method: "POST" as const,
    path: `/tasks/${input.taskId}/assignto`,
    body,
  };

  if (input.dryRun) return ok({ dryRun: true, request });
  const gate = checkTaskGate(config, request);
  if (gate) return gate;

  try {
    const raw = await client.assignTask(input.taskId, body);
    return ok({ raw, summary: summarizeTaskDetail(raw, config.url) });
  } catch (error) {
    return fail("ASSIGN_TASK_FAILED", message(error, "Failed to assign task"));
  }
}

/** ZenTao expects local "YYYY-MM-DD HH:mm:ss", not ISO-8601 with a Z suffix. */
export function zentaoNow(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

function checkTaskGate(
  config: AppConfig,
  request: unknown,
): ToolEnvelope<never> | null {
  if (config.allowWriteTask) return null;
  return fail(
    "WRITE_FORBIDDEN",
    "Task write is disabled. Set ZENTAO_ALLOW_WRITE_TASK=true to enable.",
    request,
  );
}
