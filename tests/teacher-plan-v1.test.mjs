import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getDayEvents } from "../src/model/schedule.js";
import { validateTeacherPlan } from "../src/model/teacher-plan.js";
import { migrateTeacherPlanV1 } from "../src/model/teacher-plan-v1.js";

function genericSource() {
  return {
    format: "playbook.teacherPlan.v1",
    preferredDay: 2,
    calendar: {
      anchorDate: "2026-08-20",
      anchorDay: 1,
      lastDate: "2027-06-04",
      noSchool: ["2026-09-07", "2026-11-26"]
    },
    plan: {
      status: "reviewed",
      days: [
        {
          day: 1,
          label: "Cycle One",
          events: [
            { time: "8:10-8:20", type: "prep", label: "Opening routine" },
            { time: "8:40-8:55", type: "duty", label: "Morning responsibility" }
          ]
        },
        {
          day: 2,
          label: "Cycle Two",
          events: [{ time: "12:00-12:30", type: "teach", label: "Noon workshop" }]
        },
        {
          day: 3,
          label: "Cycle Three",
          events: [{ time: "1:05-1:40", type: "support", label: "Afternoon support" }]
        },
        {
          day: 4,
          label: "Cycle Four",
          events: [{ time: "2:50-3:25", type: "support", label: "Verify assignment" }]
        },
        {
          day: 5,
          label: "Cycle Five",
          events: [{ time: "3:25-3:40", type: "duty", label: "Afternoon responsibility" }]
        }
      ]
    }
  };
}

function genericOptions(overrides = {}) {
  return {
    teacher: { id: "teacher-alpha", name: "Teacher Alpha" },
    dutyRules: [
      {
        start: "08:40",
        end: "08:55",
        dutyDetails: {
          label: "Morning duty",
          assignment: "Zone 1 through 3",
          location: "Point 2"
        }
      },
      {
        start: "15:25",
        end: "15:40",
        dutyDetails: {
          label: "Afternoon duty",
          assignment: "Zone 1 through 3",
          location: "Point 2"
        }
      }
    ],
    confirmationNeededSlots: [
      { day: 4, start: "14:50", end: "15:25" }
    ],
    ...overrides
  };
}

function eventCount(plan) {
  return plan.teachers.reduce(
    (total, teacher) => total + Object.values(teacher.days).reduce(
      (dayTotal, events) => dayTotal + events.length,
      0
    ),
    0
  );
}

test("converts the exact v1 envelope to one validated v2 teacher without mutating inputs", () => {
  const source = genericSource();
  const options = genericOptions();
  const sourceBefore = structuredClone(source);
  const optionsBefore = structuredClone(options);

  const result = migrateTeacherPlanV1(source, options);

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.value.format, "playbook.teacherPlan.v2");
  assert.equal(result.value.version, 1);
  assert.deepEqual(result.value.calendar, {
    anchorDate: "2026-08-20",
    anchorDay: 1,
    lastDate: "2027-06-04",
    noSchool: ["2026-09-07", "2026-11-26"],
    conditionalMakeup: [],
    overrides: {}
  });
  assert.equal(result.value.teachers.length, 1);
  assert.equal(result.value.teachers[0].id, "teacher-alpha");
  assert.equal(result.value.teachers[0].name, "Teacher Alpha");
  assert.deepEqual(result.value.specialEvents, []);
  assert.deepEqual(result.value.resources, []);
  assert.deepEqual(result.value.legacyV1, {
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
  });
  assert.equal(eventCount(result.value), 6);
  assert.equal(validateTeacherPlan(result.value).ok, true);
  assert.deepEqual(source, sourceBefore);
  assert.deepEqual(options, optionsBefore);
  assert.notEqual(result.value, source);
});

test("requires a caller supplied stable teacher id and display name", () => {
  for (const teacher of [undefined, {}, { id: "teacher-alpha" }, { name: "Teacher Alpha" }]) {
    const result = migrateTeacherPlanV1(genericSource(), genericOptions({ teacher }));
    assert.equal(result.ok, false);
    assert.equal(result.value, null);
    assert.ok(result.errors.includes("teacher-identity-required"));
  }
});

test("preserves previously valid nonempty teacher ids during v1 migration", () => {
  for (const id of ["teacher@example.com", "first.last", "default", " teacher alpha ", "a".repeat(65)]) {
    const result = migrateTeacherPlanV1(genericSource(), genericOptions({
      teacher: { id, name: "Teacher Alpha" }
    }));

    assert.equal(result.ok, true, id);
    assert.equal(result.value.teachers[0].id, id);
  }
});

