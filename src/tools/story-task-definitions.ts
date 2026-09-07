import type { Tool } from "@modelcontextprotocol/sdk/types.js";

const DRY_RUN = {
  type: "boolean" as const,
  description: "If true, return request summary only and do not call ZenTao.",
};

/** MCP tool definitions for story (需求) and task (任务) operations. */
export const STORY_TASK_TOOLS: Tool[] = [
  {
    name: "zentao_list_scopes",
    description:
      "List products, projects, or executions to discover the IDs the story/task tools need. Creating a story needs a product ID; creating a task needs an execution ID.",
    inputSchema: {
      type: "object",
      properties: {
        kind: {
          type: "string",
          enum: ["product", "project", "execution"],
          description: "Which scope entity to list.",
        },
        projectId: {
          type: "number",
          description: "Only for kind=execution: restrict to one project.",
        },
        page: { type: "number", description: "Page number. Default: 1." },
        limit: { type: "number", description: "Page size. Default: 20." },
      },
      required: ["kind"],
    },
  },
  {
    name: "zentao_list_stories",
    description:
      "List stories / requirements (需求) by product, project, or execution scope.",
    inputSchema: {
      type: "object",
      properties: {
        scope: {
          type: "string",
          enum: ["product", "project", "execution"],
          description: "Scope dimension.",
        },
        id: { type: "number", description: "Scope entity ID." },
        status: {
          type: "string",
          description:
            "Optional status filter: unclosed (default), draft, active, changing, reviewing, closed, all.",
        },
        storyType: {
          type: "string",
          enum: ["story", "requirement", "epic"],
          description: "Story type. Default: story.",
        },
        branch: { type: "string", description: "Optional branch filter." },
        order: { type: "string", description: "Sort order. Default: id_desc." },
        page: { type: "number", description: "Page number. Default: 1." },
        limit: { type: "number", description: "Page size. Default: 20." },
      },
      required: ["scope", "id"],
    },
  },
  {
    name: "zentao_get_story",
    description:
      "Get one story with plain-text spec (需求描述) and verify (验收标准), plus its broken-down tasks and linked bugs.",
    inputSchema: {
      type: "object",
      properties: { storyId: { type: "number", description: "Story ID." } },
      required: ["storyId"],
    },
  },
  {
    name: "zentao_create_story",
    description:
      "Create a story / requirement under a product. Requires ZENTAO_ALLOW_WRITE_STORY=true unless dryRun=true.",
    inputSchema: {
      type: "object",
      properties: {
        product: {
          type: "number",
          description: "Product ID (find it via zentao_list_scopes).",
        },
        title: { type: "string", description: "Story title." },
        spec: {
          type: "string",
          description: "Story description (需求描述). HTML allowed.",
        },
        verify: {
          type: "string",
          description: "Acceptance criteria (验收标准). HTML allowed.",
        },
        category: {
          type: "string",
          enum: [
            "feature",
            "interface",
            "performance",
            "safe",
            "experience",
            "improve",
            "other",
          ],
          description: "Story category. Default: feature.",
        },
        pri: { type: "number", description: "Priority 1-4. Default: 3." },
        type: {
          type: "string",
          enum: ["story", "requirement", "epic"],
          description: "Story type. Default: story.",
        },
        module: { type: "number", description: "Optional module ID." },
        plan: { type: "number", description: "Optional product plan ID." },
        branch: { type: "number", description: "Optional branch ID." },
        estimate: { type: "number", description: "Optional estimated hours." },
        reviewer: {
          type: "array",
          items: { type: "string" },
          description:
            "Optional reviewer accounts. Omit to create without review.",
        },
        keywords: { type: "string", description: "Optional keywords." },
        parent: { type: "number", description: "Optional parent story ID." },
        dryRun: DRY_RUN,
      },
      required: ["product", "title", "spec"],
    },
  },
  {
    name: "zentao_update_story",
    description:
      "Update story metadata (title, priority, category, module, plan, stage, status). Does NOT change spec/verify — use zentao_change_story for those. Requires ZENTAO_ALLOW_WRITE_STORY=true unless dryRun=true.",
    inputSchema: {
      type: "object",
      properties: {
        storyId: { type: "number", description: "Story ID." },
        title: { type: "string", description: "New title." },
        pri: { type: "number", description: "Priority 1-4." },
        category: { type: "string", description: "Story category." },
        type: { type: "string", description: "Story type." },
        module: { type: "number", description: "Module ID." },
        plan: { type: "number", description: "Product plan ID." },
        estimate: { type: "number", description: "Estimated hours." },
        stage: { type: "string", description: "Story stage." },
        status: { type: "string", description: "Story status." },
        keywords: { type: "string", description: "Keywords." },
        reviewer: {
          type: "array",
          items: { type: "string" },
          description: "Reviewer accounts.",
        },
        dryRun: DRY_RUN,
      },
      required: ["storyId"],
    },
  },
  {
    name: "zentao_change_story",
    description:
      "Change a story's spec (需求描述) / verify (验收标准) / title. ZenTao versions these separately, so this bumps the story version and may re-open review. Requires ZENTAO_ALLOW_WRITE_STORY=true unless dryRun=true.",
    inputSchema: {
      type: "object",
      properties: {
        storyId: { type: "number", description: "Story ID." },
        title: { type: "string", description: "New title." },
        spec: { type: "string", description: "New description (需求描述)." },
        verify: {
          type: "string",
          description: "New acceptance criteria (验收标准).",
        },
        comment: { type: "string", description: "Optional remark." },
        reviewer: {
          type: "array",
          items: { type: "string" },
          description: "Optional reviewer accounts.",
        },
        dryRun: DRY_RUN,
      },
      required: ["storyId"],
    },
  },
  {
    name: "zentao_close_story",
    description:
      "Close a story. Requires ZENTAO_ALLOW_WRITE_STORY=true unless dryRun=true.",
    inputSchema: {
      type: "object",
      properties: {
        storyId: { type: "number", description: "Story ID." },
        closedReason: {
          type: "string",
          enum: [
            "done",
            "subdivided",
            "duplicate",
            "postponed",
            "willnotdo",
            "cancel",
            "bydesign",
          ],
          description: "Close reason. Default: done.",
        },
        duplicateStory: {
          type: "number",
          description: "Duplicate story ID when closedReason=duplicate.",
        },
        comment: { type: "string", description: "Optional remark." },
        dryRun: DRY_RUN,
      },
      required: ["storyId"],
    },
  },
  {
    name: "zentao_assign_story",
    description:
      "Assign a story to a user. Requires ZENTAO_ALLOW_WRITE_STORY=true unless dryRun=true.",
    inputSchema: {
      type: "object",
      properties: {
        storyId: { type: "number", description: "Story ID." },
        assignedTo: { type: "string", description: "Assignee account." },
        comment: { type: "string", description: "Optional remark." },
        dryRun: DRY_RUN,
      },
      required: ["storyId", "assignedTo"],
    },
  },
  {
    name: "zentao_list_tasks",
    description:
      "List tasks (任务). With executionId, lists that execution's tasks; without it, lists the current user's tasks.",
    inputSchema: {
      type: "object",
      properties: {
        executionId: {
          type: "number",
          description:
            "Execution ID (find it via zentao_list_scopes). Omit for my tasks.",
        },
        status: {
          type: "string",
          description:
            "Optional status filter: wait, doing, done, pause, cancel, closed.",
        },
        assignedTo: {
          type: "string",
          description: "Optional assignee account filter.",
        },
        type: {
          type: "string",
          description:
            "Only for my-tasks mode: assignedTo (default), openedBy, finishedBy.",
        },
        order: { type: "string", description: "Sort order. Default: id_desc." },
        page: { type: "number", description: "Page number. Default: 1." },
        limit: { type: "number", description: "Page size. Default: 20." },
      },
    },
  },
  {
    name: "zentao_get_task",
    description:
      "Get one task with plain-text description and history (actions).",
    inputSchema: {
      type: "object",
      properties: { taskId: { type: "number", description: "Task ID." } },
      required: ["taskId"],
    },
  },
  {
    name: "zentao_create_task",
    description:
      "Create a task under an execution. Requires ZENTAO_ALLOW_WRITE_TASK=true unless dryRun=true.",
    inputSchema: {
      type: "object",
      properties: {
        execution: {
          type: "number",
          description: "Execution ID (find it via zentao_list_scopes).",
        },
        name: { type: "string", description: "Task name." },
        assignedTo: { type: "string", description: "Assignee account." },
        estStarted: {
          type: "string",
          description: "Planned start date, YYYY-MM-DD.",
        },
        deadline: { type: "string", description: "Deadline date, YYYY-MM-DD." },
        type: {
          type: "string",
          enum: [
            "design",
            "devel",
            "request",
            "test",
            "study",
            "discuss",
            "ui",
            "affair",
            "misc",
          ],
          description: "Task type. Default: devel.",
        },
        story: {
          type: "number",
          description: "Optional story ID this task breaks down.",
        },
        module: { type: "number", description: "Optional module ID." },
        pri: { type: "number", description: "Priority 1-4. Default: 3." },
        estimate: { type: "number", description: "Estimated hours." },
        desc: { type: "string", description: "Task description. HTML allowed." },
        dryRun: DRY_RUN,
      },
      required: ["execution", "name", "assignedTo", "estStarted", "deadline"],
    },
  },
  {
    name: "zentao_update_task",
    description:
      "Update a task's fields. Requires ZENTAO_ALLOW_WRITE_TASK=true unless dryRun=true.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "number", description: "Task ID." },
        name: { type: "string", description: "Task name." },
        type: { type: "string", description: "Task type." },
        desc: { type: "string", description: "Task description." },
        assignedTo: { type: "string", description: "Assignee account." },
        pri: { type: "number", description: "Priority 1-4." },
        estimate: { type: "number", description: "Estimated hours." },
        left: { type: "number", description: "Remaining hours." },
        consumed: { type: "number", description: "Consumed hours." },
        story: { type: "number", description: "Linked story ID." },
        module: { type: "number", description: "Module ID." },
        status: { type: "string", description: "Task status." },
        estStarted: {
          type: "string",
          description: "Planned start, YYYY-MM-DD.",
        },
        deadline: { type: "string", description: "Deadline, YYYY-MM-DD." },
        dryRun: DRY_RUN,
      },
      required: ["taskId"],
    },
  },
  {
    name: "zentao_start_task",
    description:
      "Start a task (status -> doing). Requires ZENTAO_ALLOW_WRITE_TASK=true unless dryRun=true.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "number", description: "Task ID." },
        assignedTo: {
          type: "string",
          description: "Optional assignee account.",
        },
        consumed: { type: "number", description: "Consumed hours so far." },
        left: { type: "number", description: "Remaining hours." },
        realStarted: {
          type: "string",
          description: "Actual start time. Default: now.",
        },
        comment: { type: "string", description: "Optional remark." },
        dryRun: DRY_RUN,
      },
      required: ["taskId"],
    },
  },
  {
    name: "zentao_finish_task",
    description:
      "Finish a task (status -> done) once the work is complete. Requires ZENTAO_ALLOW_WRITE_TASK=true unless dryRun=true.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "number", description: "Task ID." },
        currentConsumed: {
          type: "number",
          description: "Hours consumed in this round (required by ZenTao).",
        },
        realStarted: {
          type: "string",
          description: "Actual start time. Default: now.",
        },
        finishedDate: {
          type: "string",
          description: "Finish time. Default: now.",
        },
        assignedTo: { type: "string", description: "Optional next assignee." },
        comment: { type: "string", description: "Optional remark." },
        dryRun: DRY_RUN,
      },
      required: ["taskId", "currentConsumed"],
    },
  },
  {
    name: "zentao_close_task",
    description:
      "Close a finished or cancelled task. Requires ZENTAO_ALLOW_WRITE_TASK=true unless dryRun=true.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "number", description: "Task ID." },
        comment: { type: "string", description: "Optional remark." },
        dryRun: DRY_RUN,
      },
      required: ["taskId"],
    },
  },
  {
    name: "zentao_assign_task",
    description:
      "Assign a task to a user. Requires ZENTAO_ALLOW_WRITE_TASK=true unless dryRun=true.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "number", description: "Task ID." },
        assignedTo: { type: "string", description: "Assignee account." },
        left: { type: "number", description: "Remaining hours." },
        comment: { type: "string", description: "Optional remark." },
        dryRun: DRY_RUN,
      },
      required: ["taskId", "assignedTo"],
    },
  },
];
