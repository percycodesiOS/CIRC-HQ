import test from "node:test";
import assert from "node:assert/strict";
import {
  diffTeacherPlans,
  validateTeacherPlan
} from "../src/model/teacher-plan.js";

const EVENT_ONE = "event-h00000000000000000000000000000001";
const EVENT_TWO = "event-h00000000000000000000000000000002";
const EVENT_SPECIAL = "event-h00000000000000000000000000000003";

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
              id: EVENT_ONE,
              type: "teach",
              label: "Class A",
              start: "09:05",
              end: "09:40"
            },
            {
              id: EVENT_TWO,
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
        id: EVENT_SPECIAL,
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
      id: EVENT_ONE,
      type: "support",
      label: "Support",
      start: "10:25",
      end: "11:00"
    }
  ];

  const result = validateTeacherPlan(candidate);

  assert.equal(result.ok, false);
  assert.equal(
    result.errors.some((error) => error.includes(`duplicate event id "${EVENT_ONE}"`)),
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
    (event) => event.id !== EVENT_TWO
  );
  next.teachers[0].days[1].push({
    id: "event-h4a4efd5e55362ed79f63e76aaed4fea2",
    type: "lunch",
    label: "Lunch",
    start: "11:30",
    end: "12:00"
  });

  const result = diffTeacherPlans(previous, next);

  assert.deepEqual(result.added.map((event) => event.id), ["event-h4a4efd5e55362ed79f63e76aaed4fea2"]);
  assert.deepEqual(result.removed.map((event) => event.id), [EVENT_TWO]);
  assert.deepEqual(result.changed.map((entry) => entry.id), [EVENT_ONE]);
  assert.equal(result.changed[0].before.label, "Class A");
  assert.equal(result.changed[0].after.label, "Updated Class A");
});

test("keeps admitted labels as plain data but rejects unsupported event fields", () => {
  const candidate = makeValidPlan();
  const userText = '<img src="x" onerror="alert(1)">';
  candidate.teachers[0].days[1][0].label = userText;
  candidate.teachers[0].days[1][0].privateNote = "<script>alert(1)</script>";

  const result = validateTeacherPlan(candidate);

  assert.equal(result.ok, false);
  assert.equal(result.value, null);
  assert.equal(JSON.stringify(result).includes("<script>"), false);
  delete candidate.teachers[0].days[1][0].privateNote;
  const labelOnly = validateTeacherPlan(candidate);
  assert.equal(labelOnly.ok, true);
  assert.equal(labelOnly.value.teachers[0].days[1][0].label, userText);
  assert.equal(typeof labelOnly.value.teachers[0].days[1][0].label, "string");
});

test("rejects every semantic event ID even when the rest of the plan is valid", () => {
  for (const id of [
    "event-person-class",
    "event-math-class",
    "event-teacher-example-com",
    "event-path-private",
    "event-label-workshop"
  ]) {
    const candidate = makeValidPlan();
    candidate.teachers[0].days[1][0].id = id;
    const result = validateTeacherPlan(candidate);
    assert.equal(result.ok, false, id);
    assert.equal(result.value, null, id);
  }
});

test("uses one conservative event ID grammar for scheduled and special events", () => {
  const invalidIds = [
    "teacher@example.com",
    "event/private",
    "event\\private",
    "event:private",
    "Event-Upper",
    "event with prose",
    "event-",
    "event-a@b",
    "a".repeat(65)
  ];
  for (const id of invalidIds) {
    const candidate = makeValidPlan();
    candidate.teachers[0].days[1][0].id = id;
    const result = validateTeacherPlan(candidate);
    assert.equal(result.ok, false, id);
    assert.equal(result.value, null, id);
    assert.equal(result.errors.some((error) => /event id/i.test(error)), true, id);
  }

  const valid = makeValidPlan();
  valid.teachers[0].days[1][0].id = "event-h81f60e899c57e3559198434e6838b5c1";
  valid.specialEvents[0].id = "event-h41a74b70ec1b577eb582573644e40f98";
  assert.equal(validateTeacherPlan(valid).ok, true);
});

