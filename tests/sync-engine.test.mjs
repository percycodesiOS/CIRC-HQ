import test from "node:test";
import assert from "node:assert/strict";
import { mergeStates } from "../src/storage/sync-engine.js";

function state(overrides = {}) {
  return {
    format: "playbook.state.v1",
    schemaVersion: 1,
    updatedAt: "2026-08-28T12:00:00.000Z",
    plan: null,
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

test("records a conflict for divergent equal-timestamp preferences", () => {
  const result = mergeStates(
    state({ preferences: { theme: { value: "dark", updatedAt: "2026-08-20T10:00:00.000Z" } } }),
    state({ preferences: { theme: { value: "light", updatedAt: "2026-08-20T10:00:00.000Z" } } })
  );

  assert.equal(result.state.preferences.theme.value, "dark");
  assert.deepEqual(
    result.conflicts.map((conflict) => [conflict.collection, conflict.id]),
    [["preferences", "theme"]]
  );
});

test("merges each teacher's progress by that teacher's timestamp", () => {
  const local = state({
    teacherProgress: {
      kenny: {
        currentProjectNumber: 4,
        completedProjectNumbers: [1, 2, 3],
        updatedAt: "2026-08-28T10:00:00.000Z"
      },
      tammy: {
        currentProjectNumber: 7,
        completedProjectNumbers: [1, 2, 3, 4, 5, 6],
        updatedAt: "2026-08-28T12:00:00.000Z"
      }
    }
  });
  const remote = state({
    teacherProgress: {
      kenny: {
        currentProjectNumber: 5,
        completedProjectNumbers: [1, 2, 3, 4],
        updatedAt: "2026-08-28T13:00:00.000Z"
      },
      tammy: {
        currentProjectNumber: 6,
        completedProjectNumbers: [1, 2, 3, 4, 5],
        updatedAt: "2026-08-28T11:00:00.000Z"
      },
      guest: {
        currentProjectNumber: 2,
        completedProjectNumbers: [1],
        updatedAt: "2026-08-28T12:30:00.000Z"
      }
    }
  });

  const result = mergeStates(local, remote);

  assert.deepEqual(result.state.teacherProgress, {
    kenny: {
      currentProjectNumber: 5,
      completedProjectNumbers: [1, 2, 3, 4],
      updatedAt: "2026-08-28T13:00:00.000Z"
    },
    tammy: {
      currentProjectNumber: 7,
      completedProjectNumbers: [1, 2, 3, 4, 5, 6],
      updatedAt: "2026-08-28T12:00:00.000Z"
    },
    guest: {
      currentProjectNumber: 2,
      completedProjectNumbers: [1],
      updatedAt: "2026-08-28T12:30:00.000Z"
    }
  });
  assert.deepEqual(result.conflicts, []);
  assert.equal(local.teacherProgress.kenny.currentProjectNumber, 4);
  assert.equal(remote.teacherProgress.tammy.currentProjectNumber, 6);
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
    state({ teacherProgress: { kenny: localProgress } }),
    state({ teacherProgress: { kenny: remoteProgress } })
  );

  assert.deepEqual(result.state.teacherProgress.kenny, localProgress);
  assert.deepEqual(result.conflicts, [{
    collection: "teacherProgress",
    id: "kenny",
    reason: "equal-timestamp-divergence",
    local: localProgress,
    remote: remoteProgress
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

test("uses plan version before its timestamp and conflicts on divergent equal versions", () => {
  const result = mergeStates(
    state({ plan: { version: 2, title: "Local", updatedAt: "2026-08-20T10:00:00.000Z" } }),
    state({ plan: { version: 2, title: "Remote", updatedAt: "2026-08-21T10:00:00.000Z" } })
  );

  assert.equal(result.state.plan.title, "Remote");
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
