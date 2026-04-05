import prisma from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import { CreateIntegrationInput } from './integration.schema';

export class IntegrationService {
  async create(data: CreateIntegrationInput, companyId: string) {
    const existing = await prisma.integration.findFirst({
      where: { type: data.type as any, companyId },
    });

    if (existing) {
      throw new AppError(`Integration ${data.type} already exists for this company`, 409);
    }

    return prisma.integration.create({
      data: {
        type: data.type as any,
        token: data.token,
        companyId,
        status: 'ACTIVE',
      },
    });
  }

  async findAll(companyId: string) {
    return prisma.integration.findMany({
      where: { companyId },
      select: { id: true, type: true, status: true, createdAt: true },
    });
  }

  async toggle(id: string, companyId: string) {
    const integration = await prisma.integration.findFirst({ where: { id, companyId } });
    if (!integration) throw new AppError('Integration not found', 404);

    const newStatus = integration.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    return prisma.integration.update({
      where: { id },
      data: { status: newStatus },
    });
  }

  async delete(id: string, companyId: string) {
    const integration = await prisma.integration.findFirst({ where: { id, companyId } });
    if (!integration) throw new AppError('Integration not found', 404);

    await prisma.integration.delete({ where: { id } });
    return { message: 'Integration deleted successfully' };
  }
}
