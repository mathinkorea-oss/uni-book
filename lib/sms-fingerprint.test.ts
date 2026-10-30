import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isValidSmsFingerprint, normalizeSmsText, smsFingerprint } from "./sms-fingerprint";

describe("sms fingerprint", () => {
  const a = `[Web발신]
신한법인승인 1501
10/28 18:57
33,000원 진돗가비불쭈꾸미 평택만
잔액4,245,157원`;

  const b = `신한법인승인 1501
10/28 18:57
33,000원 진돗가비불쭈꾸미 평택만
잔액4,245,157원`;

  it("normalizes blank lines and spaces", () => {
    const n = normalizeSmsText(`  ${a.replace(/\n/g, "\n\n")}  `);
    assert.ok(n.includes("33,000원"));
    assert.ok(!n.includes("\n\n"));
  });

  it("same fingerprint for whitespace-only differences", () => {
    const compact = `신한법인승인 1501
10/28 18:57
33,000원 진돗가비불쭈꾸미 평택만
잔액4,245,157원`;
    const spaced = `  신한법인승인   1501  
10/28   18:57
33,000원   진돗가비불쭈꾸미 평택만  
잔액4,245,157원  `;
    assert.equal(smsFingerprint(compact), smsFingerprint(spaced));
  });

  it("different fingerprint when amount changes", () => {
    const c = b.replace("33,000", "34,000");
    assert.notEqual(smsFingerprint(a), smsFingerprint(c));
  });

  it("isValidSmsFingerprint matches sha256 hex", () => {
    const fp = smsFingerprint(b);
    assert.equal(isValidSmsFingerprint(fp), true);
    assert.equal(isValidSmsFingerprint(fp.toUpperCase()), false);
    assert.equal(isValidSmsFingerprint("short"), false);
  });
});
