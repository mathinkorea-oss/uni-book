import { createHash } from "node:crypto";

/** 줄바꿈·연속 공백·앞뒤 공백만 정규화 (내용은 변경하지 않음) */
export function normalizeSmsText(raw: string): string {
  const lines = raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return lines.map((line) => line.replace(/[ \t]+/g, " ")).join("\n");
}

export function smsFingerprint(raw: string): string {
  const normalized = normalizeSmsText(raw);
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

/** DB CHECK·서버 공통: SHA-256 hex 64자 소문자 */
export const SMS_FINGERPRINT_HEX_RE = /^[a-f0-9]{64}$/;

export function isValidSmsFingerprint(value: string): boolean {
  return SMS_FINGERPRINT_HEX_RE.test(value);
}
