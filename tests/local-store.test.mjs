import test from "node:test";
import assert from "node:assert/strict";
import { LocalStore, BACKUP_KEY, STATE_KEY } from "../src/storage/local-store.js";

const NOW = "2026-08-28T12:00:00.000Z";

function memoryStorage(entries = {}) {
  const values = new Map(Object.entries(entries));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    }
  };
}

function makeStore(storage) {
  return new LocalStore(storage, { now: () => NOW });
}

test("recovers from malformed saved JSON with a visible error", () => {
  const store = makeStore(memoryStorage({ [STATE_KEY]: "{not json" }));

  const result = store.load();

  assert.equal(result.state.format, "playbook.state.v1");
  assert.match(result.error, /could not be read/i);
});

test("saving retains exactly one prior version as backup", () => {
  const storage = memoryStorage({
    [STATE_KEY]: JSON.stringify({ format: "playbook.state.v1", updatedAt: "old" })
  });
  const store = makeStore(storage);
  const next = { format: "playbook.state.v1", schemaVersion: 1, updatedAt: NOW };

  store.save(next);

  assert.deepEqual(JSON.parse(storage.getItem(BACKUP_KEY)), {
    format: "playbook.state.v1",
    updatedAt: "old"
  });
  assert.deepEqual(JSON.parse(storage.getItem(STATE_KEY)), next);
});

test("exports the complete portable state envelope", () => {
  const storage = memoryStorage();
  const store = makeStore(storage);
  store.save({
    format: "playbook.state.v1",
    schemaVersion: 1,
    updatedAt: NOW,
    plan: { format: "playbook.teacherPlan.v2", version: 1 },
    teacherProgress: { today: 2 },
    classes: [{ id: "class-1" }],
    resources: [{ id: "resource-1" }],
    notes: [{ id: "note-1" }],
    preferences: { theme: "dark" }
  });

  const exported = store.exportState();

  assert.deepEqual(Object.keys(exported).sort(), [
    "classes",
    "format",
    "notes",
    "plan",
    "preferences",
    "resources",
    "schemaVersion",
    "teacherProgress",
    "updatedAt"
  ]);
  assert.equal(exported.plan.version, 1);
  assert.equal(exported.teacherProgress.today, 2);
});

test("imports only a valid teacher plan", () => {
  const store = makeStore(memoryStorage());
  const invalid = store.importPlan({ nope: true });

  assert.equal(invalid.ok, false);
  assert.match(invalid.error, /invalid/i);
});
