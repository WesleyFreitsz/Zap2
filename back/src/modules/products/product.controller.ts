import { Request, Response, NextFunction } from "express";
import { ProductService } from "./product.service";

const productService = new ProductService();

export class ProductController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.user!.companyId!;
      if (req.file) {
        const imageUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
        req.body.imageUrl = imageUrl;
      }
      const result = await productService.create(req.body, companyId);
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
      const companyId = req.user!.companyId!;
      const result = await productService.findAll(companyId);
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
      const companyId = req.user!.companyId!;
      const result = await productService.findById(
        req.params.id as string,
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
      if (req.file) {
        const imageUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
        req.body.imageUrl = imageUrl;
      }
      const result = await productService.update(
        req.params.id as string,
        companyId,
        req.body,
      );
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.user!.companyId!;
      const result = await productService.delete(
        req.params.id as string,
        companyId,
      );
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }

  async sendToChat(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { companyId, userId, role } = req.user!;
      const { productId, conversationId, customMessage } = req.body;
      const result = await productService.sendToChat(
        productId,
        conversationId,
        companyId!,
        userId,
        role,
        customMessage,
      );
      res.status(201).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }
}
