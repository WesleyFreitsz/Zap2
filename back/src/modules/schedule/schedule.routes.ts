import { Router } from "express";
import { ScheduleController } from "./schedule.controller";
import { authMiddleware } from "../../middlewares/auth";
import { subscriptionGuard } from "../../middlewares/subscription";
import { validate } from "../../middlewares/validate";
import { createScheduleSchema } from "./schedule.schema";

const router = Router();
const controller = new ScheduleController();

router.use(authMiddleware, subscriptionGuard);

router.post("/", validate(createScheduleSchema), controller.create);
router.get("/", controller.findAll);
router.put("/:id", controller.update);
router.delete("/:id", controller.cancel);

export default router;
