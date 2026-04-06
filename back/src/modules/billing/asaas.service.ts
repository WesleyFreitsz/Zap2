import { asaasApi } from "../../config/asaas";
import { logger } from "../../utils/logger";

export class AsaasService {
  async createCustomer(data: {
    name: string;
    email: string;
    cpfCnpj?: string;
  }) {
    const response = await asaasApi.post("/customers", {
      name: data.name,
      email: data.email,
      cpfCnpj: data.cpfCnpj || undefined,
    });
    logger.info(`[Asaas] Customer created: ${response.data.id}`);
    return response.data;
  }

  async createSubscription(data: {
    customerId: string;
    billingType: string;
    value: number;
    cycle: string;
    description?: string;
    nextDueDate?: string;
  }) {
    const response = await asaasApi.post("/subscriptions", {
      customer: data.customerId,
      billingType: data.billingType || "BOLETO",
      value: data.value,
      cycle: data.cycle || "MONTHLY",
      description: data.description || "Assinatura da plataforma",
      nextDueDate:
        data.nextDueDate ||
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0],
    });
    logger.info(`[Asaas] Subscription created: ${response.data.id}`);
    return response.data;
  }

  async getSubscription(subscriptionId: string) {
    const response = await asaasApi.get(`/subscriptions/${subscriptionId}`);
    return response.data;
  }

  async listPayments(subscriptionId: string) {
    const response = await asaasApi.get(
      `/subscriptions/${subscriptionId}/payments`,
    );
    return response.data?.data || [];
  }

  async getPayment(paymentId: string) {
    const response = await asaasApi.get(`/payments/${paymentId}`);
    return response.data;
  }

  async getPaymentLink(paymentId: string) {
    const response = await asaasApi.get(`/payments/${paymentId}/billingInfo`);
    return response.data?.bankSlipUrl || response.data?.invoiceUrl || null;
  }
}
