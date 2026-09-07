import { Router } from "express";
import { getCapabilityStatuses } from "../lib/atlas-capability-contracts.js";

const router = Router();

type JsonResponse = {
  json: (body: unknown) => unknown;
};

router.get("/capabilities", (_req: unknown, res: JsonResponse) => {
  res.json({
    success: true,
    capabilities: getCapabilityStatuses(),
    generatedAt: new Date().toISOString(),
  });
});

export default router;
