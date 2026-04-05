import prisma from "../../config/prisma";

export class DashboardService {
  async getOverview(companyId: string) {
    const [
      totalConversations,
      openConversations,
      closedConversations,
      totalMessages,
      totalProducts,
      totalEmployees,
    ] = await Promise.all([
      prisma.conversation.count({ where: { companyId } }),
      prisma.conversation.count({ where: { companyId, status: "OPEN" } }),
      prisma.conversation.count({ where: { companyId, status: "CLOSED" } }),
      prisma.message.count({
        where: { conversation: { companyId } },
      }),
      prisma.product.count({ where: { companyId } }),
      prisma.user.count({ where: { companyId, role: "EMPLOYEE" } }),
    ]);

    const conversationsByChannel = await prisma.conversation.groupBy({
      by: ["channel"],
      where: { companyId },
      _count: { id: true },
    });

    return {
      totalConversations,
      openConversations,
      closedConversations,
      totalMessages,
      totalProducts,
      totalEmployees,
      conversationsByChannel: conversationsByChannel.map(
        (c: { channel: string; _count: { id: number } }) => ({
          channel: c.channel,
          count: c._count.id,
        }),
      ),
    };
  }

  async getRanking(companyId: string) {
    const employees = await prisma.user.findMany({
      where: { companyId, role: "EMPLOYEE", isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        _count: {
          select: { conversations: true },
        },
      },
      orderBy: {
        conversations: { _count: "desc" },
      },
    });

    const employeesWithMessages = await Promise.all(
      employees.map(
        async (emp: {
          id: string;
          name: string;
          email: string;
          _count: { conversations: number };
        }) => {
          const messageCount = await prisma.message.count({
            where: {
              conversation: { assignedToId: emp.id, companyId },
              sender: "USER",
            },
          });

          const closedCount = await prisma.conversation.count({
            where: { assignedToId: emp.id, companyId, status: "CLOSED" },
          });

          return {
            id: emp.id,
            name: emp.name,
            email: emp.email,
            totalConversations: emp._count.conversations,
            closedConversations: closedCount,
            messagesSent: messageCount,
          };
        },
      ),
    );

    return employeesWithMessages.sort(
      (
        a: { closedConversations: number },
        b: { closedConversations: number },
      ) => b.closedConversations - a.closedConversations,
    );
  }

  async getStats(companyId: string) {
    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalMessages,
      todayMessages,
      weekMessages,
      monthMessages,
      totalConversations,
      openConversations,
      activeEmployees,
      recentConversations,
    ] = await Promise.all([
      prisma.message.count({ where: { conversation: { companyId } } }),
      prisma.message.count({
        where: { conversation: { companyId }, createdAt: { gte: startOfDay } },
      }),
      prisma.message.count({
        where: { conversation: { companyId }, createdAt: { gte: startOfWeek } },
      }),
      prisma.message.count({
        where: {
          conversation: { companyId },
          createdAt: { gte: startOfMonth },
        },
      }),
      prisma.conversation.count({ where: { companyId } }),
      prisma.conversation.count({ where: { companyId, status: "OPEN" } }),
      prisma.user.count({
        where: { companyId, role: "EMPLOYEE", isActive: true },
      }),
      prisma.conversation.findMany({
        where: { companyId },
        orderBy: { updatedAt: "desc" },
        take: 5,
        include: {
          assignedTo: { select: { id: true, name: true } },
          _count: { select: { messages: true } },
        },
      }),
    ]);

    const channelBreakdown = await prisma.conversation.groupBy({
      by: ["channel"],
      where: { companyId },
      _count: { id: true },
    });

    return {
      totalMessages,
      todayMessages,
      weekMessages,
      monthMessages,
      totalConversations,
      openConversations,
      activeEmployees,
      recentConversations,
      channelBreakdown: channelBreakdown.map(
        (c: { channel: string; _count: { id: number } }) => ({
          channel: c.channel,
          count: c._count.id,
        }),
      ),
    };
  }

  async getEmployeeStats(companyId: string, userId: string) {
    const [
      totalConversations,
      openConversations,
      closedConversations,
      messagesSent,
    ] = await Promise.all([
      prisma.conversation.count({ where: { assignedToId: userId, companyId } }),
      prisma.conversation.count({
        where: { assignedToId: userId, companyId, status: "OPEN" },
      }),
      prisma.conversation.count({
        where: { assignedToId: userId, companyId, status: "CLOSED" },
      }),
      prisma.message.count({
        where: {
          conversation: { assignedToId: userId, companyId },
          sender: "USER",
        },
      }),
    ]);

    return {
      totalConversations,
      openConversations,
      closedConversations,
      messagesSent,
    };
  }
}
