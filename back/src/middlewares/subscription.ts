import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma';
import { AppError } from '../utils/AppError';

export async function subscriptionGuard(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (!req.user || !req.user.companyId) {
    return next();
  }

  const company = await prisma.company.findUnique({
    where: { id: req.user.companyId },
  });

  if (!company || !company.isActive) {
    throw new AppError('Company subscription is inactive. Contact support.', 403);
  }

  next();
}
