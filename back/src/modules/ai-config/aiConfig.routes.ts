import { Router } from 'express';
import { AiConfigController } from './aiConfig.controller';
import { authMiddleware } from '../../middlewares/auth';
import { authorize } from '../../middlewares/authorize';
import { subscriptionGuard } from '../../middlewares/subscription';
import { validate } from '../../middlewares/validate';
import { updateAiConfigSchema } from './aiConfig.schema';

const router = Router();
const controller = new AiConfigController();

router.use(authMiddleware, subscriptionGuard);

router.get('/', controller.get);
router.put('/', authorize('ADMIN', 'SUPER_ADMIN'), validate(updateAiConfigSchema), controller.update);

export default router;
