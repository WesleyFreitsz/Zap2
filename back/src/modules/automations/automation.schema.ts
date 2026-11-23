import { isIP } from "node:net";
import { z } from "zod";

export const allowPrivateWebhooks = process.env.NODE_ENV === "development";

const blockedHostnames = /^(localhost|.*\.localhost|.*\.local|.*\.internal)$/i;

export function isAllowedWebhookUrl(value: string, allowHttp = false): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" && !(allowHttp && url.protocol === "http:")) return false;
  if (allowHttp) return true;
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  return !blockedHostnames.test(hostname) && isIP(hostname) === 0;
}

export const updateAutomationConfigSchema = z.object({
  webhookUrl: z.string().trim().max(2048).nullable()
    .refine((value) => !value || isAllowedWebhookUrl(value, allowPrivateWebhooks), {
      message: "Use uma URL https pública (ex.: webhook do n8n ou do Zapier)",
    })
    .transform((value) => value || null),
});

export const automationSendMessageSchema = z.object({
  conversationId: z.string().uuid(),
  content: z.string().trim().min(1).max(4096),
});

export type UpdateAutomationConfigInput = z.infer<typeof updateAutomationConfigSchema>;
export type AutomationSendMessageInput = z.infer<typeof automationSendMessageSchema>;
