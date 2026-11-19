import { Request, Response, NextFunction } from "express";
import { ScheduleService } from "./schedule.service";

const scheduleService = new ScheduleService();

export class ScheduleController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await scheduleService.create(req.body, req.user!.companyId!, req.user!);
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
      const result = await scheduleService.findAll(companyId, req.user!);
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.user!.companyId!;
      const result = await scheduleService.update(
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

  async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.user!.companyId!;
      const result = await scheduleService.cancel(
        req.params.id as string,
        companyId,
        req.user!,
      );
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }
}
