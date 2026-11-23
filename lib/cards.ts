export const CARD_CODES = {
  SHINHAN_CORP: "shinhan_corp",
  KB_8091: "kb_8091",
} as const;

export type CardCode = (typeof CARD_CODES)[keyof typeof CARD_CODES];

export type UserCardRow = {
  id: string;
  user_id: string;
  code: CardCode;
  display_name: string;
  issuer: "shinhan" | "kb";
  sms_last_digits: string | null;
  sort_order: number;
};

export const DEFAULT_CARD_DEFINITIONS: {
  code: CardCode;
  display_name: string;
  issuer: "shinhan" | "kb";
  sms_last_digits: string | null;
  sort_order: number;
}[] = [
  {
    code: CARD_CODES.SHINHAN_CORP,
    display_name: "법인카드",
    issuer: "shinhan",
    sms_last_digits: null,
    sort_order: 0,
  },
  {
    code: CARD_CODES.KB_8091,
    display_name: "KB국민카드",
    issuer: "kb",
    sms_last_digits: "8091",
    sort_order: 1,
  },
];

export type CardFilter = "all" | CardCode;

export function getCardLabel(
  cards: UserCardRow[],
  cardId: string | null | undefined,
): string {
  if (!cardId) return "";
  return cards.find((c) => c.id === cardId)?.display_name ?? "";
}

export function findCardByCode(
  cards: UserCardRow[],
  code: CardCode,
): UserCardRow | undefined {
  return cards.find((c) => c.code === code);
}

export function findCardBySmsDigits(
  cards: UserCardRow[],
  digits: string,
): UserCardRow | undefined {
  return cards.find((c) => c.sms_last_digits === digits);
}