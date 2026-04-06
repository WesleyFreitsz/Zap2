import prisma from "../../config/prisma";
import { AppError } from "../../utils/AppError";

export class PlanService {
  async findAll(onlyActive = false) {
    const where: any = {};
    if (onlyActive) where.isActive = true;
    return (prisma as any).plan.findMany({ where, orderBy: { price: "asc" } });
  }

  async findBySlug(slug: string) {
    const plan = await (prisma as any).plan.findUnique({ where: { slug } });
    if (!plan) throw new AppError("Plan not found", 404);
    return plan;
  }

  async findById(id: string) {
    const plan = await (prisma as any).plan.findUnique({ where: { id } });
    if (!plan) throw new AppError("Plan not found", 404);
    return plan;
  }

  async create(data: {
    name: string;
    slug: string;
    price: number;
    annualPrice: number;
    maxNumbers?: number;
    maxEmployees?: number;
    maxTeamLeaders?: number;
    features?: string[];
    founderSlots?: number;
  }) {
    const existing = await (prisma as any).plan.findUnique({ where: { slug: data.slug } });
    if (existing) throw new AppError("A plan with this slug already exists", 409);

    return (prisma as any).plan.create({ data });
  }

  async update(id: string, data: {
    name?: string;
    price?: number;
    annualPrice?: number;
    maxNumbers?: number;
    maxEmployees?: number;
    maxTeamLeaders?: number;
    features?: string[];
    founderSlots?: number;
    isActive?: boolean;
  }) {
    const plan = await (prisma as any).plan.findUnique({ where: { id } });
    if (!plan) throw new AppError("Plan not found", 404);

    return (prisma as any).plan.update({ where: { id }, data });
  }

  async delete(id: string) {
    const plan = await (prisma as any).plan.findUnique({ where: { id } });
    if (!plan) throw new AppError("Plan not found", 404);

    await (prisma as any).plan.delete({ where: { id } });
    return { message: "Plan deleted" };
  }
}
