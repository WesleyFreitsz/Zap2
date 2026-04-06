import { Request, Response, NextFunction } from "express";
import { TagService } from "./tag.service";

const tagService = new TagService();

export class TagController {
  async findAll(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const companyId = req.user!.companyId!;
      const result = await tagService.findAll(companyId);
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.user!.companyId!;
      const result = await tagService.create(req.body, companyId);
      res.status(201).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.user!.companyId!;
      const result = await tagService.delete(
        req.params.id as string,
        companyId,
      );
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }

  async assignToConversation(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const companyId = req.user!.companyId!;
      const { conversationId, tagId } = req.body;
      const result = await tagService.assignToConversation(
        conversationId,
        tagId,
        companyId,
      );
      res.status(201).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }

  async removeFromConversation(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const companyId = req.user!.companyId!;
      const conversationId = req.params.conversationId as string;
      const tagId = req.params.tagId as string;
      const result = await tagService.removeFromConversation(
        conversationId,
        tagId,
        companyId,
      );
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }

  async getConversationTags(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const companyId = req.user!.companyId!;
      const result = await tagService.getConversationTags(
        req.params.conversationId as string,
        companyId,
      );
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }
}
