import { z } from "zod";

const requiredText = z.string().trim().min(1);
const metaId = z.string().regex(/^\d+$/);
const pageChannel = z.enum(["FACEBOOK", "INSTAGRAM"]);

export const discoverPagesSchema = z.object({ code: requiredText });

export const connectPagesSchema = z.object({
  discoveryId: z.string().uuid(),
  pageId: metaId,
  channels: z.array(pageChannel).min(1),
});

export const connectWhatsAppSchema = z.object({
  code: requiredText,
  wabaId: metaId,
  phoneNumberId: metaId,
});

export const manualConnectSchema = z.object({
  type: z.enum(["WHATSAPP", "FACEBOOK", "INSTAGRAM"]),
  externalAccountId: metaId,
  accessToken: requiredText,
  metaPageId: metaId.optional(),
  wabaId: metaId.optional(),
}).superRefine(({ type, wabaId }, context) => {
  if (wabaId && type !== "WHATSAPP") {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["wabaId"], message: "wabaId é exclusivo do WhatsApp" });
  }
});

export type ConnectPagesInput = z.infer<typeof connectPagesSchema>;
export type ConnectWhatsAppInput = z.infer<typeof connectWhatsAppSchema>;
export type ManualConnectInput = z.infer<typeof manualConnectSchema>;
