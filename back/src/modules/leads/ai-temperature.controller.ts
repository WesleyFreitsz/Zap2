import { Request, Response } from "express";
import { AiTemperatureService } from "./ai-temperature.service";
import { AppError } from "../../utils/AppError";

export class AiTemperatureController {
  private aiService: AiTemperatureService;

  constructor() {
    this.aiService = new AiTemperatureService();
  }

  async analyzeLead(req: Request, res: Response) {
    try {
      const { leadId } = req.params;
      const companyId = req.user?.companyId;

      if (!companyId) {
        throw new AppError("Company ID required", 400);
      }

      const result = await this.aiService.analyzeAndClassifyLead(leadId as string, companyId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error("❌ [AI] Erro ao analisar lead:", error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Failed to analyze lead",
      });
    }
  }

  async batchAnalyze(req: Request, res: Response) {
    try {
      const companyId = req.user?.companyId;

      if (!companyId) {
        throw new AppError("Company ID required", 400);
      }

      const result = await this.aiService.batchClassifyLeads(companyId);

      res.json({
        success: true,
        data: result,
        message: `Analisados ${result.processed} leads, ${result.updated} atualizados`,
      });
    } catch (error: any) {
      console.error("❌ [AI] Erro no processamento em lote:", error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Failed to batch analyze leads",
      });
    }
  }

  async getInsights(req: Request, res: Response) {
    try {
      const companyId = req.user?.companyId;

      if (!companyId) {
        throw new AppError("Company ID required", 400);
      }

      const insights = await this.aiService.getTemperatureInsights(companyId);

      res.json({
        success: true,
        data: insights,
      });
    } catch (error: any) {
      console.error("❌ [AI] Erro ao obter insights:", error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Failed to get insights",
      });
    }
  }

  async triggerAutoClassification(req: Request, res: Response) {
    try {
      const companyId = req.user?.companyId;

      if (!companyId) {
        throw new AppError("Company ID required", 400);
      }

      // Iniciar classificação automática em background
      this.aiService.batchClassifyLeads(companyId).catch((error: any) => {
        console.error("❌ [AI] Erro na classificação automática:", error);
      });

      res.json({
        success: true,
        message: "Classificação automática iniciada em background",
      });
    } catch (error: any) {
      console.error("❌ [AI] Erro ao iniciar classificação:", error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Failed to trigger auto classification",
      });
    }
  }
}
