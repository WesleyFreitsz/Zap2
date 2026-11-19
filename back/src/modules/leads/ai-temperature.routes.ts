import { Router } from "express";
import { AiTemperatureController } from "./ai-temperature.controller";
import { authMiddleware } from "../../middlewares/auth";
import { authorize } from "../../middlewares/authorize";
import { subscriptionGuard } from "../../middlewares/subscription";

const router = Router();
const aiController = new AiTemperatureController();

// Todas as rotas precisam de autenticação
router.use(authMiddleware, subscriptionGuard);

// Analisar lead específico
router.post("/analyze/:leadId", aiController.analyzeLead.bind(aiController));

// Analisar todos os leads em lote
router.post(
  "/batch-analyze",
  authorize("ADMIN", "SUPER_ADMIN"),
  aiController.batchAnalyze.bind(aiController),
);

// Obter insights sobre distribuição de temperaturas
router.get("/insights", aiController.getInsights.bind(aiController));

// Disparar classificação automática
router.post(
  "/auto-classify",
  authorize("ADMIN", "SUPER_ADMIN"),
  aiController.triggerAutoClassification.bind(aiController),
);

export default router;
