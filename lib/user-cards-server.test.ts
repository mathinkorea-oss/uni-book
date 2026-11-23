import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CARD_CODES, type UserCardRow } from "./cards";
import { resolveCardIdFromParse } from "./user-cards-server";

const SAMPLE_CARDS: UserCardRow[] = [
  {
    id: "a",
    user_id: "u",
    code: CARD_CODES.SHINHAN_CORP,
    display_name: "법인카드",
    issuer: "shinhan",
    sms_last_digits: null,
    sort_order: 0,
  },
  {
    id: "b",
    user_id: "u",
    code: CARD_CODES.KB_8091,
    display_name: "KB국민카드",
    issuer: "kb",
    sms_last_digits: "8091",
    sort_order: 1,
  },
];

describe("resolveCardIdFromParse", () => {
  it("auto-selects KB card when digits and code match uniquely", () => {
    const r = resolveCardIdFromParse({
      cards: SAMPLE_CARDS,
      detectedCode: CARD_CODES.KB_8091,
      detectedDigits: "8091",
    });
    assert.equal(r.needsSelection, false);
    assert.equal(r.cardId, "b");
    assert.equal(r.mismatch, false);
  });

  it("does not auto-select corp when only KB digits are detected", () => {
    const r = resolveCardIdFromParse({
      cards: SAMPLE_CARDS,
      detectedCode: null,
      detectedDigits: "8091",
    });
    assert.equal(r.cardId, "b");
  });

  it("flags mismatch when user overrides detected card", () => {
    const r = resolveCardIdFromParse({
      cards: SAMPLE_CARDS,
      detectedCode: CARD_CODES.KB_8091,
      detectedDigits: "8091",
      selectedCardId: "a",
    });
    assert.equal(r.mismatch, true);
    assert.equal(r.cardId, "a");
  });
});