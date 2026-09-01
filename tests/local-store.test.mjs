import test from "node:test";
import assert from "node:assert/strict";
import {
  TECH_TERRARIUM_ARTIFACT_ID,
  createTechTerrariumArtifact,
  recordArtifactHandoff
} from "../src/model/shared-artifact.js";
import { LocalStore, BACKUP_KEY, DEVICE_KEY, STATE_KEY } from "../src/storage/local-store.js";
import { createInitialState } from "../src/model/state.js";

const NOW = "2026-08-28T12:00:00.000Z";

function memoryStorage(entries = {}) {
  const values = new Map(Object.entries(entries));
  const storage = {
    accesses: [],
    getItem(key) {
      this.accesses.push(["get", key]);
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      this.accesses.push(["set", key]);
      values.set(key, String(value));
    },
    removeItem(key) {
      this.accesses.push(["remove", key]);
      values.delete(key);
    }
  };
  return storage;
}

function makeStore(storage) {
  return new LocalStore(storage, { now: () => NOW });
}

function validState(overrides = {}) {
  return {
    ...createInitialState(NOW),
    ...overrides
  };
}

function validArtifact() {
  return recordArtifactHandoff(createTechTerrariumArtifact({
    artifactId: TECH_TERRARIUM_ARTIFACT_ID,
    nowIso: "2026-08-28T11:00:00.000Z"
  }), {
    handoff: "repeat",
    eventId: "event-h215f038ee95c283cb97e2cc32f036331",
    visitDate: "2026-08-28",
    nowIso: NOW
  });
}

test("uses the isolated CIRC HQ storage namespace", () => {
  const storage = memoryStorage();
  const store = makeStore(storage);

  store.load();
  store.save({ format: "playbook.state.v1", schemaVersion: 1, updatedAt: NOW });

  assert.equal(LocalStore.primaryKey, "circHQ.k6.state.v1");
  assert.equal(LocalStore.backupKey, "circHQ.k6.backup.v1");
  assert.doesNotMatch(JSON.stringify(storage), /circHQ\.playbook\.state\.v1/);
});

test("an empty CIRC HQ namespace never reads old-product storage", () => {
  const storage = memoryStorage({
    "missionControl.teacherPlan.v1": JSON.stringify({ format: "playbook.teacherPlan.v1" }),
    circBuyList: JSON.stringify([{ name: "legacy" }]),
    circNotes: JSON.stringify([{ text: "legacy" }]),
    "circHQ.playbook.state.v1": JSON.stringify({ format: "playbook.state.v1" })
  });
  const store = makeStore(storage);

  const result = store.load();

  assert.deepEqual(storage.accesses, [["get", STATE_KEY]]);
  assert.equal(result.error, null);
  assert.equal(result.state.plan, null);
  assert.deepEqual(result.state.notes, []);
  assert.deepEqual(result.state.resources, []);
});

test("recovers from malformed saved JSON with a visible error", () => {
  const store = makeStore(memoryStorage({ [STATE_KEY]: "{not json" }));

  const result = store.load();

  assert.equal(result.state.format, "playbook.state.v1");
  assert.match(result.error, /could not be read/i);
});

test("saving retains exactly one prior version as backup", () => {
  const prior = validState({ updatedAt: "2026-08-28T11:00:00.000Z" });
  const storage = memoryStorage({
    [STATE_KEY]: JSON.stringify(prior)
  });
  const store = makeStore(storage);
  const next = validState();

  store.save(next);

  assert.deepEqual(JSON.parse(storage.getItem(BACKUP_KEY)), prior);
  assert.deepEqual(JSON.parse(storage.getItem(STATE_KEY)), next);
});

