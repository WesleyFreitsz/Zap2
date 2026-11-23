import { assertConversationAccess, type Actor } from '../conversations/conversation-access';
import prisma from '../../config/prisma';
import { emitConversationUpdated } from '../../realtime';
import { AppError } from '../../utils/AppError';
import { notifyLeadChanged } from '../leads/lead.service';
import { CreateTagInput } from './tag.schema';

export async function copyConversationTagsToLead(conversationId: string, leadId: string) {
  const tags = await prisma.conversationTag.findMany({ where: { conversationId }, select: { tagId: true } });
  if (tags.length === 0) return;
  await prisma.leadTag.createMany({
    data: tags.map(({ tagId }) => ({ leadId, tagId })),
    skipDuplicates: true,
  });
}

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

  private async findConversation(conversationId: string, companyId: string, actor: Actor) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, companyId },
    });
    if (!conversation) throw new AppError('Conversation not found', 404);
    assertConversationAccess(conversation, actor);
    return conversation;
  }

  private async notifyTagsChanged(conversation: Awaited<ReturnType<TagService['findConversation']>>) {
    emitConversationUpdated(conversation);
    if (conversation.leadId) await notifyLeadChanged(conversation.companyId, conversation.leadId);
  }

  async assignToConversation(conversationId: string, tagId: string, companyId: string, actor: Actor) {
    const conversation = await this.findConversation(conversationId, companyId, actor);

    const tag = await prisma.tag.findFirst({ where: { id: tagId, companyId } });
    if (!tag) throw new AppError('Tag not found', 404);

    const assigned = conversation.leadId
      ? await prisma.leadTag.upsert({
        where: { leadId_tagId: { leadId: conversation.leadId, tagId } },
        create: { leadId: conversation.leadId, tagId },
        update: {},
      })
      : await prisma.conversationTag.upsert({
        where: { conversationId_tagId: { conversationId, tagId } },
        create: { conversationId, tagId },
        update: {},
      });
    await this.notifyTagsChanged(conversation);
    return assigned;
  }

  async removeFromConversation(conversationId: string, tagId: string, companyId: string, actor: Actor) {
    const conversation = await this.findConversation(conversationId, companyId, actor);

    const { count } = conversation.leadId
      ? await prisma.leadTag.deleteMany({ where: { leadId: conversation.leadId, tagId } })
      : await prisma.conversationTag.deleteMany({ where: { conversationId, tagId } });
    if (count === 0) throw new AppError('Tag assignment not found', 404);

    await this.notifyTagsChanged(conversation);
    return { message: 'Tag removed from conversation' };
  }

  async getConversationTags(conversationId: string, companyId: string, actor: Actor) {
    const conversation = await this.findConversation(conversationId, companyId, actor);

    return conversation.leadId
      ? prisma.leadTag.findMany({ where: { leadId: conversation.leadId }, include: { tag: true } })
      : prisma.conversationTag.findMany({ where: { conversationId }, include: { tag: true } });
  }
}
