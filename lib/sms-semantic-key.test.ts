import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { smsFingerprint } from "./sms-fingerprint";
import { parseShinhanCorporateSms } from "./parse-shinhan-sms";
import {
  buildSmsSemanticKey,
  isExactSemanticPaymentMatch,
  isFuzzySemanticCandidate,
} from "./sms-semantic-key";

const ONE_LINE = `[Web발신]
신한법인승인 7881 10/29 14:13 10,000원 김치찌개 미화식당 칠괴점 잔액4,235,157원`;

const MULTI_LINE = `[Web발신]
신한법인승인 7881
10/29 14:13
10,000원 김치찌개 미화식당 칠괴점
잔액4,235,157원`;

function semanticFromRaw(raw: string, year = 2026) {
  const p = parseShinhanCorporateSms(raw);
  assert.equal(p.ok, true);
  if (!p.ok) throw new Error("parse failed");
  const date = `${year}-${String(p.data.month).padStart(2, "0")}-${String(p.data.day).padStart(2, "0")}`;
  return buildSmsSemanticKey({
    confirmedYear: year,
    date,
    paymentTime: p.data.time,
    amount: p.data.amount,
    merchant: p.data.merchant,
  });
}

describe("sms semantic key", () => {
  it("same payment one-line vs multiline shares semantic key", () => {
    assert.equal(semanticFromRaw(ONE_LINE), semanticFromRaw(MULTI_LINE));
  });

  it("different fingerprint for one-line vs multiline", () => {
    assert.notEqual(smsFingerprint(ONE_LINE), smsFingerprint(MULTI_LINE));
  });

  it("different merchant yields different semantic key", () => {
    const a = semanticFromRaw(ONE_LINE);
    const b = buildSmsSemanticKey({
      confirmedYear: 2026,
      date: "2026-10-29",
      paymentTime: "14:13",
      amount: 10000,
      merchant: "다른가맹점",
    });
    assert.notEqual(a, b);
  });

  it("isExactSemanticPaymentMatch ignores fingerprint", () => {
    const input = {
      confirmedYear: 2026,
      date: "2026-10-29",
      paymentTime: "14:13",
      amount: 10000,
      merchant: "김치찌개 미화식당 칠괴점",
    };
    assert.equal(
      isExactSemanticPaymentMatch(
        {
          date: input.date,
          amount: input.amount,
          description: "김치찌개 미화식당 칠괴점",
          payment_time: "14:13",
          sms_confirmed_year: 2026,
        },
        input,
      ),
      true,
    );
  });

  it("fuzzy excludes exact semantic match", () => {
    const input = {
      confirmedYear: 2026,
      date: "2026-10-29",
      paymentTime: "14:13",
      amount: 10000,
      merchant: "김치찌개 미화식당 칠괴점",
    };
    assert.equal(
      isFuzzySemanticCandidate(
        {
          date: input.date,
          amount: input.amount,
          description: input.merchant,
          payment_time: "14:13",
          sms_confirmed_year: 2026,
        },
        input,
      ),
      false,
    );
    assert.equal(
      isFuzzySemanticCandidate(
        {
          date: input.date,
          amount: input.amount,
          description: "미화식당",
          payment_time: "14:13",
          sms_confirmed_year: 2026,
        },
        input,
      ),
      true,
    );
  });
});
