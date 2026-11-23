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

const KB_SAMPLE_ONE_LINE =
  "KB국민카드 8091 승인 유*종님 62,700원 02개월 11/16 10:37 평택본플란트 치과";

const SHINHAN_SAMPLE = `[Web발신]
신한법인승인 7881
10/29 14:13
10,000원 김치찌개 미화식당 칠괴점
잔액4,235,157원`;

describe("parseCardSms", () => {
  it("parses KB one-line approval same as multiline", () => {
    const multi = parseCardSms(KB_SAMPLE);
    const one = parseCardSms(KB_SAMPLE_ONE_LINE);
    assert.equal(multi.ok, true);
    assert.equal(one.ok, true);
    if (!multi.ok || !one.ok) return;
    assert.equal(one.data.cardDigits, multi.data.cardDigits);
    assert.equal(one.data.amount, multi.data.amount);
    assert.equal(one.data.installmentMonths, multi.data.installmentMonths);
    assert.equal(one.data.month, multi.data.month);
    assert.equal(one.data.day, multi.data.day);
    assert.equal(one.data.time, multi.data.time);
    assert.equal(one.data.merchant, "평택본플란트 치과");
    assert.equal(
      multi.data.merchant.replace(/\s+/g, ""),
      one.data.merchant.replace(/\s+/g, ""),
    );
  });

  it("suggests hospital category for dental merchant", async () => {
    const { suggestCategoryFromMerchant } = await import("./parse-shinhan-sms");
    const cat = suggestCategoryFromMerchant("평택본플란트 치과");
    assert.equal(cat.code, "hospital");
    assert.equal(cat.needsReview, false);
  });

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