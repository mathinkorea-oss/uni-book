import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { categorySelectableFromRow } from "@/lib/validate-category-code";

describe("categorySelectableFromRow", () => {
  it("rejects missing row including inactive builtin without DB row", () => {
    const r = categorySelectableFromRow(null);
    assert.equal(r.ok, false);
  });

  it("rejects inactive builtin or custom", () => {
    const r = categorySelectableFromRow({ is_active: false });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.match(r.message, /사용 중지/);
    }
  });

  it("allows active row", () => {
    const r = categorySelectableFromRow({ is_active: true });
    assert.equal(r.ok, true);
  });
});