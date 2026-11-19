import { Prisma } from "@prisma/client";
import prisma from "../../config/prisma";
import { AppError } from "../../utils/AppError";
import { QuickReplyInput } from "./quick-reply.schema";

function handleWriteError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") throw new AppError("Este atalho já está em uso", 409);
    if (error.code === "P2025") throw new AppError("Resposta rápida não encontrada", 404);
  }
  throw error;
}

export class QuickReplyService {
  findAll(companyId: string) {
    return prisma.quickReply.findMany({ where: { companyId }, orderBy: { shortcut: "asc" } });
  }

  create(companyId: string, data: QuickReplyInput) {
    return prisma.quickReply.create({ data: { ...data, companyId } }).catch(handleWriteError);
  }

  async update(companyId: string, id: string, data: QuickReplyInput) {
    const where = { id, companyId };
    await this.ensureExists(where);
    return prisma.quickReply.update({ where, data }).catch(handleWriteError);
  }

  async delete(companyId: string, id: string) {
    const where = { id, companyId };
    await this.ensureExists(where);
    await prisma.quickReply.delete({ where }).catch(handleWriteError);
  }

  private async ensureExists(where: { id: string; companyId: string }) {
    const reply = await prisma.quickReply.findFirst({ where, select: { id: true } });
    if (!reply) throw new AppError("Resposta rápida não encontrada", 404);
  }
}