test("converts morning noon and afternoon ranges deterministically inside the school window", () => {
  const result = migrateTeacherPlanV1(genericSource(), genericOptions());

  assert.equal(result.ok, true);
  assert.deepEqual(
    result.value.teachers[0].days["1"].map(({ start, end }) => [start, end]),
    [["08:10", "08:20"], ["08:40", "08:55"]]
  );
  assert.deepEqual(
    result.value.teachers[0].days["2"].map(({ start, end }) => [start, end]),
    [["12:00", "12:30"]]
  );
  assert.deepEqual(
    result.value.teachers[0].days["3"].map(({ start, end }) => [start, end]),
    [["13:05", "13:40"]]
  );
  assert.deepEqual(
    result.value.teachers[0].days["5"].map(({ start, end }) => [start, end]),
    [["15:25", "15:40"]]
  );

  const timeline = getDayEvents(result.value, "teacher-alpha", 3);
  assert.deepEqual(
    timeline.map(({ start, end, startMinutes, endMinutes }) => ({ start, end, startMinutes, endMinutes })),
    [{ start: "13:05", end: "13:40", startMinutes: 785, endMinutes: 820 }]
  );
});

test("rejects malformed unsupported and reversed ranges as a complete conversion", () => {
  const cases = ["09:00-9:30", "7:30-8:00", "4:00-4:01", "3:30-9:00"];
  for (const time of cases) {
    const source = genericSource();
    source.plan.days[1].events[0].time = time;
    source.plan.days[1].events[0].label = "Private Label Token";

    const result = migrateTeacherPlanV1(source, genericOptions());

    assert.equal(result.ok, false);
    assert.equal(result.value, null);
    assert.ok(result.errors.some((code) => code.startsWith("time-")));
    assert.equal(JSON.stringify(result).includes("Private Label Token"), false);
  }
});

test("stable event ids depend on teacher id day start and occurrence but not labels or display name", () => {
  const first = genericSource();
  first.plan.days[0].events.push({ time: "8:10-8:25", type: "support", label: "Same-start second" });
  const changed = structuredClone(first);
  changed.plan.days[0].events[0].label = "Completely different label";
  changed.plan.days[0].events[1].label = "Another different label";

  const one = migrateTeacherPlanV1(first, genericOptions()).value;
  const two = migrateTeacherPlanV1(changed, genericOptions({
    teacher: { id: "teacher-alpha", name: "Renamed Teacher" }
  })).value;

  assert.deepEqual(
    one.teachers[0].days["1"].map((event) => event.id),
    two.teachers[0].days["1"].map((event) => event.id)
  );
  assert.notEqual(one.teachers[0].days["1"][0].id, one.teachers[0].days["1"][2].id);
  const otherTeacher = migrateTeacherPlanV1(first, genericOptions({
    teacher: { id: "teacher-beta", name: "Teacher Alpha" }
  })).value;
  assert.notEqual(
    one.teachers[0].days["1"][0].id,
    otherTeacher.teachers[0].days["1"][0].id
  );
});

test("copies duty details only from exact rules and rejects missing or unused rules", () => {
  const source = genericSource();
  source.plan.days[0].events[1].label = "Words without assignment metadata";
  const result = migrateTeacherPlanV1(source, genericOptions());

  assert.equal(result.ok, true);
  assert.deepEqual(result.value.teachers[0].days["1"][1].dutyDetails, {
    label: "Morning duty",
    assignment: "Zone 1 through 3",
    location: "Point 2"
  });
  assert.equal(result.value.teachers[0].days["1"][1].label, "Words without assignment metadata");

  const missing = migrateTeacherPlanV1(source, genericOptions({ dutyRules: [] }));
  assert.equal(missing.ok, false);
  assert.ok(missing.errors.includes("duty-rule-match-required"));

  const unused = migrateTeacherPlanV1(source, genericOptions({
    dutyRules: [
      ...genericOptions().dutyRules,
      { start: "10:00", end: "10:15", dutyDetails: { assignment: "Unused" } }
    ]
  }));
  assert.equal(unused.ok, false);
  assert.ok(unused.errors.includes("duty-rule-unused"));
});

test("adds confirmation metadata from exact slots without rewriting source labels", () => {
  const source = genericSource();
  const label = source.plan.days[3].events[0].label;
  const result = migrateTeacherPlanV1(source, genericOptions());

  assert.equal(result.ok, true);
  assert.equal(result.value.teachers[0].days["4"][0].label, label);
  assert.deepEqual(result.value.teachers[0].days["4"][0].confirmation, {
    status: "needed",
    reason: "assignment-unconfirmed"
  });

  const unmatched = migrateTeacherPlanV1(source, genericOptions({
    confirmationNeededSlots: [{ day: 2, start: "14:50", end: "15:25" }]
  }));
  assert.equal(unmatched.ok, false);
  assert.ok(unmatched.errors.includes("confirmation-slot-match-required"));
});

