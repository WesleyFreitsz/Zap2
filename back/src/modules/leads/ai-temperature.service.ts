import prisma from "../../config/prisma";
import { AppError } from "../../utils/AppError";

interface BehaviorMetrics {
  messageCount: number;
  questionCount: number;
  productInterestCount: number;
  purchaseHistory: boolean;
  lastInteractionDays: number;
  responseRate: number;
  conversationDuration: number;
  mentionsProducts: boolean;
  mentionsPrice: boolean;
  mentionsBuy: boolean;
}

interface TemperatureScore {
  hot: number;
  warm: number;
  cold: number;
}

export class AiTemperatureService {
  /**
   * Analisa o comportamento do cliente e classifica automaticamente a temperatura
   */
  async analyzeAndClassifyLead(leadId: string, companyId: string): Promise<{
    temperature: "HOT" | "WARM" | "COLD";
    confidence: number;
    metrics: BehaviorMetrics;
    reasoning: string;
  }> {
    try {
      // Buscar dados do lead
      const lead = await prisma.lead.findFirst({
        where: { id: leadId, companyId },
        include: {
          conversations: {
            include: {
              messages: true,
            },
            orderBy: { updatedAt: "desc" },
          },
        },
      });

      if (!lead) {
        throw new AppError("Lead not found", 404);
      }

      // Buscar tags separadamente
      const tags = await prisma.$queryRaw`
        SELECT t.* FROM tags t
        INNER JOIN lead_tags lt ON t.id = lt."tagId"
        WHERE lt."leadId" = ${leadId}
      ` as any[];

      // Calcular métricas de comportamento
      const metrics = await this.calculateBehaviorMetrics(lead, tags);

      // Calcular scores para cada temperatura
      const scores = this.calculateTemperatureScores(metrics);

      // Determinar temperatura final
      const result = this.determineTemperature(scores, metrics);

      // Adicionar metrics ao resultado
      const resultWithMetrics = {
        ...result,
        metrics,
      };

      // Atualizar lead se necessário
      if (result.temperature !== lead.temperature) {
        await this.updateLeadTemperature(leadId, result.temperature, result.reasoning);
      }

      return resultWithMetrics;
    } catch (error) {
      console.error("❌ [AI] Erro ao analisar lead:", error);
      throw new AppError("Failed to analyze lead", 500);
    }
  }

  /**
   * Classifica múltiplos leads em lote
   */
  async batchClassifyLeads(companyId: string): Promise<{
    processed: number;
    updated: number;
    results: any[];
  }> {
    try {
      const leads = await prisma.lead.findMany({
        where: { companyId },
        include: {
          conversations: {
            include: {
              messages: true,
            },
          },
        },
      });

      let updated = 0;
      const results = [];

      for (const lead of leads) {
        try {
          // Buscar tags para este lead
          const tags = await prisma.$queryRaw`
            SELECT t.* FROM tags t
            INNER JOIN lead_tags lt ON t.id = lt."tagId"
            WHERE lt."leadId" = ${lead.id}
          `;

          const result = await this.analyzeAndClassifyLead(lead.id, companyId);
          results.push({
            leadId: lead.id,
            leadName: lead.name,
            previousTemperature: lead.temperature,
            newTemperature: result.temperature,
            confidence: result.confidence,
            reasoning: result.reasoning,
          });

          if (result.temperature !== lead.temperature) {
            updated++;
          }
        } catch (error: any) {
          console.error(`❌ [AI] Erro ao analisar lead ${lead.id}:`, error);
          results.push({
            leadId: lead.id,
            leadName: lead.name,
            error: error.message,
          });
        }
      }

      return {
        processed: leads.length,
        updated,
        results,
      };
    } catch (error) {
      console.error("❌ [AI] Erro no processamento em lote:", error);
      throw new AppError("Failed to batch classify leads", 500);
    }
  }

