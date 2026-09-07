/**
 * End-to-end test for the story (需求) and task (任务) MCP tools.
 *
 * Drives dist/index.js over stdio like a real MCP client would, against a
 * throwaway ZenTao instance (see docs/DEV-DOCKER.zh-CN.md for setup).
 *
 * Usage:
 *   ZENTAO_URL=http://127.0.0.1:8812 ZENTAO_ACCOUNT=admin \
 *   ZENTAO_PASSWORD='Zentao@123456' node scripts/e2e-story-task-test.mjs
 */
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

for (const key of ["ZENTAO_URL", "ZENTAO_ACCOUNT", "ZENTAO_PASSWORD"]) {
  if (!process.env[key]) {
    console.error(`Missing ${key}`);
    process.exit(1);
  }
}

const child = spawn(process.execPath, ["dist/index.js"], {
  cwd: projectRoot,
  env: {
    ...process.env,
    // Writes are gated off by default; this test needs them on.
    ZENTAO_ALLOW_WRITE_STORY: "true",
    ZENTAO_ALLOW_WRITE_TASK: "true",
  },
  stdio: ["pipe", "pipe", "inherit"],
});

const pending = new Map();
let nextId = 1;

createInterface({ input: child.stdout }).on("line", (line) => {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  const entry = pending.get(msg.id);
  if (entry) {
    pending.delete(msg.id);
    entry.resolve(msg);
  }
});

function send(method, params = {}) {
  const id = nextId++;
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    setTimeout(() => {
      if (pending.delete(id)) reject(new Error(`Timeout waiting for ${method}`));
    }, 30000);
  });
}

async function call(name, args = {}) {
  const res = await send("tools/call", { name, arguments: args });
  const text = res.result?.content?.[0]?.text ?? "{}";
  return JSON.parse(text);
}

let passed = 0;
let failed = 0;

