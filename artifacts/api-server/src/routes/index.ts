import { Router } from "express";
import healthRouter from "./health.js";
import chatRouter from "./chat.js";

const router = Router();

router.use(healthRouter);
router.use("/chat", chatRouter);

export default router;
