import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import pinoHttp from "pino-http";

import router from "./routes/index.js";
import { logger } from "./lib/logger.js";

const app = express();

app.use(
  (pinoHttp as unknown as (options: Record<string, unknown>) => (req: unknown, res: unknown, next: () => void) => void)({
    logger,
    serializers: {
      req(req: { id?: string; method?: string; url?: string }) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: { statusCode?: number }) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  })
);

const configuredOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = new Set([
  "https://atlasai-puce.vercel.app",
  "https://atlas-decision-engine-five.vercel.app",
  "https://atlas-decision-engine-o509dknoh-tanahmetat-4997s-projects.vercel.app",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5175",
  "http://127.0.0.1:5175",
  ...configuredOrigins,
]);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin) || /\.vercel\.app$/i.test(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin not allowed by CORS"), false);
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

interface ErrorResponse {
  headersSent: boolean;
  status(code: number): ErrorResponse;
  json(body: unknown): unknown;
}

const errorHandler = (err: unknown, _req: unknown, res: ErrorResponse, _next: unknown) => {
  const isCorsRejection = err instanceof Error && err.message.startsWith("Origin not allowed by CORS");
  logger.error({ err }, isCorsRejection ? "CORS rejection" : "Unhandled request error");
  if (res.headersSent) return;
  res.status(isCorsRejection ? 403 : 500).json({
    success: false,
    error: isCorsRejection ? "Origin not allowed by CORS" : "Beklenmeyen bir sunucu hatası oluştu.",
    message: isCorsRejection
      ? "Bu kaynağa bu adresten erişime izin verilmiyor."
      : "İsteğiniz işlenirken bir sorun oluştu. Lütfen tekrar deneyin.",
  });
};

app.use(errorHandler as ErrorRequestHandler);

export default app;
