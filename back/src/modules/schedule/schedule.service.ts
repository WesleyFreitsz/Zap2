import prisma from "../../config/prisma";
import { AppError } from "../../utils/AppError";
import { logger } from "../../utils/logger";
import { prepareTemplate } from "../channels/channel-sender";
import { CreateScheduleInput, UpdateScheduleInput } from "./schedule.schema";

export class ScheduleService {
  async create(data: CreateScheduleInput, companyId: string, userId: string, role: string) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: data.conversationId, companyId },
    });

    if (!conversation) throw new AppError("Conversation not found", 404);
    if (role === "EMPLOYEE" && conversation.assignedToId !== userId) {
      throw new AppError("Access denied to this conversation", 403);
    }

    const sendAt = new Date(data.sendAt);
    if (sendAt <= new Date()) {
      throw new AppError("Scheduled time must be in the future", 400);
    }

    const prepared = data.template ? await prepareTemplate(conversation, data.template) : undefined;

    const scheduled = await prisma.scheduledMessage.create({
      data: {
        conversationId: data.conversationId,
        content: prepared?.content ?? data.content,
        template: data.template,
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
    data: UpdateScheduleInput,
  ) {
    const scheduled = await prisma.scheduledMessage.findFirst({
      where: { id, companyId },
    });

    if (!scheduled) throw new AppError("Scheduled message not found", 404);

    if (scheduled.status !== "PENDING" && scheduled.status !== "FAILED") {
      throw new AppError("Only pending or failed messages can be updated", 400);
    }

    const sendAt = data.sendAt === undefined ? undefined : new Date(data.sendAt);
    if (sendAt && sendAt <= new Date()) {
      throw new AppError("Scheduled time must be in the future", 400);
    }

    const updated = await prisma.scheduledMessage.updateMany({
      where: { id, companyId, status: scheduled.status },
      data: { content: data.content, sendAt, status: "PENDING", error: null },
    });

    if (updated.count === 0) {
      throw new AppError("Scheduled message is being sent", 409);
    }

    return prisma.scheduledMessage.findFirstOrThrow({
      where: { id, companyId },
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
