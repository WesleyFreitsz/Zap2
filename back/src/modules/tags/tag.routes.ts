import { Router } from 'express';
import { TagController } from './tag.controller';
import { authMiddleware } from '../../middlewares/auth';
import { subscriptionGuard } from '../../middlewares/subscription';
import { validate } from '../../middlewares/validate';
import { createTagSchema } from './tag.schema';

const router = Router();
const controller = new TagController();

router.use(authMiddleware, subscriptionGuard);

router.get('/', controller.findAll);
router.post('/', validate(createTagSchema), controller.create);
router.delete('/:id', controller.delete);
router.post('/assign', controller.assignToConversation);
router.delete('/conversation/:conversationId/tag/:tagId', controller.removeFromConversation);
router.get('/conversation/:conversationId', controller.getConversationTags);

export default router;
