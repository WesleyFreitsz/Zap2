import { Request, Response, NextFunction } from "express";
import prisma from "../../config/prisma";
import { UserService } from "../users/user.service";
import { EvolutionService } from "../integrations/evolution/evolution.service";
import { logger } from "../../utils/logger";

const userService = new UserService();
const evolutionService = new EvolutionService();

export class WebhookController {
  async evolutionWebhook(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const companyId = req.params.companyId as string;
      const result = await evolutionService.handleWebhookEvent(
        companyId,
        req.body,
      );
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }

  async instagramIncoming(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { from, body, companyId } = req.body;

      logger.info(`[Instagram Webhook] Incoming message from ${from}: ${body}`);

      let conversation = await prisma.conversation.findFirst({
        where: {
          contactPhone: from,
          companyId,
          channel: "INSTAGRAM",
          status: { notIn: ["CLOSED"] },
        },
      });

      if (!conversation) {
        const assignedToId =
          await userService.getNextEmployeeRoundRobin(companyId);

        conversation = await prisma.conversation.create({
          data: {
            contactName: from,
            contactPhone: from,
            channel: "INSTAGRAM",
            companyId,
            assignedToId,
            status: "OPEN",
          },
        });
      }

      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          sender: "CLIENT",
          content: body,
        },
      });

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      });

      res.status(200).json({ status: "success", message: "Message received" });
    } catch (error) {
      next(error);
    }
  }

  async facebookIncoming(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { from, body, companyId } = req.body;

      logger.info(`[Facebook Webhook] Incoming message from ${from}: ${body}`);

      let conversation = await prisma.conversation.findFirst({
        where: {
          contactPhone: from,
          companyId,
          channel: "FACEBOOK",
          status: { notIn: ["CLOSED"] },
        },
      });

      if (!conversation) {
        const assignedToId =
          await userService.getNextEmployeeRoundRobin(companyId);

        conversation = await prisma.conversation.create({
          data: {
            contactName: from,
            contactPhone: from,
            channel: "FACEBOOK",
            companyId,
            assignedToId,
            status: "OPEN",
          },
        });
      }

      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          sender: "CLIENT",
          content: body,
        },
      });

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      });

      res.status(200).json({ status: "success", message: "Message received" });
    } catch (error) {
      next(error);
    }
  }
}
