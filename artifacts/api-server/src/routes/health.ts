import { Router } from "express";

const router = Router();

router.get("/healthz", (_req: unknown, res: { json: (body: unknown) => unknown }) => {
  res.json({ status: "ok" });
});

export default router;
