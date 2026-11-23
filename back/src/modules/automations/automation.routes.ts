import { Router, type Request, type RequestHandler } from "express";
import { authMiddleware } from "../../middlewares/auth";
import { authorize } from "../../middlewares/authorize";
import { subscriptionGuard } from "../../middlewares/subscription";
import { validate } from "../../middlewares/validate";
import { AppError } from "../../utils/AppError";
import { MessageService } from "../messages/message.service";
import {
  automationSendMessageSchema,
  updateAutomationConfigSchema,
  type AutomationSendMessageInput,
} from "./automation.schema";
import { AutomationService } from "./automation.service";

const router = Router();
const service = new AutomationService();
const messageService = new MessageService();

function respond(run: (companyId: string, req: Request) => unknown): RequestHandler {
  return async (req, res, next) => {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) throw new AppError("Usuário não está associado a uma empresa", 400);
      res.json({ status: "success", data: await run(companyId, req) });
    } catch (error) {
      next(error);
    }
  };
}

router.post("/messages", async (req, res, next) => {
  try {
    const companyId = await service.findCompanyIdByApiKey(req.get("X-Api-Key"));
    const { conversationId, content }: AutomationSendMessageInput = automationSendMessageSchema.parse(req.body);
    res.status(201).json({
      status: "success",
      data: await messageService.sendFromIntegration(conversationId, companyId, content),
    });
  } catch (error) {
    next(error);
  }
});

router.use(authMiddleware, subscriptionGuard, authorize("ADMIN"));
router.get("/config", respond((companyId) => service.getConfig(companyId)));
router.put("/config", validate(updateAutomationConfigSchema), respond((companyId, req) => service.updateConfig(companyId, req.body)));
router.post("/config/test", respond((companyId) => service.testWebhook(companyId)));
router.post("/api-key", respond((companyId) => service.rotateApiKey(companyId)));
router.delete("/api-key", respond((companyId) => service.revokeApiKey(companyId)));

export default router;
