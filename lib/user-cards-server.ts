import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CARD_CODES,
  type CardCode,
  type UserCardRow,
} from "@/lib/cards";

export async function ensureUserCards(
  supabase: SupabaseClient,
): Promise<{ cards: UserCardRow[]; error: string | null }> {
  const { data, error } = await supabase.rpc("ensure_user_cards");
  if (error) {
    return { cards: [], error: error.message };
  }
  return { cards: (data ?? []) as UserCardRow[], error: null };
}

export async function assertUserOwnsCard(
  supabase: SupabaseClient,
  userId: string,
  cardId: string,
): Promise<{ ok: true; card: UserCardRow } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from("user_cards")
    .select("id, user_id, code, display_name, issuer, sms_last_digits, sort_order")
    .eq("id", cardId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, message: "카드를 확인할 수 없습니다." };
  }
  return { ok: true, card: data as UserCardRow };
}

export function resolveCardIdFromParse(params: {
  cards: UserCardRow[];
  detectedCode: CardCode | null;
  detectedDigits: string | null;
  selectedCardId?: string | null;
}): {
  cardId: string | null;
  mismatch: boolean;
  needsSelection: boolean;
} {
  const { cards, detectedCode, detectedDigits, selectedCardId } = params;

  let inferred: UserCardRow | undefined;
  if (detectedCode) {
    inferred = cards.find((c) => c.code === detectedCode);
  }
  if (!inferred && detectedDigits) {
    inferred = cards.find((c) => c.sms_last_digits === detectedDigits);
  }

  if (selectedCardId) {
    const selected = cards.find((c) => c.id === selectedCardId);
    if (!selected) {
      return { cardId: null, mismatch: false, needsSelection: true };
    }
    if (inferred && inferred.id !== selected.id) {
      return { cardId: selected.id, mismatch: true, needsSelection: false };
    }
    return { cardId: selected.id, mismatch: false, needsSelection: false };
  }

  if (inferred) {
    return { cardId: inferred.id, mismatch: false, needsSelection: false };
  }

  return { cardId: null, mismatch: false, needsSelection: true };
}

export function defaultCardId(cards: UserCardRow[]): string | null {
  return (
    cards.find((c) => c.code === CARD_CODES.SHINHAN_CORP)?.id ??
    cards[0]?.id ??
    null
  );
}