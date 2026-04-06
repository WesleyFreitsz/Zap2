import prisma from "../../config/prisma";
import { AppError } from "../../utils/AppError";

export class CompanyService {
  async findAll() {
    return prisma.company.findMany({
      include: { _count: { select: { users: true, conversations: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async findById(id: string) {
    const company = await prisma.company.findUnique({
      where: { id },
      include: {
        users: { select: { id: true, name: true, email: true, role: true } },
        _count: { select: { conversations: true, products: true } },
      },
    });

    if (!company) throw new AppError("Company not found", 404);
    return company;
  }

  async update(
    id: string,
    data: {
      name?: string;
      plan?: string;
      isActive?: boolean;
      logo?: string;
      primaryColor?: string;
      secondaryColor?: string;
    },
  ) {
    const company = await prisma.company.findUnique({ where: { id } });
    if (!company) throw new AppError("Company not found", 404);

    return prisma.company.update({ where: { id }, data });
  }

  async toggleActive(id: string) {
    const company = await prisma.company.findUnique({ where: { id } });
    if (!company) throw new AppError("Company not found", 404);

    return prisma.company.update({
      where: { id },
      data: { isActive: !company.isActive },
    });
  }

  async delete(id: string) {
    const company = await prisma.company.findUnique({ where: { id } });
    if (!company) throw new AppError("Company not found", 404);

    await prisma.company.delete({ where: { id } });
    return { message: "Company deleted successfully" };
  }
}
