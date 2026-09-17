import assert from "node:assert/strict";
import test from "node:test";

import { buildWeekModel } from "../src/model/week.js";

const id = (n) => `event-h${String(n).padStart(32, "0")}`;

function plan(overrides = {}) {
  return {
    format: "playbook.teacherPlan.v2",
    version: 1,
    calendar: {
      anchorDate: "2026-08-20",
      anchorDay: 1,
      lastDate: "2027-06-04",
      noSchool: ["2026-09-07", "2026-09-21"],
      conditionalMakeup: ["2027-02-12"],
      overrides: {}
    },
    teachers: [{
      id: "teacher-one",
      name: "Teacher One",
      days: {
        1: [
          { id: id(11), type: "teach", label: "Class A", start: "09:05", end: "09:40" },
          { id: id(12), type: "prep", label: "Prep", start: "09:43", end: "10:18" }
        ],
        2: [{ id: id(21), type: "teach", label: "Class B", start: "09:05", end: "09:40" }],
        3: [{ id: id(31), type: "lunch", label: "Lunch", start: "11:38", end: "12:13" }],
        4: [{ id: id(41), type: "support", label: "Support", start: "09:10", end: "09:40" }],
        5: [
          { id: id(52), type: "teach", label: "Class F", start: "10:20", end: "10:55" },
          { id: id(51), type: "teach", label: "Class E", start: "09:05", end: "09:40" }
        ]
      }
    }],
    specialEvents: [
      { id: id(90), type: "special", label: "Team meeting", date: "2026-09-18", start: "08:15", end: "08:45" }
    ],
    resources: [],
    ...overrides
  };
}

test("week model needs a plan before it shows anything", () => {
  const week = buildWeekModel({ plan: null, dateKey: "2026-09-17" });
  assert.equal(week.status, "plan-required");
  assert.deepEqual(week.days, []);
  assert.match(week.nextAction, /schedule/i);
});

test("week model rejects an unsupported plan without throwing", () => {
  const week = buildWeekModel({ plan: { format: "something-else" }, dateKey: "2026-09-17" });
  assert.equal(week.status, "plan-unsupported");
});

test("week model lists the next five school days with the right cycle days", () => {
  const week = buildWeekModel({ plan: plan(), teacherId: "teacher-one", dateKey: "2026-09-17", nowMinutes: 8 * 60 });
  assert.equal(week.status, "ready");
  assert.equal(week.teacherName, "Teacher One");
  const school = week.days.filter((day) => day.cycleDay !== null);
  assert.deepEqual(
    school.map((day) => [day.dateKey, day.cycleDay]),
    [
      ["2026-09-17", 5],
      ["2026-09-18", 1],
      ["2026-09-22", 2],
      ["2026-09-23", 3],
      ["2026-09-24", 4]
    ]
  );
  assert.equal(week.rangeLabel, "Sep 17 to Sep 24");
});

test("a weekday without students stays visible and weekends are skipped", () => {
  const week = buildWeekModel({ plan: plan(), teacherId: "teacher-one", dateKey: "2026-09-17" });
  const keys = week.days.map((day) => day.dateKey);
  assert.equal(keys.includes("2026-09-19"), false);
  assert.equal(keys.includes("2026-09-20"), false);
  const inService = week.days.find((day) => day.dateKey === "2026-09-21");
  assert.equal(inService.cycleDay, null);
  assert.equal(inService.cycleLabel, "No students");
  assert.equal(inService.note, "No school for students");
  assert.deepEqual(inService.blocks, []);
});

test("blocks are in time order and special events join their date", () => {
  const week = buildWeekModel({ plan: plan(), teacherId: "teacher-one", dateKey: "2026-09-17" });
  const thursday = week.days[0];
  assert.deepEqual(thursday.blocks.map((block) => block.title), ["Class E", "Class F"]);
  assert.equal(thursday.classCount, 2);
  assert.equal(thursday.blocks[0].timeLabel, "9:05 - 9:40");
  const friday = week.days.find((day) => day.dateKey === "2026-09-18");
  assert.deepEqual(friday.blocks.map((block) => block.title), ["Team meeting", "Class A", "Prep"]);
  assert.equal(friday.blocks[0].type, "special");
  assert.equal(friday.classCount, 1);
});

test("only today's blocks are marked past or current", () => {
  const week = buildWeekModel({
    plan: plan(),
    teacherId: "teacher-one",
    dateKey: "2026-09-17",
    nowMinutes: 10 * 60 + 30
  });
  const [today, tomorrow] = week.days;
  assert.equal(today.isToday, true);
  assert.deepEqual(today.blocks.map((block) => block.state), ["past", "current"]);
  assert.equal(tomorrow.isToday, false);
  assert.ok(tomorrow.blocks.every((block) => block.state === "later"));
});

test("starting on a weekend begins with the next school day and marks nothing as today", () => {
  const week = buildWeekModel({ plan: plan(), teacherId: "teacher-one", dateKey: "2026-09-19" });
  assert.equal(week.days[0].dateKey, "2026-09-21");
  assert.equal(week.days[1].dateKey, "2026-09-22");
  assert.ok(week.days.every((day) => day.isToday === false));
});

test("an unknown teacher id falls back to the first teacher in the plan", () => {
  const week = buildWeekModel({ plan: plan(), teacherId: "missing", dateKey: "2026-09-17" });
  assert.equal(week.status, "ready");
  assert.equal(week.days[0].blocks.length, 2);
});

test("a snow make-up day asks for the district notice instead of guessing", () => {
  const week = buildWeekModel({ plan: plan(), teacherId: "teacher-one", dateKey: "2027-02-11", schoolDays: 2 });
  const makeup = week.days.find((day) => day.dateKey === "2027-02-12");
  assert.equal(makeup.cycleDay, null);
  assert.match(makeup.note, /district notice/);
});

test("the week stops at the end of the school year", () => {
  const week = buildWeekModel({ plan: plan(), teacherId: "teacher-one", dateKey: "2027-06-03" });
  assert.deepEqual(week.days.map((day) => day.dateKey), ["2027-06-03", "2027-06-04"]);
  const after = buildWeekModel({ plan: plan(), teacherId: "teacher-one", dateKey: "2027-06-07" });
  assert.equal(after.status, "no-school-days");
});

test("the model never invents text for a day with no entered blocks", () => {
  const empty = plan();
  empty.teachers[0].days["5"] = [];
  const week = buildWeekModel({ plan: empty, teacherId: "teacher-one", dateKey: "2026-09-17" });
  assert.equal(week.days[0].blocks.length, 0);
  assert.equal(week.days[0].note, "No blocks entered for this cycle day yet.");
});
