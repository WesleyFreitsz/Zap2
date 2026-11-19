import prisma from "../../config/prisma";
import { AppError } from "../../utils/AppError";
import { logger } from "../../utils/logger";
import { prepareTemplate } from "../channels/channel-sender";
import { assertConversationAccess, conversationScope, type Actor } from "../conversations/conversation-access";
import { CreateScheduleInput, UpdateScheduleInput } from "./schedule.schema";

export class ScheduleService {
  async create(data: CreateScheduleInput, companyId: string, actor: Actor) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: data.conversationId, companyId },
    });

    if (!conversation) throw new AppError("Conversation not found", 404);
    assertConversationAccess(conversation, actor);

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

  async findAll(companyId: string, actor: Actor) {
    return prisma.scheduledMessage.findMany({
      where: { companyId, conversation: conversationScope(actor) },
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
    actor: Actor,
  ) {
    const scheduled = await prisma.scheduledMessage.findFirst({
      where: { id, companyId, conversation: conversationScope(actor) },
    });

    if (!scheduled) throw new AppError("Scheduled message not found", 404);

    if (scheduled.status !== "PENDING" && scheduled.status !== "FAILED") {
      throw new AppError("Only pending or failed messages can be updated", 400);
    }

    if (scheduled.template && data.content !== undefined) {
      throw new AppError("Mensagem com template não pode ter o texto editado; cancele e agende de novo", 422);
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

  async cancel(id: string, companyId: string, actor: Actor) {
    const { count } = await prisma.scheduledMessage.deleteMany({
      where: { id, companyId, status: "PENDING", conversation: conversationScope(actor) },
    });

    if (count === 0)
      throw new AppError("Scheduled message not found or already sent", 404);

    return { message: "Scheduled message cancelled" };
  }
}
