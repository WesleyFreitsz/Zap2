import { Router } from "express";
import { AdminDashboardController } from "./admin-dashboard.controller";
import { authMiddleware } from "../../middlewares/auth";
import { authorize } from "../../middlewares/authorize";

const router = Router();
const controller = new AdminDashboardController();

router.use(authMiddleware, authorize("SUPER_ADMIN"));

router.get("/dashboard", controller.getDashboard);
router.post("/companies", controller.createCompany);

export default router;
