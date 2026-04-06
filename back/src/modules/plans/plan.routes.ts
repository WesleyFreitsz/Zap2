import { Router } from "express";
import { PlanController } from "./plan.controller";
import { authMiddleware } from "../../middlewares/auth";
import { authorize } from "../../middlewares/authorize";

const router = Router();
const controller = new PlanController();

// Public: list active plans (for pricing page / billing page)
router.get("/", controller.findAll);
router.get("/:slug", controller.findBySlug);

// SUPER_ADMIN only: manage plans
router.post("/", authMiddleware, authorize("SUPER_ADMIN"), controller.create);
router.put("/:id", authMiddleware, authorize("SUPER_ADMIN"), controller.update);
router.delete("/:id", authMiddleware, authorize("SUPER_ADMIN"), controller.delete);

export default router;
