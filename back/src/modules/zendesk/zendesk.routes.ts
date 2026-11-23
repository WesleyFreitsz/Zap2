import { Router, type Request, type RequestHandler } from "express";
import { authMiddleware } from "../../middlewares/auth";
import { authorize } from "../../middlewares/authorize";
import { subscriptionGuard } from "../../middlewares/subscription";
import { validate } from "../../middlewares/validate";
import { AppError } from "../../utils/AppError";
import { readBearerToken } from "../../utils/secret-token";
import { saveZendeskConfigSchema, zendeskWebhookSchema } from "./zendesk.schema";
import { ZendeskService } from "./zendesk.service";

const service = new ZendeskService();

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

export const zendeskWebhookRoutes = Router();
zendeskWebhookRoutes.post("/", async (req, res, next) => {
  try {
    const token = readBearerToken(req.get("Authorization"));
    const { ticketId } = zendeskWebhookSchema.parse(req.body);
    res.json({ status: "success", data: await service.handleWebhook(token, ticketId) });
  } catch (error) {
    next(error);
  }
});

const router = Router();
const admin = authorize("ADMIN");

router.use(authMiddleware, subscriptionGuard);
router.post("/conversations/:id/ticket", respond((companyId, req) =>
  service.createTicket(String(req.params.id), companyId, req.user!)
));
router.get("/config", respond((companyId) => service.getConfig(companyId)));
router.put("/config", admin, validate(saveZendeskConfigSchema), respond((companyId, req) => service.saveConfig(companyId, req.body)));
router.delete("/config", admin, respond((companyId) => service.removeConfig(companyId)));
router.post("/webhook-token", admin, respond((companyId) => service.rotateWebhookToken(companyId)));

export default router;
