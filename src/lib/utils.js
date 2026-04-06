import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

export function sanitizePersonName(value) {
  return String(value || "")
    .replace(/[^a-zA-ZÀ-ÿ\s'’-]/g, "")
    .replace(/\s{2,}/g, " ")
    .trimStart();
}

export function sanitizeCompanyName(value) {
  return String(value || "")
    .replace(/[^a-zA-ZÀ-ÿ0-9\s&.'’\-]/g, "")
    .replace(/\s{2,}/g, " ")
    .trimStart();
}

export function sanitizeSlug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function sanitizeHexColor(value) {
  const sanitized = String(value || "")
    .replace(/[^#a-fA-F0-9]/g, "")
    .slice(0, 7);

  if (!sanitized) return "#";
  return sanitized.startsWith("#") ? sanitized : `#${sanitized}`;
}

export function formatPhoneInput(value) {
  const digits = digitsOnly(value).slice(0, 13);

  if (!digits) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  if (digits.length <= 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
}

export function formatCpfCnpj(value) {
  const digits = digitsOnly(value).slice(0, 14);

  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }

  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

export const isIframe = window.self !== window.top;
