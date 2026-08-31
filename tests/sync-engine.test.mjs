import test from "node:test";
import assert from "node:assert/strict";
import { mergeStates } from "../src/storage/sync-engine.js";

function state(overrides = {}) {
  return {
    format: "playbook.state.v1",
    schemaVersion: 1,
    updatedAt: "2026-08-28T12:00:00.000Z",
    plan: null,
    teacherProgress: {},
    experienceRunners: {},
    sharedArtifacts: {},
    checklist: [],
    classes: [],
    lessonGuides: [],
    specialEvents: [],
    resources: [],
    notes: [],
    preferences: {},
    tombstones: [],
    ...overrides
  };
}

function validPlan(label = "Local workshop") {
  return {
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
        1: [{
          id: "event-h00000000000000000000000000000201",
          type: "teach",
          label,
          start: "09:00",
          end: "09:30"
        }]
      }
    }],
    specialEvents: [],
    resources: []
  };
}

test("uses the newer matching entity", () => {
  const result = mergeStates(
    state({ resources: [{ id: "guide", title: "Old", updatedAt: "2026-08-20T10:00:00.000Z" }] }),
    state({ resources: [{ id: "guide", title: "New", updatedAt: "2026-08-21T10:00:00.000Z" }] })
  );

  assert.equal(result.state.resources[0].title, "New");
  assert.deepEqual(result.conflicts, []);
});

test("preserves independently created stable IDs", () => {
  const result = mergeStates(
    state({ checklist: [{ id: "check-local", text: "Tape", updatedAt: "2026-08-20T10:00:00.000Z" }] }),
    state({ checklist: [{ id: "check-remote", text: "Markers", updatedAt: "2026-08-21T10:00:00.000Z" }] })
  );

  assert.deepEqual(result.state.checklist.map((item) => item.id).sort(), ["check-local", "check-remote"]);
});

test("records a conflict for divergent equal-timestamp entities", () => {
  const local = state({ resources: [{ id: "guide", title: "Local", updatedAt: "2026-08-20T10:00:00.000Z" }] });
  const remote = state({ resources: [{ id: "guide", title: "Remote", updatedAt: "2026-08-20T10:00:00.000Z" }] });

  const result = mergeStates(local, remote);

  assert.equal(result.state.resources[0].title, "Local");
  assert.deepEqual(result.conflicts.map((conflict) => [conflict.collection, conflict.id]), [["resources", "guide"]]);
});

test("keeps only the closed teacher preference and selects the remote value", () => {
  const result = mergeStates(
    state({ preferences: { teacherId: "teacher-alpha", unsupportedTheme: "dark" } }),
    state({ preferences: { teacherId: "teacher-beta", unsupportedTheme: "light" } })
  );

  assert.deepEqual(result.state.preferences, { teacherId: "teacher-beta" });
  assert.deepEqual(result.conflicts, []);
});

test("merges each teacher's progress by that teacher's timestamp", () => {
  const local = state({
    teacherProgress: {
      "teacher:kenny": {
        currentProjectNumber: 4,
        completedProjectNumbers: [1, 2, 3],
        updatedAt: "2026-08-28T10:00:00.000Z"
      },
      "teacher:tammy": {
        currentProjectNumber: 7,
        completedProjectNumbers: [1, 2, 3, 4, 5, 6],
        updatedAt: "2026-08-28T12:00:00.000Z"
      }
    }
  });
  const remote = state({
    teacherProgress: {
      "teacher:kenny": {
        currentProjectNumber: 5,
        completedProjectNumbers: [1, 2, 3, 4],
        updatedAt: "2026-08-28T13:00:00.000Z"
      },
      "teacher:tammy": {
        currentProjectNumber: 6,
        completedProjectNumbers: [1, 2, 3, 4, 5],
        updatedAt: "2026-08-28T11:00:00.000Z"
      },
      "teacher:guest": {
        currentProjectNumber: 2,
        completedProjectNumbers: [1],
        updatedAt: "2026-08-28T12:30:00.000Z"
      }
    }
  });

  const result = mergeStates(local, remote);

  assert.deepEqual(result.state.teacherProgress, {
    "teacher:kenny": {
      currentProjectNumber: 5,
      completedProjectNumbers: [1, 2, 3, 4],
      updatedAt: "2026-08-28T13:00:00.000Z",
      complete: false
    },
    "teacher:tammy": {
      currentProjectNumber: 7,
      completedProjectNumbers: [1, 2, 3, 4, 5, 6],
      updatedAt: "2026-08-28T12:00:00.000Z",
      complete: false
    },
    "teacher:guest": {
      currentProjectNumber: 2,
      completedProjectNumbers: [1],
      updatedAt: "2026-08-28T12:30:00.000Z",
      complete: false
    }
  });
  assert.deepEqual(result.conflicts, []);
  assert.equal(local.teacherProgress["teacher:kenny"].currentProjectNumber, 4);
  assert.equal(remote.teacherProgress["teacher:tammy"].currentProjectNumber, 6);
});

