import { Request, Response, NextFunction } from "express";
import { ConversationService } from "./conversation.service";

const conversationService = new ConversationService();

export class ConversationController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.user!.companyId!;
      const result = await conversationService.create(req.body, companyId);
      res.status(201).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }

  async findAll(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { companyId, userId, role } = req.user!;
      const result = await conversationService.findAll(
        companyId!,
        userId,
        role,
      );
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }

  async findById(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { companyId, userId, role } = req.user!;
      const result = await conversationService.findById(
        req.params.id as string,
        companyId!,
        userId,
        role,
      );
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }

  async markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.user!.companyId!;
      await conversationService.markAsRead(req.params.id as string, companyId, req.user!);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }

  async assign(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.user!.companyId!;
      const { conversationId, toUserId } = req.body;
      const result = await conversationService.assign(
        conversationId,
        toUserId,
        companyId,
      );
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }

  async transfer(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const companyId = req.user!.companyId!;
      const { conversationId, toUserId } = req.body;
      const result = await conversationService.transfer(
        conversationId,
        toUserId,
        companyId,
        req.user!,
      );
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.user!.companyId!;
      const result = await conversationService.update(
        req.params.id as string,
        companyId,
        req.body,
        req.user!,
      );
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }

  async createLead(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const companyId = req.user!.companyId!;
      const result = await conversationService.createLeadFromConversation(
        req.params.id as string,
        companyId,
        req.user!,
      );
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }

  async close(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.user!.companyId!;
      const result = await conversationService.close(
        req.params.id as string,
        companyId,
        req.user!,
      );
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await conversationService.remove(req.params.id as string, req.user!.companyId!, req.user!);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }
}
