/**
 * Local MCP smoke test. Reads credentials from environment or ~/.cursor/mcp.json.
 * Usage: node scripts/smoke-test.mjs [keyword]
 */
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

function loadEnvFromCursorMcp() {
  try {
    const raw = readFileSync(join(homedir(), ".cursor", "mcp.json"), "utf8");
    const config = JSON.parse(raw);
    const env = config?.mcpServers?.zentao?.env;
    if (env && typeof env === "object") {
      for (const [key, value] of Object.entries(env)) {
        if (process.env[key] === undefined && value != null) {
          process.env[key] = String(value);
        }
      }
    }
  } catch {
    // ignore
  }
}

loadEnvFromCursorMcp();

const required = ["ZENTAO_URL", "ZENTAO_ACCOUNT", "ZENTAO_PASSWORD"];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing ${key}`);
    process.exit(1);
  }
}

const child = spawn("node", ["dist/index.js"], {
  cwd: new URL("..", import.meta.url).pathname,
  env: {
    ...process.env,
    NODE_TLS_REJECT_UNAUTHORIZED: process.env.ZENTAO_SKIP_SSL === "true" ? "0" : process.env.NODE_TLS_REJECT_UNAUTHORIZED,
  },
  stdio: ["pipe", "pipe", "inherit"],
});

const rl = createInterface({ input: child.stdout });
const pending = new Map();
let nextId = 1;

function send(method, params = {}) {
  const id = nextId++;
  const msg = JSON.stringify({ jsonrpc: "2.0", id, method, params });
  child.stdin.write(msg + "\n");
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`Timeout waiting for ${method}`));
      }
    }, 20000);
  });
}

rl.on("line", (line) => {
  try {
    const msg = JSON.parse(line);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id).resolve(msg);
      pending.delete(msg.id);
    } else {
      console.log("event:", line.slice(0, 200));
    }
  } catch {
    console.log("stdout:", line);
  }
});

try {
  await send("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "smoke-test", version: "1.0.0" },
  });
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");

  const tools = await send("tools/list");
  console.log("tools:", tools.result?.tools?.map((t) => t.name).join(", "));

  const health = await send("tools/call", {
    name: "zentao_health_check",
    arguments: {},
  });
  console.log("health_check:", health.result?.content?.[0]?.text?.slice(0, 500));

  const myBugs = await send("tools/call", {
    name: "zentao_list_my_bugs",
    arguments: { limit: 5 },
  });
  console.log("list_my_bugs:", myBugs.result?.content?.[0]?.text?.slice(0, 800));

  const keyword = process.argv[2] || "";
  if (keyword) {
    console.log(`\nNote: keyword search "${keyword}" needs product scope via zentao_list_bugs.`);
  }
} catch (error) {
  console.error("smoke test failed:", error);
  process.exitCode = 1;
} finally {
  child.kill();
}
