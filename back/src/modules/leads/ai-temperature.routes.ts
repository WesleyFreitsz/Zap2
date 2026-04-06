import { Router } from "express";
import { AiTemperatureController } from "./ai-temperature.controller";
import { authMiddleware } from "../../middlewares/auth";

const router = Router();
const aiController = new AiTemperatureController();

// Todas as rotas precisam de autenticação
router.use(authMiddleware);

// Analisar lead específico
router.post("/analyze/:leadId", aiController.analyzeLead.bind(aiController));

// Analisar todos os leads em lote
router.post("/batch-analyze", aiController.batchAnalyze.bind(aiController));

// Obter insights sobre distribuição de temperaturas
router.get("/insights", aiController.getInsights.bind(aiController));

// Disparar classificação automática
router.post("/auto-classify", aiController.triggerAutoClassification.bind(aiController));

export default router;