test("keeps local teacher progress and records a conflict on equal-timestamp divergence", () => {
  const localProgress = {
    currentProjectNumber: 8,
    completedProjectNumbers: [1, 2, 3, 4, 5, 6, 7],
    updatedAt: "2026-08-28T14:00:00.000Z"
  };
  const remoteProgress = {
    currentProjectNumber: 9,
    completedProjectNumbers: [1, 2, 3, 4, 5, 6, 7, 8],
    updatedAt: "2026-08-28T14:00:00.000Z"
  };

  const result = mergeStates(
    state({ teacherProgress: { "teacher:kenny": localProgress } }),
    state({ teacherProgress: { "teacher:kenny": remoteProgress } })
  );

  assert.deepEqual(result.state.teacherProgress["teacher:kenny"], { ...localProgress, complete: false });
  assert.deepEqual(result.conflicts, [{
    collection: "teacherProgress",
    id: "teacher:kenny",
    reason: "equal-timestamp-divergence",
    local: { ...localProgress, complete: false },
    remote: { ...remoteProgress, complete: false }
  }]);
});

test("does not merge private notes into a classroom-facing state", () => {
  const result = mergeStates(
    state({ classroomFacing: true, notes: [{ id: "welcome", text: "Welcome", visibility: "classroom", updatedAt: "2026-08-20T10:00:00.000Z" }] }),
    state({ notes: [{ id: "private", text: "Call guardian", visibility: "teacher-private", updatedAt: "2026-08-21T10:00:00.000Z" }] })
  );

  assert.deepEqual(result.state.notes.map((note) => note.id), ["welcome"]);
});

test("preserves tombstones while omitting tombstoned live entities", () => {
  const result = mergeStates(
    state({ tombstones: [{ collection: "resources", id: "retired", deletedAt: "2026-08-22T10:00:00.000Z" }] }),
    state({ resources: [{ id: "retired", title: "Old guide", updatedAt: "2026-08-20T10:00:00.000Z" }] })
  );

  assert.deepEqual(result.state.resources, []);
  assert.deepEqual(result.state.tombstones.map((item) => item.id), ["retired"]);
});

test("omits a tombstoned note while preserving its tombstone", () => {
  const result = mergeStates(
    state({ tombstones: [{ collection: "notes", id: "private-note", deletedAt: "2026-08-22T10:00:00.000Z" }] }),
    state({ notes: [{ id: "private-note", text: "Retired", updatedAt: "2026-08-20T10:00:00.000Z" }] })
  );

  assert.deepEqual(result.state.notes, []);
  assert.deepEqual(result.state.tombstones.map((item) => [item.collection, item.id]), [["notes", "private-note"]]);
});

test("records a conflict for divergent admitted teacher plans", () => {
  const result = mergeStates(
    state({ plan: validPlan("Local workshop") }),
    state({ plan: validPlan("Remote workshop") })
  );

  assert.equal(result.state.plan.teachers[0].days["1"][0].label, "Local workshop");
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.conflicts[0].collection, "plan");
});

test("leaves local state unchanged when remote data is unavailable", () => {
  const local = state({ resources: [{ id: "guide", title: "Local", updatedAt: "2026-08-20T10:00:00.000Z" }] });
  const snapshot = structuredClone(local);

  const result = mergeStates(local, null);

  assert.deepEqual(result.state, snapshot);
  assert.notEqual(result.state, local);
  assert.equal(result.conflicts[0].reason, "remote-unavailable");
});

test("dormant sync canonicalizes the complete local-state schema and rejects forbidden families", () => {
  const local = state({
    unsupportedTopLevel: { privatePassthrough: true },
    preferences: { teacherId: "teacher-alpha", unsupportedNested: "drop" },
    notes: [{
      id: "note-safe",
      text: "Safe note",
      visibility: "teacher-private",
      updatedAt: "2026-08-28T12:00:00.000Z",
      unsupportedNested: "drop"
    }]
  });

  const result = mergeStates(local, null);

  assert.equal(Object.hasOwn(result.state, "unsupportedTopLevel"), false);
  assert.deepEqual(result.state.preferences, { teacherId: "teacher-alpha" });
  assert.equal(Object.hasOwn(result.state.notes[0], "unsupportedNested"), false);
  assert.throws(() => mergeStates(state({ studentRoster: ["individual record"] }), null), /invalid|forbidden|state/i);
});
