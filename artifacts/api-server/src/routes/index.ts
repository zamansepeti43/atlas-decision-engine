import { Router } from "express";
import healthRouter from "./health.js";
import chatRouter from "./chat.js";
import selfImprovementRouter from "./self-improvement.js";
import selfImprovementAgentRouter from "./self-improvement-agent.js";

const router = Router();

router.use(healthRouter);
router.use("/chat", chatRouter);
router.use(selfImprovementRouter);
router.use(selfImprovementAgentRouter);

export default router;
