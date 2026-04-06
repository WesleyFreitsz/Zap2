import prisma from "../../config/prisma";
import { AppError } from "../../utils/AppError";
import { AsaasService } from "./asaas.service";
import { logger } from "../../utils/logger";

const asaasService = new AsaasService();

const PLAN_PRICES: Record<string, number> = {
  basic: 97,
  professional: 197,
  enterprise: 497,
};

export class BillingService {
  async createSubscription(companyId: string, data: {
    plan: string;
    customerName: string;
    customerEmail: string;
    cpfCnpj?: string;
    billingType?: string;
  }) {
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new AppError("Company not found", 404);

    const existingSub = await (prisma as any).subscription.findUnique({
      where: { companyId },
    });
    if (existingSub && existingSub.status === "ACTIVE") {
      throw new AppError("Company already has an active subscription", 409);
    }

    const value = PLAN_PRICES[data.plan] || PLAN_PRICES.basic;

    // Create Asaas customer
    const customer = await asaasService.createCustomer({
      name: data.customerName,
      email: data.customerEmail,
      cpfCnpj: data.cpfCnpj,
    });

    // Create Asaas subscription
    const asaasSub = await asaasService.createSubscription({
      customerId: customer.id,
      billingType: data.billingType || "BOLETO",
      value,
      cycle: "MONTHLY",
      description: `Plano ${data.plan} - ${company.name}`,
    });

    const subscription = await (prisma as any).subscription.upsert({
      where: { companyId },
      create: {
        companyId,
        asaasCustomerId: customer.id,
        asaasSubscriptionId: asaasSub.id,
        plan: data.plan,
        value,
        billingCycle: "MONTHLY",
        status: "ACTIVE",
        nextDueDate: asaasSub.nextDueDate ? new Date(asaasSub.nextDueDate) : null,
      },
      update: {
        asaasCustomerId: customer.id,
        asaasSubscriptionId: asaasSub.id,
        plan: data.plan,
        value,
        status: "ACTIVE",
        nextDueDate: asaasSub.nextDueDate ? new Date(asaasSub.nextDueDate) : null,
      },
    });

    // Update company plan
    await prisma.company.update({
      where: { id: companyId },
      data: { plan: data.plan, isActive: true },
    });

    logger.info(`[Billing] Subscription created for company ${companyId}: ${asaasSub.id}`);

    return subscription;
  }

  async getSubscription(companyId: string) {
    const subscription = await (prisma as any).subscription.findUnique({
      where: { companyId },
      include: { company: { select: { id: true, name: true, plan: true } } },
    });

    if (!subscription) return null;

    return subscription;
  }

  async getInvoices(companyId: string) {
    const subscription = await (prisma as any).subscription.findUnique({
      where: { companyId },
    });

    if (!subscription) return [];

    return (prisma as any).invoice.findMany({
      where: { subscriptionId: subscription.id },
      orderBy: { dueDate: "desc" },
    });
  }

  async handleAsaasWebhook(payload: Record<string, any>) {
    const event = payload.event as string;
    const payment = payload.payment as Record<string, any> | undefined;

    if (!payment) {
      logger.warn("[Asaas Webhook] No payment data in payload");
      return { handled: false };
    }

    const asaasSubscriptionId = payment.subscription as string | undefined;
    if (!asaasSubscriptionId) {
      logger.warn("[Asaas Webhook] No subscription id in payment");
      return { handled: false };
    }

    const subscription = await (prisma as any).subscription.findFirst({
      where: { asaasSubscriptionId },
    });

    if (!subscription) {
      logger.warn(`[Asaas Webhook] Subscription not found: ${asaasSubscriptionId}`);
      return { handled: false };
    }

    logger.info(`[Asaas Webhook] Event: ${event}, subscription: ${subscription.id}`);

    switch (event) {
      case "PAYMENT_CONFIRMED":
      case "PAYMENT_RECEIVED": {
        // Upsert invoice
        await (prisma as any).invoice.upsert({
          where: { asaasPaymentId: payment.id },
          create: {
            subscriptionId: subscription.id,
            asaasPaymentId: payment.id,
            value: payment.value,
            dueDate: new Date(payment.dueDate),
            paidAt: new Date(),
            status: "RECEIVED",
            paymentUrl: payment.invoiceUrl || payment.bankSlipUrl || null,
          },
          update: {
            paidAt: new Date(),
            status: "RECEIVED",
          },
        });

        // Ensure company is active
        await (prisma as any).subscription.update({
          where: { id: subscription.id },
          data: { status: "ACTIVE", nextDueDate: payment.nextDueDate ? new Date(payment.nextDueDate) : undefined },
        });
        await prisma.company.update({
          where: { id: subscription.companyId },
          data: { isActive: true },
        });

        logger.info(`[Asaas Webhook] Payment confirmed for company ${subscription.companyId}`);
        return { handled: true };
      }

      case "PAYMENT_OVERDUE": {
        await (prisma as any).invoice.upsert({
          where: { asaasPaymentId: payment.id },
          create: {
            subscriptionId: subscription.id,
            asaasPaymentId: payment.id,
            value: payment.value,
            dueDate: new Date(payment.dueDate),
            status: "OVERDUE",
            paymentUrl: payment.invoiceUrl || payment.bankSlipUrl || null,
          },
          update: { status: "OVERDUE" },
        });

        await (prisma as any).subscription.update({
          where: { id: subscription.id },
          data: { status: "OVERDUE" },
        });

        // Restrict company access
        await prisma.company.update({
          where: { id: subscription.companyId },
          data: { isActive: false },
        });

        logger.warn(`[Asaas Webhook] Payment overdue — company ${subscription.companyId} deactivated`);
        return { handled: true };
      }

      case "PAYMENT_DELETED":
      case "PAYMENT_REFUNDED": {
        await (prisma as any).invoice.updateMany({
          where: { asaasPaymentId: payment.id },
          data: { status: "REFUNDED" },
        });
        logger.info(`[Asaas Webhook] Payment refunded/deleted: ${payment.id}`);
        return { handled: true };
      }

      default:
        logger.info(`[Asaas Webhook] Unhandled event: ${event}`);
        return { handled: false };
    }
  }
}
