import assert from "node:assert/strict";
import test from "node:test";

import {
  buildImprovementBranchName,
  buildImprovementPlan,
  canTransitionToMerge,
} from "./self-improvement-planner.js";

test("builds a safe improvement proposal", () => {
  const proposal = buildImprovementPlan({
    title: "Improve chat memory",
    reason: "Users report that useful context is lost between turns.",
    summary: "Improve memory persistence while preserving the existing chat contract.",
    source: "user_feedback",
    targetFiles: ["src/lib/memory.ts", "src/routes/chat.ts", "src/lib/memory.ts"],
  });

  assert.equal(proposal.status, "proposed");
  assert.deepEqual(proposal.targetFiles, ["src/lib/memory.ts", "src/routes/chat.ts"]);
  assert.match(buildImprovementBranchName(proposal), /^atlas\/improve\/improve-chat-memory-imp_/);
  assert.equal(canTransitionToMerge(proposal, { testPassed: true, diffReviewed: true }), false);
});

test("blocks dependency changes by default", () => {
  const proposal = buildImprovementPlan({
    title: "Update dependency",
    reason: "Security update requested.",
    summary: "Update a package.",
    targetFiles: ["package.json"],
  });

  assert.equal(proposal.risk, "medium");
  assert.ok(proposal.blockedActions.some((action) => action.includes("Dependency/lockfile")));
});