test("rejects invalid v1 structure unsupported event data and duplicate or missing cycle days", () => {
  const unsupported = genericSource();
  unsupported.plan.days[2].events[0].type = "unsupported";
  const invalidType = migrateTeacherPlanV1(unsupported, genericOptions());
  assert.equal(invalidType.ok, false);
  assert.equal(invalidType.value, null);
  assert.ok(invalidType.errors.includes("candidate-invalid"));

  const duplicateDay = genericSource();
  duplicateDay.plan.days[4].day = 4;
  const duplicate = migrateTeacherPlanV1(duplicateDay, genericOptions());
  assert.equal(duplicate.ok, false);
  assert.ok(duplicate.errors.includes("cycle-days-invalid"));

  const wrongFormat = genericSource();
  wrongFormat.format = "playbook.teacherPlan.v2";
  const format = migrateTeacherPlanV1(wrongFormat, genericOptions());
  assert.equal(format.ok, false);
  assert.ok(format.errors.includes("source-format-unsupported"));
});

test("reports count and integrity audit values without source labels", () => {
  const result = migrateTeacherPlanV1(genericSource(), genericOptions());

  assert.equal(result.ok, true);
  assert.deepEqual(result.audit, {
    inputEventCount: 6,
    outputEventCount: 6,
    dayCount: 5,
    dutyRuleCount: 2,
    dutyEventCount: 2,
    confirmationSlotCount: 1,
    confirmationEventCount: 1,
    sourceUnchanged: true,
    candidateValid: true,
    labelsPreserved: true,
    typesPreserved: true,
    orderPreserved: true,
    timesPreserved: true,
    idsUnique: true
  });
  assert.equal(JSON.stringify(result.audit).includes("Opening routine"), false);
});

test("private v1 file converts all events and validates without printing private content", {
  skip: !process.env.PLAYBOOK_PRIVATE_PLAN || !process.env.PLAYBOOK_PRIVATE_OPTIONS
}, async () => {
  const [sourceText, optionsText] = await Promise.all([
    readFile(process.env.PLAYBOOK_PRIVATE_PLAN, "utf8"),
    readFile(process.env.PLAYBOOK_PRIVATE_OPTIONS, "utf8")
  ]);
  const result = migrateTeacherPlanV1(JSON.parse(sourceText), JSON.parse(optionsText));
  const validated = result.ok ? validateTeacherPlan(result.value) : { ok: false };
  const output = {
    sourceSha256: createHash("sha256").update(sourceText).digest("hex").toUpperCase(),
    inputEventCount: result.audit?.inputEventCount ?? 0,
    outputEventCount: result.audit?.outputEventCount ?? 0,
    dayCount: result.audit?.dayCount ?? 0,
    dutyEventCount: result.audit?.dutyEventCount ?? 0,
    confirmationEventCount: result.audit?.confirmationEventCount ?? 0,
    migrationOk: result.ok,
    validationOk: validated.ok,
    sourceUnchanged: result.audit?.sourceUnchanged === true,
    labelsPreserved: result.audit?.labelsPreserved === true,
    typesPreserved: result.audit?.typesPreserved === true,
    orderPreserved: result.audit?.orderPreserved === true,
    timesPreserved: result.audit?.timesPreserved === true,
    idsUnique: result.audit?.idsUnique === true,
    errorCodes: result.errors
  };
  console.log(JSON.stringify(output));
  assert.equal(output.sourceSha256, "BD7D359590414E2FA6F1891403B71BC5772F8FE452EBD35566B55D00D6E871BD");
  assert.equal(output.inputEventCount, 60);
  assert.equal(output.outputEventCount, 60);
  assert.equal(output.dayCount, 5);
  assert.equal(output.dutyEventCount, 10);
  assert.equal(output.confirmationEventCount, 4);
  assert.equal(output.migrationOk, true);
  assert.equal(output.validationOk, true);
  assert.equal(output.sourceUnchanged, true);
  assert.equal(output.labelsPreserved, true);
  assert.equal(output.typesPreserved, true);
  assert.equal(output.orderPreserved, true);
  assert.equal(output.timesPreserved, true);
  assert.equal(output.idsUnique, true);
  assert.deepEqual(output.errorCodes, []);
});
