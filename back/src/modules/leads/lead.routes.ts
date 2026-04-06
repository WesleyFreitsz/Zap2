import { Router } from "express";
import { LeadController } from "./lead.controller";
import { authMiddleware } from "../../middlewares/auth";
import { subscriptionGuard } from "../../middlewares/subscription";
import aiTemperatureRoutes from "./ai-temperature.routes";

const router = Router();
const controller = new LeadController();

// Rotas principais de leads
router.get("/", authMiddleware, subscriptionGuard, controller.findAll);
router.get("/:id", authMiddleware, subscriptionGuard, controller.findById);
router.post("/", authMiddleware, subscriptionGuard, controller.create);
router.put("/:id", authMiddleware, subscriptionGuard, controller.update);
router.delete("/:id", authMiddleware, subscriptionGuard, controller.delete);

// Rotas de IA de temperatura
router.use("/ai", aiTemperatureRoutes);

export default router;
