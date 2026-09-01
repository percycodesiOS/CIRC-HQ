import test from "node:test";
import assert from "node:assert/strict";

import * as firebaseAdapter from "../src/storage/firebase-adapter.js";

const DOMAINS = Object.freeze(["plan", "progress", "preferences", "content"]);
const FIXED_ISO = "2026-09-01T12:00:00.000Z";

function requireClient(options) {
  assert.equal(typeof firebaseAdapter.createFirebaseClient, "function", "createFirebaseClient must be exported");
  return firebaseAdapter.createFirebaseClient(options);
}

function domainValue(domain) {
  if (domain === "plan") return { plan: null };
  if (domain === "progress") return { teacherProgress: {} };
  if (domain === "preferences") return { preferences: {} };
  return {
    checklist: [],
    classes: [],
    lessonGuides: [],
    specialEvents: [],
    resources: [],
    notes: [],
    tombstones: []
  };
}

function timestampDouble(iso = FIXED_ISO) {
  return { toDate: () => new Date(iso) };
}

function envelope(domain, { uid = "teacher-uid", revision = 1, value = domainValue(domain), extra = {} } = {}) {
  return {
    schemaVersion: 1,
    revision,
    updatedAt: timestampDouble(),
    updatedBy: uid,
    ...value,
    ...extra
  };
}

function firebaseDouble({
  uid = "teacher-uid",
  documents = {},
  getError = null,
  transactionError = null
} = {}) {
  const records = new Map(Object.entries(documents));
  const calls = [];
  const writes = [];
  const serverTime = timestampDouble();
  return {
    calls,
    writes,
    get writeCount() {
      return writes.length;
    },
    currentUser: () => uid ? { uid } : null,
    serverTimestamp: () => serverTime,
    async getDocument(path) {
      calls.push({ kind: "get", path });
      if (getError) throw getError;
      return records.get(path) ?? null;
    },
    async runTransaction(callback) {
      calls.push({ kind: "transaction" });
      if (transactionError) throw transactionError;
      const staged = [];
      const result = await callback({
        get: async (path) => records.get(path) ?? null,
        set: (path, value, ...rest) => staged.push({ path, value, rest })
      });
      for (const write of staged) {
        writes.push(write);
        records.set(write.path, write.value);
      }
      return result;
    }
  };
}

test("private paths are UID and domain scoped in declared order", async () => {
  const firebase = firebaseDouble();
  const client = requireClient({
    config: { projectId: "injected-test-project" },
    firebase
  });

  const result = await client.loadPrivateDomains("teacher-uid");

  assert.equal(result.status, "loaded");
  assert.deepEqual(firebase.calls.map((call) => call.path), [
    "playbookTeachers/teacher-uid/private/plan",
    "playbookTeachers/teacher-uid/private/progress",
    "playbookTeachers/teacher-uid/private/preferences",
    "playbookTeachers/teacher-uid/private/content"
  ]);
  assert.deepEqual(result.domains, Object.fromEntries(DOMAINS.map((domain) => [domain, null])));
  assert.deepEqual(result.revisions, Object.fromEntries(DOMAINS.map((domain) => [domain, 0])));
  assert.deepEqual(result.updatedAt, Object.fromEntries(DOMAINS.map((domain) => [domain, null])));
});

test("private loads return payload-only domains and canonical metadata", async () => {
  const documents = Object.fromEntries(DOMAINS.map((domain, index) => [
    `playbookTeachers/teacher-uid/private/${domain}`,
    envelope(domain, { revision: index + 1 })
  ]));
  const firebase = firebaseDouble({ documents });
  const client = requireClient({
    config: { projectId: "injected-test-project" },
    firebase
  });

  const result = await client.loadPrivateDomains("teacher-uid");

  assert.deepEqual(result, {
    status: "loaded",
    domains: Object.fromEntries(DOMAINS.map((domain) => [domain, domainValue(domain)])),
    revisions: { plan: 1, progress: 2, preferences: 3, content: 4 },
    updatedAt: Object.fromEntries(DOMAINS.map((domain) => [domain, FIXED_ISO]))
  });
  assert.equal(JSON.stringify(result).includes("toDate"), false);
});

