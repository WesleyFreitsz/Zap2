import { Router } from "express";
import { EvolutionController } from "./evolution.controller";
import { authMiddleware } from "../../../middlewares/auth";
import { authorize } from "../../../middlewares/authorize";
import { subscriptionGuard } from "../../../middlewares/subscription";

const router = Router();
const controller = new EvolutionController();

router.post(
  "/connect",
  authMiddleware,
  subscriptionGuard,
  authorize("ADMIN", "SUPER_ADMIN"),
  controller.connect,
);
router.get("/status", authMiddleware, subscriptionGuard, controller.status);
router.get(
  "/qrcode",
  authMiddleware,
  subscriptionGuard,
  authorize("ADMIN", "SUPER_ADMIN"),
  controller.qrCode,
);
router.post(
  "/reconnect",
  authMiddleware,
  subscriptionGuard,
  authorize("ADMIN", "SUPER_ADMIN"),
  controller.reconnect,
);
router.post(
  "/disconnect",
  authMiddleware,
  subscriptionGuard,
  authorize("ADMIN", "SUPER_ADMIN"),
  controller.disconnect,
);
router.post("/send", authMiddleware, subscriptionGuard, controller.sendMessage);
router.post(
  "/send-media",
  authMiddleware,
  subscriptionGuard,
  controller.sendMedia,
);
router.get(
  "/config",
  authMiddleware,
  subscriptionGuard,
  authorize("ADMIN", "SUPER_ADMIN"),
  controller.getConfig,
);
router.put(
  "/config",
  authMiddleware,
  subscriptionGuard,
  authorize("ADMIN", "SUPER_ADMIN"),
  controller.saveConfig,
);

export default router;
