import { CARD_CODES, type CardCode } from "@/lib/cards";
import { parseKbApprovalSms } from "@/lib/parse-kb-sms";
import {
  parseShinhanCorporateSms,
  type ShinhanSmsParseError,
} from "@/lib/parse-shinhan-sms";

export type CardSmsApproval = {
  cardCode: CardCode | null;
  cardDigits: string | null;
  month: number;
  day: number;
  time: string;
  amount: number;
  merchant: string;
  installmentMonths: number | null;
  approvalLineSuffix?: string;
};

export type CardSmsParseError = ShinhanSmsParseError | {
  kind:
    | "error"
    | "cancel"
    | "reject"
    | "multi"
    | "billing"
    | "ambiguous"
    | "unknown_card";
  message: string;
};

export type CardSmsParseResult =
  | { ok: true; data: CardSmsApproval }
  | { ok: false; error: CardSmsParseError };

const SHINHAN_HDR = /신한\s*법인\s*승인/i;
const KB_HDR = /KB국민카드\s*\d{4}\s*승인/i;

function countHeaders(text: string, re: RegExp): number {
  const m = text.match(new RegExp(re.source, re.flags + "g"));
  return m?.length ?? 0;
}

export function detectSmsCardFamily(
  raw: string,
): "shinhan" | "kb" | "ambiguous" | "unknown" {
  const normalized = raw.replace(/\r\n/g, "\n");
  const shinhan = countHeaders(normalized, SHINHAN_HDR);
  const kb = countHeaders(normalized, KB_HDR);
  if (shinhan > 0 && kb > 0) return "ambiguous";
  if (shinhan > 0) return "shinhan";
  if (kb > 0) return "kb";
  return "unknown";
}

export function parseCardSms(raw: string): CardSmsParseResult {
  const family = detectSmsCardFamily(raw);

  if (family === "ambiguous") {
    return {
      ok: false,
      error: {
        kind: "ambiguous",
        message:
          "신한 법인카드와 KB국민카드 승인 문자가 섞여 있어요. 한 건만 붙여넣어 주세요.",
      },
    };
  }

  if (family === "kb") {
    const kb = parseKbApprovalSms(raw);
    if (!kb.ok) {
      return { ok: false, error: kb.error };
    }
    const digits = kb.data.cardDigits;
    const cardCode =
      digits === "8091" ? CARD_CODES.KB_8091 : null;
    return {
      ok: true,
      data: {
        cardCode,
        cardDigits: digits,
        month: kb.data.month,
        day: kb.data.day,
        time: kb.data.time,
        amount: kb.data.amount,
        merchant: kb.data.merchant,
        installmentMonths: kb.data.installmentMonths,
      },
    };
  }

  if (family === "shinhan") {
    const shinhan = parseShinhanCorporateSms(raw);
    if (!shinhan.ok) {
      return { ok: false, error: shinhan.error };
    }
    return {
      ok: true,
      data: {
        cardCode: CARD_CODES.SHINHAN_CORP,
        cardDigits: null,
        month: shinhan.data.month,
        day: shinhan.data.day,
        time: shinhan.data.time,
        amount: shinhan.data.amount,
        merchant: shinhan.data.merchant,
        installmentMonths: null,
        approvalLineSuffix: shinhan.data.approvalLineSuffix,
      },
    };
  }

  return {
    ok: false,
    error: {
      kind: "unknown_card",
      message:
        "카드 승인 문자를 인식하지 못했습니다. 신한 법인카드 또는 KB국민카드 승인 문자인지 확인해 주세요.",
    },
  };
}