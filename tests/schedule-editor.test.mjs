import test from "node:test";
import assert from "node:assert/strict";

import {
  addScheduleEvent,
  compileScheduleDraft,
  copyScheduleDay,
  createBlankScheduleDraft,
  createScheduleDraftFromPlan,
  duplicateScheduleEvent,
  editScheduleEvent,
  removeScheduleEvent
} from "../src/model/schedule-editor.js";

const EVENT_ONE = "event-h00000000000000000000000000000001";
const EVENT_TWO = "event-h00000000000000000000000000000002";
const EVENT_THREE = "event-h00000000000000000000000000000003";
const EVENT_FOUR = "event-h00000000000000000000000000000004";
const EVENT_FIVE = "event-h00000000000000000000000000000005";

function calendar() {
  return {
    anchorDate: "2026-08-20",
    anchorDay: 1,
    lastDate: "2027-06-04",
    noSchool: [],
    conditionalMakeup: [],
    overrides: {}
  };
}

function twoTeacherPlan() {
  return {
    format: "playbook.teacherPlan.v2",
    version: 1,
    calendar: calendar(),
    teachers: [
      {
        id: "teacher-alpha-stable",
        name: "Teacher Alpha",
        days: {
          1: [
            {
              id: EVENT_ONE,
              type: "teach",
              label: "Grade 5",
              start: "08:10",
              end: "08:45"
            }
          ],
          2: [],
          3: [],
          4: [],
          5: []
        }
      },
      {
        id: "teacher-beta-stable",
        name: "Teacher Beta",
        days: {
          1: [],
          2: [
            {
              id: EVENT_TWO,
              type: "duty",
              label: "Dismissal duty",
              start: "15:25",
              end: "15:40",
              dutyDetails: {
                label: "Dismissal",
                assignment: "Area 1",
                location: "Bus loop"
              }
            }
          ],
          3: [],
          4: [],
          5: []
        }
      }
    ],
    specialEvents: [],
    resources: []
  };
}

test("a blank schedule draft compiles to one valid teacher with five empty cycle days", () => {
  const draft = createBlankScheduleDraft({
    teacherId: "teacher-stable",
    teacherName: "Teacher Name",
    calendar: calendar()
  });

  const result = compileScheduleDraft(draft);

  assert.equal(result.ok, true);
  assert.deepEqual(Object.keys(result.value.teachers[0].days), ["1", "2", "3", "4", "5"]);
  assert.deepEqual(Object.values(result.value.teachers[0].days), [[], [], [], [], []]);
});

test("creating a draft from a plan preserves every teacher and stable teacher ID", () => {
  const plan = twoTeacherPlan();
  const snapshot = structuredClone(plan);

  const draft = createScheduleDraftFromPlan(plan);
  draft.teachers[0].name = "Changed only in the draft";
  const result = compileScheduleDraft(createScheduleDraftFromPlan(plan));

  assert.equal(result.ok, true);
  assert.deepEqual(result.value, snapshot);
  assert.deepEqual(result.value.teachers.map(({ id }) => id), [
    "teacher-alpha-stable",
    "teacher-beta-stable"
  ]);
  assert.deepEqual(plan, snapshot);
});

test("adding an event uses only the injected event ID generator and does not mutate the draft", () => {
  const draft = createScheduleDraftFromPlan(twoTeacherPlan());
  const snapshot = structuredClone(draft);
  let calls = 0;

  const next = addScheduleEvent(
    draft,
    {
      teacherId: "teacher-alpha-stable",
      cycleDay: 3,
      event: {
        id: "event-hffffffffffffffffffffffffffffffff",
        type: "prep",
        label: "Planning",
        start: "09:00",
        end: "09:35"
      }
    },
    {
      eventIdFactory: () => {
        calls += 1;
        return EVENT_THREE;
      }
    }
  );

  assert.equal(calls, 1);
  assert.equal(next.teachers[0].days[3][0].id, EVENT_THREE);
  assert.deepEqual(draft, snapshot);
});

test("changing a duty to another type removes duty-only fields and preserves its event ID", () => {
  const draft = createScheduleDraftFromPlan(twoTeacherPlan());

  const next = editScheduleEvent(draft, {
    teacherId: "teacher-beta-stable",
    cycleDay: 2,
    eventId: EVENT_TWO,
    changes: { type: "support", label: "Student support" }
  });

  const changed = next.teachers[1].days[2][0];
  assert.equal(changed.id, EVENT_TWO);
  assert.equal(changed.type, "support");
  assert.equal(Object.hasOwn(changed, "dutyDetails"), false);
  assert.equal(compileScheduleDraft(next).ok, true);
});

