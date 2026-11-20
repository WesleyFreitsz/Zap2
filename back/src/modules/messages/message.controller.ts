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

  async sendMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { companyId, userId, role } = req.user!;
      const result = await messageService.sendMedia(req.body, req.file!, companyId!, userId, role);
      res.status(201).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }

  async listStickers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await messageService.listStickers(req.user!.companyId!);
      res.json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }

  async react(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { companyId, userId, role } = req.user!;
      await messageService.react(req.params.id as string, req.body, companyId!, userId, role);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }

  async edit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { companyId, userId, role } = req.user!;
      const result = await messageService.edit(req.params.id as string, req.body, companyId!, userId, role);
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { companyId, userId, role } = req.user!;
      await messageService.remove(req.params.id as string, companyId!, userId, role);
      res.status(204).end();
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
