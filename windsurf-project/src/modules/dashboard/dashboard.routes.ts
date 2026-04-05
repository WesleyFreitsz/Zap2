import { Router } from "express";
import { DashboardController } from "./dashboard.controller";
import { authMiddleware } from "../../middlewares/auth";
import { authorize } from "../../middlewares/authorize";
import { subscriptionGuard } from "../../middlewares/subscription";

const router = Router();
const controller = new DashboardController();

router.use(authMiddleware, subscriptionGuard);

router.get("/overview", authorize("ADMIN", "SUPER_ADMIN"), controller.overview);
router.get("/stats", authorize("ADMIN", "SUPER_ADMIN"), controller.stats);
router.get("/ranking", authorize("ADMIN", "SUPER_ADMIN"), controller.ranking);
router.get("/my-stats", controller.myStats);

export default router;
