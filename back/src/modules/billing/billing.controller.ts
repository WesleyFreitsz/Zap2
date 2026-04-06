import { Request, Response, NextFunction } from "express";
import { BillingService } from "./billing.service";
import { AppError } from "../../utils/AppError";
import { env } from "../../config/env";

const billingService = new BillingService();

export class BillingController {
  async createSubscription(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) throw new AppError("Company not found", 400);

      const { plan, customerName, customerEmail, cpfCnpj, billingType } =
        req.body;
      if (!plan || !customerName || !customerEmail) {
        throw new AppError(
          "plan, customerName, and customerEmail are required",
          400,
        );
      }

      const result = await billingService.createSubscription(companyId, {
        plan,
        customerName,
        customerEmail,
        cpfCnpj,
        billingType,
      });
      res.status(201).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }

  async getSubscription(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) throw new AppError("Company not found", 400);

      const result = await billingService.getSubscription(companyId);
      res.json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }

  async getInvoices(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) throw new AppError("Company not found", 400);

      const result = await billingService.getInvoices(companyId);
      res.json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }

  async asaasWebhook(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      // Verify webhook token if configured
      if (env.ASAAS_WEBHOOK_TOKEN) {
        const token = req.headers["asaas-access-token"] as string;
        if (token !== env.ASAAS_WEBHOOK_TOKEN) {
          res.status(401).json({ error: "Invalid webhook token" });
          return;
        }
      }

      const result = await billingService.handleAsaasWebhook(req.body);
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }
}
