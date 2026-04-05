import { Router } from "express";
import { UserController } from "./user.controller";
import { authMiddleware } from "../../middlewares/auth";
import { authorize } from "../../middlewares/authorize";
import { subscriptionGuard } from "../../middlewares/subscription";
import { validate } from "../../middlewares/validate";
import { createUserSchema } from "./user.schema";

const router = Router();
const controller = new UserController();

router.use(authMiddleware);

// Any authenticated user
router.get("/profile", controller.getProfile);
router.post("/change-password", controller.changePassword);

// Admin-only user management (needs subscription)
router.get(
  "/",
  subscriptionGuard,
  authorize("ADMIN", "SUPER_ADMIN"),
  controller.findAll,
);
router.get(
  "/:id",
  subscriptionGuard,
  authorize("ADMIN", "SUPER_ADMIN"),
  controller.findById,
);
router.post(
  "/",
  subscriptionGuard,
  authorize("ADMIN", "SUPER_ADMIN"),
  validate(createUserSchema),
  controller.create,
);
router.put(
  "/:id",
  subscriptionGuard,
  authorize("ADMIN", "SUPER_ADMIN"),
  controller.update,
);
router.delete(
  "/:id",
  subscriptionGuard,
  authorize("ADMIN", "SUPER_ADMIN"),
  controller.delete,
);

export default router;
