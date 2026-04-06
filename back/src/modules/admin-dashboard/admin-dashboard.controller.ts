import { Request, Response, NextFunction } from "express";
import { AdminDashboardService } from "./admin-dashboard.service";
import { AppError } from "../../utils/AppError";

const service = new AdminDashboardService();

export class AdminDashboardController {
  async getDashboard(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const data = await service.getDashboard();
      res.json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  }

  async createCompany(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) throw new AppError("Authentication required", 401);

      const { name, adminEmail, plan, primaryColor, secondaryColor, logo } =
        req.body;
      if (!name || !adminEmail) {
        throw new AppError("name and adminEmail are required", 400);
      }

      const result = await service.createCompany({
        name,
        adminEmail,
        plan,
        primaryColor,
        secondaryColor,
        logo,
        invitedById: userId,
      });

      res.status(201).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }
}
