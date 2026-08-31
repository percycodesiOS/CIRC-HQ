import test from "node:test";
import assert from "node:assert/strict";
import {
  diffTeacherPlans,
  validateTeacherPlan
} from "../src/model/teacher-plan.js";

function makeValidPlan() {
  return {
    format: "playbook.teacherPlan.v2",
    version: 1,
    calendar: {
      anchorDate: "2026-08-20",
      anchorDay: 1,
      lastDate: "2027-06-04",
      noSchool: ["2026-09-07"],
      conditionalMakeup: ["2027-02-12"],
      overrides: {}
    },
    teachers: [
      {
        id: "teacher-1",
        name: "Teacher One",
        days: {
          1: [
            {
              id: "event-a",
              type: "teach",
              label: "Class A",
              start: "09:05",
              end: "09:40"
            },
            {
              id: "event-b",
              type: "prep",
              label: "Prep",
              start: "09:45",
              end: "10:20"
            }
          ]
        }
      }
    ],
    specialEvents: [
      {
        id: "special-a",
        type: "special",
        label: "Parent Night",
        date: "2026-09-10",
        start: "18:00",
        end: "19:00"
      }
    ],
    resources: []
  };
}

test("accepts a valid playbook.teacherPlan.v2 value without mutation", () => {
  const candidate = makeValidPlan();
  const snapshot = structuredClone(candidate);

  const result = validateTeacherPlan(candidate);

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.value, snapshot);
  assert.notEqual(result.value, candidate);
  assert.notEqual(result.value.teachers, candidate.teachers);
  assert.deepEqual(candidate, snapshot);
});

test("accepts previously valid nonempty teacher id formats", () => {
  for (const id of ["teacher@example.com", "first.last", "default", " teacher alpha ", "a".repeat(65)]) {
    const candidate = makeValidPlan();
    candidate.teachers[0].id = id;

    const result = validateTeacherPlan(candidate);

    assert.equal(result.ok, true, id);
    assert.equal(result.value.teachers[0].id, id);
  }
});

test("rejects schema version values other than 1", () => {
  const candidate = makeValidPlan();
  candidate.version = 2;

  const result = validateTeacherPlan(candidate);

  assert.equal(result.ok, false);
  assert.equal(
    result.errors.some((error) => error.includes("version must be exactly 1")),
    true
  );
});

test("rejects duplicate event IDs", () => {
  const candidate = makeValidPlan();
  candidate.teachers[0].days[2] = [
    {
      id: "event-a",
      type: "support",
      label: "Support",
      start: "10:25",
      end: "11:00"
    }
  ];

  const result = validateTeacherPlan(candidate);

  assert.equal(result.ok, false);
  assert.equal(
    result.errors.some((error) => /duplicate event id "event-a"/i.test(error)),
    true
  );
});

test("rejects an invalid calendar date", () => {
  const candidate = makeValidPlan();
  candidate.calendar.anchorDate = "2026-02-30";

  const result = validateTeacherPlan(candidate);

  assert.equal(result.ok, false);
  assert.equal(
    result.errors.some((error) => error.includes("calendar.anchorDate")),
    true
  );
});

test("rejects an invalid event time range", () => {
  const candidate = makeValidPlan();
  candidate.teachers[0].days[1][0].end = "09:05";

  const result = validateTeacherPlan(candidate);

  assert.equal(result.ok, false);
  assert.equal(
    result.errors.some((error) => error.includes("end must be after start")),
    true
  );
});

test("rejects an unsupported event type", () => {
  const candidate = makeValidPlan();
  candidate.teachers[0].days[1][0].type = "meeting";

  const result = validateTeacherPlan(candidate);

  assert.equal(result.ok, false);
  assert.equal(
    result.errors.some((error) => error.includes("unsupported type")),
    true
  );
});

test("rejects a plan with no teacher", () => {
  const candidate = makeValidPlan();
  candidate.teachers = [];

  const result = validateTeacherPlan(candidate);

  assert.equal(result.ok, false);
  assert.equal(
    result.errors.some((error) => error.includes("teachers must include")),
    true
  );
});

test("diff identifies one added, one removed, and one changed event", () => {
  const previous = makeValidPlan();
  const next = makeValidPlan();
  next.teachers[0].days[1][0].label = "Updated Class A";
  next.teachers[0].days[1] = next.teachers[0].days[1].filter(
    (event) => event.id !== "event-b"
  );
  next.teachers[0].days[1].push({
    id: "event-c",
    type: "lunch",
    label: "Lunch",
    start: "11:30",
    end: "12:00"
  });

  const result = diffTeacherPlans(previous, next);

  assert.deepEqual(result.added.map((event) => event.id), ["event-c"]);
  assert.deepEqual(result.removed.map((event) => event.id), ["event-b"]);
  assert.deepEqual(result.changed.map((entry) => entry.id), ["event-a"]);
  assert.equal(result.changed[0].before.label, "Class A");
  assert.equal(result.changed[0].after.label, "Updated Class A");
});

test("keeps user text as plain data instead of markup", () => {
  const candidate = makeValidPlan();
  const userText = '<img src="x" onerror="alert(1)">';
  candidate.teachers[0].days[1][0].label = userText;
  candidate.teachers[0].days[1][0].privateNote = "<script>alert(1)</script>";

  const result = validateTeacherPlan(candidate);

  assert.equal(result.ok, true);
  assert.equal(result.value.teachers[0].days[1][0].label, userText);
  assert.equal(
    result.value.teachers[0].days[1][0].privateNote,
    "<script>alert(1)</script>"
  );
  assert.equal(typeof result.value.teachers[0].days[1][0].label, "string");
});
