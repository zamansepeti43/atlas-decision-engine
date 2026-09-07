import { Router, type Request, type Response } from "express";
import { createBankingConnectionStart, parseBankCsv } from "../lib/banking-runtime.js";

const router = Router();

router.get("/banking/status", (_req: Request, res: Response) => {
  res.json({
    success: true,
    configured: Boolean(process.env.OPEN_BANKING_AUTHORIZE_URL && process.env.OPEN_BANKING_CLIENT_ID),
    consentRequired: true,
    passwordRequired: false,
  });
});

router.get("/banking/connect", (req: Request, res: Response) => {
  const redirectUri = String(req.query.redirect_uri ?? "").trim();
  if (!redirectUri) return res.status(400).json({ success: false, error: "redirect_uri gerekli." });
  const connection = createBankingConnectionStart(redirectUri);
  if (!connection) return res.status(503).json({ success: false, error: "Open Banking sağlayıcısı yapılandırılmamış." });
  return res.json({ success: true, ...connection });
});

router.post("/banking/import-csv", (req: Request, res: Response) => {
  const csv = typeof req.body?.csv === "string" ? req.body.csv : "";
  if (!csv) return res.status(400).json({ success: false, error: "csv gerekli." });
  const transactions = parseBankCsv(csv);
  return res.json({ success: true, transactions, count: transactions.length, source: "import" });
});

export default router;
