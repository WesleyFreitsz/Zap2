import prisma from "../../config/prisma";
import { InvitationService } from "../invitations/invitation.service";

const invitationService = new InvitationService();

export class AdminDashboardService {
  async getDashboard() {
    const [
      totalCompanies,
      activeCompanies,
      totalUsers,
      totalConversations,
      companies,
    ] = await Promise.all([
      prisma.company.count(),
      prisma.company.count({ where: { isActive: true } }),
      prisma.user.count(),
      prisma.conversation.count(),
      (prisma.company as any).findMany({
        include: {
          _count: { select: { users: true, conversations: true } },
          subscription: {
            select: {
              plan: true,
              status: true,
              value: true,
              nextDueDate: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const inactiveCompanies = totalCompanies - activeCompanies;

    // Plan popularity
    const planCounts: Record<string, number> = {};
    let totalRevenue = 0;
    let overdueCount = 0;

    for (const company of companies) {
      const sub = (company as any).subscription;
      const plan = sub?.plan || company.plan || "basic";
      planCounts[plan] = (planCounts[plan] || 0) + 1;

      if (sub?.status === "ACTIVE") {
        totalRevenue += sub.value || 0;
      }
      if (sub?.status === "OVERDUE") {
        overdueCount++;
      }
    }

    const mostPopularPlan =
      Object.entries(planCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "basic";

    return {
      totalCompanies,
      activeCompanies,
      inactiveCompanies,
      overdueCount,
      totalUsers,
      totalConversations,
      totalRevenue,
      mostPopularPlan,
      planDistribution: planCounts,
      companies: companies.map((c: any) => ({
        id: c.id,
        name: c.name,
        plan: c.plan,
        isActive: c.isActive,
        createdAt: c.createdAt,
        usersCount: c._count?.users || 0,
        conversationsCount: c._count?.conversations || 0,
        subscription: c.subscription || null,
      })),
    };
  }

  async createCompany(data: {
    name: string;
    adminEmail: string;
    plan?: string;
    primaryColor?: string;
    secondaryColor?: string;
    logo?: string;
    invitedById: string;
  }) {
    const company = await prisma.company.create({
      data: {
        name: data.name,
        plan: data.plan || "basic",
        primaryColor: data.primaryColor || null,
        secondaryColor: data.secondaryColor || null,
        logo: data.logo || null,
        isActive: true,
      } as any,
    });

    const result = await invitationService.sendInvitation({
      email: data.adminEmail,
      role: "ADMIN",
      companyId: company.id,
      invitedById: data.invitedById,
    });

    return { company, ...result };
  }
}
