import assert from "node:assert/strict";
import test from "node:test";

import { createInitialState } from "../src/model/state.js";
import * as schemaAdmission from "../src/model/schema-admission.js";
import { LocalStore, BACKUP_KEY, STATE_KEY } from "../src/storage/local-store.js";
import * as settings from "../src/ui/settings.js";

const NOW = "2026-08-31T12:00:00.000Z";
const STRICT_EVENT_ID = "event-h00000000000000000000000000000001";

function memoryStorage(entries = {}) {
  const values = new Map(Object.entries(entries));
  return {
    accesses: [],
    getItem(key) {
      this.accesses.push(["get", key]);
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      this.accesses.push(["set", key, String(value)]);
      values.set(key, String(value));
    },
    removeItem(key) {
      this.accesses.push(["remove", key]);
      values.delete(key);
    }
  };
}

function validPlan(eventId = STRICT_EVENT_ID) {
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
          id: eventId,
          type: "teach",
          label: "Workshop",
          start: "09:00",
          end: "09:30"
        }]
      }
    }],
    specialEvents: [],
    resources: []
  };
}

function validState(overrides = {}) {
  return {
    ...createInitialState(NOW),
    plan: validPlan(),
    ...overrides
  };
}

test("unrecoverable ONLY COPY state locks every ordinary mutation and export without a write", () => {
  const onlyCopy = "ONLY COPY: malformed primary must remain byte-for-byte";
  const actions = [
    {
      name: "save",
      run: (store) => assert.throws(() => store.save(validState()), /unrecoverable|restore/i)
    },
    {
      name: "backup",
      run: (store) => assert.throws(() => store.backup(), /unrecoverable|restore/i)
    },
    {
      name: "exportState",
      run: (store) => assert.throws(() => store.exportState(), /unrecoverable|restore/i)
    },
    {
      name: "importPlan",
      run: (store) => assert.deepEqual(store.importPlan(validPlan()), {
        ok: false,
        error: "state-unrecoverable",
        errors: []
      })
    }
  ];

  for (const action of actions) {
    const storage = memoryStorage({ [STATE_KEY]: onlyCopy });
    const store = new LocalStore(storage, { now: () => NOW });
    const loaded = store.load();
    assert.equal(loaded.status, "unrecoverable", action.name);
    assert.match(loaded.error, /no valid local backup/i, action.name);
    const setsBefore = storage.accesses.filter(([kind]) => kind === "set").length;

    action.run(store);

    assert.equal(
      storage.accesses.filter(([kind]) => kind === "set").length,
      setsBefore,
      action.name
    );
    assert.equal(storage.getItem(STATE_KEY), onlyCopy, action.name);
    assert.equal(storage.getItem(BACKUP_KEY), null, action.name);
  }
});

test("explicit restore is the only path that replaces damaged raw state and writes two valid copies", () => {
  const primaryRaw = "ONLY COPY: malformed primary";
  const backupRaw = "DAMAGED BACKUP";
  const storage = memoryStorage({ [STATE_KEY]: primaryRaw, [BACKUP_KEY]: backupRaw });
  const store = new LocalStore(storage, { now: () => NOW });
  assert.equal(typeof store.restoreState, "function");

  const restored = store.restoreState(validState());

  assert.equal(restored.plan.teachers[0].days["1"][0].id, STRICT_EVENT_ID);
  assert.deepEqual(JSON.parse(storage.getItem(STATE_KEY)), restored);
  assert.deepEqual(JSON.parse(storage.getItem(BACKUP_KEY)), restored);
  assert.equal(store.load().status, "primary");
});