test("rejects forbidden individual-record fields at every plan depth without retaining values", () => {
  const probes = [
    (plan) => { plan.studentRoster = ["ROOT_SENTINEL"]; },
    (plan) => { plan.teachers[0].studentRecords = ["TEACHER_SENTINEL"]; },
    (plan) => { plan.teachers[0].days[1][0].studentNames = ["EVENT_SENTINEL"]; },
    (plan) => { plan.calendar.overrides["2026-09-01"] = {
      kind: "cycle",
      day: 1,
      accountAlias: "NESTED_SENTINEL"
    }; }
  ];

  for (const addProbe of probes) {
    const candidate = makeValidPlan();
    addProbe(candidate);
    const result = validateTeacherPlan(candidate);
    assert.equal(result.ok, false);
    assert.equal(result.value, null);
    assert.doesNotMatch(JSON.stringify(result), /ROOT_SENTINEL|TEACHER_SENTINEL|EVENT_SENTINEL|NESTED_SENTINEL/);
  }
});

test("reconstructs a closed plan, strips exact legacy compatibility metadata, and rejects nested extras", () => {
  const compatible = makeValidPlan();
  compatible.legacyV1 = {
    sourceFormat: "playbook.teacherPlan.v1",
    preferredDay: 2,
    planStatus: "reviewed",
    dayLabels: [
      { day: 1, label: "Cycle One" },
      { day: 2, label: "Cycle Two" },
      { day: 3, label: "Cycle Three" },
      { day: 4, label: "Cycle Four" },
      { day: 5, label: "Cycle Five" }
    ]
  };
  const admitted = validateTeacherPlan(compatible);
  assert.equal(admitted.ok, true);
  assert.equal(Object.hasOwn(admitted.value, "legacyV1"), false);

  for (const addExtra of [
    (plan) => { plan.ordinaryRootExtra = true; },
    (plan) => { plan.calendar.ordinaryExtra = true; },
    (plan) => { plan.teachers[0].ordinaryExtra = true; },
    (plan) => { plan.teachers[0].days[1][0].ordinaryExtra = true; },
    (plan) => { plan.specialEvents[0].ordinaryExtra = true; }
  ]) {
    const candidate = makeValidPlan();
    addExtra(candidate);
    const result = validateTeacherPlan(candidate);
    assert.equal(result.ok, false);
    assert.equal(result.value, null);
  }
});

test("admits exact duty and confirmation sub-schemas only where supported", () => {
  const duty = makeValidPlan();
  duty.teachers[0].days[1][0] = {
    id: "event-hd9e05c40e94fa85dfcad00db3bb0ad4e",
    type: "duty",
    label: "Duty",
    start: "09:05",
    end: "09:40",
    dutyDetails: {
      label: "Morning duty",
      assignment: "Zone one",
      location: "Point two"
    },
    confirmation: { status: "needed", reason: "assignment-unconfirmed" }
  };
  const admitted = validateTeacherPlan(duty);
  assert.equal(admitted.ok, true);
  assert.deepEqual(admitted.value.teachers[0].days[1][0].dutyDetails, duty.teachers[0].days[1][0].dutyDetails);
  assert.deepEqual(admitted.value.teachers[0].days[1][0].confirmation, duty.teachers[0].days[1][0].confirmation);

  const teachWithDuty = makeValidPlan();
  teachWithDuty.teachers[0].days[1][0].dutyDetails = { assignment: "Not allowed" };
  assert.equal(validateTeacherPlan(teachWithDuty).ok, false);

  const confirmationExtra = structuredClone(duty);
  confirmationExtra.teachers[0].days[1][0].confirmation.extra = true;
  assert.equal(validateTeacherPlan(confirmationExtra).ok, false);
});
