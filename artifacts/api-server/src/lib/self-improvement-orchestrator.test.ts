import assert from "node:assert/strict";
import test from "node:test";

import { buildImprovementPlan } from "./self-improvement-planner.js";
import { SelfImprovementGuard } from "./self-improvement-orchestrator.js";

test("does not allow PR before tests pass", () => {
  const proposal = buildImprovementPlan({
    title: "Fix chat response",
    reason: "Regression",
    summary: "Improve response handling",
    targetFiles: ["src/routes/chat.ts"],
  });
  const guard = new SelfImprovementGuard();
  let run = guard.createRun(proposal);

  run = guard.advance(run, "branch", { branch: "atlas/improve/fix-chat" });
  run = guard.advance(run, "implement");
  assert.equal(guard.canAdvance(run, "test"), true);
  assert.equal(guard.canAdvance(run, "pr"), false);
});

test("requires explicit approval before merge", () => {
  const proposal = buildImprovementPlan({
    title: "Improve memory",
    reason: "User feedback",
    summary: "Improve memory extraction",
    targetFiles: ["src/lib/memory.ts"],
  });
  const guard = new SelfImprovementGuard();
  let run = guard.createRun(proposal);

  run = guard.advance(run, "branch", { branch: "atlas/improve/memory" });
  run = guard.advance(run, "implement");
  run = guard.advance(run, "test", { testPassed: true });
  run = guard.advance(run, "diff", { diffReviewed: true });
  run = guard.advance(run, "pr");
  run = guard.advance(run, "awaiting_approval");

  assert.equal(guard.canAdvance(run, "merge"), false);
});

test("rejects protected branches", () => {
  const guard = new SelfImprovementGuard();
  assert.throws(() => guard.assertSafeBranch("main"));
  assert.doesNotThrow(() => guard.assertSafeBranch("atlas/improve/example"));
});