function check(label, condition, detail) {
  if (condition) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label}`);
    if (detail !== undefined) {
      console.log(`        ${JSON.stringify(detail).slice(0, 400)}`);
    }
  }
}

function today(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

try {
  await send("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "story-task-e2e", version: "1.0.0" },
  });
  child.stdin.write(
    `${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`,
  );

  console.log("\n[1] tools/list");
  const tools = (await send("tools/list")).result?.tools ?? [];
  const names = new Set(tools.map((t) => t.name));
  for (const expected of [
    "zentao_list_scopes",
    "zentao_list_stories",
    "zentao_get_story",
    "zentao_create_story",
    "zentao_update_story",
    "zentao_change_story",
    "zentao_close_story",
    "zentao_assign_story",
    "zentao_list_tasks",
    "zentao_get_task",
    "zentao_create_task",
    "zentao_update_task",
    "zentao_start_task",
    "zentao_finish_task",
    "zentao_close_task",
    "zentao_assign_task",
  ]) {
    check(`tool registered: ${expected}`, names.has(expected));
  }

  console.log("\n[2] health check");
  const health = await call("zentao_health_check");
  check("health ok", health.ok === true, health);
  check(
    "story/task gates reported",
    health.data?.writeGates?.writeStoryEnabled === true &&
      health.data?.writeGates?.writeTaskEnabled === true,
    health.data?.writeGates,
  );

  console.log("\n[3] scope discovery");
  const products = await call("zentao_list_scopes", { kind: "product" });
  check("list products", products.ok && products.data.items.length > 0, products);
  const productId = products.data?.items?.[0]?.id;

  const executions = await call("zentao_list_scopes", { kind: "execution" });
  check(
    "list executions",
    executions.ok && executions.data.items.length > 0,
    executions,
  );
  // Pick an execution that already has tasks so the read assertions are
  // meaningful; fall back to the first one for the create/update flow.
  let executionId = executions.data?.items?.[0]?.id;
  for (const item of executions.data?.items ?? []) {
    const probe = await call("zentao_list_tasks", { executionId: item.id, limit: 1 });
    if (probe.ok && probe.data.items.length > 0) {
      executionId = item.id;
      break;
    }
  }
  console.log(`        productId=${productId} executionId=${executionId}`);

  console.log("\n[4] story read");
  const stories = await call("zentao_list_stories", {
    scope: "product",
    id: productId,
    limit: 5,
  });
  check("list stories", stories.ok && stories.data.items.length > 0, stories);
  const storyId = stories.data?.items?.[0]?.id;

  const story = await call("zentao_get_story", { storyId });
  check("get story", story.ok && story.data.summary.id === storyId, story.error);
  check(
    "spec converted to plain text",
    typeof story.data?.summary?.specPlain === "string",
    story.data?.summary,
  );

  console.log("\n[5] story write");
  const dryCreate = await call("zentao_create_story", {
    product: productId,
    title: "dryRun should not persist",
    spec: "dryRun",
    dryRun: true,
  });
  check("create story dryRun", dryCreate.ok && dryCreate.data.dryRun === true, dryCreate);

  const created = await call("zentao_create_story", {
    product: productId,
    title: `MCP E2E 需求 ${Date.now()}`,
    spec: "<p>由 MCP e2e 测试创建的需求描述。</p>",
    verify: "<p>验收标准：接口返回 200。</p>",
    pri: 2,
    category: "feature",
  });
  check("create story", created.ok && created.data?.summary?.id > 0, created.error);
  const newStoryId = created.data?.summary?.id;
  console.log(`        newStoryId=${newStoryId}`);

  if (newStoryId) {
    // ZenTao 18.x refuses a story edit when the story has no reviewers and
    // won't accept needNotReview over REST, so we must report that clearly
    // rather than surfacing a raw 400.
    const noReviewer = await call("zentao_update_story", {
      storyId: newStoryId,
      title: "should not apply",
    });
    check(
      "update without reviewer either succeeds or explains why",
      noReviewer.ok || noReviewer.error?.code === "REVIEWER_REQUIRED",
      noReviewer.error,
    );

    const updated = await call("zentao_update_story", {
      storyId: newStoryId,
      title: "MCP E2E 需求（已更新标题）",
      pri: 1,
      reviewer: ["admin"],
    });
    check("update story with reviewer", updated.ok, updated.error);

    const reread = await call("zentao_get_story", { storyId: newStoryId });
    check(
      "update persisted",
      reread.data?.summary?.title === "MCP E2E 需求（已更新标题）",
      reread.data?.summary?.title,
    );

    const changed = await call("zentao_change_story", {
      storyId: newStoryId,
      spec: "<p>改后的需求描述 v2。</p>",
      comment: "e2e change",
    });
    check("change story spec", changed.ok, changed.error);

    const afterChange = await call("zentao_get_story", { storyId: newStoryId });
    check(
      "spec change persisted",
      (afterChange.data?.summary?.specPlain ?? "").includes("v2"),
      afterChange.data?.summary?.specPlain,
    );

    const assigned = await call("zentao_assign_story", {
      storyId: newStoryId,
      assignedTo: "dev1",
      comment: "e2e assign",
    });
    check("assign story", assigned.ok, assigned.error);
    check(
      "assignee persisted",
      assigned.data?.summary?.assignedTo === "dev1",
      assigned.data?.summary?.assignedTo,
    );

    const closedStory = await call("zentao_close_story", {
      storyId: newStoryId,
      closedReason: "done",
      comment: "e2e close",
    });
    check("close story", closedStory.ok, closedStory.error);
    check(
      "story status closed",
      closedStory.data?.summary?.status === "closed",
      closedStory.data?.summary?.status,
    );
  }

  console.log("\n[6] task read");
  const tasks = await call("zentao_list_tasks", { executionId, limit: 5 });
  check("list tasks by execution", tasks.ok && tasks.data.items.length > 0, tasks);
  const taskId = tasks.data?.items?.[0]?.id;

  const myTasks = await call("zentao_list_tasks", { limit: 5 });
  check("list my tasks", myTasks.ok, myTasks.error);

  const task = await call("zentao_get_task", { taskId });
  check("get task", task.ok && task.data.summary.id === taskId, task.error);

  console.log("\n[7] task write");
  const dryTask = await call("zentao_create_task", {
    execution: executionId,
    name: "dryRun task",
    assignedTo: "admin",
    estStarted: today(),
    deadline: today(3),
    dryRun: true,
  });
  check("create task dryRun", dryTask.ok && dryTask.data.dryRun === true, dryTask);

  const newTask = await call("zentao_create_task", {
    execution: executionId,
    name: `MCP E2E 任务 ${Date.now()}`,
    assignedTo: "admin",
    estStarted: today(),
    deadline: today(3),
    type: "devel",
    estimate: 4,
    desc: "<p>由 MCP e2e 测试创建的任务。</p>",
  });
  check("create task", newTask.ok && newTask.data?.summary?.id > 0, newTask.error);
  const newTaskId = newTask.data?.summary?.id;
  console.log(`        newTaskId=${newTaskId}`);

  if (newTaskId) {
    const upd = await call("zentao_update_task", {
      taskId: newTaskId,
      name: "MCP E2E 任务（已更新）",
      pri: 1,
    });
    check("update task", upd.ok, upd.error);

    const rereadTask = await call("zentao_get_task", { taskId: newTaskId });
    check(
      "task update persisted",
      rereadTask.data?.summary?.name === "MCP E2E 任务（已更新）",
      rereadTask.data?.summary?.name,
    );

    const started = await call("zentao_start_task", { taskId: newTaskId, left: 3 });
    check("start task", started.ok, started.error);
    check(
      "task status doing",
      started.data?.summary?.status === "doing",
      started.data?.summary?.status,
    );

    const finished = await call("zentao_finish_task", {
      taskId: newTaskId,
      currentConsumed: 2,
    });
    check("finish task", finished.ok, finished.error);
    check(
      "task status done",
      finished.data?.summary?.status === "done",
      finished.data?.summary?.status,
    );

    const closed = await call("zentao_close_task", {
      taskId: newTaskId,
      comment: "e2e close",
    });
    check("close task", closed.ok, closed.error);
  }

  console.log("\n[8] write gates");
  const gated = spawn(process.execPath, ["dist/index.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      ZENTAO_ALLOW_WRITE_STORY: "false",
      ZENTAO_ALLOW_WRITE_TASK: "false",
    },
    stdio: ["pipe", "pipe", "inherit"],
  });
  const gatedPending = new Map();
  let gatedId = 1;
  createInterface({ input: gated.stdout }).on("line", (line) => {
    try {
      const msg = JSON.parse(line);
      const e = gatedPending.get(msg.id);
      if (e) {
        gatedPending.delete(msg.id);
        e(msg);
      }
    } catch {
      /* ignore non-JSON */
    }
  });
  const gatedSend = (method, params = {}) => {
    const id = gatedId++;
    gated.stdin.write(
      `${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`,
    );
    return new Promise((resolve) => gatedPending.set(id, resolve));
  };
  await gatedSend("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "gate-test", version: "1.0.0" },
  });
  gated.stdin.write(
    `${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`,
  );
  const blocked = JSON.parse(
    (
      await gatedSend("tools/call", {
        name: "zentao_create_story",
        arguments: { product: productId, title: "blocked", spec: "blocked" },
      })
    ).result.content[0].text,
  );
  check(
    "create story blocked without gate",
    blocked.ok === false && blocked.error.code === "WRITE_FORBIDDEN",
    blocked,
  );
  const blockedTask = JSON.parse(
    (
      await gatedSend("tools/call", {
        name: "zentao_create_task",
        arguments: {
          execution: executionId,
          name: "blocked",
          assignedTo: "admin",
          estStarted: today(),
          deadline: today(1),
        },
      })
    ).result.content[0].text,
  );
  check(
    "create task blocked without gate",
    blockedTask.ok === false && blockedTask.error.code === "WRITE_FORBIDDEN",
    blockedTask,
  );
  gated.kill();

  console.log(`\n=== ${passed} passed, ${failed} failed ===`);
  process.exitCode = failed > 0 ? 1 : 0;
} catch (error) {
  console.error("e2e failed:", error);
  process.exitCode = 1;
} finally {
  child.kill();
}
