import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatCategoryFilterSuffix,
  isCustomCategoryCode,
  isUnregisteredCategoryRow,
  mergeCategoryOptions,
  validateUserCategoryInsertCode,
  type UserCategoryRow,
} from "@/lib/user-categories";

function masterRow(
  code: string,
  display_name: string,
  overrides: Partial<UserCategoryRow> = {},
): UserCategoryRow {
  return {
    id: `id-${code}`,
    user_id: "user-1",
    code,
    display_name,
    sort_order: 0,
    is_active: true,
    is_builtin: true,
    ...overrides,
  };
}

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

describe("mergeCategoryOptions", () => {
  it("does not duplicate codes when many expenses share meal/other", () => {
    const merged = mergeCategoryOptions([], [
      "meal",
      "meal",
      "other",
      "other",
      "other",
    ]);
    const codes = merged.map((c) => c.code);
    assert.equal(codes.filter((c) => c === "meal").length, 1);
    assert.equal(codes.filter((c) => c === "other").length, 1);
    assert.equal(new Set(codes).size, codes.length);
  });

  it("prefers master display_name, is_active, sort_order over synthetic", () => {
    const merged = mergeCategoryOptions(
      [masterRow("meal", "식비", { sort_order: 2, is_active: false })],
      ["meal", "meal"],
    );
    assert.equal(merged.length, 1);
    assert.equal(merged[0].display_name, "식비");
    assert.equal(merged[0].is_active, false);
    assert.equal(merged[0].sort_order, 2);
  });

  it("adds orphan expense codes not in master", () => {
    const merged = mergeCategoryOptions(
      [masterRow("meal", "식사")],
      ["meal", "custom_a1b2c3d4"],
    );
    assert.equal(merged.length, 2);
    const orphan = merged.find((c) => c.code === "custom_a1b2c3d4");
    assert.ok(orphan);
    assert.ok(isUnregisteredCategoryRow(orphan!));
    assert.equal(formatCategoryFilterSuffix(orphan!), " (미등록)");
  });

  it("distinguishes inactive master from unregistered orphan", () => {
    const inactive = masterRow("other", "기타", { is_active: false });
    const merged = mergeCategoryOptions([inactive], ["other"]);
    assert.equal(merged.length, 1);
    assert.equal(formatCategoryFilterSuffix(merged[0]), " (중지)");
    assert.equal(isUnregisteredCategoryRow(merged[0]), false);
  });

  it("dedupes duplicate master rows by code", () => {
    const a = masterRow("meal", "식사");
    const b = masterRow("meal", "식비", { user_id: "user-1" });
    const merged = mergeCategoryOptions([a, b], []);
    assert.equal(merged.length, 1);
  });
});