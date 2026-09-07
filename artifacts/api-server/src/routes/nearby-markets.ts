import { Router, type Request, type Response } from "express";
import { compareNearbyProduct, findNearbyMarkets, type UserLocation } from "../lib/local-market-runtime.js";

const router = Router();

function parseLocation(req: Request): UserLocation {
  const latitude = Number(req.body?.latitude ?? req.query.latitude);
  const longitude = Number(req.body?.longitude ?? req.query.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error("Geçerli konum gerekli (latitude/longitude). Konum izni verilmemiş olabilir.");
  }
  return { latitude, longitude, accuracy: Number(req.body?.accuracy ?? req.query.accuracy) || undefined };
}

router.post("/nearby-markets", async (req: Request, res: Response) => {
  try {
    const location = parseLocation(req);
    const radius = Math.max(100, Math.min(5000, Number(req.body?.radiusMeters ?? 1000)));
    return res.json({ success: true, ...await findNearbyMarkets(location, radius) });
  } catch (error) {
    return res.status(400).json({ success: false, error: error instanceof Error ? error.message : "Yakındaki marketler alınamadı." });
  }
});

router.post("/nearby-price-check", async (req: Request, res: Response) => {
  try {
    const product = String(req.body?.product ?? "").trim();
    if (!product) return res.status(400).json({ success: false, error: "product gerekli." });
    const location = parseLocation(req);
    const radius = Math.max(100, Math.min(5000, Number(req.body?.radiusMeters ?? 1000)));
    return res.json({ success: true, ...await compareNearbyProduct(product, location, radius) });
  } catch (error) {
    return res.status(400).json({ success: false, error: error instanceof Error ? error.message : "Yakın fiyat kontrolü başarısız." });
  }
});

export default router;
