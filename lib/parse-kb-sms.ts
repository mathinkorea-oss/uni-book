import { classifyByRules } from "@/lib/classify-expense";
import type { CategoryCode } from "@/lib/categories";
import {
  findDateTimeInString,
  preprocessSmsLines,
  stripBalanceSegments,
  suggestCategoryFromMerchant,
  buildExpenseDateIso,
  merchantSimilarity,
} from "@/lib/parse-shinhan-sms";

export type KbSmsApproval = {
  kind: "approval";
  cardDigits: string;
  month: number;
  day: number;
  time: string;
  amount: number;
  installmentMonths: number | null;
  merchant: string;
};

export type KbSmsParseError = {
  kind: "error" | "cancel" | "reject" | "multi" | "billing";
  message: string;
};

export type KbSmsParseResult =
  | { ok: true; data: KbSmsApproval }
  | { ok: false; error: KbSmsParseError };

const CANCEL_RE = /승인\s*취소|취소\s*승인|승인취소/i;
const REJECT_RE = /거절|승인\s*거부|부결/i;
const BILLING_RE =
  /카드\s*대금|이용\s*대금|결제\s*대금|청구\s*예정|청구\s*안내|청구\s*내역|결제\s*예정\s*금액/i;

const KB_HEADER_RE = /KB국민카드(\d{4})\s*승인/i;
const AMOUNT_INSTALL_RE = /^([\d,]+)원(?:\s+(\d{1,2})개월)?$/;

function countKbHeaders(text: string): number {
  const m = text.match(/KB국민카드\d{4}\s*승인/gi);
  return m?.length ?? 0;
}

function expandWebHeaderLines(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const web = line.match(/^\[Web발신\]\s*(.*)$/i);
    if (web) {
      const rest = web[1].trim();
      if (rest) out.push(rest);
      continue;
    }
    out.push(line);
  }
  return out;
}

export function parseKbApprovalSms(raw: string): KbSmsParseResult {
  const lines = preprocessSmsLines(raw);
  const normalized = lines.join("\n");

  if (!normalized) {
    return {
      ok: false,
      error: { kind: "error", message: "문자 내용을 입력해 주세요." },
    };
  }

  if (BILLING_RE.test(normalized) && !KB_HEADER_RE.test(normalized)) {
    return {
      ok: false,
      error: {
        kind: "billing",
        message: "카드대금·청구 안내 문자는 지출로 저장하지 않습니다.",
      },
    };
  }

  if (CANCEL_RE.test(normalized)) {
    return {
      ok: false,
      error: {
        kind: "cancel",
        message:
          "승인 취소 문자로 보입니다. 이 화면에서는 일반 승인 지출만 등록할 수 있어요.",
      },
    };
  }
  if (REJECT_RE.test(normalized)) {
    return {
      ok: false,
      error: {
        kind: "reject",
        message: "거절·부결 문자는 지출로 저장할 수 없습니다.",
      },
    };
  }

  if (countKbHeaders(normalized) > 1) {
    return {
      ok: false,
      error: {
        kind: "multi",
        message:
          "여러 건의 승인 문자가 섞여 있는 것 같아요. 한 건씩 붙여넣어 주세요.",
      },
    };
  }

  const bodyLines = expandWebHeaderLines(lines);
  let cardDigits: string | null = null;
  for (const line of bodyLines) {
    const h = KB_HEADER_RE.exec(line);
    if (h) {
      cardDigits = h[1];
      break;
    }
  }
  if (!cardDigits) {
    return {
      ok: false,
      error: {
        kind: "error",
        message: "KB국민카드 승인 헤더(KB국민카드#### 승인)를 찾지 못했습니다.",
      },
    };
  }

  const bodyText = bodyLines.join("\n");
  const bodyNoBalance = stripBalanceSegments(
    bodyText.replace(/누적\s*[\d,]+\s*원?/gi, " "),
  );

  const dt = findDateTimeInString(bodyNoBalance);
  if (!dt) {
    return {
      ok: false,
      error: {
        kind: "error",
        message:
          "날짜·시간(MM/DD HH:MM)을 찾지 못했습니다. 문자 전체를 확인해 주세요.",
      },
    };
  }

  let amount: number | null = null;
  let installmentMonths: number | null = null;
  for (const line of bodyLines) {
    if (/누적/i.test(line)) continue;
  const m = AMOUNT_INSTALL_RE.exec(line.replace(/\s+/g, " ").trim());
    if (m) {
      const parsed = Number(m[1].replace(/,/g, ""));
      if (parsed > 0) {
        amount = parsed;
        installmentMonths = m[2] ? Number(m[2]) : null;
        break;
      }
    }
  }

  if (amount == null) {
    return {
      ok: false,
      error: {
        kind: "error",
        message: "승인 금액을 찾지 못했습니다. ‘누적’ 금액은 지출에 넣지 않아요.",
      },
    };
  }

  const afterDt = bodyNoBalance.slice(dt.index + dt.length).trim();
  const merchantLines = afterDt
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/누적/i.test(l) && !AMOUNT_INSTALL_RE.test(l));

  const merchant = merchantLines[0]?.replace(/\n/g, " ").trim() ?? "";
  if (!merchant) {
    return {
      ok: false,
      error: {
        kind: "error",
        message: "가맹점 이름을 찾지 못했습니다. 직접 확인해 주세요.",
      },
    };
  }

  return {
    ok: true,
    data: {
      kind: "approval",
      cardDigits,
      month: dt.month,
      day: dt.day,
      time: dt.time,
      amount,
      installmentMonths,
      merchant,
    },
  };
}

export { suggestCategoryFromMerchant, buildExpenseDateIso, merchantSimilarity };
export type { CategoryCode };