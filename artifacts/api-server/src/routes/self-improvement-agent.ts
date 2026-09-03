import { Router } from "express";
import { z } from "zod";

import { buildImprovementPlan } from "../lib/self-improvement-planner.js";
import { buildCodingAgentContext } from "../lib/self-improvement-agent.js";
import { SelfImprovementGuard } from "../lib/self-improvement-orchestrator.js";

const router = Router();

const schema = z.object({
  title: z.string().min(1).max(160),
  reason: z.string().min(1).max(4000),
  summary: z.string().min(1).max(4000),
  source: z.enum(["user_feedback", "error", "test_failure", "performance", "manual"]).optional(),
  targetFiles: z.array(z.string().min(1).max(300)).max(50).optional(),
  branch: z.string().regex(/^atlas\/improve\/[a-z0-9-]+$/).optional(),
});

router.post("/self-improvement/agent-job", (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: "Invalid coding-agent job input", details: parsed.error.flatten() });
    return;
  }

  const proposal = buildImprovementPlan(parsed.data);
  const guard = new SelfImprovementGuard(proposal.policy);
  const branch = parsed.data.branch ?? `atlas/improve/${proposal.id}`;
  guard.assertSafeBranch(branch);

  const run = guard.createRun(proposal);
  const branchedRun = guard.advance(run, "branch", { branch });
  const context = buildCodingAgentContext(proposal, branchedRun, "zamansepeti43/atlas-decision-engine");

  res.status(202).json({
    ok: true,
    proposal,
    run: branchedRun,
    context,
    execution: "queued_for_coding_agent",
    note: "This endpoint prepares a constrained agent job; it does not merge or modify main.",
  });
});

export default router;
