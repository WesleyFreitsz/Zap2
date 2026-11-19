import { Router } from "express";
import { env } from "../../config/env";
import { AppError } from "../../utils/AppError";
import { logger } from "../../utils/logger";
import { ingestInbound } from "../channels/channel-inbox.service";
import { parseMetaWebhook, verifyWebhookChallenge, verifyWebhookSignature } from "./meta-webhook";

const router = Router();

router.get("/", (req, res, next) => {
  if (!env.META_WEBHOOK_VERIFY_TOKEN) return next(new AppError("Integração Meta não configurada", 503));
  const challenge = verifyWebhookChallenge(req.query, env.META_WEBHOOK_VERIFY_TOKEN);
  if (challenge === undefined) return res.sendStatus(403);
  return res.status(200).type("text/plain").send(challenge);
});

router.post("/", (req, res, next) => {
  if (!env.META_APP_SECRET) return next(new AppError("Integração Meta não configurada", 503));
  if (!verifyWebhookSignature(req.rawBody, req.get("X-Hub-Signature-256"), env.META_APP_SECRET)) {
    return res.sendStatus(401);
  }

  res.sendStatus(200);
  void processWebhook(req.body).catch((error: unknown) => {
    logger.error("[Meta Webhook] Falha ao processar eventos", { error });
  });
});

async function processWebhook(payload: unknown): Promise<void> {
  for (const message of parseMetaWebhook(payload)) {
    try {
      await ingestInbound(message);
    } catch (error) {
      logger.error("[Meta Webhook] Falha ao processar mensagem", { externalId: message.externalId, error });
    }
  }
}

export default router;
