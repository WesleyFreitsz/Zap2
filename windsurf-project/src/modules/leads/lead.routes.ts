import { Router } from "express";
import { LeadController } from "./lead.controller";
import { authMiddleware } from "../../middlewares/auth";
import { subscriptionGuard } from "../../middlewares/subscription";

const router = Router();
const controller = new LeadController();

router.get("/", authMiddleware, subscriptionGuard, controller.findAll);
router.get("/:id", authMiddleware, subscriptionGuard, controller.findById);
router.post("/", authMiddleware, subscriptionGuard, controller.create);
router.put("/:id", authMiddleware, subscriptionGuard, controller.update);
router.delete("/:id", authMiddleware, subscriptionGuard, controller.delete);

export default router;
