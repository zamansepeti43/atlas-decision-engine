import { Router } from "express";
import { z } from "zod";

import {
  buildImprovementBranchName,
  buildImprovementPlan,
} from "../lib/self-improvement-planner.js";

const router = Router();

const planSchema = z.object({
  title: z.string().min(1).max(160),
  reason: z.string().min(1).max(4000),
  summary: z.string().min(1).max(4000),
  source: z
    .enum(["user_feedback", "error", "test_failure", "performance", "manual"])
    .optional(),
  targetFiles: z.array(z.string().min(1).max(300)).max(50).optional(),
});

router.post("/self-improvement/plan", (req, res) => {
  const parsed = planSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      ok: false,
      error: "Invalid self-improvement plan input",
      details: parsed.error.flatten(),
    });
    return;
  }

  const proposal = buildImprovementPlan(parsed.data);

  res.status(201).json({
    ok: true,
    proposal,
    next: {
      branch: buildImprovementBranchName(proposal),
      stages: ["analyze", "branch", "implement", "test", "diff", "pr", "awaiting_approval"],
      mergeRequiresExplicitUserApproval: proposal.policy.requireApprovalBeforeMerge,
    },
  });
});

export default router;
