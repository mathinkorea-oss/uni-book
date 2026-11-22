import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CARD_CODES } from "./cards";
import { parseCardSms } from "./parse-card-sms";
import { parseShinhanCorporateSms } from "./parse-shinhan-sms";

const KB_SAMPLE = `[Web발신]
KB국민카드8091 승인
유*종님
62,700원 02개월
11/16 10:37
평택본플란트치과
누적1,170,832원`;

const SHINHAN_SAMPLE = `[Web발신]
신한법인승인 7881
10/29 14:13
10,000원 김치찌개 미화식당 칠괴점
잔액4,235,157원`;

describe("parseCardSms", () => {
  it("parses KB approval with installment and excludes cumulative", () => {
    const r = parseCardSms(KB_SAMPLE);
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.data.cardCode, CARD_CODES.KB_8091);
    assert.equal(r.data.cardDigits, "8091");
    assert.equal(r.data.amount, 62700);
    assert.equal(r.data.installmentMonths, 2);
    assert.equal(r.data.month, 11);
    assert.equal(r.data.day, 16);
    assert.equal(r.data.time, "10:37");
    assert.equal(r.data.merchant, "평택본플란트치과");
  });

  it("still parses Shinhan corporate SMS", () => {
    const unified = parseCardSms(SHINHAN_SAMPLE);
    assert.equal(unified.ok, true);
    if (!unified.ok) return;
    assert.equal(unified.data.cardCode, CARD_CODES.SHINHAN_CORP);
    const shinhan = parseShinhanCorporateSms(SHINHAN_SAMPLE);
    assert.equal(shinhan.ok, true);
    if (!shinhan.ok) return;
    assert.equal(unified.data.amount, shinhan.data.amount);
  });

  it("rejects billing notice style text", () => {
    const r = parseCardSms("KB국민카드 이용대금 청구 안내 12월 결제예정");
    assert.equal(r.ok, false);
  });

  it("rejects cancel SMS", () => {
    const r = parseCardSms("신한법인승인 승인취소 10/1 12:00 1,000원 테스트");
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.error.kind, "cancel");
  });
});