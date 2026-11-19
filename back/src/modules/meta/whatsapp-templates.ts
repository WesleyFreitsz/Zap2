import { z } from "zod";
import { AppError } from "../../utils/AppError";

export const templateInputSchema = z.object({
  name: z.string().trim().min(1),
  language: z.string().trim().min(1),
  parameters: z.record(z.string()).default({}),
});

export type TemplateInput = z.infer<typeof templateInputSchema>;

const rawTemplateSchema = z.object({
  name: z.string().min(1),
  language: z.string().min(1),
  category: z.string().min(1),
  status: z.literal("APPROVED"),
  parameter_format: z.enum(["POSITIONAL", "NAMED"]).default("POSITIONAL"),
  components: z.array(z.object({
    type: z.enum(["HEADER", "BODY", "FOOTER", "BUTTONS"]),
    format: z.string().optional(),
    text: z.string().min(1).optional(),
    buttons: z.array(z.object({
      type: z.enum(["QUICK_REPLY", "URL", "PHONE_NUMBER"]),
      text: z.string().min(1),
      url: z.string().optional(),
    })).optional(),
  })),
});

const placeholder = /\{\{([^{}]+)\}\}/g;
const hasPlaceholder = (text: string) => text.includes("{{");

export function toTemplateSummary(raw: unknown) {
  const parsed = rawTemplateSchema.safeParse(raw);
  if (!parsed.success || parsed.data.category === "AUTHENTICATION") return null;

  const { name, language, category, parameter_format: format, components } = parsed.data;
  const header = components.find(({ type }) => type === "HEADER");
  const body = components.find(({ type }) => type === "BODY")?.text;
  const footer = components.find(({ type }) => type === "FOOTER")?.text ?? null;
  const buttons = components.find(({ type }) => type === "BUTTONS")?.buttons ?? [];

  if (!body || (header && (header.format !== "TEXT" || !header.text || hasPlaceholder(header.text)))) return null;
  if ((footer && hasPlaceholder(footer)) || buttons.some(({ type, text, url }) =>
    hasPlaceholder(text) || (type === "URL" && (!url || hasPlaceholder(url)))
  )) return null;

  const variables = [...new Set(Array.from(body.matchAll(placeholder), (match) => match[1]))];
  const variablePattern = format === "NAMED" ? /^[a-z][a-z0-9_]*$/ : /^[1-9]\d*$/;
  if (variables.some((key) => !variablePattern.test(key))) return null;

  return { name, language, category, format, header: header?.text ?? null, body, footer, buttons: buttons.map(({ text }) => text), variables };
}

export type TemplateSummary = NonNullable<ReturnType<typeof toTemplateSummary>>;

function readParameter(values: Record<string, string>, key: string) {
  const value = Object.hasOwn(values, key) ? values[key] : undefined;
  if (!value?.trim()) throw new AppError(`Preencha a variável {{${key}}}`, 422);
  return value;
}

export function renderTemplateBody(summary: TemplateSummary, values: Record<string, string>) {
  return summary.body.replace(placeholder, (_match, key: string) => readParameter(values, key));
}

export function buildTemplatePayload(summary: TemplateSummary, values: Record<string, string>) {
  const template = { name: summary.name, language: { code: summary.language } };
  if (!summary.variables.length) return template;

  const keys = summary.format === "POSITIONAL"
    ? [...summary.variables].sort((first, second) => Number(first) - Number(second))
    : summary.variables;
  const parameters = keys.map((key) => ({
    type: "text",
    text: readParameter(values, key),
    ...(summary.format === "NAMED" && { parameter_name: key }),
  }));
  return { ...template, components: [{ type: "body", parameters }] };
}

export type TemplatePayload = ReturnType<typeof buildTemplatePayload>;
