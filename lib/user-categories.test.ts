import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isCustomCategoryCode,
  validateUserCategoryInsertCode,
} from "@/lib/user-categories";

describe("validateUserCategoryInsertCode", () => {
  it("rejects builtin codes like meal", () => {
    const r = validateUserCategoryInsertCode("meal");
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.match(r.message, /기본 분류/);
    }
  });

  it("rejects non-custom shapes", () => {
    assert.equal(validateUserCategoryInsertCode("my_category").ok, false);
    assert.equal(validateUserCategoryInsertCode("custom_ab").ok, false);
  });

  it("accepts custom_ hex codes", () => {
    const r = validateUserCategoryInsertCode("custom_a1b2c3d4");
    assert.equal(r.ok, true);
    assert.equal(isCustomCategoryCode("custom_a1b2c3d4"), true);
  });
});