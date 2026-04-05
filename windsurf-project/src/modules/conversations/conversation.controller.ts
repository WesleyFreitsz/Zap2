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
      );
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }
}
