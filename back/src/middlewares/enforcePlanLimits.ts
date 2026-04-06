import { Request, Response, NextFunction } from "express";
import prisma from "../config/prisma";
import { AppError } from "../utils/AppError";

export const enforcePlanLimits = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return next();

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        _count: { select: { users: true, integrations: true } },
      },
    });

    if (!company) return next();

    const plan = await (prisma as any).plan.findFirst({
      where: { slug: company.plan, isActive: true },
    });

    if (!plan) return next();

    // Attach plan limits to request for downstream use
    (req as any).planLimits = {
      maxEmployees: plan.maxEmployees,
      maxNumbers: plan.maxNumbers,
      maxTeamLeaders: plan.maxTeamLeaders,
      currentEmployees: company._count.users,
      currentNumbers: company._count.integrations,
    };

    next();
  } catch (error) {
    next(error);
  }
};

export const checkEmployeeLimit = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return next();

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: { _count: { select: { users: true } } },
    });
    if (!company) return next();

    const plan = await (prisma as any).plan.findFirst({
      where: { slug: company.plan, isActive: true },
    });
    if (!plan) return next();

    if (company._count.users >= plan.maxEmployees) {
      throw new AppError(
        `Limite do plano atingido: máximo de ${plan.maxEmployees} funcionários no plano ${plan.name}`,
        403,
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const checkNumberLimit = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return next();

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: { _count: { select: { integrations: true } } },
    });
    if (!company) return next();

    const plan = await (prisma as any).plan.findFirst({
      where: { slug: company.plan, isActive: true },
    });
    if (!plan) return next();

    if (company._count.integrations >= plan.maxNumbers) {
      throw new AppError(
        `Limite do plano atingido: máximo de ${plan.maxNumbers} número(s) WhatsApp no plano ${plan.name}`,
        403,
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};
