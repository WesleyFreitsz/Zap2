import { Router } from 'express';
import { MessageController } from './message.controller';
import { authMiddleware } from '../../middlewares/auth';
import { subscriptionGuard } from '../../middlewares/subscription';
import { validate } from '../../middlewares/validate';
import { sendMessageSchema, sendTemplateSchema, suggestReplySchema } from './message.schema';

const router = Router();
const controller = new MessageController();

router.use(authMiddleware, subscriptionGuard);

router.post('/send', validate(sendMessageSchema), controller.send);
router.post('/send-template', validate(sendTemplateSchema), controller.sendTemplate);
router.post('/suggest-reply', validate(suggestReplySchema), controller.suggestReply);
router.get('/:conversationId', controller.findByConversation);

export default router;
