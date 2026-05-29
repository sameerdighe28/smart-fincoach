import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export const SOURCE_LABELS: Record<string, string> = {
  ICICI_BANK: "ICICI Bank",
  HDFC_BANK: "HDFC Bank",
  PHONEPE: "PhonePe",
  GOOGLEPAY: "Google Pay",
  CRED: "CRED",
  IMOBILE: "iMobile",
  MANUAL: "Manual",
};

export const SOURCE_OPTIONS = [
  { value: "ICICI_BANK", label: "ICICI Bank Statement" },
  { value: "HDFC_BANK", label: "HDFC Bank Statement" },
  { value: "PHONEPE", label: "PhonePe History" },
  { value: "GOOGLEPAY", label: "Google Pay History" },
];

