import test from "node:test";
import assert from "node:assert/strict";
import {
  SETUP_STEPS,
  advanceSetup,
  createSetupState,
  setupCompletionSummary,
  summarizeTeacherPlan
} from "../src/model/setup-flow.js";

const teacherPlanFixture = {
  format: "playbook.teacherPlan.v2",
  version: 1,
  calendar: {
    anchorDate: "2026-08-20",
    anchorDay: 1,
    lastDate: "2027-06-04",
    noSchool: [],
    conditionalMakeup: [],
    overrides: {}
  },
  teachers: [{
    id: "teacher-alpha",
    name: "Teacher Alpha",
    days: {
      1: [{ id: "event-haaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", type: "teach", label: "Class A", start: "09:00", end: "09:30" }],
      2: [{ id: "event-hbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", type: "prep", label: "Prep", start: "09:00", end: "09:30" }],
      3: [{ id: "event-hcccccccccccccccccccccccccccccccc", type: "lunch", label: "Lunch", start: "12:00", end: "12:30" }],
      4: [{ id: "event-hdddddddddddddddddddddddddddddddd", type: "support", label: "Support", start: "13:00", end: "13:30" }],
      5: [{ id: "event-heeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", type: "duty", label: "Duty", start: "14:00", end: "14:30" }]
    }
  }],
  specialEvents: [],
  resources: []
};

globalThis.teacherPlanFixture = teacherPlanFixture;

test("setup begins with Google sign-in as the single current action", () => {
  const state = createSetupState();
  assert.equal(state.current, "account");
  assert.deepEqual(SETUP_STEPS, ["account", "teacher", "schedule", "sync", "verify", "ready"]);
});

test("setup cannot skip required verification", () => {
  const state = createSetupState({ account: { uid: "teacher-alpha" } });
  assert.throws(() => advanceSetup(state, "ready"), /setup-step-blocked/);
});

test("room is optional and never blocks the teacher setup sequence", () => {
  const state = createSetupState({ account: { uid: "teacher-alpha" } });
  const schedule = advanceSetup(state, "schedule");
  const sync = advanceSetup(schedule, "sync");
  const verify = advanceSetup(sync, "verify");
  const ready = advanceSetup(verify, "ready");

  assert.equal(ready.current, "ready");
  assert.equal(Object.hasOwn(ready, "room"), false);
});

test("teacher plan summary uses teacher-facing facts", () => {
  const summary = summarizeTeacherPlan(globalThis.teacherPlanFixture);
  assert.equal(summary.teacherName, "Teacher Alpha");
  assert.equal(summary.cycleDayCount, 5);
  assert.ok(summary.eventCount > 0);
  assert.match(summary.dateRange, /2026/);
});

test("completion summary reports the final setup state without exposing the plan", () => {
  const state = createSetupState({ account: { uid: "teacher-alpha" } });
  const completed = {
    ...state,
    current: "ready",
    planPreview: { teacherName: "Teacher Alpha" },
    uploadConfirmed: true,
    verification: { status: "verified" }
  };
  const summary = setupCompletionSummary(completed);
  assert.equal(summary.complete, true);
  assert.equal(summary.current, "ready");
  assert.equal(summary.scheduleReady, true);
  assert.equal(summary.privateSyncEnabled, true);
  assert.equal(Object.hasOwn(summary, "roomJoined"), false);
  assert.equal(Object.hasOwn(summary, "plan"), false);
});
