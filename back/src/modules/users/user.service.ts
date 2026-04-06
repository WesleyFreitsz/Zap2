import bcrypt from "bcryptjs";
import prisma from "../../config/prisma";
import { AppError } from "../../utils/AppError";
import { CreateUserInput } from "./user.schema";

export class UserService {
  async create(data: CreateUserInput, companyId: string) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existingUser) {
      throw new AppError("Email already registered", 409);
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role: data.role as any,
        companyId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    return user;
  }

  async findAllByCompany(companyId: string) {
    return prisma.user.findMany({
      where: { companyId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findById(id: string, companyId: string) {
    const user = await prisma.user.findFirst({
      where: { id, companyId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!user) throw new AppError("User not found", 404);
    return user;
  }

  async update(id: string, companyId: string, data: Partial<CreateUserInput>) {
    const user = await prisma.user.findFirst({ where: { id, companyId } });
    if (!user) throw new AppError("User not found", 404);

    const updateData: any = { ...data };
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 12);
    }

    return prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
  }

  async delete(id: string, companyId: string) {
    const user = await prisma.user.findFirst({ where: { id, companyId } });
    if (!user) throw new AppError("User not found", 404);

    await prisma.user.delete({ where: { id } });
    return { message: "User deleted successfully" };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError("User not found", 404);

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) throw new AppError("Current password is incorrect", 400);

    if (newPassword.length < 6) {
      throw new AppError("New password must be at least 6 characters", 400);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword, mustChangePassword: false },
    });

    return { message: "Password changed successfully" };
  }

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        isTeamLeader: true,
        mustChangePassword: true,
        createdAt: true,
        company: {
          select: {
            id: true,
            name: true,
            logo: true,
            primaryColor: true,
            secondaryColor: true,
            plan: true,
          },
        },
      },
    });
    if (!user) throw new AppError("User not found", 404);
    return user;
  }

  async getNextEmployeeRoundRobin(companyId: string): Promise<string> {
    const employees = await prisma.user.findMany({
      where: { companyId, role: "EMPLOYEE", isActive: true },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });

    if (employees.length === 0) {
      throw new AppError("No active employees available", 400);
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { lastAssignedUserId: true },
    });

    const lastAssignedId = company?.lastAssignedUserId;
    let nextIndex = 0;

    if (lastAssignedId) {
      const lastIndex = employees.findIndex(
        (e: { id: string }) => e.id === lastAssignedId,
      );
      nextIndex = lastIndex >= 0 ? (lastIndex + 1) % employees.length : 0;
    }

    const assignedUserId = employees[nextIndex].id;

    await prisma.company.update({
      where: { id: companyId },
      data: { lastAssignedUserId: assignedUserId },
    });

    return assignedUserId;
  }
}
