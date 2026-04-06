import { Request, Response, NextFunction } from "express";
import { PlanService } from "./plan.service";
import { AppError } from "../../utils/AppError";

const planService = new PlanService();

export class PlanController {
  async findAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const onlyActive = req.query.active === "true";
      const plans = await planService.findAll(onlyActive);
      res.json({ status: "success", data: plans });
    } catch (error) {
      next(error);
    }
  }

  async findBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const plan = await planService.findBySlug(req.params.slug as string);
      res.json({ status: "success", data: plan });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, slug, price, annualPrice, maxNumbers, maxEmployees, maxTeamLeaders, features, founderSlots } = req.body;
      if (!name || !slug || price == null || annualPrice == null) {
        throw new AppError("name, slug, price, and annualPrice are required", 400);
      }
      const plan = await planService.create({
        name, slug, price, annualPrice, maxNumbers, maxEmployees, maxTeamLeaders, features, founderSlots,
      });
      res.status(201).json({ status: "success", data: plan });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const plan = await planService.update(req.params.id as string, req.body);
      res.json({ status: "success", data: plan });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await planService.delete(req.params.id as string);
      res.json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }
}
