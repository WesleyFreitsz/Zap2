import cron from "node-cron";
import prisma from "../config/prisma";
import { prepareTemplate, sendTemplate, sendText } from "../modules/channels/channel-sender";
import { templateInputSchema } from "../modules/meta/whatsapp-templates";
import { emitMessageCreated } from "../realtime";
import { logger } from "../utils/logger";
import { AppError } from "../utils/AppError";

export default class ScheduledMessageWorker {
  private isRunning = false;

  async start(): Promise<void> {
    await prisma.scheduledMessage.updateMany({
      where: { status: "SENDING" },
      data: { status: "FAILED", error: "Envio interrompido" },
    });

    cron.schedule("* * * * *", () => this.run());
  }

  private async run(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const due = { status: "PENDING" as const, sendAt: { lte: new Date() } };
      const messages = await prisma.scheduledMessage.findMany({
        where: due,
        orderBy: [{ sendAt: "asc" }, { id: "asc" }],
        select: { id: true, companyId: true },
        take: 50,
      });

      for (const { id, companyId } of messages) {
        const claim = await prisma.scheduledMessage.updateMany({
          where: { id, companyId, ...due },
          data: { status: "SENDING", error: null },
        });

        if (claim.count > 0) await this.send(id, companyId);
      }
    } catch (error) {
      logger.error("[ScheduledMessageWorker] Failed to process scheduled messages", { error });
    } finally {
      this.isRunning = false;
    }
  }

  private async send(id: string, companyId: string): Promise<void> {
    const claimed = { id, companyId, status: "SENDING" as const };
    let failureMessage = "Falha ao preparar o envio";

    try {
      const message = await prisma.scheduledMessage.findFirst({ where: claimed });
      if (!message) return;

      const conversation = await prisma.conversation.findFirst({
        where: { id: message.conversationId, companyId },
      });

      if (!conversation) {
        failureMessage = "Conversa não encontrada";
        throw new Error(failureMessage);
      }

      failureMessage = "Falha no envio da mensagem";
      let content = message.content;
      let externalId: string | null;
      if (message.template !== null) {
        const template = templateInputSchema.safeParse(message.template);
        if (!template.success) throw new AppError("Template indisponível", 422);
        const prepared = await prepareTemplate(conversation, template.data, true);
        content = prepared.content;
        ({ externalId } = await sendTemplate(conversation, prepared.payload));
      } else {
        ({ externalId } = await sendText(conversation, content));
      }
      const sentAt = new Date();

      failureMessage = "Mensagem enviada, mas houve falha ao registrar o envio";
      const [, updated] = await prisma.$transaction([
        prisma.message.create({
          data: {
            conversationId: conversation.id,
            sender: "USER",
            content,
            externalId,
          },
        }),
        prisma.conversation.update({
          where: { id: conversation.id, companyId },
          data: { updatedAt: sentAt },
        }),
        prisma.scheduledMessage.update({
          where: claimed,
          data: { status: "SENT", sentAt, content },
        }),
      ]);
      emitMessageCreated(updated);
    } catch (error) {
      logger.error("[ScheduledMessageWorker] Failed to deliver scheduled message", {
        id,
        companyId,
        error: error instanceof Error ? error.message : error,
      });
      await prisma.scheduledMessage.updateMany({
        where: claimed,
        data: { status: "FAILED", error: error instanceof AppError ? error.message : failureMessage },
      });
    }
  }
}
