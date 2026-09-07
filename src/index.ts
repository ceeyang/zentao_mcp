import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { loadConfig } from "./config.js";
import { TokenManager } from "./client/auth.js";
import { ZenTaoHttpClient } from "./client/auth.js";
import { ZenTaoClient } from "./client/zentao-client.js";
import { StoryTaskClient } from "./client/story-task-client.js";
import {
  healthCheck,
  listMyBugs,
  listBugs,
  getBug,
  resolveBug,
  closeBug,
  activateBug,
  stripBugImagesBase64,
  buildBugImageMcpContent,
  type BugImagesBundle,
} from "./tools/bugs.js";
import {
  listStories,
  getStory,
  createStory,
  updateStory,
  changeStory,
  closeStory,
  assignStory,
} from "./tools/stories.js";
import {
  listTasks,
  getTask,
  createTask,
  updateTask,
  startTask,
  finishTask,
  closeTask,
  assignTask,
} from "./tools/tasks.js";
import { listScopes } from "./tools/scopes.js";
import { STORY_TASK_TOOLS } from "./tools/story-task-definitions.js";
import { toToolText, type ToolEnvelope } from "./utils/envelope.js";

function stripImageBase64FromEnvelope(
  envelope: ToolEnvelope<unknown>,
): ToolEnvelope<unknown> {
  if (!envelope.ok || !envelope.data || typeof envelope.data !== "object") {
    return envelope;
  }
  const data = envelope.data as { images?: BugImagesBundle };
  if (!data.images || !Array.isArray(data.images.original)) return envelope;
  return {
    ...envelope,
    data: {
      ...data,
      images: stripBugImagesBase64(data.images),
    },
  };
}

/** Keep unset optional fields undefined instead of turning them into NaN. */
function optionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function configureTls(config: { skipSsl: boolean }): void {
  if (config.skipSsl) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }
}

const TOOLS: Tool[] = [
  {
    name: "zentao_health_check",
    description:
      "Check ZenTao MCP configuration, authentication, and write-operation gates.",
    inputSchema: {
      type: "object",
      properties: {
        forceTokenRefresh: {
          type: "boolean",
          description: "Force refresh token before checking connectivity.",
        },
      },
    },
  },
  {
    name: "zentao_list_my_bugs",
    description:
      "List bugs assigned to the current logged-in user. No product/project ID required.",
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          description: "Work type filter. Default: assignedTo.",
        },
        order: {
          type: "string",
          description: "Sort order. Default: id_desc.",
        },
        page: { type: "number", description: "Page number. Default: 1." },
        limit: { type: "number", description: "Page size. Default: 20." },
      },
    },
  },
  {
    name: "zentao_list_bugs",
    description: "List bugs by product, project, or execution scope.",
    inputSchema: {
      type: "object",
      properties: {
        scope: {
          type: "string",
          enum: ["product", "project", "execution"],
          description: "Scope dimension.",
        },
        id: { type: "number", description: "Scope entity ID." },
        status: { type: "string", description: "Optional status filter." },
        browseType: {
          type: "string",
          description:
            "Optional browse type, e.g. unclosed, unresolved, assigntome.",
        },
        assignedTo: {
          type: "string",
          description: "Optional assignee account filter.",
        },
        keyword: { type: "string", description: "Optional keyword filter." },
        page: { type: "number", description: "Page number. Default: 1." },
        limit: { type: "number", description: "Page size. Default: 20." },
      },
      required: ["scope", "id"],
    },
  },
  {
    name: "zentao_get_bug",
    description:
      "Get a single bug with full context: plain-text steps, history (actions), and downloaded images by default. Images are split into original (steps) vs follow-up (fix/history records), with latestProgress highlighting the newest update.",
    inputSchema: {
      type: "object",
      properties: {
        bugId: { type: "number", description: "Bug ID." },
        includeImages: {
          type: "boolean",
          description:
            "Download inline images from steps and history (Token auth). Default true. Set false to skip binary fetch.",
        },
      },
      required: ["bugId"],
    },
  },
  {
    name: "zentao_resolve_bug",
    description:
      "Resolve a bug after fixing code. Requires ZENTAO_ALLOW_RESOLVE_BUG=true unless dryRun=true.",
    inputSchema: {
      type: "object",
      properties: {
        bugId: { type: "number", description: "Bug ID." },
        resolution: {
          type: "string",
          enum: [
            "fixed",
            "bydesign",
            "duplicate",
            "external",
            "notrepro",
            "postponed",
            "willnotfix",
            "tostory",
          ],
          description: "Resolution code. Usually fixed.",
        },
        resolvedBuild: {
          type: "string",
          description: "Resolved build. Default: trunk.",
        },
        assignedTo: {
          type: "string",
          description: "Optional assignee account after resolve.",
        },
        comment: {
          type: "string",
          description: "Optional remark recorded with the resolve action.",
        },
        duplicateBug: {
          type: "number",
          description: "Duplicate bug ID when resolution=duplicate.",
        },
        dryRun: {
          type: "boolean",
          description:
            "If true, return request summary only and do not call ZenTao.",
        },
      },
      required: ["bugId", "resolution"],
    },
  },
  {
    name: "zentao_close_bug",
    description:
      "Close a bug. Requires ZENTAO_ALLOW_CLOSE_BUG=true unless dryRun=true.",
    inputSchema: {
      type: "object",
      properties: {
        bugId: { type: "number", description: "Bug ID." },
        comment: { type: "string", description: "Optional remark." },
        dryRun: {
          type: "boolean",
          description:
            "If true, return request summary only and do not call ZenTao.",
        },
      },
      required: ["bugId"],
    },
  },
  {
    name: "zentao_activate_bug",
    description:
      "Re-activate a bug when fix verification fails. Requires ZENTAO_ALLOW_ACTIVATE_BUG=true unless dryRun=true.",
    inputSchema: {
      type: "object",
      properties: {
        bugId: { type: "number", description: "Bug ID." },
        assignedTo: {
          type: "string",
          description: "Optional assignee account.",
        },
        openedBuild: {
          type: "array",
          items: { type: "string" },
          description: "Affected builds. Default: [trunk].",
        },
        comment: { type: "string", description: "Optional remark." },
        dryRun: {
          type: "boolean",
          description:
            "If true, return request summary only and do not call ZenTao.",
        },
      },
      required: ["bugId"],
    },
  },
  ...STORY_TASK_TOOLS,
];

