import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isSameSmsRegistration } from "./sms-dedup";
import { parseConfirmedYear } from "./sms-confirmed-year";

describe("SMS dedup by confirmed year (not expense date)", () => {
  const fingerprint = "abc123";

  it("blocks re-entry when expense date was edited after save", () => {
    const stored = {
      sms_fingerprint: fingerprint,
      sms_confirmed_year: 2026,
      date: "2025-11-01",
    };
    const cardA = "00000000-0000-4000-8000-0000000000aa";
    assert.equal(
      isSameSmsRegistration(
        { ...stored, card_id: cardA },
        fingerprint,
        2026,
        cardA,
      ),
      true,
      "same SMS + confirmed 2026 must match even if stored date is 2025",
    );
    assert.equal(
      isSameSmsRegistration(
        { ...stored, card_id: cardA },
        fingerprint,
        2025,
        cardA,
      ),
      false,
      "different confirmed year is a separate registration",
    );
  });

  it("allows same SMS text for another confirmed year", () => {
    const stored2026 = {
      sms_fingerprint: fingerprint,
      sms_confirmed_year: 2026,
    };
    const cardB = "00000000-0000-4000-8000-0000000000bb";
    assert.equal(
      isSameSmsRegistration(
        { ...stored2026, card_id: cardB },
        fingerprint,
        2025,
        cardB,
      ),
      false,
    );
  });

  it("same SMS on different cards is not the same registration", () => {
    const card1 = "00000000-0000-4000-8000-000000000011";
    const card2 = "00000000-0000-4000-8000-000000000012";
    const stored = { sms_fingerprint: fingerprint, sms_confirmed_year: 2026, card_id: card1 };
    assert.equal(isSameSmsRegistration(stored, fingerprint, 2026, card2), false);
  });

  it("parseConfirmedYear rejects invalid values", () => {
    assert.equal(parseConfirmedYear(2026), 2026);
    assert.equal(parseConfirmedYear(1999), null);
    assert.equal(parseConfirmedYear("2026"), null);
  });
});
