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