test("save preserves the last known-good backup when prior state is malformed", () => {
  const malformed = '{"format":"playbook.state.v1","resources":[{"href":"javascript:genericProbe=1"}]';
  const lastKnownGood = JSON.stringify(validState({
    updatedAt: "2026-08-28T11:00:00.000Z"
  }));
  const storage = memoryStorage({
    [STATE_KEY]: malformed,
    [BACKUP_KEY]: lastKnownGood
  });
  const next = validState();
  const store = makeStore(storage);

  const saved = store.save(next);

  assert.deepEqual(saved, next);
  assert.equal(storage.getItem(BACKUP_KEY), lastKnownGood);
  assert.notEqual(storage.getItem(BACKUP_KEY), malformed);
  assert.deepEqual(JSON.parse(storage.getItem(STATE_KEY)), next);
});

test("backup preserves the last known-good backup when primary state is malformed", () => {
  const malformed = '{"format":"playbook.state.v1","resources":[{"href":"javascript:genericProbe=1"}]';
  const lastKnownGood = JSON.stringify(validState({
    updatedAt: "2026-08-28T11:00:00.000Z"
  }));
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
    [STATE_KEY]: JSON.stringify(validState({
      resources: [{
        id: "safe-resource",
        title: "Safe resource",
        href: "mission-control.html"
      }, {
        id: "unsafe-resource",
        title: "Unsafe resource",
        href: "javascript:genericProbe=1"
      }]
    })),
    [BACKUP_KEY]: JSON.stringify(validState({
      updatedAt: "2026-08-28T11:00:00.000Z"
    }))
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
  store.save(validState({
    teacherProgress: {
      "local:default": {
        currentProjectNumber: 2,
        completedProjectNumbers: [1],
        complete: false,
        updatedAt: NOW
      }
    },
    classes: [{
      id: "class-1",
      title: "Class one",
      visibility: "teacher-private",
      reviewedForBoard: false,
      updatedAt: NOW
    }],
    resources: [{ id: "resource-1", title: "Resource one" }],
    notes: [{
      id: "note-1",
      text: "Note one",
      visibility: "teacher-private",
      updatedAt: NOW
    }],
    preferences: { teacherId: "teacher-one" }
  }));

  const exported = store.exportState();

  assert.deepEqual(Object.keys(exported).sort(), [
    "checklist",
    "classes",
    "experienceRunners",
    "format",
    "lessonGuides",
    "notes",
    "plan",
    "preferences",
    "resources",
    "schemaVersion",
    "sharedArtifacts",
    "specialEvents",
    "teacherProgress",
    "tombstones",
    "updatedAt"
  ]);
  assert.equal(exported.plan, null);
  assert.equal(exported.teacherProgress["local:default"].currentProjectNumber, 2);
  assert.equal(exported.preferences.teacherId, "teacher-one");
});

test("imports only a valid teacher plan", () => {
  const store = makeStore(memoryStorage());
  const invalid = store.importPlan({ nope: true });

  assert.equal(invalid.ok, false);
  assert.match(invalid.error, /invalid/i);
});

test("invalid primary recovers a detached admitted backup without writes or old-product reads", () => {
  const backup = validState({
    notes: [{
      id: "note-recovered",
      text: "Recovered content",
      visibility: "teacher-private",
      updatedAt: NOW
    }]
  });
  const primaryRaw = "{not json";
  const backupRaw = JSON.stringify(backup);
  const storage = memoryStorage({
    [STATE_KEY]: primaryRaw,
    [BACKUP_KEY]: backupRaw,
    "missionControl.teacherPlan.v1": "OLD_PRODUCT_SENTINEL",
    circBuyList: "OLD_PRODUCT_SENTINEL",
    circNotes: "OLD_PRODUCT_SENTINEL"
  });
  const store = makeStore(storage);

  const result = store.load();

  assert.equal(result.status, "recovered-backup");
  assert.match(result.error, /recovered.*backup/i);
  assert.deepEqual(result.state, backup);
  assert.notEqual(result.state, backup);
  result.state.notes[0].text = "Detached mutation";
  assert.equal(JSON.parse(backupRaw).notes[0].text, "Recovered content");
  assert.deepEqual(storage.accesses, [
    ["get", STATE_KEY],
    ["get", BACKUP_KEY]
  ]);
  assert.equal(storage.getItem(STATE_KEY), primaryRaw);
  assert.equal(storage.getItem(BACKUP_KEY), backupRaw);
});

