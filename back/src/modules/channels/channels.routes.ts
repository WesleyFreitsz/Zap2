import { Router } from "express";
import { env } from "../../config/env";
import { authMiddleware } from "../../middlewares/auth";
import { authorize } from "../../middlewares/authorize";
import { subscriptionGuard } from "../../middlewares/subscription";
import { validate } from "../../middlewares/validate";
import { ChannelsController } from "./channels.controller";
import {
  connectPagesSchema,
  connectWhatsAppSchema,
  discoverPagesSchema,
  manualConnectSchema,
} from "./channels.schema";
import { ChannelsService } from "./channels.service";

const router = Router();
const controller = new ChannelsController(new ChannelsService());
const authorizeWrite = authorize("ADMIN", "SUPER_ADMIN");

router.use(authMiddleware, subscriptionGuard);
router.get("/", controller.findAll);
router.get("/meta/config", controller.getMetaConfig);
router.post("/meta/pages/discover", authorizeWrite, validate(discoverPagesSchema), controller.discoverPages);
router.post("/meta/pages/connect", authorizeWrite, validate(connectPagesSchema), controller.connectPages);
router.post("/whatsapp-cloud/connect", authorizeWrite, validate(connectWhatsAppSchema), controller.connectWhatsApp);
if (env.META_ALLOW_MANUAL_CONNECT) {
  router.post("/meta/manual", authorizeWrite, validate(manualConnectSchema), controller.connectManual);
}
router.delete("/:id", authorizeWrite, controller.delete);

export default router;
