import express from "express";
import type { IncomingMessage } from "node:http";
import path from "path";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import routes from "./routes";
import { errorHandler } from "./middlewares/errorHandler";
import { logger } from "./utils/logger";

const app = express();
const metaWebhookPath = /^\/api\/webhooks\/meta\/?$/i;

declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: env.FRONTEND_ORIGINS }));
app.use(express.json({
  verify(req: IncomingMessage & { rawBody?: Buffer }, _res, buffer) {
    if (req.method === "POST" && metaWebhookPath.test(req.url?.split("?", 1)[0] ?? "")) {
      req.rawBody = buffer;
    }
  },
}));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.use(
  morgan("combined", {
    skip: (req) => req.method === "GET" && metaWebhookPath.test(req.url?.split("?", 1)[0] ?? ""),
    stream: { write: (message: string) => logger.info(message.trim()) },
  }),
);

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api", routes);

app.use(errorHandler);

export default app;
