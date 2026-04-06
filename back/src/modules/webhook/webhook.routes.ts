import { Router } from "express";
import { WebhookController } from "./webhook.controller";

const router = Router();
const controller = new WebhookController();

router.post("/instagram", controller.instagramIncoming);
router.post("/facebook", controller.facebookIncoming);

export default router;
