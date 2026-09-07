import { Router, type Request, type Response } from "express";
import { getCapabilityStatuses } from "../lib/atlas-capability-contracts.js";

const router = Router();

router.get("/capabilities", (_req: Request, res: Response) => {
  res.json({
    success: true,
    capabilities: getCapabilityStatuses(),
    generatedAt: new Date().toISOString(),
  });
});

export default router;
