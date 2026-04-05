import { Router } from "express";
import { BillingController } from "./billing.controller";
import { authMiddleware } from "../../middlewares/auth";
import { authorize } from "../../middlewares/authorize";

const router = Router();
const controller = new BillingController();

// Authenticated billing routes
router.get("/subscription", authMiddleware, controller.getSubscription);
router.get("/invoices", authMiddleware, controller.getInvoices);
router.post(
  "/subscriptions",
  authMiddleware,
  authorize("ADMIN", "SUPER_ADMIN"),
  controller.createSubscription,
);

// Asaas webhook (public, verified by token in header)
router.post("/webhook/asaas", controller.asaasWebhook);

export default router;
