import assert from "node:assert/strict";
import test from "node:test";

import { applyPreparedChanges } from "./self-improvement-github.js";
import { buildImprovementPlan } from "./self-improvement-planner.js";

test("only approved files can be written", async () => {
  const calls: string[] = [];
  const worker = {
    async createBranch(branch: string) { calls.push(`branch:${branch}`); },
    async writeFile(input: { path: string }) { calls.push(`file:${input.path}`); },
    async createPullRequest() { return { url: "" }; },
  };
  const proposal = buildImprovementPlan({
    title: "Chat fix",
    reason: "Regression",
    summary: "Fix chat",
    targetFiles: ["src/chat.ts"],
  });

  await assert.rejects(() => applyPreparedChanges(worker, proposal, [
    { path: "src/other.ts", content: "bad" },
  ]));
  assert.deepEqual(calls, []);
});

test("creates a branch before applying approved changes", async () => {
  const calls: string[] = [];
  const worker = {
    async createBranch(branch: string) { calls.push(`branch:${branch}`); },
    async writeFile(input: { path: string }) { calls.push(`file:${input.path}`); },
    async createPullRequest() { return { url: "" }; },
  };
  const proposal = buildImprovementPlan({
    title: "Chat fix",
    reason: "Regression",
    summary: "Fix chat",
    targetFiles: ["src/chat.ts"],
  });

  const result = await applyPreparedChanges(worker, proposal, [
    { path: "src/chat.ts", content: "fixed" },
  ]);

  assert.match(result.branch, /^atlas\/improve\/chat-fix-/);
  assert.equal(calls.length, 2);
  assert.match(calls[0], /^branch:/);
  assert.equal(calls[1], "file:src/chat.ts");
});