test("invalid primary and invalid or missing backup fail closed without destroying raw values", () => {
  for (const backupRaw of ["{also broken", null]) {
    const primaryRaw = "{broken primary";
    const entries = { [STATE_KEY]: primaryRaw };
    if (backupRaw !== null) entries[BACKUP_KEY] = backupRaw;
    const storage = memoryStorage(entries);
    const store = makeStore(storage);

    const result = store.load();

    assert.equal(result.status, "unrecoverable");
    assert.match(result.error, /could not be read/i);
    assert.deepEqual(result.state, createInitialState(NOW));
    assert.equal(storage.accesses.filter(([action]) => action === "set").length, 0);
    assert.equal(storage.getItem(STATE_KEY), primaryRaw);
    assert.equal(storage.getItem(BACKUP_KEY), backupRaw);
  }
});

test("export and the first two saves after recovery never lose the recovered good state", () => {
  const recovered = validState({
    notes: [{
      id: "note-good",
      text: "Last known good",
      visibility: "teacher-private",
      updatedAt: NOW
    }]
  });
  const storage = memoryStorage({
    [STATE_KEY]: "{bad primary",
    [BACKUP_KEY]: JSON.stringify(recovered)
  });
  const store = makeStore(storage);

  const exported = store.exportState();
  assert.deepEqual(exported, recovered);
  assert.notEqual(exported, recovered);

  const first = store.save({ ...exported, updatedAt: "2026-08-28T12:01:00.000Z" });
  assert.equal(first.notes[0].text, "Last known good");
  assert.equal(JSON.parse(storage.getItem(BACKUP_KEY)).notes[0].text, "Last known good");
  assert.equal(JSON.parse(storage.getItem(STATE_KEY)).notes[0].text, "Last known good");

  const second = store.save({ ...first, updatedAt: "2026-08-28T12:02:00.000Z" });
  assert.equal(second.notes[0].text, "Last known good");
  assert.equal(JSON.parse(storage.getItem(BACKUP_KEY)).notes[0].text, "Last known good");
  assert.equal(JSON.parse(storage.getItem(STATE_KEY)).notes[0].text, "Last known good");
});

test("local persistence rebuilds known schemas, drops ordinary extras, and rejects forbidden person data", () => {
  const source = validState({
    unsupportedTopLevel: { shouldNotSurvive: true },
    preferences: { theme: "dark", nestedExtra: { shouldNotSurvive: true } },
    notes: [{
      id: "note-safe",
      text: "Safe note",
      visibility: "teacher-private",
      updatedAt: NOW,
      unsupportedNested: "DROP_ME"
    }]
  });
  const storage = memoryStorage();
  const store = makeStore(storage);

  const saved = store.save(source);
  const loaded = store.load().state;
  const exported = store.exportState();
  const backup = store.backup().state;

  for (const admitted of [saved, loaded, exported, backup]) {
    assert.equal(Object.hasOwn(admitted, "unsupportedTopLevel"), false);
    assert.equal(Object.hasOwn(admitted.preferences, "nestedExtra"), false);
    assert.equal(Object.hasOwn(admitted.notes[0], "unsupportedNested"), false);
    assert.equal(JSON.stringify(admitted).includes("DROP_ME"), false);
  }

  const forbidden = validState({ studentRoster: ["individual record"] });
  assert.throws(() => store.save(forbidden), /forbidden|state/i);
});

test("forbidden primary fields recover the clean backup and prototype-shaped extras cannot survive", () => {
  const backup = validState();
  const primary = validState({
    notes: [{
      id: "note-private",
      text: "Unsafe",
      visibility: "teacher-private",
      updatedAt: NOW,
      studentRecords: [{ name: "individual" }]
    }]
  });
  const storage = memoryStorage({
    [STATE_KEY]: JSON.stringify(primary),
    [BACKUP_KEY]: JSON.stringify(backup)
  });

  const recovered = makeStore(storage).load();

  assert.equal(recovered.status, "recovered-backup");
  assert.deepEqual(recovered.state, backup);

  const prototypeProbe = JSON.parse(JSON.stringify(validState()));
  prototypeProbe.preferences = JSON.parse('{"theme":"dark","__proto__":{"polluted":true}}');
  const saved = makeStore(memoryStorage()).save(prototypeProbe);
  assert.equal(Object.getPrototypeOf(saved), Object.prototype);
  assert.equal(Object.getPrototypeOf(saved.preferences), Object.prototype);
  assert.equal(Object.hasOwn(saved.preferences, "__proto__"), false);
  assert.equal({}.polluted, undefined);
});

