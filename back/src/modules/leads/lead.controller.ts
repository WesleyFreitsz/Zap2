import { Request, Response, NextFunction } from "express";
import { LeadService } from "./lead.service";
import { createLeadSchema, updateLeadSchema } from "./lead.schema";
import { AppError } from "../../utils/AppError";

const leadService = new LeadService();

export class LeadController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) throw new AppError("Company not found", 400);

      const data = createLeadSchema.parse(req.body);
      const lead = await leadService.create(data, companyId, req.user!);
      res.status(201).json({ status: "success", data: lead });
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
      const companyId = req.user?.companyId;
      if (!companyId) throw new AppError("Company not found", 400);

      const { temperature, status, assignedToId, search } = req.query;
      const leads = await leadService.findAll(
        companyId,
        {
          temperature: temperature as string,
          status: status as string,
          assignedToId: assignedToId as string,
          search: search as string,
        },
        req.user?.role,
        req.user?.userId,
      );
      res.json({ status: "success", data: leads });
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
      const companyId = req.user?.companyId;
      if (!companyId) throw new AppError("Company not found", 400);

      const lead = await leadService.findById(
        req.params.id as string,
        companyId,
        req.user!,
      );
      res.json({ status: "success", data: lead });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) throw new AppError("Company not found", 400);

      const data = updateLeadSchema.parse(req.body);
      const lead = await leadService.update(
        req.params.id as string,
        companyId,
        data,
        req.user!,
      );
      res.json({ status: "success", data: lead });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) throw new AppError("Company not found", 400);

      const result = await leadService.delete(
        req.params.id as string,
        companyId,
        req.user!,
      );
      res.json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }
}
