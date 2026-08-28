import test from "node:test";
import assert from "node:assert/strict";
import { getCycleDay, getTimelineState } from "../src/model/schedule.js";
import {
  getDayEvents,
  isInstructionalDate,
  parseLocalDate
} from "../src/model/schedule.js";

const calendar = {
  anchorDate: "2026-08-20",
  anchorDay: 1,
  lastDate: "2027-06-04",
  noSchool: ["2026-09-07"],
  conditionalMakeup: ["2027-02-12"],
  overrides: {}
};

test("anchor date is Day 1", () => {
  assert.deepEqual(parseLocalDate("2026-08-20"), {
    year: 2026,
    month: 8,
    day: 20
  });
  assert.equal(isInstructionalDate("2026-08-20", calendar), true);
  assert.deepEqual(getCycleDay("2026-08-20", calendar), {
    day: 1,
    source: "calculated",
    reason: "instructional-day"
  });
});

test("cycle wraps through the opening instructional dates", () => {
  assert.equal(getCycleDay("2026-08-21", calendar).day, 2);
  assert.equal(getCycleDay("2026-08-24", calendar).day, 3);
  assert.equal(getCycleDay("2026-08-26", calendar).day, 5);
  assert.equal(getCycleDay("2026-08-27", calendar).day, 1);
});

test("weekends and listed no-school dates have no cycle day", () => {
  assert.equal(isInstructionalDate("2026-08-22", calendar), false);
  assert.equal(isInstructionalDate("2026-09-07", calendar), false);
  assert.equal(getCycleDay("2026-08-22", calendar).day, null);
  assert.equal(getCycleDay("2026-09-07", calendar).day, null);
  assert.equal(getCycleDay("2026-09-08", calendar).day, 3);
});

test("manual override wins and identifies its source", () => {
  const changed = structuredClone(calendar);
  changed.overrides["2026-09-08"] = { kind: "cycle", day: 4 };
  assert.deepEqual(getCycleDay("2026-09-08", changed), {
    day: 4,
    source: "override",
    reason: "manual-cycle"
  });
});

test("conditional makeup date requires an explicit decision", () => {
  assert.deepEqual(getCycleDay("2027-02-12", calendar), {
    day: null,
    source: "conditional",
    reason: "makeup-status-needed"
  });
});

test("timeline returns current and next events at exact boundaries", () => {
  const events = [
    { id: "a", startMinutes: 540, endMinutes: 575 },
    { id: "b", startMinutes: 580, endMinutes: 615 }
  ];
  assert.equal(getTimelineState(events, 540).current.id, "a");
  assert.equal(getTimelineState(events, 575).current, null);
  assert.equal(getTimelineState(events, 575).next.id, "b");
  assert.equal(getTimelineState(events, 575).minutesUntilNext, 5);

  const plan = {
    teachers: [
      {
        id: "teacher-1",
        days: {
          1: [
            { id: "later", start: "09:40", end: "10:15" },
            { id: "earlier", start: "09:00", end: "09:35" },
            { id: "same-time", start: "09:00", end: "09:20" }
          ]
        }
      }
    ]
  };
  assert.deepEqual(
    getDayEvents(plan, "teacher-1", 1).map((event) => [
      event.id,
      event.startMinutes,
      event.endMinutes
    ]),
    [
      ["earlier", 540, 575],
      ["same-time", 540, 560],
      ["later", 580, 615]
    ]
  );
});
