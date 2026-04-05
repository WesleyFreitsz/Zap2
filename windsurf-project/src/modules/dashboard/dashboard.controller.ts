import { Request, Response, NextFunction } from "express";
import { DashboardService } from "./dashboard.service";

const dashboardService = new DashboardService();

export class DashboardController {
  async overview(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const companyId = req.user!.companyId!;
      const result = await dashboardService.getOverview(companyId);
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }

  async ranking(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const companyId = req.user!.companyId!;
      const result = await dashboardService.getRanking(companyId);
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }

  async stats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.user!.companyId!;
      const result = await dashboardService.getStats(companyId);
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }

  async myStats(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { companyId, userId } = req.user!;
      const result = await dashboardService.getEmployeeStats(
        companyId!,
        userId,
      );
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }
}
