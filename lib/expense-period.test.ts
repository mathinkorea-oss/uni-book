import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addMonths, monthDateRange } from "./month";
import {
  formatPeriodLabel,
  isReversedRange,
  isSingleCalendarMonth,
  kstViewMonth,
  resolvePeriodRange,
} from "./expense-period";

describe("expense-period", () => {
  it("resolves last_3_months as three calendar months inclusive", () => {
    const today = kstViewMonth();
    const { range, error } = resolvePeriodRange({
      preset: "last_3_months",
      viewMonth: today,
    });
    assert.equal(error, null);
    assert.ok(range);
    assert.equal(range!.start, monthDateRange(addMonths(today, -2)).start);
    assert.equal(range!.end, monthDateRange(today).end);
    assert.equal(isSingleCalendarMonth(range!), false);
  });

  it("rejects reversed custom range", () => {
    const { range, error } = resolvePeriodRange({
      preset: "custom",
      viewMonth: null,
      customStart: "2026-03-10",
      customEnd: "2026-03-01",
    });
    assert.equal(range, null);
    assert.ok(error);
    assert.equal(isReversedRange("2026-03-10", "2026-03-01"), true);
  });

  it("includes both ends of custom range", () => {
    const { range } = resolvePeriodRange({
      preset: "custom",
      viewMonth: null,
      customStart: "2026-01-15",
      customEnd: "2026-02-02",
    });
    assert.ok(range);
    assert.equal(range!.start, "2026-01-15");
    assert.equal(range!.end, "2026-02-02");
  });

  it("formats labels", () => {
    assert.match(
      formatPeriodLabel("last_3_months", { start: "2026-01-01", end: "2026-03-31" }, null),
      /2026-01-01/,
    );
  });
});