test("invalid or forbidden restore candidates leave both damaged raw values untouched", () => {
  for (const candidate of [
    { format: "playbook.state.v1" },
    validState({ studentRoster: [{ name: "individual record" }] }),
    validState({ plan: validPlan("event-person-class") })
  ]) {
    const primaryRaw = "ONLY COPY: malformed primary";
    const backupRaw = "DAMAGED BACKUP";
    const storage = memoryStorage({ [STATE_KEY]: primaryRaw, [BACKUP_KEY]: backupRaw });
    const store = new LocalStore(storage, { now: () => NOW });
    const setsBefore = storage.accesses.filter(([kind]) => kind === "set").length;

    assert.throws(() => store.restoreState(candidate), /invalid|state|event/i);
    assert.equal(storage.accesses.filter(([kind]) => kind === "set").length, setsBefore);
    assert.equal(storage.getItem(STATE_KEY), primaryRaw);
    assert.equal(storage.getItem(BACKUP_KEY), backupRaw);
  }
});

test("settings backup preview is closed, inert until exact confirmation, and restores the same candidate", () => {
  assert.equal(typeof settings.previewSettingsRestore, "function");
  assert.equal(typeof settings.applySettingsRestore, "function");
  const candidate = validState({ unsupportedTopLevel: "drop", preferences: {
    teacherId: "teacher-alpha",
    unsupportedNested: "drop"
  } });
  const calls = [];
  const store = {
    restoreState(value) {
      calls.push(structuredClone(value));
      return structuredClone(value);
    }
  };

  const preview = settings.previewSettingsRestore(JSON.stringify(candidate));

  assert.equal(preview.ok, true);
  assert.equal(calls.length, 0);
  assert.equal(Object.hasOwn(preview.candidate, "unsupportedTopLevel"), false);
  assert.deepEqual(preview.candidate.preferences, { teacherId: "teacher-alpha" });
  assert.equal(settings.applySettingsRestore(store, { id: preview.previewToken.id }).ok, false);
  assert.equal(calls.length, 0);

  const applied = settings.applySettingsRestore(store, preview.previewToken);
  assert.equal(applied.ok, true);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], preview.candidate);
  assert.equal(settings.applySettingsRestore(store, preview.previewToken).ok, false);
  assert.equal(calls.length, 1);
});

test("settings backup parsing rejects forbidden and semantic-ID state instead of returning a clone", () => {
  for (const candidate of [
    validState({ studentRoster: ["individual record"] }),
    validState({ plan: validPlan("event-person-class") }),
    validState({ sharedArtifacts: {
      "tech-terrarium-2026-27": {
        schemaVersion: 1,
        artifactId: "tech-terrarium-2026-27",
        projectNumber: 2,
        stageId: "define",
        contributionIndex: 0,
        status: "active",
        createdAt: NOW,
        updatedAt: NOW,
        visits: [{
          eventId: "event-person-class",
          visitDate: "2026-08-31",
          handoff: "repeat",
          stageId: "define",
          contributionIndex: 0,
          recordedAt: NOW
        }]
      }
    } })
  ]) {
    const parsed = settings.parseSettingsBackup(JSON.stringify(candidate));
    assert.equal(parsed.ok, false);
    assert.equal(parsed.value, null);
  }
});

test("event IDs are exactly 128 random bits rendered as opaque lowercase hex", () => {
  assert.equal(typeof schemaAdmission.generateEventId, "function");
  let invocation = 0;
  const sizes = [];
  const crypto = {
    getRandomValues(bytes) {
      sizes.push(bytes.byteLength);
      bytes.fill(invocation);
      invocation += 1;
      return bytes;
    }
  };

  const first = schemaAdmission.generateEventId(crypto);
  const second = schemaAdmission.generateEventId(crypto);

  assert.equal(first, "event-h00000000000000000000000000000000");
  assert.equal(second, "event-h01010101010101010101010101010101");
  assert.deepEqual(sizes, [16, 16]);
  assert.match(first, /^event-h[0-9a-f]{32}$/);
  assert.notEqual(first, second);
  for (const semantic of [
    "event-person-class",
    "event-math-9am",
    "event-teacher-example-com",
    "event-private-path"
  ]) assert.equal(schemaAdmission.isEventId(semantic), false, semantic);
});
