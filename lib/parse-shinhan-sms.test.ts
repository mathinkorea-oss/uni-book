import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeSmsText, smsFingerprint } from "./sms-fingerprint";
import {
  buildExpenseDateIso,
  merchantSimilarity,
  parseShinhanCorporateSms,
} from "./parse-shinhan-sms";

const EXAMPLE = `[Web발신]
신한법인승인 1501
10/28 18:57
33,000원 진돗가비불쭈꾸미 평택만
잔액4,245,157원`;

const ONE_LINE = `[Web발신]
신한법인승인 7881 10/29 14:13 10,000원 김치찌개 미화식당 칠괴점 잔액4,235,157원`;

describe("parseShinhanCorporateSms", () => {
  it("parses single-line approval with inline date and amount", () => {
    const r = parseShinhanCorporateSms(ONE_LINE);
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.data.month, 10);
    assert.equal(r.data.day, 29);
    assert.equal(r.data.time, "14:13");
    assert.equal(r.data.amount, 10000);
    assert.equal(r.data.merchant, "김치찌개 미화식당 칠괴점");
  });

  it("parses one physical line without newlines after Web header", () => {
    const r = parseShinhanCorporateSms(
      "[Web발신] 신한법인승인 7881 10/29 14:13 10,000원 김치찌개 미화식당 칠괴점 잔액4,235,157원",
    );
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.data.amount, 10000);
    assert.equal(r.data.merchant, "김치찌개 미화식당 칠괴점");
  });

  it("parses with NBSP between date and time", () => {
    const r = parseShinhanCorporateSms(
      "신한법인승인\n10/29\u00A014:13\n10,000원 테스트가맹점",
    );
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.data.time, "14:13");
    assert.equal(r.data.merchant, "테스트가맹점");
  });

  it("parses example approval SMS", () => {
    const r = parseShinhanCorporateSms(EXAMPLE);
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.data.amount, 33000);
    assert.equal(r.data.time, "18:57");
    assert.equal(r.data.month, 10);
    assert.equal(r.data.day, 28);
    assert.equal(r.data.merchant, "진돗가비불쭈꾸미 평택만");
  });

  it("ignores balance line", () => {
    const r = parseShinhanCorporateSms(
      "신한법인승인\n10/28 18:57\n33,000원 가맹점\n잔액4,245,157원",
    );
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.data.amount, 33000);
  });

  it("joins multiline merchant", () => {
    const r = parseShinhanCorporateSms(
      "신한법인승인\n10/28 18:57\n33,000원\n진돗가비불쭈꾸미\n평택만",
    );
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.data.merchant, "진돗가비불쭈꾸미 평택만");
  });

  it("normalizes whitespace and newlines", () => {
    const messy = `  신한법인승인   1501  
10/28   18:57
33,000원   가맹점A  
잔액  1,000원 `;
    const r = parseShinhanCorporateSms(messy);
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.data.amount, 33000);
    assert.equal(r.data.merchant, "가맹점A");
  });

  it("blocks cancel SMS", () => {
    const r = parseShinhanCorporateSms(
      "신한법인승인\n10/28 18:57\n승인취소 33,000원 가맹점",
    );
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.error.kind, "cancel");
  });

  it("blocks multiple approvals", () => {
    const r = parseShinhanCorporateSms(
      "신한법인승인\n신한법인승인\n10/28 18:57\n1,000원 A",
    );
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.error.kind, "multi");
  });

  it("keeps fingerprint unchanged for multiline reference SMS", () => {
    const fpBefore = smsFingerprint(EXAMPLE);
    assert.equal(parseShinhanCorporateSms(EXAMPLE).ok, true);
    assert.equal(smsFingerprint(EXAMPLE), fpBefore);
    assert.equal(normalizeSmsText(EXAMPLE).includes("33,000원"), true);
  });
});

describe("buildExpenseDateIso", () => {
  it("builds valid ISO date", () => {
    assert.equal(buildExpenseDateIso(2026, 10, 28), "2026-10-28");
  });

  it("rejects invalid calendar date", () => {
    assert.equal(buildExpenseDateIso(2026, 2, 30), null);
  });
});

describe("merchantSimilarity", () => {
  it("matches equal and contained names", () => {
    assert.equal(merchantSimilarity("가맹점", "가맹점"), 1);
    assert.ok(merchantSimilarity("진돗가비불쭈꾸미 평택만", "진돗가") >= 0.85);
  });
});
