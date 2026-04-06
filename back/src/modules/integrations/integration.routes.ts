import { Router } from 'express';
import { IntegrationController } from './integration.controller';
import { authMiddleware } from '../../middlewares/auth';
import { authorize } from '../../middlewares/authorize';
import { subscriptionGuard } from '../../middlewares/subscription';
import { validate } from '../../middlewares/validate';
import { createIntegrationSchema } from './integration.schema';

const router = Router();
const controller = new IntegrationController();

router.use(authMiddleware, subscriptionGuard, authorize('ADMIN', 'SUPER_ADMIN'));

router.get('/', controller.findAll);
router.post('/', validate(createIntegrationSchema), controller.create);
router.patch('/:id/toggle', controller.toggle);
router.delete('/:id', controller.delete);

export default router;
