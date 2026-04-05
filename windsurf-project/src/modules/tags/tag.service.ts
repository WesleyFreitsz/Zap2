import prisma from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import { CreateTagInput } from './tag.schema';

export class TagService {
  async findAll(companyId: string) {
    return prisma.tag.findMany({
      where: { companyId },
      include: {
        _count: { select: { conversationTags: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: CreateTagInput, companyId: string) {
    const existing = await prisma.tag.findFirst({
      where: { name: data.name, companyId },
    });

    if (existing) {
      throw new AppError('Tag with this name already exists', 409);
    }

    return prisma.tag.create({
      data: {
        name: data.name,
        color: data.color || '#6366f1',
        category: data.category || 'general',
        companyId,
      },
    });
  }

  async delete(id: string, companyId: string) {
    const tag = await prisma.tag.findFirst({ where: { id, companyId } });
    if (!tag) throw new AppError('Tag not found', 404);

    await prisma.conversationTag.deleteMany({ where: { tagId: id } });
    await prisma.tag.delete({ where: { id } });

    return { message: 'Tag deleted successfully' };
  }

  async assignToConversation(conversationId: string, tagId: string, companyId: string) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, companyId },
    });
    if (!conversation) throw new AppError('Conversation not found', 404);

    const tag = await prisma.tag.findFirst({ where: { id: tagId, companyId } });
    if (!tag) throw new AppError('Tag not found', 404);

    const existing = await prisma.conversationTag.findFirst({
      where: { conversationId, tagId },
    });
    if (existing) return existing;

    return prisma.conversationTag.create({
      data: { conversationId, tagId },
    });
  }

  async removeFromConversation(conversationId: string, tagId: string, companyId: string) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, companyId },
    });
    if (!conversation) throw new AppError('Conversation not found', 404);

    const ct = await prisma.conversationTag.findFirst({
      where: { conversationId, tagId },
    });
    if (!ct) throw new AppError('Tag assignment not found', 404);

    await prisma.conversationTag.delete({ where: { id: ct.id } });
    return { message: 'Tag removed from conversation' };
  }

  async getConversationTags(conversationId: string, companyId: string) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, companyId },
    });
    if (!conversation) throw new AppError('Conversation not found', 404);

    return prisma.conversationTag.findMany({
      where: { conversationId },
      include: { tag: true },
    });
  }
}
