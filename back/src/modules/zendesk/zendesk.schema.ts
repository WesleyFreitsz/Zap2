import { z } from "zod";

export const saveZendeskConfigSchema = z.object({
  subdomain: z.string().trim().toLowerCase()
    .transform((value) => value.replace(/^https?:\/\//, "").replace(/\.zendesk\.com.*$/, ""))
    .pipe(z.string().regex(/^[a-z0-9][a-z0-9-]{0,62}$/, "Subdomínio inválido")),
  email: z.string().trim().email(),
  apiToken: z.string().trim().min(1).max(200),
});

export const zendeskWebhookSchema = z.object({
  ticketId: z.union([z.string(), z.number()]).transform(String).pipe(z.string().regex(/^\d+$/)),
});

export type SaveZendeskConfigInput = z.infer<typeof saveZendeskConfigSchema>;
