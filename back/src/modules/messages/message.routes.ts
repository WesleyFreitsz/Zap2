import { Router } from 'express';
import { MessageController } from './message.controller';
import { authMiddleware } from '../../middlewares/auth';
import { subscriptionGuard } from '../../middlewares/subscription';
import { validate } from '../../middlewares/validate';
import { uploadChatMedia } from '../../middlewares/upload';
import {
  editMessageSchema,
  reactMessageSchema,
  sendMediaSchema,
  sendMessageSchema,
  sendTemplateSchema,
  suggestReplySchema,
} from './message.schema';

const router = Router();
const controller = new MessageController();

router.use(authMiddleware, subscriptionGuard);

router.post('/send', validate(sendMessageSchema), controller.send);
router.post('/send-template', validate(sendTemplateSchema), controller.sendTemplate);
router.post('/suggest-reply', validate(suggestReplySchema), controller.suggestReply);
router.get('/stickers', controller.listStickers);
router.post('/send-media', uploadChatMedia, validate(sendMediaSchema), controller.sendMedia);
router.post('/:id/react', validate(reactMessageSchema), controller.react);
router.patch('/:id', validate(editMessageSchema), controller.edit);
router.delete('/:id', controller.remove);
router.get('/:conversationId', controller.findByConversation);

export default router;
