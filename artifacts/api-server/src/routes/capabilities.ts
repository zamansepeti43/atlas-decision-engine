import { Router } from "express";
import { getCapabilityStatuses } from "../lib/atlas-capability-contracts.js";

const router = Router();

router.get("/capabilities", (_req, res) => {
  res.json({
    success: true,
    capabilities: getCapabilityStatuses(),
    generatedAt: new Date().toISOString(),
  });
});

export default router;
