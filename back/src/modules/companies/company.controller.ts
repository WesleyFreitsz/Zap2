import { Request, Response, NextFunction } from "express";
import { CompanyService } from "./company.service";
import { env } from "../../config/env";

const companyService = new CompanyService();

export class CompanyController {
  async findAll(
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const result = await companyService.findAll();
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
      const result = await companyService.findById(req.params.id as string);
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await companyService.update(
        req.params.id as string,
        req.body,
      );
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }

  async toggleActive(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const result = await companyService.toggleActive(req.params.id as string);
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }

  async uploadLogo(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ status: "error", message: "No file uploaded" });
        return;
      }
      const logoUrl = `/uploads/${req.file.filename}`;
      const result = await companyService.update(req.params.id as string, {
        logo: logoUrl,
      });
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await companyService.delete(req.params.id as string);
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }
}
