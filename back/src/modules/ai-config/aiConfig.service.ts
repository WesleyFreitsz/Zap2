import prisma from '../../config/prisma';
import { UpdateAiConfigInput } from './aiConfig.schema';

export class AiConfigService {
  async get(companyId: string) {
    let config = await prisma.aiConfig.findUnique({ where: { companyId } });

    if (!config) {
      config = await prisma.aiConfig.create({
        data: { companyId },
      });
    }

    return config;
  }

  async update(companyId: string, data: UpdateAiConfigInput) {
    let config = await prisma.aiConfig.findUnique({ where: { companyId } });

    if (!config) {
      config = await prisma.aiConfig.create({
        data: { companyId, ...data },
      });
    } else {
      config = await prisma.aiConfig.update({
        where: { companyId },
        data,
      });
    }

    return config;
  }
}
