import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth";
import { authorize } from "../../middlewares/authorize";
import { validate } from "../../middlewares/validate";
import { create, findAll, remove, update } from "./quick-reply.controller";
import { quickReplySchema } from "./quick-reply.schema";

const router = Router();
const manage = authorize("ADMIN", "SUPER_ADMIN");

router.use(authMiddleware);
router.get("/", findAll);
router.post("/", manage, validate(quickReplySchema), create);
router.put("/:id", manage, validate(quickReplySchema), update);
router.delete("/:id", manage, remove);

export default router;
