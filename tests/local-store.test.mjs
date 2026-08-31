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

test("save preserves the last known-good backup when prior state is malformed", () => {
  const malformed = '{"format":"playbook.state.v1","resources":[{"href":"javascript:genericProbe=1"}]';
  const lastKnownGood = JSON.stringify({
    format: "playbook.state.v1",
    updatedAt: "last-known-good",
    resources: []
  });
  const storage = memoryStorage({
    [STATE_KEY]: malformed,
    [BACKUP_KEY]: lastKnownGood
  });
  const next = { format: "playbook.state.v1", schemaVersion: 1, updatedAt: NOW };
  const store = makeStore(storage);

  const saved = store.save(next);

  assert.deepEqual(saved, next);
  assert.equal(storage.getItem(BACKUP_KEY), lastKnownGood);
  assert.notEqual(storage.getItem(BACKUP_KEY), malformed);
  assert.deepEqual(JSON.parse(storage.getItem(STATE_KEY)), next);
});

test("backup preserves the last known-good backup when primary state is malformed", () => {
  const malformed = '{"format":"playbook.state.v1","resources":[{"href":"javascript:genericProbe=1"}]';
  const lastKnownGood = JSON.stringify({
    format: "playbook.state.v1",
    updatedAt: "last-known-good",
    resources: []
  });
  const storage = memoryStorage({
    [STATE_KEY]: malformed,
    [BACKUP_KEY]: lastKnownGood
  });
  const store = makeStore(storage);

  const result = store.backup();

  assert.equal(result.state.format, "playbook.state.v1");
  assert.match(result.error, /could not be read/i);
  assert.equal(storage.getItem(BACKUP_KEY), lastKnownGood);
  assert.notEqual(storage.getItem(BACKUP_KEY), malformed);
});

test("backup writes the admitted current state on success", () => {
  const storage = memoryStorage({
    [STATE_KEY]: JSON.stringify({
      format: "playbook.state.v1",
      updatedAt: "current",
      resources: [{
        id: "safe-resource",
        title: "Safe resource",
        href: "mission-control.html"
      }, {
        id: "unsafe-resource",
        title: "Unsafe resource",
        href: "javascript:genericProbe=1"
      }]
    }),
    [BACKUP_KEY]: JSON.stringify({ format: "playbook.state.v1", updatedAt: "older" })
  });
  const store = makeStore(storage);

  const result = store.backup();

  assert.equal(result.error, null);
  assert.deepEqual(result.state.resources.map((resource) => resource.id), ["safe-resource"]);
  assert.deepEqual(JSON.parse(storage.getItem(BACKUP_KEY)), result.state);
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
