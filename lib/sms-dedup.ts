import type { SupabaseClient } from "@supabase/supabase-js";
import { merchantSimilarity } from "@/lib/parse-shinhan-sms";
import {
  buildSmsSemanticKey,
  isExactSemanticPaymentMatch,
  isFuzzySemanticCandidate,
  type SmsSemanticInput,
} from "@/lib/sms-semantic-key";

export type DuplicateExpenseSummary = {
  id: string;
  date: string;
  amount: number;
  description: string;
  payment_time?: string | null;
  note?: string | null;
  sms_confirmed_year?: number | null;
};

export function buildSemanticInput(params: {
  confirmedYear: number;
  date: string;
  paymentTime: string;
  amount: number;
  merchant: string;
}): SmsSemanticInput {
  return {
    confirmedYear: params.confirmedYear,
    date: params.date,
    paymentTime: params.paymentTime,
    amount: params.amount,
    merchant: params.merchant,
  };
}

export function isSameSmsRegistration(
  stored: {
    sms_fingerprint?: string | null;
    sms_confirmed_year?: number | null;
  },
  fingerprint: string,
  confirmedYear: number,
): boolean {
  return (
    stored.sms_fingerprint === fingerprint &&
    stored.sms_confirmed_year === confirmedYear
  );
}

export async function findExactSmsDuplicate(
  supabase: SupabaseClient,
  userId: string,
  fingerprint: string,
  confirmedYear: number,
): Promise<DuplicateExpenseSummary | null> {
  const { data } = await supabase
    .from("expenses")
    .select(
      "id, date, amount, description, payment_time, note, sms_confirmed_year",
    )
    .eq("user_id", userId)
    .eq("sms_fingerprint", fingerprint)
    .eq("sms_confirmed_year", confirmedYear)
    .maybeSingle();

  return data as DuplicateExpenseSummary | null;
}

export async function findSemanticSmsDuplicate(
  supabase: SupabaseClient,
  userId: string,
  input: SmsSemanticInput,
): Promise<DuplicateExpenseSummary | null> {
  const semanticKey = buildSmsSemanticKey(input);

  const { data: byKey } = await supabase
    .from("expenses")
    .select(
      "id, date, amount, description, payment_time, note, sms_confirmed_year",
    )
    .eq("user_id", userId)
    .eq("sms_confirmed_year", input.confirmedYear)
    .eq("sms_semantic_key", semanticKey)
    .maybeSingle();

  if (byKey) return byKey as DuplicateExpenseSummary;

  const { data: rows } = await supabase
    .from("expenses")
    .select(
      "id, date, amount, description, payment_time, note, sms_confirmed_year, sms_semantic_key",
    )
    .eq("user_id", userId)
    .eq("sms_confirmed_year", input.confirmedYear)
    .eq("date", input.date)
    .eq("amount", Math.round(input.amount));

  for (const row of rows ?? []) {
    if (isExactSemanticPaymentMatch(row, input)) {
      return row as DuplicateExpenseSummary;
    }
  }

  return null;
}

export async function findDeletedSmsMarker(
  supabase: SupabaseClient,
  userId: string,
  fingerprint: string,
  confirmedYear: number,
): Promise<boolean> {
  const { data } = await supabase
    .from("expense_sms_deleted_markers")
    .select("user_id")
    .eq("user_id", userId)
    .eq("sms_fingerprint", fingerprint)
    .eq("sms_confirmed_year", confirmedYear)
    .maybeSingle();
  return Boolean(data);
}

export async function findFuzzyDuplicateCandidates(
  supabase: SupabaseClient,
  userId: string,
  date: string,
  amount: number,
  merchant: string,
  excludeFingerprint?: string,
  semanticInput?: SmsSemanticInput,
): Promise<DuplicateExpenseSummary[]> {
  const { data } = await supabase
    .from("expenses")
    .select(
      "id, date, amount, description, payment_time, note, sms_fingerprint, sms_confirmed_year",
    )
    .eq("user_id", userId)
    .eq("date", date)
    .eq("amount", amount);

  const rows = (data ?? []) as (DuplicateExpenseSummary & {
    sms_fingerprint?: string | null;
  })[];

  return rows.filter((row) => {
    if (excludeFingerprint && row.sms_fingerprint === excludeFingerprint) {
      return false;
    }
    if (semanticInput) {
      if (isExactSemanticPaymentMatch(row, semanticInput)) return false;
      if (isFuzzySemanticCandidate(row, semanticInput)) return true;
      return false;
    }
    return merchantSimilarity(row.description, merchant) >= 0.85;
  });
}

export async function clearSmsDeletedMarker(
  supabase: SupabaseClient,
  userId: string,
  fingerprint: string,
  confirmedYear: number,
): Promise<void> {
  await supabase
    .from("expense_sms_deleted_markers")
    .delete()
    .eq("user_id", userId)
    .eq("sms_fingerprint", fingerprint)
    .eq("sms_confirmed_year", confirmedYear);
}

export async function resolveSmsDuplicateExpense(
  supabase: SupabaseClient,
  userId: string,
  fingerprint: string,
  confirmedYear: number,
  semanticInput: SmsSemanticInput,
): Promise<DuplicateExpenseSummary | null> {
  const byFp = await findExactSmsDuplicate(
    supabase,
    userId,
    fingerprint,
    confirmedYear,
  );
  if (byFp) return byFp;
  return findSemanticSmsDuplicate(supabase, userId, semanticInput);
}
