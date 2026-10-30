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
    assert.equal(
      isSameSmsRegistration(stored, fingerprint, 2026),
      true,
      "same SMS + confirmed 2026 must match even if stored date is 2025",
    );
    assert.equal(
      isSameSmsRegistration(stored, fingerprint, 2025),
      false,
      "different confirmed year is a separate registration",
    );
  });

  it("allows same SMS text for another confirmed year", () => {
    const stored2026 = {
      sms_fingerprint: fingerprint,
      sms_confirmed_year: 2026,
    };
    assert.equal(isSameSmsRegistration(stored2026, fingerprint, 2025), false);
  });

  it("parseConfirmedYear rejects invalid values", () => {
    assert.equal(parseConfirmedYear(2026), 2026);
    assert.equal(parseConfirmedYear(1999), null);
    assert.equal(parseConfirmedYear("2026"), null);
  });
});
