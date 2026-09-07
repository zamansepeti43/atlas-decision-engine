import { Router } from "express";
import { HealthCheckResponse } from "../../../../lib/api-zod/src/generated/api.js";

const router = Router();

router.get("/healthz", (_req: unknown, res: { json: (body: unknown) => unknown }) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

export default router;