test("round-trips one valid shared artifact as a detached clone without unrelated state", () => {
  const storage = memoryStorage();
  const store = makeStore(storage);
  const artifact = validArtifact();
  const source = {
    format: "playbook.state.v1",
    schemaVersion: 1,
    updatedAt: NOW,
    sharedArtifacts: { [TECH_TERRARIUM_ARTIFACT_ID]: artifact },
    unrelatedState: { preserved: true }
  };

  const saved = store.save(source);
  const loaded = store.load().state;

  assert.deepEqual(saved.sharedArtifacts, source.sharedArtifacts);
  assert.deepEqual(loaded.sharedArtifacts, source.sharedArtifacts);
  assert.equal(Object.hasOwn(loaded, "unrelatedState"), false);
  assert.notEqual(saved.sharedArtifacts, source.sharedArtifacts);
  assert.notEqual(loaded.sharedArtifacts, saved.sharedArtifacts);
  loaded.sharedArtifacts[TECH_TERRARIUM_ARTIFACT_ID].visits[0].eventId = "changed";
  assert.equal(saved.sharedArtifacts[TECH_TERRARIUM_ARTIFACT_ID].visits[0].eventId, "event-h215f038ee95c283cb97e2cc32f036331");
});

test("drops invalid shared-artifact siblings without resetting valid state or writing during load", () => {
  const artifact = validArtifact();
  const storage = memoryStorage({
    [STATE_KEY]: JSON.stringify({
      format: "playbook.state.v1",
      schemaVersion: 1,
      updatedAt: NOW,
      sharedArtifacts: {
        [TECH_TERRARIUM_ARTIFACT_ID]: artifact,
        "unknown-artifact": { ...artifact, artifactId: "unknown-artifact" }
      },
      unrelatedState: { preserved: true }
    })
  });
  const store = makeStore(storage);

  const result = store.load();

  assert.equal(result.error, null);
  assert.deepEqual(Object.keys(result.state.sharedArtifacts), [TECH_TERRARIUM_ARTIFACT_ID]);
  assert.equal(Object.hasOwn(result.state, "unrelatedState"), false);
  assert.equal(storage.accesses.filter(([action]) => action === "set").length, 0);
});

test("backup and save never retain an invalid shared artifact from the prior primary state", () => {
  const artifact = validArtifact();
  const storage = memoryStorage({
    [STATE_KEY]: JSON.stringify(validState({
      updatedAt: "2026-08-28T11:30:00.000Z",
      sharedArtifacts: {
        [TECH_TERRARIUM_ARTIFACT_ID]: artifact,
        injected: { ...artifact, teacherId: "private-teacher" }
      }
    }))
  });
  const store = makeStore(storage);

  store.save({
    format: "playbook.state.v1",
    schemaVersion: 1,
    updatedAt: NOW,
    sharedArtifacts: { [TECH_TERRARIUM_ARTIFACT_ID]: artifact }
  });

  const backup = JSON.parse(storage.getItem(BACKUP_KEY));
  assert.deepEqual(Object.keys(backup.sharedArtifacts), [TECH_TERRARIUM_ARTIFACT_ID]);
  assert.equal(JSON.stringify(backup).includes("private-teacher"), false);
});

