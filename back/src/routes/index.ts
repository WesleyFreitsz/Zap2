import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes";
import userRoutes from "../modules/users/user.routes";
import conversationRoutes from "../modules/conversations/conversation.routes";
import messageRoutes from "../modules/messages/message.routes";
import productRoutes from "../modules/products/product.routes";
import scheduleRoutes from "../modules/schedule/schedule.routes";
import dashboardRoutes from "../modules/dashboard/dashboard.routes";
import whatsappRoutes from "../modules/integrations/wppconnect/wppconnect.routes";
import companyRoutes from "../modules/companies/company.routes";
import aiConfigRoutes from "../modules/ai-config/aiConfig.routes";
import tagRoutes from "../modules/tags/tag.routes";
import leadRoutes from "../modules/leads/lead.routes";
import invitationRoutes from "../modules/invitations/invitation.routes";
import billingRoutes from "../modules/billing/billing.routes";
import adminDashboardRoutes from "../modules/admin-dashboard/admin-dashboard.routes";
import planRoutes from "../modules/plans/plan.routes";
import metaWebhookRoutes from "../modules/meta/meta-webhook.routes";
import channelRoutes from "../modules/channels/channels.routes";
import quickReplyRoutes from "../modules/quick-replies/quick-reply.routes";

const router = Router();

router.use("/webhooks/meta", metaWebhookRoutes);

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/conversations", conversationRoutes);
router.use("/messages", messageRoutes);
router.use("/products", productRoutes);
router.use("/schedule", scheduleRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/integrations/whatsapp", whatsappRoutes);
router.use("/channels", channelRoutes);
router.use("/companies", companyRoutes);
router.use("/ai-config", aiConfigRoutes);
router.use("/tags", tagRoutes);
router.use("/leads", leadRoutes);
router.use("/invitations", invitationRoutes);
router.use("/billing", billingRoutes);
router.use("/admin", adminDashboardRoutes);
router.use("/plans", planRoutes);
router.use("/quick-replies", quickReplyRoutes);

export default router;
