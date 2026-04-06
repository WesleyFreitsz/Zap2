import { Router } from "express";
import { CompanyController } from "./company.controller";
import { authMiddleware } from "../../middlewares/auth";
import { authorize } from "../../middlewares/authorize";
import { uploadLogo } from "../../middlewares/upload";

const router = Router();
const controller = new CompanyController();

router.use(authMiddleware, authorize("SUPER_ADMIN"));

router.get("/", controller.findAll);
router.get("/:id", controller.findById);
router.put("/:id", controller.update);
router.patch("/:id/toggle", controller.toggleActive);
router.post("/:id/logo", uploadLogo, controller.uploadLogo);
router.delete("/:id", controller.delete);

export default router;