test("verified save reads the exact replacement revision back", async () => {
  const path = "playbookTeachers/teacher-uid/private/plan";
  const firebase = firebaseDouble({
    documents: { [path]: envelope("plan", { revision: 3 }) }
  });
  const client = requireClient({
    config: { projectId: "injected-test-project" },
    firebase
  });
  const value = domainValue("plan");

  const result = await client.savePrivateDomain("teacher-uid", "plan", value, 3);

  assert.deepEqual(result, { status: "verified", revision: 4, value });
  assert.deepEqual(firebase.calls.map((call) => call.kind), ["transaction", "get"]);
  assert.equal(firebase.writeCount, 1);
  assert.equal(firebase.writes[0].path, path);
  assert.deepEqual(firebase.writes[0].rest, []);
  assert.deepEqual(Object.keys(firebase.writes[0].value).sort(), [
    "plan",
    "revision",
    "schemaVersion",
    "updatedAt",
    "updatedBy"
  ]);
  assert.equal(firebase.writes[0].value.schemaVersion, 1);
  assert.equal(firebase.writes[0].value.updatedBy, "teacher-uid");
});

test("a missing private domain uses revision zero and first writes revision one", async () => {
  const firebase = firebaseDouble();
  const client = requireClient({
    config: { projectId: "injected-test-project" },
    firebase
  });

  const result = await client.savePrivateDomain("teacher-uid", "preferences", domainValue("preferences"), 0);

  assert.equal(result.status, "verified");
  assert.equal(result.revision, 1);
  assert.equal(firebase.writeCount, 1);
});

test("revision mismatch stops without overwrite and returns only admitted remote payload", async () => {
  const path = "playbookTeachers/teacher-uid/private/progress";
  const remote = domainValue("progress");
  const firebase = firebaseDouble({
    documents: { [path]: envelope("progress", { revision: 4, value: remote }) }
  });
  const client = requireClient({
    config: { projectId: "injected-test-project" },
    firebase
  });

  const result = await client.savePrivateDomain("teacher-uid", "progress", domainValue("progress"), 2);

  assert.deepEqual(result, { status: "conflict", revision: 4, value: remote });
  assert.equal(firebase.writeCount, 0);
  assert.deepEqual(firebase.calls.map((call) => call.kind), ["transaction"]);
});

test("UID mismatch, empty identifiers, and path separators perform zero Firebase I/O", async () => {
  const firebase = firebaseDouble();
  const client = requireClient({
    config: { projectId: "injected-test-project" },
    firebase
  });

  const results = await Promise.all([
    client.loadPrivateDomains("other-teacher"),
    client.loadPrivateDomains(""),
    client.loadPrivateDomains("teacher/uid"),
    client.loadPrivateDomains("teacher\\uid"),
    client.savePrivateDomain("teacher-uid", "plan/private", domainValue("plan"), 0),
    client.verifyPrivateDomain("teacher-uid", "", 1)
  ]);

  assert.deepEqual(results.map((result) => result.status), Array(results.length).fill("denied"));
  assert.deepEqual(firebase.calls, []);
  assert.equal(firebase.writeCount, 0);
});

test("malformed envelopes and forbidden private domain fields fail closed", async () => {
  const path = "playbookTeachers/teacher-uid/private/content";
  const firebase = firebaseDouble({
    documents: {
      [path]: envelope("content", { extra: { experienceRunners: {} } })
    }
  });
  const client = requireClient({
    config: { projectId: "injected-test-project" },
    firebase
  });
  const invalidContent = { ...domainValue("content"), sharedArtifacts: {} };

  const loadResult = await client.loadPrivateDomains("teacher-uid");
  const saveResult = await client.savePrivateDomain("teacher-uid", "content", invalidContent, 0);

  assert.equal(loadResult.status, "denied");
  assert.deepEqual(saveResult, { status: "denied", revision: null, value: null });
  assert.equal(firebase.writeCount, 0);
});

test("network and permission failures return safe structured statuses", async () => {
  const networkError = new Error("network credential detail must not escape");
  networkError.code = "firestore/unavailable";
  const permissionError = new Error("permission account detail must not escape");
  permissionError.code = "firestore/permission-denied";
  const offlineClient = requireClient({
    config: { projectId: "injected-test-project" },
    firebase: firebaseDouble({ transactionError: networkError })
  });
  const deniedClient = requireClient({
    config: { projectId: "injected-test-project" },
    firebase: firebaseDouble({ getError: permissionError })
  });

  const offline = await offlineClient.savePrivateDomain("teacher-uid", "plan", domainValue("plan"), 0);
  const denied = await deniedClient.verifyPrivateDomain("teacher-uid", "plan", 1);

  assert.deepEqual(offline, { status: "offline", revision: null, value: null });
  assert.deepEqual(denied, { status: "denied", revision: null, value: null });
  assert.equal(JSON.stringify({ offline, denied }).includes("detail"), false);
});