test("duplicating an event creates an independent copy with a generated ID", () => {
  const draft = createScheduleDraftFromPlan(twoTeacherPlan());

  const next = duplicateScheduleEvent(
    draft,
    {
      teacherId: "teacher-alpha-stable",
      cycleDay: 1,
      eventId: EVENT_ONE
    },
    { eventIdFactory: () => EVENT_THREE }
  );
  next.teachers[0].days[1][1].label = "Independent copy";

  assert.equal(next.teachers[0].days[1][0].label, "Grade 5");
  assert.equal(next.teachers[0].days[1][1].id, EVENT_THREE);
  assert.equal(draft.teachers[0].days[1].length, 1);
});

test("removing an event leaves the other teachers and days unchanged", () => {
  const draft = createScheduleDraftFromPlan(twoTeacherPlan());

  const next = removeScheduleEvent(draft, {
    teacherId: "teacher-alpha-stable",
    cycleDay: 1,
    eventId: EVENT_ONE
  });

  assert.deepEqual(next.teachers[0].days[1], []);
  assert.deepEqual(next.teachers[1], draft.teachers[1]);
  assert.equal(draft.teachers[0].days[1].length, 1);
});

test("copying a day replaces only the selected target day and generates fresh event IDs", () => {
  let nextId = 0;
  const generated = [EVENT_FOUR, EVENT_FIVE];
  let draft = createScheduleDraftFromPlan(twoTeacherPlan());
  draft = addScheduleEvent(
    draft,
    {
      teacherId: "teacher-alpha-stable",
      cycleDay: 1,
      event: {
        type: "prep",
        label: "Prep",
        start: "09:00",
        end: "09:35"
      }
    },
    { eventIdFactory: () => EVENT_THREE }
  );
  const secondTeacherSnapshot = structuredClone(draft.teachers[1]);

  const next = copyScheduleDay(
    draft,
    {
      teacherId: "teacher-alpha-stable",
      sourceDay: 1,
      targetDay: 4
    },
    { eventIdFactory: () => generated[nextId++] }
  );

  assert.deepEqual(next.teachers[0].days[4].map(({ id }) => id), [EVENT_FOUR, EVENT_FIVE]);
  assert.deepEqual(
    next.teachers[0].days[4].map(({ label }) => label),
    ["Grade 5", "Prep"]
  );
  assert.deepEqual(next.teachers[1], secondTeacherSnapshot);
  assert.deepEqual(draft.teachers[0].days[4], []);
});

test("compiling reports blank event fields in plain language", () => {
  let draft = createBlankScheduleDraft({
    teacherId: "teacher-stable",
    teacherName: "Teacher Name",
    calendar: calendar()
  });
  draft = addScheduleEvent(
    draft,
    {
      teacherId: "teacher-stable",
      cycleDay: 1,
      event: { type: "teach", label: "  ", start: "", end: "" }
    },
    { eventIdFactory: () => EVENT_ONE }
  );

  const result = compileScheduleDraft(draft);

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors.map(({ message }) => message), [
    "Enter a name for this schedule item.",
    "Enter a start time for this schedule item.",
    "Enter an end time for this schedule item."
  ]);
});

test("compiling reports a reversed time range in plain language", () => {
  let draft = createBlankScheduleDraft({
    teacherId: "teacher-stable",
    teacherName: "Teacher Name",
    calendar: calendar()
  });
  draft = addScheduleEvent(
    draft,
    {
      teacherId: "teacher-stable",
      cycleDay: 1,
      event: { type: "teach", label: "Grade 5", start: "09:00", end: "08:45" }
    },
    { eventIdFactory: () => EVENT_ONE }
  );

  const result = compileScheduleDraft(draft);

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors.map(({ message }) => message), [
    "End time must be later than start time."
  ]);
});

test("compiling reports overlapping schedule items in plain language", () => {
  let draft = createBlankScheduleDraft({
    teacherId: "teacher-stable",
    teacherName: "Teacher Name",
    calendar: calendar()
  });
  draft = addScheduleEvent(
    draft,
    {
      teacherId: "teacher-stable",
      cycleDay: 1,
      event: { type: "teach", label: "Grade 5", start: "09:00", end: "09:35" }
    },
    { eventIdFactory: () => EVENT_ONE }
  );
  draft = addScheduleEvent(
    draft,
    {
      teacherId: "teacher-stable",
      cycleDay: 1,
      event: { type: "prep", label: "Prep", start: "09:30", end: "10:05" }
    },
    { eventIdFactory: () => EVENT_TWO }
  );

  const result = compileScheduleDraft(draft);

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors.map(({ message }) => message), [
    "Grade 5 overlaps Prep on Cycle Day 1."
  ]);
});
