import { Request, Response, NextFunction } from "express";
import { MessageService } from "./message.service";

const messageService = new MessageService();

export class MessageController {
  async send(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { companyId, userId, role } = req.user!;
      const result = await messageService.send(
        req.body,
        companyId!,
        userId,
        role,
      );
      res.status(201).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }

  async suggestReply(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { companyId, userId, role } = req.user!;
      const result = await messageService.suggestReply(
        req.body,
        companyId!,
        userId,
        role,
      );
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }

  async sendTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { companyId, userId, role } = req.user!;
      const result = await messageService.sendTemplate(req.body, companyId!, userId, role);
      res.status(201).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }

  async findByConversation(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { companyId, userId, role } = req.user!;
      const result = await messageService.findByConversation(
        req.params.conversationId as string,
        companyId!,
        userId,
        role,
      );
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }
}
