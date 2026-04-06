import cron from "node-cron";
import { AiTemperatureService } from "../modules/leads/ai-temperature.service";
import prisma from "../config/prisma";

class AiTemperatureScheduler {
  private aiService: AiTemperatureService;
  private isRunning = false;

  constructor() {
    this.aiService = new AiTemperatureService();
  }

  /**
   * Inicia o scheduler para classificação automática
   */
  start() {
    console.log("🤖 [AI] Iniciando scheduler de classificação de temperatura...");

    // Rodar a cada 2 horas
    cron.schedule("0 */2 * * *", async () => {
      await this.runAutoClassification();
    });

    // Rodar todo dia às 9h da manhã
    cron.schedule("0 9 * * *", async () => {
      await this.runDailyClassification();
    });

    console.log("✅ [AI] Scheduler iniciado com sucesso!");
  }

  /**
   * Executa classificação automática (a cada 2 horas)
   */
  private async runAutoClassification() {
    if (this.isRunning) {
      console.log("⏳ [AI] Classificação já em execução, aguardando...");
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      console.log("🚀 [AI] Iniciando classificação automática de leads...");

      // Buscar todas as empresas ativas
      const companies = await prisma.company.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
      });

      let totalProcessed = 0;
      let totalUpdated = 0;

      for (const company of companies) {
        try {
          console.log(`📊 [AI] Analisando empresa: ${company.name}`);

          const result = await this.aiService.batchClassifyLeads(company.id);

          totalProcessed += result.processed;
          totalUpdated += result.updated;

          console.log(`✅ [AI] ${company.name}: ${result.processed} processados, ${result.updated} atualizados`);

          // Pequena pausa entre empresas para não sobrecarregar
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`❌ [AI] Erro ao classificar leads da empresa ${company.name}:`, error);
        }
      }

      const duration = (Date.now() - startTime) / 1000;
      console.log(`🎉 [AI] Classificação concluída em ${duration.toFixed(2)}s:`);
      console.log(`   📈 Total processados: ${totalProcessed}`);
      console.log(`   🔄 Total atualizados: ${totalUpdated}`);
      console.log(`   📊 Empresas analisadas: ${companies.length}`);

    } catch (error) {
      console.error("❌ [AI] Erro na classificação automática:", error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Executa classificação diária completa com relatório
   */
  private async runDailyClassification() {
    console.log("🌅 [AI] Iniciando classificação diária completa...");

    try {
      await this.runAutoClassification();

      // Gerar relatório diário
      await this.generateDailyReport();

    } catch (error) {
      console.error("❌ [AI] Erro na classificação diária:", error);
    }
  }

  /**
   * Gera relatório diário das classificações
   */
  private async generateDailyReport() {
    try {
      console.log("📊 [AI] Gerando relatório diário...");

      const companies = await prisma.company.findMany({
        where: { isActive: true },
        include: {
          leads: {
            select: { temperature: true },
          },
        },
      });

      const report = {
        date: new Date().toISOString().split('T')[0],
        totalCompanies: companies.length,
        totalLeads: companies.reduce((sum: number, comp: any) => sum + comp.leads.length, 0),
        distribution: {
          HOT: 0,
          WARM: 0,
          COLD: 0,
        },
        companyBreakdown: companies.map((company: any) => {
          const distribution = company.leads.reduce((acc: any, lead: any) => {
            acc[lead.temperature] = (acc[lead.temperature] || 0) + 1;
            return acc;
          }, { HOT: 0, WARM: 0, COLD: 0 });

          return {
            companyName: company.name,
            totalLeads: company.leads.length,
            distribution,
          };
        }),
      };

      // Acumular distribuição total
      companies.forEach((company: any) => {
        company.leads.forEach((lead: any) => {
          (report.distribution as any)[lead.temperature]++;
        });
      });

      console.log("📋 [AI] Relatório diário gerado:");
      console.log(`   📅 Data: ${report.date}`);
      console.log(`   🏢 Empresas: ${report.totalCompanies}`);
      console.log(`   👥 Total Leads: ${report.totalLeads}`);
      console.log(`   🔥 HOT: ${report.distribution.HOT} (${((report.distribution.HOT / report.totalLeads) * 100).toFixed(1)}%)`);
      console.log(`   🌡️ WARM: ${report.distribution.WARM} (${((report.distribution.WARM / report.totalLeads) * 100).toFixed(1)}%)`);
      console.log(`   ❄️ COLD: ${report.distribution.COLD} (${((report.distribution.COLD / report.totalLeads) * 100).toFixed(1)}%)`);

      // Aqui você poderia salvar o relatório no banco ou enviar por email
      // await this.saveDailyReport(report);

    } catch (error) {
      console.error("❌ [AI] Erro ao gerar relatório diário:", error);
    }
  }

  /**
   * Executa classificação manual para uma empresa específica
   */
  async classifyCompany(companyId: string) {
    try {
      console.log(`🎯 [AI] Classificando empresa específica: ${companyId}`);

      const result = await this.aiService.batchClassifyLeads(companyId);

      console.log(`✅ [AI] Classificação manual concluída:`);
      console.log(`   📊 Processados: ${result.processed}`);
      console.log(`   🔄 Atualizados: ${result.updated}`);

      return result;
    } catch (error) {
      console.error(`❌ [AI] Erro na classificação manual da empresa ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Para o scheduler (útil para testes)
   */
  stop() {
    console.log("🛑 [AI] Parando scheduler de classificação...");
    // Em uma implementação real, você armazenaria as referências aos jobs e os paria
    console.log("✅ [AI] Scheduler parado");
  }
}

export default AiTemperatureScheduler;
