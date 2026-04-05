import { Router } from "express";
import { ConversationController } from "./conversation.controller";
import { authMiddleware } from "../../middlewares/auth";
import { authorize } from "../../middlewares/authorize";
import { subscriptionGuard } from "../../middlewares/subscription";
import { validate } from "../../middlewares/validate";
import {
  createConversationSchema,
  transferConversationSchema,
  assignConversationSchema,
} from "./conversation.schema";

const router = Router();
const controller = new ConversationController();

router.use(authMiddleware, subscriptionGuard);

router.get("/", controller.findAll);
router.get("/:id", controller.findById);
router.post("/", validate(createConversationSchema), controller.create);
router.post(
  "/assign",
  authorize("ADMIN", "SUPER_ADMIN"),
  validate(assignConversationSchema),
  controller.assign,
);
router.post(
  "/transfer",
  authorize("ADMIN", "EMPLOYEE"),
  validate(transferConversationSchema),
  controller.transfer,
);
router.put("/:id", controller.update);
router.patch("/:id/close", authorize("ADMIN", "EMPLOYEE"), controller.close);

export default router;
