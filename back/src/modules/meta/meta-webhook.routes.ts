import { Router } from "express";
import { env } from "../../config/env";
import { AppError } from "../../utils/AppError";
import { logger } from "../../utils/logger";
import { applyMessageEvent, ingestInbound } from "../channels/channel-inbox.service";
import { parseMetaEvents, parseMetaWebhook, verifyWebhookChallenge, verifyWebhookSignature } from "./meta-webhook";

const router = Router();

router.get("/", (req, res, next) => {
  if (!env.META_WEBHOOK_VERIFY_TOKEN) return next(new AppError("Integração Meta não configurada", 503));
  const challenge = verifyWebhookChallenge(req.query, env.META_WEBHOOK_VERIFY_TOKEN);
  if (challenge === undefined) return res.sendStatus(403);
  return res.status(200).type("text/plain").send(challenge);
});

router.post("/", async (req, res, next) => {
  if (!env.META_APP_SECRET) return next(new AppError("Integração Meta não configurada", 503));
  if (!verifyWebhookSignature(req.rawBody, req.get("X-Hub-Signature-256"), env.META_APP_SECRET)) {
    return res.sendStatus(401);
  }

  try {
    // grava antes de confirmar: com 500 a Meta reenvia e o externalId evita duplicar
    const failures = await processWebhook(req.body);
    res.sendStatus(failures > 0 ? 500 : 200);
    if (failures === 0) void processMessageEvents(req.body);
  } catch (error) {
    next(error);
  }
});

async function processWebhook(payload: unknown): Promise<number> {
  let failures = 0;
  for (const message of parseMetaWebhook(payload)) {
    try {
      await ingestInbound(message);
    } catch (error) {
      failures++;
      logger.error("[Meta Webhook] Falha ao processar mensagem", { externalId: message.externalId, error });
    }
  }
  return failures;
}

async function processMessageEvents(payload: unknown): Promise<void> {
  for (const event of parseMetaEvents(payload)) {
    try {
      await applyMessageEvent(event);
    } catch (error) {
      logger.error("[Meta Webhook] Falha ao atualizar mensagem", { event, error });
    }
  }
}

export default router;
