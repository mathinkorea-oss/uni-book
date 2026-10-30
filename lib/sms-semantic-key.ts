import { createHash } from "node:crypto";
import { merchantSimilarity } from "@/lib/parse-shinhan-sms";

export type SmsSemanticInput = {
  confirmedYear: number;
  date: string;
  paymentTime: string;
  amount: number;
  merchant: string;
};

export function normalizeMerchantForSemantic(merchant: string): string {
  return merchant.replace(/\s+/g, " ").trim().toLowerCase();
}

/** 형식(한 줄/여러 줄)과 무관한 동일 결제 식별 (fingerprint와 별도) */
export function buildSmsSemanticKey(input: SmsSemanticInput): string {
  const merchantNorm = normalizeMerchantForSemantic(input.merchant);
  const time = input.paymentTime.trim();
  const canonical = [
    input.confirmedYear,
    input.date,
    time,
    Math.round(input.amount),
    merchantNorm,
  ].join("|");
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function isExactSemanticPaymentMatch(
  row: {
    date: string;
    amount: number;
    description: string;
    payment_time?: string | null;
    sms_confirmed_year?: number | null;
  },
  input: SmsSemanticInput,
): boolean {
  const rowYear =
    row.sms_confirmed_year ?? Number(row.date.slice(0, 4));
  if (rowYear !== input.confirmedYear) return false;
  if (row.date !== input.date) return false;
  if (Math.round(row.amount) !== Math.round(input.amount)) return false;
  const rowTime = (row.payment_time ?? "").trim();
  const inputTime = input.paymentTime.trim();
  if (rowTime !== inputTime) return false;
  return (
    normalizeMerchantForSemantic(row.description) ===
    normalizeMerchantForSemantic(input.merchant)
  );
}

/** exact semantic 제외, 유사 가맹점만 fuzzy 후보 */
export function isFuzzySemanticCandidate(
  row: {
    date: string;
    amount: number;
    description: string;
    payment_time?: string | null;
    sms_confirmed_year?: number | null;
  },
  input: SmsSemanticInput,
): boolean {
  if (isExactSemanticPaymentMatch(row, input)) return false;
  if (row.date !== input.date) return false;
  if (Math.round(row.amount) !== Math.round(input.amount)) return false;
  const rowYear =
    row.sms_confirmed_year ?? Number(row.date.slice(0, 4));
  if (rowYear !== input.confirmedYear) return false;
  return merchantSimilarity(row.description, input.merchant) >= 0.85;
}
