import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isBackfillTarget } from "./backfill-categories";

describe("isBackfillTarget", () => {
  it("skips user-set categories", () => {
    assert.equal(
      isBackfillTarget(
        {
          category_code: "meal",
          category_needs_review: false,
          category_user_set: true,
        },
        "reapply_rules",
      ),
      false,
    );
  });

  it("default scope targets review and other only", () => {
    assert.equal(
      isBackfillTarget(
        {
          category_code: "meal",
          category_needs_review: false,
          category_user_set: false,
        },
        "needs_review_only",
      ),
      false,
    );
    assert.equal(
      isBackfillTarget(
        {
          category_code: "other",
          category_needs_review: false,
          category_user_set: false,
        },
        "needs_review_only",
      ),
      true,
    );
  });

  it("reapply scope includes classified rows when not user-set", () => {
    assert.equal(
      isBackfillTarget(
        {
          category_code: "meal",
          category_needs_review: false,
          category_user_set: false,
        },
        "reapply_rules",
      ),
      true,
    );
  });
});