function validDeviceMetadata(overrides = {}) {
  return {
    schemaVersion: 1,
    accountUid: "teacher-uid",
    teacherConfirmed: true,
    planConfirmed: true,
    uploadAuthorized: true,
    pendingDomains: ["progress", "sharedArtifact"],
    conflictDomains: ["plan"],
    lastVerifiedAt: NOW,
    lastVerifiedRevisions: {
      plan: 4,
      progress: 2,
      preferences: 1,
      content: 3,
      sharedArtifact: 7
    },
    tenantId: "tenant-safe",
    roomId: "room-safe",
    pendingSharedHandoff: {
      artifactId: TECH_TERRARIUM_ARTIFACT_ID,
      expectedRevision: 7,
      handoff: "repeat",
      eventId: "event-h215f038ee95c283cb97e2cc32f036331",
      visitDate: "2026-08-28",
      nowIso: NOW
    },
    ...overrides
  };
}

test("device metadata round-trips only the exact admitted non-secret schema", () => {
  const storage = memoryStorage();
  const store = makeStore(storage);
  const source = validDeviceMetadata();

  const saved = store.saveDeviceMetadata(source);
  const loaded = store.loadDeviceMetadata();

  assert.deepEqual(saved, source);
  assert.deepEqual(loaded, source);
  assert.notEqual(saved, source);
  assert.notEqual(loaded, saved);
  assert.deepEqual(JSON.parse(storage.getItem(DEVICE_KEY)), source);
  assert.doesNotMatch(JSON.stringify(loaded), /accessToken|refreshToken|experienceRunners|inviteCode/);
});

test("malformed device metadata fails closed without overwriting its raw value", () => {
  const cases = [
    { ...validDeviceMetadata(), accessToken: "forbidden" },
    { ...validDeviceMetadata(), pendingDomains: ["plan", "plan"] },
    { ...validDeviceMetadata(), pendingDomains: ["content", "plan"] },
    { ...validDeviceMetadata(), tenantId: "tenant/unsafe" },
    { ...validDeviceMetadata(), roomId: null },
    { ...validDeviceMetadata(), lastVerifiedAt: "2026-08-28T12:00:00Z" },
    { ...validDeviceMetadata(), pendingSharedHandoff: { ...validDeviceMetadata().pendingSharedHandoff, eventId: "class-a" } },
    { ...validDeviceMetadata(), experienceRunners: {} }
  ];

  for (const candidate of cases) {
    const raw = JSON.stringify(candidate);
    const storage = memoryStorage({ [DEVICE_KEY]: raw });
    const loaded = makeStore(storage).loadDeviceMetadata();

    assert.deepEqual(loaded, {
      schemaVersion: 1,
      accountUid: null,
      teacherConfirmed: false,
      planConfirmed: false,
      uploadAuthorized: false,
      pendingDomains: [],
      conflictDomains: [],
      lastVerifiedAt: null,
      lastVerifiedRevisions: {
        plan: 0,
        progress: 0,
        preferences: 0,
        content: 0,
        sharedArtifact: 0
      },
      tenantId: null,
      roomId: null,
      pendingSharedHandoff: null
    });
    assert.equal(storage.getItem(DEVICE_KEY), raw);
  }
});

test("clearing cloud identity preserves local state backup and ordered private pending domains", () => {
  const primary = validState();
  const backup = validState({ updatedAt: "2026-08-28T11:00:00.000Z" });
  const storage = memoryStorage({
    [STATE_KEY]: JSON.stringify(primary),
    [BACKUP_KEY]: JSON.stringify(backup),
    [DEVICE_KEY]: JSON.stringify(validDeviceMetadata({
      pendingDomains: ["plan", "progress", "sharedArtifact"]
    }))
  });
  const store = makeStore(storage);

  const cleared = store.clearCloudIdentityMetadata({ preservePending: true });

  assert.equal(cleared.accountUid, null);
  assert.equal(cleared.teacherConfirmed, false);
  assert.equal(cleared.uploadAuthorized, false);
  assert.deepEqual(cleared.pendingDomains, ["plan", "progress"]);
  assert.equal(cleared.pendingSharedHandoff, null);
  assert.equal(storage.getItem(STATE_KEY), JSON.stringify(primary));
  assert.equal(storage.getItem(BACKUP_KEY), JSON.stringify(backup));
});
