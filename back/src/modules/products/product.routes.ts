import { Router } from "express";
import { ProductController } from "./product.controller";
import { authMiddleware } from "../../middlewares/auth";
import { authorize } from "../../middlewares/authorize";
import { subscriptionGuard } from "../../middlewares/subscription";
import { uploadProductImage } from "../../middlewares/upload";
import { validate } from "../../middlewares/validate";
import {
  createProductSchema,
  updateProductSchema,
  sendProductToChatSchema,
} from "./product.schema";

const router = Router();
const controller = new ProductController();

router.use(authMiddleware, subscriptionGuard);

router.get("/", controller.findAll);
router.get("/:id", controller.findById);
router.post(
  "/",
  authorize("ADMIN", "SUPER_ADMIN"),
  uploadProductImage,
  validate(createProductSchema),
  controller.create,
);
router.put(
  "/:id",
  authorize("ADMIN", "SUPER_ADMIN"),
  uploadProductImage,
  validate(updateProductSchema),
  controller.update,
);
router.delete("/:id", authorize("ADMIN", "SUPER_ADMIN"), controller.delete);
router.post(
  "/send-to-chat",
  validate(sendProductToChatSchema),
  controller.sendToChat,
);

export default router;
