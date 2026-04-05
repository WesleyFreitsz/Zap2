import { Request, Response, NextFunction } from "express";
import { UserService } from "./user.service";

const userService = new UserService();

export class UserController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.user!.companyId!;
      const result = await userService.create(req.body, companyId);
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
      const result = await userService.findAllByCompany(companyId);
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
      const result = await userService.findById(
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
      const result = await userService.update(
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
      const result = await userService.delete(
        req.params.id as string,
        companyId,
      );
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }

  async changePassword(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        res
          .status(400)
          .json({
            status: "error",
            message: "currentPassword and newPassword are required",
          });
        return;
      }
      const result = await userService.changePassword(
        userId,
        currentPassword,
        newPassword,
      );
      res.json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }

  async getProfile(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const result = await userService.getProfile(userId);
      res.json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }
}