  /**
   * Calcula métricas de comportamento do cliente
   */
  private async calculateBehaviorMetrics(lead: any, tags: any[]): Promise<BehaviorMetrics> {
    const allMessages = lead.conversations.flatMap((conv: any) => conv.messages || []);
    const clientMessages = allMessages.filter((msg: any) => msg.senderType === "CLIENT");

    // Contar mensagens
    const messageCount = clientMessages.length;

    // Contar perguntas (mensagens com ?)
    const questionCount = clientMessages.filter((msg: any) =>
      msg.content?.includes('?') ||
      msg.content?.toLowerCase().includes('como') ||
      msg.content?.toLowerCase().includes('qual') ||
      msg.content?.toLowerCase().includes('onde') ||
      msg.content?.toLowerCase().includes('quanto')
    ).length;

    // Contar interesse em produtos
    const productKeywords = ['produto', 'serviço', 'plano', 'pacote', 'comprar', 'preço', 'valor'];
    const productInterestCount = clientMessages.filter((msg: any) =>
      productKeywords.some(keyword =>
        msg.content?.toLowerCase().includes(keyword)
      )
    ).length;

    // Verificar histórico de compras (baseado em tags ou status)
    const purchaseHistory = tags.some((tag: any) =>
      tag.name?.toLowerCase().includes('cliente') ||
      tag.name?.toLowerCase().includes('comprou')
    ) || lead.status === 'CONVERTED';

    // Dias desde última interação
    const lastMessage = allMessages[allMessages.length - 1];
    const lastInteractionDays = lastMessage
      ? Math.floor((Date.now() - new Date(lastMessage.createdAt).getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    // Taxa de resposta (mensagens do cliente vs total)
    const responseRate = allMessages.length > 0
      ? (clientMessages.length / allMessages.length) * 100
      : 0;

    // Duração média das conversas
    const conversationDurations = lead.conversations.map((conv: any) => {
      if (!conv.messages || conv.messages.length === 0) return 0;
      const first = conv.messages[0];
      const last = conv.messages[conv.messages.length - 1];
      return new Date(last.createdAt).getTime() - new Date(first.createdAt).getTime();
    });
    const conversationDuration = conversationDurations.reduce((a: number, b: number) => a + b, 0) / conversationDurations.length / (1000 * 60); // minutos

    // Análise de conteúdo específico
    const mentionsProducts = productInterestCount > 0;
    const mentionsPrice = clientMessages.some((msg: any) =>
      ['preço', 'valor', 'custo', 'quanto custa', 'preço'].some(keyword =>
        msg.content?.toLowerCase().includes(keyword)
      )
    );
    const mentionsBuy = clientMessages.some((msg: any) =>
      ['comprar', 'quero comprar', 'fechar', 'contratar', 'assinar'].some(keyword =>
        msg.content?.toLowerCase().includes(keyword)
      )
    );

    return {
      messageCount,
      questionCount,
      productInterestCount,
      purchaseHistory,
      lastInteractionDays,
      responseRate,
      conversationDuration,
      mentionsProducts,
      mentionsPrice,
      mentionsBuy,
    };
  }

  /**
   * Calcula scores para cada temperatura baseado nas métricas
   */
  private calculateTemperatureScores(metrics: BehaviorMetrics): TemperatureScore {
    let hot = 0;
    let warm = 0;
    let cold = 0;

    // PONTUAÇÃO HOT
    if (metrics.purchaseHistory) hot += 30;
    if (metrics.mentionsBuy) hot += 25;
    if (metrics.mentionsPrice) hot += 20;
    if (metrics.productInterestCount >= 3) hot += 15;
    if (metrics.responseRate > 60) hot += 10;
    if (metrics.lastInteractionDays < 7) hot += 10;
    if (metrics.conversationDuration > 10) hot += 10;

    // PONTUAÇÃO WARM
    if (metrics.productInterestCount >= 1 && metrics.productInterestCount < 3) warm += 25;
    if (metrics.questionCount >= 3) warm += 20;
    if (metrics.mentionsProducts) warm += 20;
    if (metrics.responseRate > 40) warm += 15;
    if (metrics.lastInteractionDays < 14) warm += 10;
    if (metrics.messageCount >= 5) warm += 10;

    // PONTUAÇÃO COLD
    if (metrics.messageCount <= 2) cold += 25;
    if (metrics.questionCount === 0) cold += 20;
    if (metrics.lastInteractionDays > 30) cold += 20;
    if (metrics.responseRate < 30) cold += 15;
    if (metrics.conversationDuration < 5) cold += 10;
    if (!metrics.mentionsProducts) cold += 10;

    return { hot, warm, cold };
  }

  /**
   * Determina a temperatura final baseado nos scores
   */
  private determineTemperature(scores: TemperatureScore, metrics: BehaviorMetrics): {
    temperature: "HOT" | "WARM" | "COLD";
    confidence: number;
    reasoning: string;
  } {
    const { hot, warm, cold } = scores;
    const total = hot + warm + cold;

    let temperature: "HOT" | "WARM" | "COLD";
    let reasoning: string;
    let confidence: number;

    if (hot >= warm && hot >= cold) {
      temperature = "HOT";
      confidence = (hot / total) * 100;
      reasoning = this.buildHotReasoning(metrics);
    } else if (warm >= cold) {
      temperature = "WARM";
      confidence = (warm / total) * 100;
      reasoning = this.buildWarmReasoning(metrics);
    } else {
      temperature = "COLD";
      confidence = (cold / total) * 100;
      reasoning = this.buildColdReasoning(metrics);
    }

    return { temperature, confidence, reasoning };
  }

  private buildHotReasoning(metrics: BehaviorMetrics): string {
    const reasons = [];
    if (metrics.purchaseHistory) reasons.push("já comprou anteriormente");
    if (metrics.mentionsBuy) reasons.push("mencionou interesse em comprar");
    if (metrics.mentionsPrice) reasons.push("perguntou sobre preços");
    if (metrics.productInterestCount >= 3) reasons.push("mostrou alto interesse em produtos");
    if (metrics.responseRate > 60) reasons.push("alta taxa de resposta");
    return `Cliente HOT: ${reasons.join(", ")}`;
  }

  private buildWarmReasoning(metrics: BehaviorMetrics): string {
    const reasons = [];
    if (metrics.productInterestCount >= 1) reasons.push("interesse em produtos");
    if (metrics.questionCount >= 3) reasons.push("faz muitas perguntas");
    if (metrics.mentionsProducts) reasons.push("menciona produtos");
    if (metrics.responseRate > 40) reasons.push("taxa de resposta moderada");
    return `Cliente WARM: ${reasons.join(", ")}`;
  }

  private buildColdReasoning(metrics: BehaviorMetrics): string {
    const reasons = [];
    if (metrics.messageCount <= 2) reasons.push("poucas mensagens");
    if (metrics.questionCount === 0) reasons.push("não faz perguntas");
    if (metrics.lastInteractionDays > 30) reasons.push("inativo há muito tempo");
    if (metrics.responseRate < 30) reasons.push("baixa taxa de resposta");
    return `Cliente COLD: ${reasons.join(", ")}`;
  }

  /**
   * Atualiza a temperatura do lead no banco
   */
  private async updateLeadTemperature(
    leadId: string,
    temperature: "HOT" | "WARM" | "COLD",
    reasoning: string
  ): Promise<void> {
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        temperature,
        updatedAt: new Date(),
      },
    });

    console.log(`🤖 [AI] Lead ${leadId} atualizado para ${temperature}: ${reasoning}`);
  }

  /**
   * Obtém insights sobre a distribuição de temperaturas
   */
  async getTemperatureInsights(companyId: string): Promise<{
    distribution: Record<string, number>;
    totalLeads: number;
    recommendations: string[];
  }> {
    const leads = await prisma.lead.findMany({
      where: { companyId },
      select: { temperature: true },
    });

    const distribution = leads.reduce((acc: any, lead) => {
      acc[lead.temperature] = (acc[lead.temperature] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalLeads = leads.length;
    const hotPercentage = (distribution.HOT || 0) / totalLeads * 100;
    const warmPercentage = (distribution.WARM || 0) / totalLeads * 100;
    const coldPercentage = (distribution.COLD || 0) / totalLeads * 100;

    const recommendations = [];
    if (hotPercentage < 20) recommendations.push("Foque em converter leads WARM para HOT");
    if (coldPercentage > 50) recommendations.push("Muitos leads COLD, considere campanhas de reengajamento");
    if (warmPercentage > 40) recommendations.push("Oportunidade de converter muitos leads WARM");

    return {
      distribution,
      totalLeads,
      recommendations,
    };
  }
}
