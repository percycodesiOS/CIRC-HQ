import test from "node:test";
import assert from "node:assert/strict";
import { createBrowserFirebaseAdapter, createFirebaseAdapter, buildTeacherDocumentPatch } from "../src/storage/firebase-adapter.js";

function state(overrides = {}) {
  return {
    format: "playbook.state.v1",
    schemaVersion: 1,
    updatedAt: "2026-08-28T12:00:00.000Z",
    plan: null,
    teacherProgress: {},
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

function firebaseDouble({ uid = "kenny-uid", remoteState = null, loadError = null, saveError = null } = {}) {
  const calls = [];
  return {
    calls,
    currentUser: () => (uid ? { uid } : null),
    async getDocument(path) {
      calls.push(["get", path]);
      if (loadError) throw loadError;
      return remoteState;
    },
    async setDocument(path, patch, options) {
      calls.push(["set", path, patch, options]);
      if (saveError) throw saveError;
    }
  };
}

test("buildTeacherDocumentPatch protects the private state boundary", () => {
  const privateState = state({ role: "admin", tenantId: "tenant-a", claims: { teacher: true }, credential: "secret", unrecognizedSensitiveField: "exclude me" });

  const patch = buildTeacherDocumentPatch(privateState);

  assert.deepEqual(Object.keys(patch), ["playbookPrivateV1"]);
  assert.equal(patch.playbookPrivateV1.format, "playbook.state.v1");
  assert.deepEqual(patch.playbookPrivateV1.resources, []);
  assert.equal("role" in patch.playbookPrivateV1, false);
  assert.equal("tenantId" in patch.playbookPrivateV1, false);
  assert.equal("claims" in patch.playbookPrivateV1, false);
  assert.equal("credential" in patch.playbookPrivateV1, false);
  assert.equal("unrecognizedSensitiveField" in patch.playbookPrivateV1, false);
});

test("uses the signed-in teacher's exact private document path and merges newer remote state before saving", async () => {
  const remoteState = state({ updatedAt: "2026-08-28T13:00:00.000Z", resources: [{ id: "remote", title: "Remote", updatedAt: "2026-08-28T13:00:00.000Z" }] });
  const firebase = firebaseDouble({ remoteState });
  const adapter = createFirebaseAdapter({ config: { apiKey: "injected-test-value" }, firebase });
  const localState = state({ resources: [{ id: "local", title: "Local", updatedAt: "2026-08-28T12:00:00.000Z" }] });

  const result = await adapter.savePrivateState(localState);

  assert.equal(result.status, "saved");
  assert.deepEqual(result.state.resources.map((item) => item.id), ["local", "remote"]);
  assert.deepEqual(firebase.calls[0], ["get", "playbookTeachers/kenny-uid"]);
  assert.equal(firebase.calls[1][0], "set");
  assert.equal(firebase.calls[1][1], "playbookTeachers/kenny-uid");
  assert.deepEqual(Object.keys(firebase.calls[1][2]), ["playbookPrivateV1"]);
  assert.deepEqual(firebase.calls[1][3], { merge: true });
});

test("rejects saving when no authenticated teacher UID exists", async () => {
  const adapter = createFirebaseAdapter({ config: { apiKey: "injected-test-value" }, firebase: firebaseDouble({ uid: null }) });

  await assert.rejects(adapter.savePrivateState(state()), /authenticated UID/i);
});

test("surfaces cloud read and write failures instead of reporting success", async () => {
  const loadAdapter = createFirebaseAdapter({ config: { apiKey: "injected-test-value" }, firebase: firebaseDouble({ loadError: new Error("offline") }) });
  const saveAdapter = createFirebaseAdapter({ config: { apiKey: "injected-test-value" }, firebase: firebaseDouble({ saveError: new Error("denied") }) });

  assert.deepEqual(await loadAdapter.loadPrivateState(), { status: "load-error", state: null, error: "offline" });
  const result = await saveAdapter.savePrivateState(state());
  assert.equal(result.status, "save-error");
  assert.equal(result.error, "denied");
});

test("keeps local mode usable when Firebase configuration is absent", async () => {
  const adapter = createFirebaseAdapter({});

  assert.equal(adapter.status, "not-configured");
  assert.deepEqual(await adapter.loadPrivateState(), { status: "not-configured", state: null, error: null });
  assert.deepEqual(await adapter.savePrivateState(state()), { status: "not-configured", state: null, error: null });
});

test("guards browser initialization failures with cloud-blocked local-usable behavior", async () => {
  const adapter = await createBrowserFirebaseAdapter({
    config: { apiKey: "injected-test-value" },
    loadDependencies: async () => { throw new Error("module unavailable"); }
  });

  assert.equal(adapter.status, "cloud-blocked");
  assert.deepEqual(await adapter.loadPrivateState(), { status: "cloud-blocked", state: null, error: null });
  assert.deepEqual(await adapter.savePrivateState(state()), { status: "cloud-blocked", state: null, error: null });
});
