import { Router, type Request, type Response } from "express";
import { buildAgentTask, runControlledWebAgent, authorizePurchase, type AgentAction } from "../lib/agent-runtime.js";
import type { PurchaseAuthorization } from "../lib/atlas-capability-contracts.js";

const router = Router();

function readActions(value: unknown): AgentAction[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is AgentAction => !!item && typeof item === "object").slice(0, 50);
}

router.post("/agent/plan", (req: Request, res: Response) => {
  const goal = String(req.body?.goal ?? "").trim();
  if (!goal) return res.status(400).json({ success: false, error: "goal gerekli." });
  const domains = Array.isArray(req.body?.allowedDomains) ? req.body.allowedDomains.map(String) : [];
  const actions = readActions(req.body?.actions);
  return res.json({
    success: true,
    task: buildAgentTask(goal, domains, Number(req.body?.maxActions ?? 12), actions),
  });
});

router.post("/agent/run", async (req: Request, res: Response) => {
  try {
    const task = buildAgentTask(
      String(req.body?.goal ?? ""),
      Array.isArray(req.body?.allowedDomains) ? req.body.allowedDomains.map(String) : [],
      Number(req.body?.maxActions ?? 12),
      readActions(req.body?.actions),
    );
    if (!task.goal) return res.status(400).json({ success: false, error: "goal gerekli." });
    if (!task.allowedDomains.length) {
      return res.status(400).json({ success: false, error: "En az bir izinli alan adı gerekli." });
    }
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
