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
import {
  healthCheck,
  listMyBugs,
  listBugs,
  getBug,
  resolveBug,
  closeBug,
  activateBug,
} from "./tools/bugs.js";
import { toToolText } from "./utils/envelope.js";

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
      "Get a single bug with raw payload and AI-friendly summary including plain-text steps.",
    inputSchema: {
      type: "object",
      properties: {
        bugId: { type: "number", description: "Bug ID." },
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
          envelope = await getBug(client, { bugId: Number(input.bugId) });
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

      return {
        content: [{ type: "text", text: toToolText(envelope) }],
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