async function main(): Promise<void> {
  const config = loadConfig();
  configureTls(config);

  const auth = new TokenManager({
    url: config.url,
    token: config.token,
    account: config.account,
    password: config.password,
    skipSsl: config.skipSsl,
  });
  const http = new ZenTaoHttpClient(auth, config.url);
  const client = new ZenTaoClient(http);
  const storyTask = new StoryTaskClient(http);

  const server = new Server(
    { name: "zentao-mcp", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const input = (args ?? {}) as Record<string, unknown>;

    try {
      let envelope;
      switch (name) {
        case "zentao_health_check":
          envelope = await healthCheck(config, auth, client, {
            forceTokenRefresh: Boolean(input.forceTokenRefresh),
          });
          break;
        case "zentao_list_my_bugs":
          envelope = await listMyBugs(client, {
            type: input.type as string | undefined,
            order: input.order as string | undefined,
            page: input.page as number | undefined,
            limit: input.limit as number | undefined,
          });
          break;
        case "zentao_list_bugs":
          envelope = await listBugs(config, client, {
            scope: input.scope as "product" | "project" | "execution",
            id: Number(input.id),
            status: input.status as string | undefined,
            browseType: input.browseType as string | undefined,
            assignedTo: input.assignedTo as string | undefined,
            keyword: input.keyword as string | undefined,
            page: input.page as number | undefined,
            limit: input.limit as number | undefined,
          });
          break;
        case "zentao_get_bug":
          envelope = await getBug(client, http, config.url, {
            bugId: Number(input.bugId),
            includeImages: input.includeImages !== false,
          });
          break;
        case "zentao_resolve_bug":
          envelope = await resolveBug(config, client, {
            bugId: Number(input.bugId),
            resolution: String(input.resolution),
            resolvedBuild: input.resolvedBuild as string | undefined,
            assignedTo: input.assignedTo as string | undefined,
            comment: input.comment as string | undefined,
            duplicateBug: input.duplicateBug as number | undefined,
            dryRun: Boolean(input.dryRun),
          });
          break;
        case "zentao_close_bug":
          envelope = await closeBug(config, client, {
            bugId: Number(input.bugId),
            comment: input.comment as string | undefined,
            dryRun: Boolean(input.dryRun),
          });
          break;
        case "zentao_activate_bug":
          envelope = await activateBug(config, client, {
            bugId: Number(input.bugId),
            assignedTo: input.assignedTo as string | undefined,
            openedBuild: input.openedBuild as string[] | undefined,
            comment: input.comment as string | undefined,
            dryRun: Boolean(input.dryRun),
          });
          break;
        case "zentao_list_scopes":
          envelope = await listScopes(storyTask, {
            kind: input.kind as "product" | "project" | "execution",
            projectId: optionalNumber(input.projectId),
            page: optionalNumber(input.page),
            limit: optionalNumber(input.limit),
          });
          break;
        case "zentao_list_stories":
          envelope = await listStories(config, storyTask, {
            scope: input.scope as "product" | "project" | "execution",
            id: Number(input.id),
            status: input.status as string | undefined,
            storyType: input.storyType as string | undefined,
            branch: input.branch as string | undefined,
            order: input.order as string | undefined,
            page: optionalNumber(input.page),
            limit: optionalNumber(input.limit),
          });
          break;
        case "zentao_get_story":
          envelope = await getStory(storyTask, config.url, {
            storyId: Number(input.storyId),
          });
          break;
        case "zentao_create_story":
          envelope = await createStory(config, storyTask, {
            product: Number(input.product),
            title: String(input.title),
            spec: String(input.spec),
            verify: input.verify as string | undefined,
            category: input.category as string | undefined,
            pri: optionalNumber(input.pri),
            type: input.type as string | undefined,
            module: optionalNumber(input.module),
            plan: optionalNumber(input.plan),
            branch: optionalNumber(input.branch),
            estimate: optionalNumber(input.estimate),
            reviewer: input.reviewer as string[] | undefined,
            keywords: input.keywords as string | undefined,
            parent: optionalNumber(input.parent),
            dryRun: Boolean(input.dryRun),
          });
          break;
        case "zentao_update_story":
          envelope = await updateStory(config, storyTask, {
            storyId: Number(input.storyId),
            title: input.title as string | undefined,
            pri: optionalNumber(input.pri),
            category: input.category as string | undefined,
            type: input.type as string | undefined,
            module: optionalNumber(input.module),
            plan: optionalNumber(input.plan),
            estimate: optionalNumber(input.estimate),
            stage: input.stage as string | undefined,
            status: input.status as string | undefined,
            keywords: input.keywords as string | undefined,
            reviewer: input.reviewer as string[] | undefined,
            dryRun: Boolean(input.dryRun),
          });
          break;
        case "zentao_change_story":
          envelope = await changeStory(config, storyTask, {
            storyId: Number(input.storyId),
            title: input.title as string | undefined,
            spec: input.spec as string | undefined,
            verify: input.verify as string | undefined,
            comment: input.comment as string | undefined,
            reviewer: input.reviewer as string[] | undefined,
            dryRun: Boolean(input.dryRun),
          });
          break;
        case "zentao_close_story":
          envelope = await closeStory(config, storyTask, {
            storyId: Number(input.storyId),
            closedReason: input.closedReason as string | undefined,
            duplicateStory: optionalNumber(input.duplicateStory),
            comment: input.comment as string | undefined,
            dryRun: Boolean(input.dryRun),
          });
          break;
        case "zentao_assign_story":
          envelope = await assignStory(config, storyTask, {
            storyId: Number(input.storyId),
            assignedTo: String(input.assignedTo),
            comment: input.comment as string | undefined,
            dryRun: Boolean(input.dryRun),
          });
          break;
        case "zentao_list_tasks":
          envelope = await listTasks(storyTask, {
            executionId: optionalNumber(input.executionId),
            status: input.status as string | undefined,
            assignedTo: input.assignedTo as string | undefined,
            type: input.type as string | undefined,
            order: input.order as string | undefined,
            page: optionalNumber(input.page),
            limit: optionalNumber(input.limit),
          });
          break;
        case "zentao_get_task":
          envelope = await getTask(storyTask, config.url, {
            taskId: Number(input.taskId),
          });
          break;
        case "zentao_create_task":
          envelope = await createTask(config, storyTask, {
            execution: Number(input.execution),
            name: String(input.name),
            assignedTo: String(input.assignedTo),
            estStarted: String(input.estStarted),
            deadline: String(input.deadline),
            type: input.type as string | undefined,
            story: optionalNumber(input.story),
            module: optionalNumber(input.module),
            pri: optionalNumber(input.pri),
            estimate: optionalNumber(input.estimate),
            desc: input.desc as string | undefined,
            dryRun: Boolean(input.dryRun),
          });
          break;
        case "zentao_update_task":
          envelope = await updateTask(config, storyTask, {
            taskId: Number(input.taskId),
            name: input.name as string | undefined,
            type: input.type as string | undefined,
            desc: input.desc as string | undefined,
            assignedTo: input.assignedTo as string | undefined,
            pri: optionalNumber(input.pri),
            estimate: optionalNumber(input.estimate),
            left: optionalNumber(input.left),
            consumed: optionalNumber(input.consumed),
            story: optionalNumber(input.story),
            module: optionalNumber(input.module),
            status: input.status as string | undefined,
            estStarted: input.estStarted as string | undefined,
            deadline: input.deadline as string | undefined,
            dryRun: Boolean(input.dryRun),
          });
          break;
        case "zentao_start_task":
          envelope = await startTask(config, storyTask, {
            taskId: Number(input.taskId),
            assignedTo: input.assignedTo as string | undefined,
            consumed: optionalNumber(input.consumed),
            left: optionalNumber(input.left),
            realStarted: input.realStarted as string | undefined,
            comment: input.comment as string | undefined,
            dryRun: Boolean(input.dryRun),
          });
          break;
        case "zentao_finish_task":
          envelope = await finishTask(config, storyTask, {
            taskId: Number(input.taskId),
            currentConsumed: Number(input.currentConsumed),
            realStarted: input.realStarted as string | undefined,
            finishedDate: input.finishedDate as string | undefined,
            assignedTo: input.assignedTo as string | undefined,
            comment: input.comment as string | undefined,
            dryRun: Boolean(input.dryRun),
          });
          break;
        case "zentao_close_task":
          envelope = await closeTask(config, storyTask, {
            taskId: Number(input.taskId),
            comment: input.comment as string | undefined,
            dryRun: Boolean(input.dryRun),
          });
          break;
        case "zentao_assign_task":
          envelope = await assignTask(config, storyTask, {
            taskId: Number(input.taskId),
            assignedTo: String(input.assignedTo),
            left: optionalNumber(input.left),
            comment: input.comment as string | undefined,
            dryRun: Boolean(input.dryRun),
          });
          break;
        default:
          return {
            content: [
              {
                type: "text",
                text: toToolText({
                  ok: false,
                  error: { code: "UNKNOWN_TOOL", message: `Unknown tool: ${name}` },
                  meta: {
                    source: "zentao-rest-v1",
                    fetchedAt: new Date().toISOString(),
                  },
                }),
              },
            ],
            isError: true,
          };
      }

      const content: Array<
        | { type: "text"; text: string }
        | { type: "image"; data: string; mimeType: string }
      > = [{ type: "text", text: toToolText(stripImageBase64FromEnvelope(envelope)) }];

      if (
        envelope.ok &&
        envelope.data &&
        typeof envelope.data === "object" &&
        "images" in envelope.data
      ) {
        const images = (envelope.data as { images?: BugImagesBundle }).images;
        if (images) {
          content.push(...buildBugImageMcpContent(images));
        }
      }

      return {
        content,
        isError: !envelope.ok,
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: toToolText({
              ok: false,
              error: {
                code: "TOOL_EXECUTION_FAILED",
                message:
                  error instanceof Error ? error.message : "Tool execution failed",
              },
              meta: {
                source: "zentao-rest-v1",
                fetchedAt: new Date().toISOString(),
              },
            }),
          },
        ],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
