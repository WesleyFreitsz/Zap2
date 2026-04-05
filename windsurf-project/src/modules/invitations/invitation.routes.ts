import { Router } from "express";
import { InvitationController } from "./invitation.controller";
import { authMiddleware } from "../../middlewares/auth";
import { authorize } from "../../middlewares/authorize";

const router = Router();
const controller = new InvitationController();

// Public routes (no auth needed)
router.get("/token/:token", controller.getByToken);

// Authenticated routes
router.get(
  "/",
  authMiddleware,
  authorize("ADMIN", "SUPER_ADMIN"),
  controller.list,
);
router.post(
  "/",
  authMiddleware,
  authorize("ADMIN", "SUPER_ADMIN"),
  controller.send,
);
router.delete(
  "/:id",
  authMiddleware,
  authorize("ADMIN", "SUPER_ADMIN"),
  controller.revoke,
);

export default router;
