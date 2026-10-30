import { classifyByRules } from "@/lib/classify-expense";
import type { CategoryCode } from "@/lib/categories";

export type ShinhanSmsApproval = {
  kind: "approval";
  month: number;
  day: number;
  time: string;
  amount: number;
  merchant: string;
  approvalLineSuffix?: string;
};

export type ShinhanSmsParseError = {
  kind: "error" | "cancel" | "reject" | "multi";
  message: string;
};

export type ShinhanSmsParseResult =
  | { ok: true; data: ShinhanSmsApproval }
  | { ok: false; error: ShinhanSmsParseError };

const CANCEL_RE = /승인\s*취소|취소\s*승인|승인취소/i;
const REJECT_RE = /거절|승인\s*거부|부결/i;

const UNICODE_SPACES = /[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g;

const DATE_TIME_RE = /(\d{1,2})\/(\d{1,2})[ \t]+(\d{1,2}):(\d{2})/;

const AMOUNT_WON_RE = /([\d,]+)\s*원/;

function countApprovalHeaders(text: string): number {
  const m = text.match(/신한\s*법인\s*승인/gi);
  return m?.length ?? 0;
}

export function preprocessSmsLines(raw: string): string[] {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(UNICODE_SPACES, " ")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line) => line.length > 0);
}

function stripBalanceSegments(text: string): string {
  return text.replace(/잔액\s*[\d,]+\s*원?/gi, " ").replace(/[ \t]+/g, " ").trim();
}

export function findDateTimeInString(
  text: string,
): { month: number; day: number; time: string; index: number; length: number } | null {
  const m = DATE_TIME_RE.exec(text);
  if (!m || m.index === undefined) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  const hh = Number(m[3]);
  const mm = Number(m[4]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (hh > 23 || mm > 59) return null;
  return {
    month,
    day,
    time: `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`,
    index: m.index,
    length: m[0].length,
  };
}

function findFirstAmount(
  text: string,
): { amount: number; rest: string } | null {
  const m = AMOUNT_WON_RE.exec(text);
  if (!m || m.index === undefined) return null;
  const amount = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const rest = text.slice(m.index + m[0].length).trim();
  return { amount, rest };
}

function extractApprovalSuffix(line: string, dtIndex: number): string | undefined {
  const header = line.match(/^신한\s*법인\s*승인\s*/i);
  if (!header || dtIndex <= header[0].length) return undefined;
  const between = line.slice(header[0].length, dtIndex).trim();
  return between || undefined;
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

function merchantAfterAmount(amountRest: string): string {
  return stripBalanceSegments(
    amountRest.replace(/\n/g, " ").replace(/[ \t]+/g, " "),
  ).trim();
}

export function parseShinhanCorporateSms(raw: string): ShinhanSmsParseResult {
  const lines = preprocessSmsLines(raw);
  const normalized = lines.join("\n");

  if (!normalized) {
    return {
      ok: false,
      error: { kind: "error", message: "문자 내용을 입력해 주세요." },
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

  if (countApprovalHeaders(normalized) > 1) {
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
  const bodyText = bodyLines.join("\n");
  const bodyNoBalance = stripBalanceSegments(bodyText);

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

  const afterDt = bodyNoBalance.slice(dt.index + dt.length).trim();
  const amountInfo = findFirstAmount(afterDt);
  if (!amountInfo) {
    return {
      ok: false,
      error: {
        kind: "error",
        message: "사용 금액을 찾지 못했습니다. ‘잔액’ 금액은 지출로 쓰지 않아요.",
      },
    };
  }

  let approvalLineSuffix: string | undefined;
  for (const line of bodyLines) {
    if (/^신한\s*법인\s*승인/i.test(line)) {
      const localDt = findDateTimeInString(stripBalanceSegments(line));
      if (localDt) {
        approvalLineSuffix = extractApprovalSuffix(line, localDt.index);
      }
      break;
    }
  }

  const merchant = merchantAfterAmount(amountInfo.rest);
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
      month: dt.month,
      day: dt.day,
      time: dt.time,
      amount: amountInfo.amount,
      merchant,
      approvalLineSuffix,
    },
  };
}

export function suggestCategoryFromMerchant(merchant: string): {
  code: CategoryCode;
  needsReview: boolean;
} {
  const ruled = classifyByRules(merchant, "");
  if (ruled) {
    return { code: ruled.code, needsReview: ruled.needsReview };
  }
  return { code: "meal", needsReview: true };
}

export function buildExpenseDateIso(year: number, month: number, day: number): string | null {
  const d = new Date(year, month - 1, day);
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day
  ) {
    return null;
  }
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

export function merchantSimilarity(a: string, b: string): number {
  const na = a.replace(/\s+/g, "").toLowerCase();
  const nb = b.replace(/\s+/g, "").toLowerCase();
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  return 0;
}
