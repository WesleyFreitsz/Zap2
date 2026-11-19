import prisma from "../../config/prisma";

export interface DayData {
  day: string;
  date: string;
  mensagens: number;
  ia: number;
}

export class DashboardService {
  async getOverview(companyId: string) {
    const [
      totalConversations,
      openConversations,
      closedConversations,
      totalMessages,
      totalProducts,
      activeEmployees,
    ] = await Promise.all([
      prisma.conversation.count({ where: { companyId } }),
      prisma.conversation.count({ where: { companyId, status: "OPEN" } }),
      prisma.conversation.count({ where: { companyId, status: "CLOSED" } }),
      prisma.message.count({
        where: { conversation: { companyId } },
      }),
      prisma.product.count({ where: { companyId } }),
      prisma.user.count({ where: { companyId, role: "EMPLOYEE", isActive: true } }),
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
      activeEmployees,
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
      totalProducts,
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
      prisma.product.count({ where: { companyId, active: true } }),
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
      totalProducts,
      recentConversations,
      channelBreakdown: channelBreakdown.map(
        (c: { channel: string; _count: { id: number } }) => ({
          channel: c.channel,
          count: c._count.id,
        }),
      ),
    };
  }

  async getWeeklyActivity(companyId: string): Promise<DayData[]> {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() - 1); // Start from Monday
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    // Get all messages from this week
    const messages = await prisma.message.findMany({
      where: {
        conversation: { companyId },
        createdAt: {
          gte: startOfWeek,
          lte: endOfWeek
        }
      },
      select: {
        createdAt: true,
        sender: true,
      }
    });

    // Helper to get day name in Portuguese
    const getDayName = (date: Date) => {
      const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      return days[date.getDay()];
    };

    // Initialize week data
    const weekData: DayData[] = [];
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(startOfWeek);
      currentDate.setDate(startOfWeek.getDate() + i);

      weekData.push({
        day: getDayName(currentDate),
        date: currentDate.toISOString().split('T')[0],
        mensagens: 0,
        ia: 0
      });
    }

    // Count messages by day
    messages.forEach(message => {
      const messageDate = new Date(message.createdAt);
      const dayIndex = messageDate.getDay();
      const adjustedIndex = dayIndex === 0 ? 6 : dayIndex - 1; // Adjust to make Monday=0, Sunday=6

      if (adjustedIndex >= 0 && adjustedIndex < 7) {
        if (message.sender === 'CLIENT') {
          weekData[adjustedIndex].mensagens++;
        } else if (message.sender === 'USER') {
          weekData[adjustedIndex].ia++;
        }
      }
    });

    return weekData;
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
