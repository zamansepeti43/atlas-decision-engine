import { Router, type Request, type Response } from "express";
import { buildAgentTask, runControlledWebAgent, authorizePurchase } from "../lib/agent-runtime.js";
import type { PurchaseAuthorization } from "../lib/atlas-capability-contracts.js";

const router = Router();

router.post("/agent/plan", (req: Request, res: Response) => {
  const goal = String(req.body?.goal ?? "").trim();
  if (!goal) return res.status(400).json({ success: false, error: "goal gerekli." });
  const domains = Array.isArray(req.body?.allowedDomains) ? req.body.allowedDomains.map(String) : [];
  return res.json({ success: true, task: buildAgentTask(goal, domains, Number(req.body?.maxActions ?? 12)) });
});

router.post("/agent/run", async (req: Request, res: Response) => {
  try {
    const task = buildAgentTask(String(req.body?.goal ?? ""), Array.isArray(req.body?.allowedDomains) ? req.body.allowedDomains.map(String) : [], Number(req.body?.maxActions ?? 12));
    if (!task.goal) return res.status(400).json({ success: false, error: "goal gerekli." });
    const confirmed = req.body?.confirmed === true;
    const result = await runControlledWebAgent(task, confirmed);
    return res.json({ success: true, result });
  } catch (error) {
    return res.status(409).json({ success: false, error: error instanceof Error ? error.message : "Agent çalıştırılamadı." });
  }
});

router.post("/purchase/authorize", (req: Request, res: Response) => {
  try {
    const auth = req.body as PurchaseAuthorization;
    return res.json({ success: true, authorization: authorizePurchase(auth) });
  } catch (error) {
    return res.status(403).json({ success: false, error: error instanceof Error ? error.message : "Satın alma onaylanmadı." });
  }
});

export default router;
