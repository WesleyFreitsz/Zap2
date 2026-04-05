import prisma from "../../config/prisma";
import { AppError } from "../../utils/AppError";
import { logger } from "../../utils/logger";
import { CreateScheduleInput } from "./schedule.schema";

export class ScheduleService {
  async create(data: CreateScheduleInput, companyId: string) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: data.conversationId, companyId },
    });

    if (!conversation) throw new AppError("Conversation not found", 404);

    const sendAt = new Date(data.sendAt);
    if (sendAt <= new Date()) {
      throw new AppError("Scheduled time must be in the future", 400);
    }

    const scheduled = await prisma.scheduledMessage.create({
      data: {
        conversationId: data.conversationId,
        content: data.content,
        sendAt,
        companyId,
        status: "PENDING",
      },
    });

    logger.info(
      `Scheduled message ${scheduled.id} for ${sendAt.toISOString()}`,
    );

    return scheduled;
  }

  async findAll(companyId: string) {
    return prisma.scheduledMessage.findMany({
      where: { companyId },
      include: {
        conversation: { select: { contactName: true, contactPhone: true } },
      },
      orderBy: { sendAt: "asc" },
    });
  }

  async update(
    id: string,
    companyId: string,
    data: { content?: string; sendAt?: string; status?: string },
  ) {
    const scheduled = await prisma.scheduledMessage.findFirst({
      where: { id, companyId },
    });

    if (!scheduled) throw new AppError("Scheduled message not found", 404);

    if (scheduled.status === "SENT") {
      throw new AppError("Cannot update an already sent message", 400);
    }

    const updateData: any = {};
    if (data.content !== undefined) updateData.content = data.content;
    if (data.status !== undefined) updateData.status = data.status;

    if (data.sendAt) {
      const newSendAt = new Date(data.sendAt);
      if (newSendAt <= new Date()) {
        throw new AppError("Scheduled time must be in the future", 400);
      }
      updateData.sendAt = newSendAt;
    }

    return prisma.scheduledMessage.update({
      where: { id },
      data: updateData,
      include: {
        conversation: { select: { contactName: true, contactPhone: true } },
      },
    });
  }

  async cancel(id: string, companyId: string) {
    const scheduled = await prisma.scheduledMessage.findFirst({
      where: { id, companyId, status: "PENDING" },
    });

    if (!scheduled)
      throw new AppError("Scheduled message not found or already sent", 404);

    await prisma.scheduledMessage.delete({ where: { id } });

    return { message: "Scheduled message cancelled" };
  }
}
