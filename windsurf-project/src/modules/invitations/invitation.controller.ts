import { Request, Response, NextFunction } from "express";
import { InvitationService } from "./invitation.service";
import { AppError } from "../../utils/AppError";

const invitationService = new InvitationService();

export class InvitationController {
  async send(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const role = req.user?.role;
      const companyId = req.user?.companyId;

      if (!userId) throw new AppError("Authentication required", 401);

      const { email, invitationRole, companyName, isTeamLeader } = req.body;
      if (!email || !invitationRole) {
        throw new AppError("email and invitationRole are required", 400);
      }

      // SUPER_ADMIN can invite ADMIN (with companyName) or EMPLOYEE
      // ADMIN can only invite EMPLOYEE for their own company
      if (role === "ADMIN" && invitationRole === "ADMIN") {
        throw new AppError("Admin cannot invite another Admin", 403);
      }

      const result = await invitationService.sendInvitation({
        email,
        role: invitationRole,
        companyId:
          role === "SUPER_ADMIN" && invitationRole === "ADMIN"
            ? null
            : companyId,
        invitedById: userId,
        companyName,
        isTeamLeader: isTeamLeader || false,
      });

      res.status(201).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }

  async getByToken(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { token } = req.params;
      const result = await invitationService.getByToken(token as string);
      res.json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const role = req.user?.role;
      const companyId = req.user?.companyId;

      let invitations: any[] = [];
      if (role === "SUPER_ADMIN") {
        invitations = await invitationService.listAll();
      } else if (companyId) {
        invitations = await invitationService.listByCompany(companyId);
      } else {
        invitations = [];
      }

      res.json({ status: "success", data: invitations });
    } catch (error) {
      next(error);
    }
  }

  async revoke(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId =
        req.user?.role === "SUPER_ADMIN" ? null : req.user?.companyId;
      const result = await invitationService.revoke(
        req.params.id as string,
        companyId,
      );
      res.json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }
}
