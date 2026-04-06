import { Router } from "express";
import { WppConnectController } from "./wppconnect.controller";
import { authMiddleware } from "../../../middlewares/auth";
import { authorize } from "../../../middlewares/authorize";
import { subscriptionGuard } from "../../../middlewares/subscription";

const router = Router();
const controller = new WppConnectController();

// Create new session (validates plan limit internally)
router.post(
  "/connect",
  authMiddleware,
  subscriptionGuard,
  authorize("ADMIN", "SUPER_ADMIN"),
  controller.connect,
);

// List all sessions for company
router.get("/sessions", authMiddleware, subscriptionGuard, controller.sessions);

// Status of specific session
router.get(
  "/status/:integrationId",
  authMiddleware,
  subscriptionGuard,
  controller.status,
);

// QR code of specific session
router.get(
  "/qrcode/:integrationId",
  authMiddleware,
  subscriptionGuard,
  authorize("ADMIN", "SUPER_ADMIN"),
  controller.qrCode,
);

// Reconnect specific session
router.post(
  "/reconnect/:integrationId",
  authMiddleware,
  subscriptionGuard,
  authorize("ADMIN", "SUPER_ADMIN"),
  controller.reconnect,
);

// Disconnect specific session
router.post(
  "/disconnect/:integrationId",
  authMiddleware,
  subscriptionGuard,
  authorize("ADMIN", "SUPER_ADMIN"),
  controller.disconnect,
);

// Send message (integrationId optional in body, auto-selects if omitted)
router.post("/send", authMiddleware, subscriptionGuard, controller.sendMessage);

// Send media (integrationId optional in body)
router.post(
  "/send-media",
  authMiddleware,
  subscriptionGuard,
  controller.sendMedia,
);

export default router;
