import assert from "node:assert/strict";
import test from "node:test";

import { createInitialState } from "../src/model/state.js";
import {
  TECH_TERRARIUM_ARTIFACT_ID,
  createTechTerrariumArtifact,
  recordArtifactHandoff
} from "../src/model/shared-artifact.js";
import { partitionPrivateDomains } from "../src/storage/cloud-domains.js";
import { DEVICE_KEY, LocalStore } from "../src/storage/local-store.js";

const runtimeModule = await import("../src/runtime/cloud-runtime.js").catch(() => ({}));

const NOW = "2026-09-01T13:00:00.000Z";
const EVENT_ID = "event-h0123456789abcdef0123456789abcdef";
const SECOND_EVENT_ID = "event-hfedcba9876543210fedcba9876543210";
const VALID_INVITE_CODE = "ABCDEFGHJ-KMNPQRSTV-WXYZ23456";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function requireRuntimeFactory() {
  assert.equal(typeof runtimeModule.createCloudRuntimeController, "function", "createCloudRuntimeController must be exported");
  return runtimeModule.createCloudRuntimeController;
}

function planFixture(name = "Teacher Example") {
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
      id: "teacher-example",
      name,
      days: {
        1: [{
          id: EVENT_ID,
          type: "teach",
          label: "Example class",
          start: "09:00",
          end: "09:30"
        }]
      }
    }],
    specialEvents: [],
    resources: []
  };
}

function stateFixture({ plan = null } = {}) {
  const state = createInitialState(NOW);
  state.plan = plan;
  return state;
}

function memoryStorage(entries = {}) {
  const values = new Map(Object.entries(entries));
  return {
    values,
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

function serializedStorage(storage) {
  return JSON.stringify([...storage.values.entries()]);
}

function emptyRemote() {
  return {
    status: "loaded",
    domains: { plan: null, progress: null, preferences: null, content: null },
    revisions: { plan: 0, progress: 0, preferences: 0, content: 0 },
    updatedAt: { plan: null, progress: null, preferences: null, content: null }
  };
}

function completeRemote(state, revision = 2) {
  return {
    status: "loaded",
    domains: partitionPrivateDomains(state),
    revisions: { plan: revision, progress: revision, preferences: revision, content: revision },
    updatedAt: {
      plan: NOW,
      progress: NOW,
      preferences: NOW,
      content: NOW
    }
  };
}

function fakeCloudClient(options = {}) {
  let authListener = null;
  const calls = [];
  const artifact = createTechTerrariumArtifact({
    artifactId: TECH_TERRARIUM_ARTIFACT_ID,
    nowIso: NOW
  });
  const projectProgress = {
    projectNumber: 2,
    stageId: "define",
    contributionIndex: 0,
    status: "active",
    updatedAt: NOW
  };
  let privateRemote = options.privateRemote ?? emptyRemote();
  let roomMembership = options.roomMembership ?? { status: "not-member", membership: null, room: null };
  let sharedResult = options.sharedResult ?? {
    status: "loaded",
    revision: 1,
    value: artifact,
    projectProgress
  };
  return {
    status: options.status ?? "ready",
    calls,
    emitAuth(user) {
      authListener?.(user);
    },
    setPrivateRemote(value) {
      privateRemote = value;
    },
    setRoomMembership(value) {
      roomMembership = value;
    },
    setSharedResult(value) {
      sharedResult = value;
    },
    observeAuth(listener) {
      calls.push({ kind: "observe" });
      authListener = listener;
      return () => calls.push({ kind: "unsubscribe" });
    },
    signInWithGoogle() {
      calls.push({ kind: "popup" });
      const result = typeof options.popupResult === "function"
        ? options.popupResult()
        : options.popupResult ?? { status: "pending" };
      return Promise.resolve(result);
    },
    signOut() {
      calls.push({ kind: "sign-out" });
      return Promise.resolve({ status: "signed-out" });
    },
    async loadPrivateDomains(uid) {
      calls.push({ kind: "load-private", uid });
      if (typeof options.loadPrivateDomains === "function") {
        return structuredClone(await options.loadPrivateDomains(uid));
      }
      return structuredClone(privateRemote);
    },
    async savePrivateDomain(uid, domain, value, expectedRevision) {
      calls.push({ kind: "save-private", uid, domain, value: structuredClone(value), expectedRevision });
      if (typeof options.savePrivateDomain === "function") {
        return structuredClone(await options.savePrivateDomain({
          uid,
          domain,
          value: structuredClone(value),
          expectedRevision,
          calls: structuredClone(calls)
        }));
      }
      const configured = options.saveResults?.[domain];
      if (configured) return structuredClone(configured);
      return {
        status: "verified",
        revision: expectedRevision + 1,
        value: structuredClone(value)
      };
    },
    async verifyPrivateDomain(uid, domain, expectedRevision) {
      calls.push({ kind: "verify-private", uid, domain, expectedRevision });
      if (typeof options.verifyPrivateDomain === "function") {
        return structuredClone(await options.verifyPrivateDomain({
          uid,
          domain,
          expectedRevision,
          calls: structuredClone(calls)
        }));
      }
      return {
        status: "verified",
        revision: expectedRevision,
        value: structuredClone(privateRemote.domains?.[domain])
      };
    },
    async createTenantRoom(input) {
      calls.push({ kind: "create-room", input: structuredClone(input) });
      const defaultResult = {
        status: "created",
        tenantId: "tenant-safe",
        roomId: "room-safe",
        membership: {
          uid: "teacher-uid",
          tenantId: "tenant-safe",
          roomId: "room-safe",
          role: "owner",
          trusted: true
        },
        inviteCode: VALID_INVITE_CODE,
        revision: 1,
        artifact: structuredClone(artifact),
        projectProgress: structuredClone(projectProgress)
      };
      const configured = typeof options.createRoomResult === "function"
        ? await options.createRoomResult(structuredClone(defaultResult))
        : options.createRoomResult;
      const result = configured ?? defaultResult;
      roomMembership = {
        status: "member",
        membership: structuredClone(result.membership),
        room: { tenantId: "tenant-safe", roomId: "room-safe", name: "Shared CIRC Room" }
      };
      return structuredClone(result);
    },
    async loadRoomMembership(uid) {
      calls.push({ kind: "load-room", uid });
      return structuredClone(roomMembership);
    },
    async loadSharedArtifact(input) {
      calls.push({ kind: "load-shared", input: structuredClone(input) });
      if (typeof options.loadSharedArtifact === "function") {
        return structuredClone(await options.loadSharedArtifact(structuredClone(input)));
      }
      return structuredClone(sharedResult);
    },
    async redeemRoomInvite(code) {
      calls.push({ kind: "redeem", code });
      const result = structuredClone(options.redeemResult ?? { status: "denied", membership: null });
      if (result.status === "joined" && options.redeemRoomMembership) {
        roomMembership = structuredClone(options.redeemRoomMembership);
      }
      return result;
    },
    async saveSharedArtifact(input) {
      calls.push({ kind: "save-shared", input: structuredClone(input) });
      const configured = typeof options.saveSharedArtifact === "function"
        ? await options.saveSharedArtifact(structuredClone(input))
        : options.sharedSaveResult;
      return structuredClone(configured ?? {
        status: "verified",
        revision: input.expectedRevision + 1,
        value: artifact,
        projectProgress
      });
    }
  };
}

function harness({
  initialState = stateFixture(),
  cloud = fakeCloudClient(),
  readFileText = async (file) => file.text
} = {}) {
  const storage = memoryStorage();
  const store = new LocalStore(storage, { now: () => NOW });
  let state = store.save(initialState);
  const invalidations = [];
  const routes = [];
  const routeActions = Object.fromEntries([
    "openSchedule",
    "openToday",
    "previewExperience",
    "openSetupHelp",
    "enterDemo",
    "exitDemo",
    "returnToSetup",
    "replaceTeacherPlan",
    "exportLocalBackup"
  ].map((name) => [name, () => routes.push(name)]));
  const controller = requireRuntimeFactory()({
    store,
    clock: { now: () => new Date(NOW) },
    readFileText,
    migrationOptions: null,
    getState: () => state,
    acceptPersistedState: (next) => {
      state = structuredClone(next);
    },
    persistAndAcceptState: (next) => {
      state = store.save(next);
    },
    invalidate: () => invalidations.push(controller.getSetupModel()),
    routes: routeActions
  });
  controller.connect(cloud);
  return {
    controller,
    cloud,
    store,
    storage,
    get state() {
      return state;
    },
    invalidations,
    routes,
    commitState(nextState) {
      state = store.save(nextState);
      return structuredClone(state);
    }
  };
}

function memberRoom(role = "teacher") {
  return {
    status: "member",
    membership: {
      uid: "teacher-uid",
      tenantId: "tenant-safe",
      roomId: "room-safe",
      role,
      trusted: true
    },
    room: { tenantId: "tenant-safe", roomId: "room-safe", name: "Shared CIRC Room" }
  };
}

function artifactProgress(artifact) {
  return {
    projectNumber: artifact.projectNumber,
    stageId: artifact.stageId,
    contributionIndex: artifact.contributionIndex,
    status: artifact.status,
    updatedAt: artifact.updatedAt
  };
}

function authorizeDevice(app, overrides = {}) {
  return app.store.saveDeviceMetadata({
    ...app.store.loadDeviceMetadata(),
    accountUid: "teacher-uid",
    teacherConfirmed: true,
    planConfirmed: true,
    uploadAuthorized: true,
    lastVerifiedRevisions: {
      plan: 2,
      progress: 2,
      preferences: 2,
      content: 2,
      sharedArtifact: 1
    },
    ...overrides
  });
}

async function settle() {
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
}

test("popup starts synchronously and only the auth observer advances account setup", async () => {
  const app = harness();
  const actions = app.controller.getSetupActions();

  const pending = actions.continueWithGoogle();

  assert.equal(app.cloud.calls.filter(({ kind }) => kind === "popup").length, 1);
  assert.equal(app.controller.getSetupModel().current, "account");
  assert.equal(app.controller.getSetupModel().account.status, "pending");
  await pending;
  assert.equal(app.controller.getSetupModel().current, "account");

  app.cloud.emitAuth({ uid: "teacher-uid", displayName: "Teacher Example", email: "teacher@example.invalid" });

  assert.equal(app.controller.getSetupModel().current, "teacher");
  assert.deepEqual(app.controller.getSetupModel().account, {
    status: "observed",
    displayName: "Teacher Example",
    maskedEmail: "t*****r@example.invalid"
  });
  assert.doesNotMatch(JSON.stringify(app.controller.getSetupModel()), /teacher-uid/);
});

test("file preview and confirmation stay local until the explicit upload gate", async () => {
  const app = harness();
  const actions = app.controller.getSetupActions();
  app.cloud.emitAuth({ uid: "teacher-uid", displayName: "Teacher Example", email: "teacher@example.invalid" });
  await actions.useAccount();

  await actions.choosePlanFile({ text: JSON.stringify(planFixture()) });
  assert.equal(app.controller.getSetupModel().plan.status, "preview");
  assert.equal(app.cloud.calls.some(({ kind }) => kind === "save-private"), false);

  await actions.confirmPlanPreview();

  assert.equal(app.state.plan.teachers[0].name, "Teacher Example");
  assert.equal(app.controller.getSetupModel().current, "sync");
  assert.equal(app.cloud.calls.some(({ kind }) => kind === "save-private"), false);
});

test("roomless explicit upload backs up and verifies all private domains without shared access", async () => {
  const app = harness({
    initialState: stateFixture({ plan: planFixture() }),
    cloud: fakeCloudClient({
      roomMembership: { status: "not-member", membership: null, room: null }
    })
  });
  const actions = app.controller.getSetupActions();
  app.cloud.emitAuth({ uid: "teacher-uid", displayName: "Teacher Example", email: "teacher@example.invalid" });
  await actions.useAccount();
  await actions.confirmPlanPreview();

  assert.equal(app.controller.getSetupModel().current, "sync");
  assert.deepEqual(app.controller.getSetupModel().completed, ["account", "teacher", "schedule"]);
  assert.deepEqual(await actions.uploadAndVerify(), { status: "verified" });
  assert.deepEqual(app.cloud.calls.filter(({ kind }) => kind === "save-private").map(({ domain }) => domain), [
    "plan", "progress", "preferences", "content"
  ]);
  assert.deepEqual(app.store.loadDeviceMetadata().lastVerifiedRevisions, {
    plan: 1,
    progress: 1,
    preferences: 1,
    content: 1,
    sharedArtifact: 0
  });
  assert.equal(app.store.loadDeviceMetadata().uploadAuthorized, true);
  assert.equal(app.store.loadDeviceMetadata().lastVerifiedAt, NOW);
  assert.ok(app.storage.getItem("circHQ.k6.backup.v1"));
  assert.equal(app.cloud.calls.some(({ kind }) => kind === "load-shared"), false);
  assert.equal(app.cloud.calls.some(({ kind }) => kind === "save-shared"), false);
  app.controller.destroy();
});

test("Schedule opens through the runtime without touching storage or cloud", () => {
  const app = harness();
  const beforeStorage = [...app.storage.values.entries()];
  const beforeCloudCalls = app.cloud.calls.length;

  app.controller.getSetupActions().openSchedule();

  assert.equal(app.routes.at(-1), "openSchedule");
  assert.deepEqual([...app.storage.values.entries()], beforeStorage);
  assert.equal(app.cloud.calls.length, beforeCloudCalls);
  app.controller.destroy();
});

test("an editor-built local plan returns to confirmation without a file import", async () => {
  const app = harness();
  const actions = app.controller.getSetupActions();
  app.cloud.emitAuth({ uid: "teacher-uid", displayName: "Teacher Example", email: "teacher@example.invalid" });
  await actions.useAccount();

  const editedState = stateFixture({ plan: planFixture("Editor Teacher") });
  app.commitState(editedState);
  assert.deepEqual(
    await app.controller.afterLocalCommit({ domains: ["plan"], state: app.state }),
    { status: "pending" }
  );

  const previewModel = app.controller.getSetupModel();
  assert.equal(previewModel.current, "schedule");
  assert.equal(previewModel.plan.status, "preview");
  assert.equal(previewModel.plan.teacherName, "Editor Teacher");
  assert.equal(app.cloud.calls.some(({ kind }) => kind === "save-private"), false);

  assert.deepEqual(await actions.confirmPlanPreview(), { status: "confirmed" });
  assert.equal(app.controller.getSetupModel().current, "sync");
  assert.equal(app.store.loadDeviceMetadata().planConfirmed, true);
  app.controller.destroy();
});

test("explicit upload backs up locally and verifies four private domains in fixed order", async () => {
  const app = harness();
  const actions = app.controller.getSetupActions();
  app.cloud.emitAuth({ uid: "teacher-uid", displayName: "Teacher Example", email: "teacher@example.invalid" });
  await actions.useAccount();
  await actions.choosePlanFile({ text: JSON.stringify(planFixture()) });
  await actions.confirmPlanPreview();
  const invitation = await actions.createRoom();

  assert.deepEqual(invitation, { inviteCode: VALID_INVITE_CODE });
  assert.equal(app.controller.getSetupModel().current, "sync");
  assert.equal(app.controller.getSetupModel().room.inviteCode, invitation.inviteCode);
  assert.equal(serializedStorage(app.storage).includes(invitation.inviteCode), false);
  assert.equal(serializedStorage(app.storage).includes(invitation.inviteCode.replaceAll("-", "")), false);
  assert.doesNotMatch(JSON.stringify(app.store.loadDeviceMetadata()), new RegExp(invitation.inviteCode));
  assert.doesNotMatch(JSON.stringify(app.state), new RegExp(invitation.inviteCode));
  assert.doesNotMatch(JSON.stringify(app.cloud.calls), new RegExp(invitation.inviteCode));
  await actions.uploadAndVerify();

  assert.deepEqual(app.cloud.calls.filter(({ kind }) => kind === "save-private").map(({ domain }) => domain), [
    "plan", "progress", "preferences", "content"
  ]);
  assert.equal(app.controller.getSetupModel().current, "ready");
  assert.equal(app.controller.getSetupModel().sync.status, "verified");
  assert.equal(app.store.loadDeviceMetadata().uploadAuthorized, true);
  assert.equal(app.store.loadDeviceMetadata().lastVerifiedAt, NOW);
  assert.ok(app.storage.getItem("circHQ.k6.backup.v1"));
  assert.equal(serializedStorage(app.storage).includes(invitation.inviteCode), false);
  assert.equal(serializedStorage(app.storage).includes(invitation.inviteCode.replaceAll("-", "")), false);
  assert.doesNotMatch(JSON.stringify(app.cloud.calls), /experienceRunners|sharedArtifacts/);
});

test("the generated room invitation is cleared when the cloud session is destroyed", async () => {
  const app = harness();
  const actions = app.controller.getSetupActions();
  app.cloud.emitAuth({ uid: "teacher-uid", displayName: "Teacher Example", email: "teacher@example.invalid" });
  await actions.useAccount();
  await actions.choosePlanFile({ text: JSON.stringify(planFixture()) });
  await actions.confirmPlanPreview();
  const invitation = await actions.createRoom();

  assert.equal(app.controller.getSetupModel().room.inviteCode, invitation.inviteCode);
  app.controller.destroy();
  assert.equal(app.controller.getSetupModel().room.inviteCode, undefined);
  assert.equal(serializedStorage(app.storage).includes(invitation.inviteCode), false);
  assert.equal(serializedStorage(app.storage).includes(invitation.inviteCode.replaceAll("-", "")), false);
});

test("malformed room-creation results fail closed before local room state is committed", async () => {
  const cases = [
    ["missing invitation", (result) => { delete result.inviteCode; return result; }],
    ["empty invitation", (result) => ({ ...result, inviteCode: "" })],
    ["wrong alphabet", (result) => ({ ...result, inviteCode: "ABCDEFGHI-JKLMNOPQR-STUVWXYI2" })],
    ["wrong length", (result) => ({ ...result, inviteCode: "ABCDEFGHJ-KMNPQRSTV" })],
    ["oversized invitation", (result) => ({ ...result, inviteCode: VALID_INVITE_CODE.repeat(20) })],
    ["non-owner membership", (result) => ({ ...result, membership: { ...result.membership, role: "teacher" } })]
  ];

  for (const [label, createRoomResult] of cases) {
    const app = harness({ cloud: fakeCloudClient({ createRoomResult }) });
    const actions = app.controller.getSetupActions();
    app.cloud.emitAuth({ uid: "teacher-uid", displayName: "Teacher Example", email: "teacher@example.invalid" });
    await actions.useAccount();
    await actions.choosePlanFile({ text: JSON.stringify(planFixture()) });
    await actions.confirmPlanPreview();
    const beforeState = structuredClone(app.state);
    const beforeMetadata = app.store.loadDeviceMetadata();

    assert.deepEqual(await actions.createRoom(), { status: "denied" }, label);
    assert.equal(app.controller.getSetupModel().current, "sync", label);
    assert.equal(app.controller.getSetupModel().room.inviteCode, undefined, label);
    assert.deepEqual(app.state, beforeState, label);
    assert.deepEqual(app.store.loadDeviceMetadata(), beforeMetadata, label);
    assert.equal(serializedStorage(app.storage).includes(VALID_INVITE_CODE), false, label);
  }
});

test("room invitations clear through disconnect, sign-out, and identity replacement", async () => {
  async function invitedApp() {
    const app = harness();
    const actions = app.controller.getSetupActions();
    app.cloud.emitAuth({ uid: "teacher-uid", displayName: "Teacher Example", email: "teacher@example.invalid" });
    await actions.useAccount();
    await actions.choosePlanFile({ text: JSON.stringify(planFixture()) });
    await actions.confirmPlanPreview();
    await actions.createRoom();
    return { app, actions };
  }

  const disconnected = await invitedApp();
  disconnected.app.controller.disconnect();
  assert.equal(disconnected.app.controller.getSetupModel().room.inviteCode, undefined);

  const signedOut = await invitedApp();
  const signOutResult = signedOut.actions.signOut();
  signedOut.app.cloud.emitAuth(null);
  assert.deepEqual(await signOutResult, { status: "signed-out" });
  assert.equal(signedOut.app.controller.getSetupModel().room.inviteCode, undefined);

  const replaced = await invitedApp();
  replaced.app.cloud.emitAuth({ uid: "other-teacher", displayName: "Other Teacher", email: "other@example.invalid" });
  await settle();
  assert.equal(replaced.app.controller.getSetupModel().room.inviteCode, undefined);

  for (const { app } of [disconnected, signedOut, replaced]) {
    assert.equal(serializedStorage(app.storage).includes(VALID_INVITE_CODE), false);
    assert.equal(serializedStorage(app.storage).includes(VALID_INVITE_CODE.replaceAll("-", "")), false);
  }
});

test("cloud plan is summarized without application until explicit confirmation", async () => {
  const cloudState = stateFixture({ plan: planFixture("Cloud Teacher") });
  const cloud = fakeCloudClient({ privateRemote: completeRemote(cloudState) });
  const app = harness({ cloud });
  const actions = app.controller.getSetupActions();
  cloud.emitAuth({ uid: "teacher-uid", displayName: "Teacher Example", email: "teacher@example.invalid" });

  await actions.useAccount();

  assert.equal(app.state.plan, null);
  assert.equal(app.controller.getSetupModel().plan.status, "cloud-found");
  assert.equal(app.controller.getSetupModel().plan.teacherName, "Cloud Teacher");
  await actions.confirmPlanPreview();
  assert.equal(app.state.plan.teachers[0].name, "Cloud Teacher");
  assert.equal(cloud.calls.some(({ kind }) => kind === "save-private"), false);
});

test("partial cloud data is attention and never becomes an empty upload target", async () => {
  const remote = emptyRemote();
  remote.domains.plan = { plan: planFixture("Partial Cloud") };
  remote.revisions.plan = 1;
  remote.updatedAt.plan = NOW;
  const cloud = fakeCloudClient({ privateRemote: remote });
  const app = harness({ cloud });
  const actions = app.controller.getSetupActions();
  cloud.emitAuth({ uid: "teacher-uid", displayName: "Teacher Example", email: "teacher@example.invalid" });

  await actions.useAccount();

  assert.equal(app.controller.getSetupModel().sync.status, "attention");
  assert.match(app.controller.getSetupModel().notice.text, /incomplete|attention/i);
  assert.equal(cloud.calls.some(({ kind }) => kind === "save-private"), false);
});

test("a different observed account clears revision authority and upload authorization", async () => {
  const app = harness();
  app.store.saveDeviceMetadata({
    ...app.store.loadDeviceMetadata(),
    accountUid: "first-user",
    teacherConfirmed: true,
    planConfirmed: true,
    uploadAuthorized: true,
    lastVerifiedRevisions: {
      plan: 4,
      progress: 4,
      preferences: 4,
      content: 4,
      sharedArtifact: 3
    },
    tenantId: "tenant-safe",
    roomId: "room-safe"
  });

  app.cloud.emitAuth({ uid: "second-user", displayName: "Second Teacher", email: "second@example.invalid" });

  const metadata = app.store.loadDeviceMetadata();
  assert.equal(metadata.accountUid, "second-user");
  assert.equal(metadata.teacherConfirmed, false);
  assert.equal(metadata.uploadAuthorized, false);
  assert.deepEqual(metadata.lastVerifiedRevisions, {
    plan: 0,
    progress: 0,
    preferences: 0,
    content: 0,
    sharedArtifact: 0
  });
  assert.equal(app.cloud.calls.some(({ kind }) => kind === "save-private"), false);
});

test("offline local writes stay pending and runner-only writes cause zero cloud work", async () => {
  const cloud = fakeCloudClient({
    saveResults: {
      progress: { status: "offline", revision: null, value: null }
    }
  });
  const app = harness({ initialState: stateFixture({ plan: planFixture() }), cloud });
  app.store.saveDeviceMetadata({
    ...app.store.loadDeviceMetadata(),
    accountUid: "teacher-uid",
    teacherConfirmed: true,
    planConfirmed: true,
    uploadAuthorized: true,
    lastVerifiedRevisions: {
      plan: 1,
      progress: 1,
      preferences: 1,
      content: 1,
      sharedArtifact: 1
    }
  });
  cloud.emitAuth({ uid: "teacher-uid", displayName: "Teacher Example", email: "teacher@example.invalid" });
  await app.controller.afterLocalCommit({ domains: ["progress"], state: app.state });

  assert.deepEqual(app.store.loadDeviceMetadata().pendingDomains, ["progress"]);
  assert.equal(app.controller.getSyncPresentation().status, "offline");
  const callCount = cloud.calls.length;
  await app.controller.afterLocalCommit({ domains: [], state: {
    ...app.state,
    experienceRunners: { "teacher:teacher-example": { private: true } }
  } });
  assert.equal(cloud.calls.length, callCount);
});

test("sign-out preserves local recovery and destroy ignores late auth work", async () => {
  const app = harness({ initialState: stateFixture({ plan: planFixture() }) });
  app.cloud.emitAuth({ uid: "teacher-uid", displayName: "Teacher Example", email: "teacher@example.invalid" });
  const before = app.store.load().state;
  const action = app.controller.getSetupActions().signOut();
  assert.equal(app.cloud.calls.filter(({ kind }) => kind === "sign-out").length, 1);
  app.cloud.emitAuth(null);
  await action;
  await settle();
  assert.deepEqual(app.store.load().state, before);
  assert.equal(app.store.loadDeviceMetadata().accountUid, null);
  assert.ok(app.routes.includes("returnToSetup"));

  app.controller.destroy();
  const invalidations = app.invalidations.length;
  app.cloud.emitAuth({ uid: "late-user", displayName: "Late", email: "late@example.invalid" });
  await settle();
  assert.equal(app.invalidations.length, invalidations);
  assert.equal(app.cloud.calls.filter(({ kind }) => kind === "unsubscribe").length, 1);
  assert.equal(JSON.parse(app.storage.getItem(DEVICE_KEY)).accountUid, null);
});

test("popup failures surface only the exact recoverable teacher copy", async () => {
  const cases = [
    ["popup-blocked", "Google sign-in could not open. Allow pop-ups for this site, then choose Continue with Google again."],
    ["popup-closed", "Google sign-in was closed. Choose Continue with Google when you are ready."],
    ["unauthorized-domain", "Google sign-in is not enabled for this CIRC HQ address. Keep using local mode and ask the site owner to check the authorized domain."],
    ["offline", "You appear to be offline. Keep teaching from this device and try Google sign-in again when connected."],
    ["denied", "Google sign-in could not start. Try again or open Setup help."]
  ];
  for (const [status, text] of cases) {
    const app = harness({ cloud: fakeCloudClient({ popupResult: { status } }) });
    await app.controller.getSetupActions().continueWithGoogle();
    assert.deepEqual(app.controller.getSetupModel().notice, { kind: "error", text });
    assert.doesNotMatch(JSON.stringify(app.controller.getSetupModel()), /auth\/|credential|token|raw/i);
    app.controller.destroy();
  }
});

test("a returning verified teacher merges admitted cloud data and restores the shared room", async () => {
  const state = stateFixture({ plan: planFixture("Returning Teacher") });
  const cloud = fakeCloudClient({
    privateRemote: completeRemote(state),
    roomMembership: memberRoom("teacher")
  });
  const app = harness({ initialState: state, cloud });
  authorizeDevice(app, { tenantId: "tenant-safe", roomId: "room-safe" });

  cloud.emitAuth({ uid: "teacher-uid", displayName: "Returning Teacher", email: "returning@example.invalid" });
  await settle();

  assert.equal(app.controller.getSetupModel().current, "ready");
  assert.equal(app.controller.getSyncPresentation().label, "CIRC Cloud verified");
  assert.deepEqual(app.controller.getRoomPresentation(), {
    status: "ready",
    name: "Shared CIRC Room",
    role: "teacher",
    syncLabel: "CIRC Cloud verified",
    lastVerifiedAt: null
  });
  assert.deepEqual(cloud.calls.filter(({ kind }) => kind === "load-private").map(({ uid }) => uid), ["teacher-uid"]);
  assert.equal(cloud.calls.some(({ kind }) => kind === "save-private"), false);
  app.controller.destroy();
});

test("a returning verified teacher needs no room to complete private sync", async () => {
  const state = stateFixture({ plan: planFixture("Roomless Teacher") });
  const cloud = fakeCloudClient({
    privateRemote: completeRemote(state),
    roomMembership: { status: "not-member", membership: null, room: null }
  });
  const app = harness({ initialState: state, cloud });
  authorizeDevice(app, { tenantId: null, roomId: null });

  cloud.emitAuth({ uid: "teacher-uid", displayName: "Roomless Teacher", email: "roomless@example.invalid" });
  await settle();

  assert.equal(app.controller.getSetupModel().current, "ready");
  assert.equal(app.controller.getSyncPresentation().status, "verified");
  assert.equal(app.controller.getRoomPresentation().status, "missing");
  assert.equal(cloud.calls.some(({ kind }) => kind === "load-shared"), false);
  assert.equal(cloud.calls.some(({ kind }) => kind === "save-shared"), false);
  app.controller.destroy();
});

test("plan conflicts preserve the local candidate until the teacher chooses cloud or local", async () => {
  const local = stateFixture({ plan: planFixture("Local Teacher") });
  const remote = stateFixture({ plan: planFixture("Cloud Teacher") });
  const cloud = fakeCloudClient({ privateRemote: completeRemote(remote) });
  const app = harness({ initialState: local, cloud });
  authorizeDevice(app);
  cloud.emitAuth({ uid: "teacher-uid", displayName: "Teacher Example", email: "teacher@example.invalid" });
  await settle();

  assert.equal(app.state.plan.teachers[0].name, "Local Teacher");
  assert.deepEqual(app.store.loadDeviceMetadata().conflictDomains, ["plan"]);
  assert.equal(app.controller.getSyncPresentation().status, "attention");
  assert.equal(cloud.calls.some(({ kind }) => kind === "save-private"), false);

  assert.deepEqual(app.controller.getSetupActions().useCloudPlan(), { status: "resolved" });
  assert.equal(app.state.plan.teachers[0].name, "Cloud Teacher");
  assert.deepEqual(app.store.loadDeviceMetadata().conflictDomains, []);

  const keepCloud = fakeCloudClient({ privateRemote: completeRemote(remote) });
  const keepApp = harness({ initialState: local, cloud: keepCloud });
  authorizeDevice(keepApp);
  keepCloud.emitAuth({ uid: "teacher-uid", displayName: "Teacher Example", email: "teacher@example.invalid" });
  await settle();
  assert.deepEqual(keepApp.controller.getSetupActions().keepLocalPlan(), { status: "pending" });
  assert.equal(keepApp.state.plan.teachers[0].name, "Local Teacher");
  assert.deepEqual(keepApp.store.loadDeviceMetadata().pendingDomains, ["plan"]);
  assert.deepEqual(keepApp.store.loadDeviceMetadata().conflictDomains, []);
  keepApp.controller.destroy();
  app.controller.destroy();
});

test("equal-timestamp teacher progress marks only progress while the local plan remains usable", async () => {
  const local = stateFixture({ plan: planFixture() });
  local.teacherProgress = {
    "teacher:example": {
      currentProjectNumber: 3,
      completedProjectNumbers: [1, 2],
      complete: false,
      updatedAt: NOW
    }
  };
  const remote = structuredClone(local);
  remote.teacherProgress["teacher:example"] = {
    currentProjectNumber: 4,
    completedProjectNumbers: [1, 2, 3],
    complete: false,
    updatedAt: NOW
  };
  const cloud = fakeCloudClient({ privateRemote: completeRemote(remote) });
  const app = harness({ initialState: local, cloud });
  authorizeDevice(app);
  cloud.emitAuth({ uid: "teacher-uid", displayName: "Teacher Example", email: "teacher@example.invalid" });
  await settle();

  assert.deepEqual(app.store.loadDeviceMetadata().conflictDomains, ["progress"]);
  assert.equal(app.state.teacherProgress["teacher:example"].currentProjectNumber, 3);
  assert.equal(app.state.plan.teachers[0].name, "Teacher Example");
  assert.equal(cloud.calls.some(({ kind }) => kind === "save-private"), false);
  app.controller.destroy();
});

test("invite redemption discards the raw code then loads membership and the shared pair", async () => {
  const joined = memberRoom("teacher");
  const cloud = fakeCloudClient({
    redeemResult: { status: "joined", membership: joined.membership },
    redeemRoomMembership: joined
  });
  const app = harness({ initialState: stateFixture({ plan: planFixture() }), cloud });
  const actions = app.controller.getSetupActions();
  cloud.emitAuth({ uid: "teacher-uid", displayName: "Teacher Example", email: "teacher@example.invalid" });
  await actions.useAccount();
  await actions.confirmPlanPreview();
  const code = "ABCD-EFGH-JKMN-PQRS-TUVW";

  assert.deepEqual(await actions.redeemInvite(code), { status: "joined" });
  assert.equal(cloud.calls.filter(({ kind }) => kind === "redeem")[0].code, code);
  assert.deepEqual(cloud.calls.filter(({ kind }) => kind === "load-shared").at(-1).input, {
    tenantId: "tenant-safe",
    roomId: "room-safe"
  });
  assert.equal([...app.storage.values.values()].join("\n").includes(code), false);
  assert.equal(app.store.loadDeviceMetadata().tenantId, "tenant-safe");
  assert.ok(app.state.sharedArtifacts[TECH_TERRARIUM_ARTIFACT_ID]);
  app.controller.destroy();
});

test("shared handoffs use only the room transaction and admit its verified pair", async () => {
  const baseArtifact = createTechTerrariumArtifact({
    artifactId: TECH_TERRARIUM_ARTIFACT_ID,
    nowIso: NOW
  });
  const nextArtifact = recordArtifactHandoff(baseArtifact, {
    handoff: "ready",
    eventId: EVENT_ID,
    visitDate: "2026-09-01",
    nowIso: NOW
  });
  const state = stateFixture({ plan: planFixture() });
  state.sharedArtifacts = { [TECH_TERRARIUM_ARTIFACT_ID]: baseArtifact };
  const cloud = fakeCloudClient({
    roomMembership: memberRoom("owner"),
    sharedSaveResult: {
      status: "verified",
      revision: 2,
      value: nextArtifact,
      projectProgress: artifactProgress(nextArtifact)
    }
  });
  const app = harness({ initialState: state, cloud });
  authorizeDevice(app, { tenantId: "tenant-safe", roomId: "room-safe" });
  cloud.emitAuth({ uid: "teacher-uid", displayName: "Teacher Example", email: "teacher@example.invalid" });
  await settle();
  const privateCallCount = cloud.calls.filter(({ kind }) => kind === "save-private").length;

  await app.controller.afterSharedHandoff({
    state: app.state,
    handoff: {
      handoff: "ready",
      eventId: EVENT_ID,
      visitDate: "2026-09-01",
      nowIso: NOW
    }
  });

  const transaction = cloud.calls.filter(({ kind }) => kind === "save-shared").at(-1).input;
  assert.deepEqual(Object.keys(transaction).sort(), [
    "eventId", "expectedRevision", "handoff", "nowIso", "roomId", "tenantId", "visitDate"
  ]);
  assert.equal(JSON.stringify(transaction).includes("experienceRunners"), false);
  assert.equal(cloud.calls.filter(({ kind }) => kind === "save-private").length, privateCallCount);
  assert.equal(app.state.sharedArtifacts[TECH_TERRARIUM_ARTIFACT_ID].visits.length, 1);
  assert.equal(app.store.loadDeviceMetadata().pendingSharedHandoff, null);
  assert.equal(app.store.loadDeviceMetadata().lastVerifiedRevisions.sharedArtifact, 2);
  app.controller.destroy();
});

test("untrusted or absent room context cannot load or write a shared artifact", async () => {
  const cases = [
    ["absent", { status: "not-member", membership: null, room: null }],
    ["untrusted", {
      status: "member",
      membership: {
        uid: "teacher-uid",
        tenantId: "tenant-safe",
        roomId: "room-safe",
        role: "teacher",
        trusted: false
      },
      room: { tenantId: "tenant-safe", roomId: "room-safe", name: "Untrusted Room" }
    }]
  ];

  for (const [label, roomMembership] of cases) {
    const state = stateFixture({ plan: planFixture() });
    const cloud = fakeCloudClient({ privateRemote: completeRemote(state), roomMembership });
    const app = harness({ initialState: state, cloud });
    authorizeDevice(app, { tenantId: "tenant-safe", roomId: "room-safe" });
    cloud.emitAuth({ uid: "teacher-uid", displayName: "Teacher Example", email: "teacher@example.invalid" });
    await settle();

    const result = await app.controller.afterSharedHandoff({
      handoff: { handoff: "ready", eventId: EVENT_ID, visitDate: "2026-09-01", nowIso: NOW }
    });

    assert.deepEqual(result, { status: "blocked" }, label);
    assert.equal(cloud.calls.some(({ kind }) => kind === "load-shared"), false, label);
    assert.equal(cloud.calls.some(({ kind }) => kind === "save-shared"), false, label);
    assert.equal(app.store.loadDeviceMetadata().pendingSharedHandoff, null, label);
    assert.equal(app.store.loadDeviceMetadata().pendingDomains.includes("sharedArtifact"), false, label);
    app.controller.destroy();
  }
});

test("room loss preserves a pending shared handoff while private retry still syncs", async () => {
  const state = stateFixture({ plan: planFixture() });
  const cloud = fakeCloudClient({
    privateRemote: completeRemote(state),
    roomMembership: { status: "not-member", membership: null, room: null }
  });
  const app = harness({ initialState: state, cloud });
  const pendingSharedHandoff = {
    artifactId: TECH_TERRARIUM_ARTIFACT_ID,
    expectedRevision: 1,
    handoff: "ready",
    eventId: EVENT_ID,
    visitDate: "2026-09-01",
    nowIso: NOW
  };
  authorizeDevice(app, {
    tenantId: "tenant-safe",
    roomId: "room-safe",
    pendingDomains: ["progress", "sharedArtifact"],
    pendingSharedHandoff
  });
  cloud.emitAuth({ uid: "teacher-uid", displayName: "Teacher Example", email: "teacher@example.invalid" });
  await settle();

  assert.deepEqual(await app.controller.syncNow(), { status: "pending" });
  assert.equal(cloud.calls.some(({ kind, domain }) => kind === "save-private" && domain === "progress"), true);
  assert.equal(cloud.calls.some(({ kind }) => kind === "load-shared"), false);
  assert.equal(cloud.calls.some(({ kind }) => kind === "save-shared"), false);
  assert.deepEqual(app.store.loadDeviceMetadata().pendingDomains, ["sharedArtifact"]);
  assert.deepEqual(app.store.loadDeviceMetadata().pendingSharedHandoff, pendingSharedHandoff);
  app.controller.destroy();
});

test("an offline shared handoff stays pending and a changed remote revision never blind-rebases", async () => {
  const artifact = createTechTerrariumArtifact({ artifactId: TECH_TERRARIUM_ARTIFACT_ID, nowIso: NOW });
  const state = stateFixture({ plan: planFixture() });
  state.sharedArtifacts = { [TECH_TERRARIUM_ARTIFACT_ID]: artifact };
  const cloud = fakeCloudClient({
    roomMembership: memberRoom("teacher"),
    sharedSaveResult: { status: "offline", revision: null, value: null, projectProgress: null }
  });
  const app = harness({ initialState: state, cloud });
  authorizeDevice(app, { tenantId: "tenant-safe", roomId: "room-safe" });
  cloud.emitAuth({ uid: "teacher-uid", displayName: "Teacher Example", email: "teacher@example.invalid" });
  await settle();

  await app.controller.afterSharedHandoff({
    state: app.state,
    handoff: { handoff: "repeat", eventId: EVENT_ID, visitDate: "2026-09-01", nowIso: NOW }
  });
  assert.equal(app.controller.getSyncPresentation().status, "offline");
  assert.equal(app.store.loadDeviceMetadata().pendingSharedHandoff.expectedRevision, 1);
  const writesBeforeRetry = cloud.calls.filter(({ kind }) => kind === "save-shared").length;
  cloud.setSharedResult({
    status: "loaded",
    revision: 2,
    value: artifact,
    projectProgress: artifactProgress(artifact)
  });

  await app.controller.syncNow();

  assert.deepEqual(app.store.loadDeviceMetadata().conflictDomains, ["sharedArtifact"]);
  assert.equal(cloud.calls.filter(({ kind }) => kind === "save-shared").length, writesBeforeRetry);
  assert.ok(app.store.loadDeviceMetadata().pendingSharedHandoff);
  app.controller.destroy();
});

test("a pending shared retry rejects a verified result without the exact revision increment", async () => {
  const artifact = createTechTerrariumArtifact({ artifactId: TECH_TERRARIUM_ARTIFACT_ID, nowIso: NOW });
  const handedOffArtifact = recordArtifactHandoff(artifact, {
    handoff: "repeat",
    eventId: EVENT_ID,
    visitDate: "2026-09-01",
    nowIso: NOW
  });
  const state = stateFixture({ plan: planFixture() });
  state.sharedArtifacts = { [TECH_TERRARIUM_ARTIFACT_ID]: artifact };
  let saveAttempts = 0;
  const cloud = fakeCloudClient({
    roomMembership: memberRoom("teacher"),
    async saveSharedArtifact(input) {
      saveAttempts += 1;
      if (saveAttempts === 1) {
        return { status: "offline", revision: null, value: null, projectProgress: null };
      }
      return {
        status: "verified",
        revision: input.expectedRevision + 2,
        value: handedOffArtifact,
        projectProgress: artifactProgress(handedOffArtifact)
      };
    }
  });
  const app = harness({ initialState: state, cloud });
  authorizeDevice(app, { tenantId: "tenant-safe", roomId: "room-safe" });
  cloud.emitAuth({ uid: "teacher-uid", displayName: "Teacher Example", email: "teacher@example.invalid" });
  await settle();

  await app.controller.afterSharedHandoff({
    state: app.state,
    handoff: { handoff: "repeat", eventId: EVENT_ID, visitDate: "2026-09-01", nowIso: NOW }
  });
  await app.controller.syncNow();

  const metadata = app.store.loadDeviceMetadata();
  assert.equal(saveAttempts, 2);
  assert.equal(metadata.lastVerifiedRevisions.sharedArtifact, 1);
  assert.ok(metadata.pendingSharedHandoff);
  assert.deepEqual(metadata.conflictDomains, ["sharedArtifact"]);
  assert.equal(app.state.sharedArtifacts[TECH_TERRARIUM_ARTIFACT_ID].visits.length, 0);
  assert.equal(app.controller.getSyncPresentation().status, "attention");
  app.controller.destroy();
});

test("a pending shared retry accepts only a verified save response", async () => {
  const artifact = createTechTerrariumArtifact({ artifactId: TECH_TERRARIUM_ARTIFACT_ID, nowIso: NOW });
  const handedOffArtifact = recordArtifactHandoff(artifact, {
    handoff: "repeat",
    eventId: EVENT_ID,
    visitDate: "2026-09-01",
    nowIso: NOW
  });
  const state = stateFixture({ plan: planFixture() });
  state.sharedArtifacts = { [TECH_TERRARIUM_ARTIFACT_ID]: artifact };
  let saveAttempts = 0;
  const cloud = fakeCloudClient({
    roomMembership: memberRoom("teacher"),
    async saveSharedArtifact(input) {
      saveAttempts += 1;
      if (saveAttempts === 1) {
        return { status: "offline", revision: null, value: null, projectProgress: null };
      }
      return {
        status: "loaded",
        revision: input.expectedRevision + 1,
        value: handedOffArtifact,
        projectProgress: artifactProgress(handedOffArtifact)
      };
    }
  });
  const app = harness({ initialState: state, cloud });
  authorizeDevice(app, { tenantId: "tenant-safe", roomId: "room-safe" });
  cloud.emitAuth({ uid: "teacher-uid", displayName: "Teacher Example", email: "teacher@example.invalid" });
  await settle();

  await app.controller.afterSharedHandoff({
    state: app.state,
    handoff: { handoff: "repeat", eventId: EVENT_ID, visitDate: "2026-09-01", nowIso: NOW }
  });
  await app.controller.syncNow();

  const metadata = app.store.loadDeviceMetadata();
  assert.equal(saveAttempts, 2);
  assert.equal(metadata.lastVerifiedRevisions.sharedArtifact, 1);
  assert.ok(metadata.pendingSharedHandoff);
  assert.deepEqual(metadata.conflictDomains, ["sharedArtifact"]);
  assert.equal(app.state.sharedArtifacts[TECH_TERRARIUM_ARTIFACT_ID].visits.length, 0);
  assert.equal(app.controller.getSyncPresentation().status, "attention");
  app.controller.destroy();
});

test("returning verification stays closed when the required shared pair cannot load", async () => {
  for (const [sharedStatus, expectedStatus] of [["offline", "offline"], ["denied", "attention"]]) {
    const state = stateFixture({ plan: planFixture("Returning Teacher") });
    const cloud = fakeCloudClient({
      privateRemote: completeRemote(state),
      roomMembership: memberRoom("teacher"),
      sharedResult: {
        status: sharedStatus,
        revision: null,
        value: null,
        projectProgress: null
      }
    });
    const app = harness({ initialState: state, cloud });
    authorizeDevice(app, { tenantId: "tenant-safe", roomId: "room-safe" });

    cloud.emitAuth({ uid: "teacher-uid", displayName: "Returning Teacher", email: "returning@example.invalid" });
    await settle();

    assert.equal(app.controller.getSyncPresentation().status, expectedStatus, sharedStatus);
    assert.notEqual(app.controller.getSetupModel().current, "ready", sharedStatus);
    assert.notEqual(app.controller.getRoomPresentation().status, "ready", sharedStatus);
    app.controller.destroy();
  }
});

test("a local edit during initial upload is verified in a later revision instead of forgotten", async () => {
  const firstPlanWrite = deferred();
  let planAttempts = 0;
  const state = stateFixture({ plan: planFixture("Original Teacher") });
  const cloud = fakeCloudClient({
    roomMembership: memberRoom("owner"),
    async savePrivateDomain({ domain, value, expectedRevision }) {
      if (domain === "plan" && ++planAttempts === 1) return firstPlanWrite.promise;
      return { status: "verified", revision: expectedRevision + 1, value };
    }
  });
  const app = harness({ initialState: state, cloud });
  authorizeDevice(app, {
    uploadAuthorized: false,
    tenantId: "tenant-safe",
    roomId: "room-safe"
  });
  cloud.emitAuth({ uid: "teacher-uid", displayName: "Teacher Example", email: "teacher@example.invalid" });
  await settle();

  const upload = app.controller.getSetupActions().uploadAndVerify();
  await settle();
  const firstCall = cloud.calls.find(({ kind, domain }) => kind === "save-private" && domain === "plan");
  assert.ok(firstCall);

  const newer = structuredClone(app.state);
  newer.plan = planFixture("Newer Teacher");
  app.commitState(newer);
  await app.controller.afterLocalCommit({ domains: ["plan"], state: app.state });
  firstPlanWrite.resolve({
    status: "verified",
    revision: firstCall.expectedRevision + 1,
    value: firstCall.value
  });
  await upload;

  const planWrites = cloud.calls.filter(({ kind, domain }) => kind === "save-private" && domain === "plan");
  assert.equal(planWrites.length, 2);
  assert.equal(planWrites[1].value.plan.teachers[0].name, "Newer Teacher");
  assert.deepEqual(app.store.loadDeviceMetadata().pendingDomains, []);
  assert.equal(app.controller.getSyncPresentation().status, "verified");
  app.controller.destroy();
});

test("rapid private edits retain the newest retry obligation when the later write is offline", async () => {
  const firstWrite = deferred();
  let progressAttempts = 0;
  const base = stateFixture({ plan: planFixture() });
  const cloud = fakeCloudClient({
    privateRemote: completeRemote(base),
    roomMembership: memberRoom("teacher"),
    async savePrivateDomain({ domain, value, expectedRevision }) {
      if (domain !== "progress") return { status: "verified", revision: expectedRevision + 1, value };
      progressAttempts += 1;
      if (progressAttempts === 1) return firstWrite.promise;
      if (progressAttempts === 2) return { status: "offline", revision: null, value: null };
      return { status: "verified", revision: expectedRevision + 1, value };
    }
  });
  const app = harness({ initialState: base, cloud });
  authorizeDevice(app, { tenantId: "tenant-safe", roomId: "room-safe" });
  cloud.emitAuth({ uid: "teacher-uid", displayName: "Teacher Example", email: "teacher@example.invalid" });
  await settle();

  const firstState = structuredClone(app.state);
  firstState.teacherProgress = {
    "teacher:example": {
      currentProjectNumber: 3,
      completedProjectNumbers: [1, 2],
      complete: false,
      updatedAt: "2026-09-01T13:01:00.000Z"
    }
  };
  app.commitState(firstState);
  const first = app.controller.afterLocalCommit({ domains: ["progress"], state: app.state });
  await settle();

  const secondState = structuredClone(app.state);
  secondState.teacherProgress["teacher:example"] = {
    currentProjectNumber: 4,
    completedProjectNumbers: [1, 2, 3],
    complete: false,
    updatedAt: "2026-09-01T13:02:00.000Z"
  };
  app.commitState(secondState);
  const second = app.controller.afterLocalCommit({ domains: ["progress"], state: app.state });
  const firstCall = cloud.calls.filter(({ kind, domain }) => kind === "save-private" && domain === "progress")[0];
  firstWrite.resolve({
    status: "verified",
    revision: firstCall.expectedRevision + 1,
    value: firstCall.value
  });
  await Promise.all([first, second]);

  assert.deepEqual(app.store.loadDeviceMetadata().pendingDomains, ["progress"]);
  assert.equal(app.controller.getSyncPresentation().status, "offline");
  await app.controller.syncNow();
  const progressWrites = cloud.calls.filter(({ kind, domain }) => kind === "save-private" && domain === "progress");
  assert.equal(progressWrites.length, 3);
  assert.equal(progressWrites[2].value.teacherProgress["teacher:example"].currentProjectNumber, 4);
  assert.deepEqual(app.store.loadDeviceMetadata().pendingDomains, []);
  app.controller.destroy();
});

test("private verification rejects wrong save increments and wrong read-back revisions", async () => {
  const base = stateFixture({ plan: planFixture() });
  const badSaveCloud = fakeCloudClient({
    privateRemote: completeRemote(base),
    roomMembership: memberRoom("teacher"),
    savePrivateDomain: async ({ value, expectedRevision }) => ({
      status: "verified",
      revision: expectedRevision + 2,
      value
    })
  });
  const badSaveApp = harness({ initialState: base, cloud: badSaveCloud });
  authorizeDevice(badSaveApp, { tenantId: "tenant-safe", roomId: "room-safe" });
  badSaveCloud.emitAuth({ uid: "teacher-uid", displayName: "Teacher Example", email: "teacher@example.invalid" });
  await settle();
  await badSaveApp.controller.afterLocalCommit({ domains: ["progress"], state: badSaveApp.state });
  assert.equal(badSaveApp.store.loadDeviceMetadata().lastVerifiedRevisions.progress, 2);
  assert.deepEqual(badSaveApp.store.loadDeviceMetadata().pendingDomains, ["progress"]);
  assert.equal(badSaveApp.controller.getSyncPresentation().status, "attention");
  badSaveApp.controller.destroy();

  const badVerifyCloud = fakeCloudClient({
    privateRemote: completeRemote(base),
    roomMembership: memberRoom("teacher"),
    verifyPrivateDomain: async ({ domain, expectedRevision }) => ({
      status: "verified",
      revision: expectedRevision + 1,
      value: completeRemote(base).domains[domain]
    })
  });
  const badVerifyApp = harness({ initialState: base, cloud: badVerifyCloud });
  authorizeDevice(badVerifyApp, {
    uploadAuthorized: false,
    tenantId: "tenant-safe",
    roomId: "room-safe"
  });
  badVerifyCloud.emitAuth({ uid: "teacher-uid", displayName: "Teacher Example", email: "teacher@example.invalid" });
  await settle();
  const result = await badVerifyApp.controller.getSetupActions().uploadAndVerify();
  assert.notEqual(result.status, "verified");
  assert.equal(badVerifyApp.store.loadDeviceMetadata().lastVerifiedRevisions.plan, 2);
  assert.deepEqual(badVerifyApp.store.loadDeviceMetadata().pendingDomains, ["plan"]);
  assert.equal(badVerifyApp.controller.getSyncPresentation().status, "attention");
  badVerifyApp.controller.destroy();
});

test("demo suspends existing and late cloud clients until the teacher exits", async () => {
  const app = harness();
  const actions = app.controller.getSetupActions();
  actions.exploreDemo();
  app.cloud.emitAuth({ uid: "teacher-uid", displayName: "Teacher Example", email: "teacher@example.invalid" });
  await settle();

  assert.equal(app.controller.getSetupModel().mode, "demo");
  assert.equal(app.controller.getSetupModel().account, null);
  assert.equal(app.cloud.calls.filter(({ kind }) => kind === "load-private").length, 0);

  const lateCloud = fakeCloudClient();
  app.controller.connect(lateCloud);
  assert.equal(lateCloud.calls.filter(({ kind }) => kind === "observe").length, 0);
  actions.previewExperience();
  assert.equal(lateCloud.calls.length, 0);

  actions.exitDemo();
  assert.equal(lateCloud.calls.filter(({ kind }) => kind === "observe").length, 1);
  app.controller.destroy();
});

test("stored local plans and room invitations keep the explicit confirmation gates", async () => {
  const joined = memberRoom("teacher");
  const cloud = fakeCloudClient({
    redeemResult: { status: "joined", membership: joined.membership },
    redeemRoomMembership: joined
  });
  const app = harness({ initialState: stateFixture({ plan: planFixture() }), cloud });
  const actions = app.controller.getSetupActions();
  const code = "ABCD-EFGH-JKMN-PQRS-TUVW";
  cloud.emitAuth({ uid: "teacher-uid", displayName: "Teacher Example", email: "teacher@example.invalid" });

  assert.deepEqual(await actions.redeemInvite(code), { status: "blocked" });
  assert.equal(cloud.calls.some(({ kind }) => kind === "redeem"), false);
  await actions.useAccount();
  assert.equal(app.store.loadDeviceMetadata().planConfirmed, false);
  assert.equal(app.controller.getSetupModel().plan.status, "preview");
  assert.deepEqual(await actions.redeemInvite(code), { status: "blocked" });
  assert.equal(cloud.calls.some(({ kind }) => kind === "redeem"), false);

  assert.deepEqual(await actions.confirmPlanPreview(), { status: "confirmed" });
  assert.equal(app.store.loadDeviceMetadata().planConfirmed, true);
  assert.deepEqual(await actions.redeemInvite(code), { status: "joined" });
  assert.equal(cloud.calls.filter(({ kind }) => kind === "redeem").length, 1);
  app.controller.destroy();
});

test("late popup and file completions cannot overwrite newer controller state", async () => {
  const popup = deferred();
  const popupCloud = fakeCloudClient({ popupResult: () => popup.promise });
  const popupApp = harness({ cloud: popupCloud });
  const pendingPopup = popupApp.controller.getSetupActions().continueWithGoogle();
  popupCloud.emitAuth({ uid: "teacher-uid", displayName: "Teacher Example", email: "teacher@example.invalid" });
  const observedNotice = popupApp.controller.getSetupModel().notice;
  popup.resolve({ status: "denied" });
  await pendingPopup;
  assert.equal(popupApp.controller.getSetupModel().current, "teacher");
  assert.deepEqual(popupApp.controller.getSetupModel().notice, observedNotice);
  popupApp.controller.destroy();

  const older = deferred();
  const newer = deferred();
  const fileApp = harness({
    readFileText: (file) => file.name === "older" ? older.promise : newer.promise
  });
  const actions = fileApp.controller.getSetupActions();
  const olderPreview = actions.choosePlanFile({ name: "older" });
  const newerPreview = actions.choosePlanFile({ name: "newer" });
  newer.resolve(JSON.stringify(planFixture("Newest Teacher")));
  await newerPreview;
  older.resolve(JSON.stringify(planFixture("Stale Teacher")));
  await olderPreview;
  assert.equal(fileApp.controller.getSetupModel().plan.teacherName, "Newest Teacher");
  fileApp.controller.destroy();
});

test("sign-out detaches a new account write queue from an unresolved old-account write", async () => {
  const oldWrite = deferred();
  let attempts = 0;
  const base = stateFixture({ plan: planFixture() });
  const cloud = fakeCloudClient({
    privateRemote: completeRemote(base),
    roomMembership: memberRoom("teacher"),
    async savePrivateDomain({ value, expectedRevision }) {
      attempts += 1;
      if (attempts === 1) return oldWrite.promise;
      return { status: "verified", revision: expectedRevision + 1, value };
    }
  });
  const app = harness({ initialState: base, cloud });
  authorizeDevice(app, { tenantId: "tenant-safe", roomId: "room-safe" });
  cloud.emitAuth({ uid: "teacher-uid", displayName: "Teacher Example", email: "teacher@example.invalid" });
  await settle();

  const first = app.controller.afterLocalCommit({ domains: ["progress"], state: app.state });
  await settle();
  const signOut = app.controller.getSetupActions().signOut();
  cloud.emitAuth(null);
  await signOut;
  cloud.emitAuth({ uid: "teacher-uid", displayName: "Teacher Example", email: "teacher@example.invalid" });
  authorizeDevice(app, { tenantId: "tenant-safe", roomId: "room-safe" });

  const second = app.controller.afterLocalCommit({ domains: ["progress"], state: app.state });
  await settle();
  const callsBeforeOldCompletion = cloud.calls.filter(({ kind, domain }) => kind === "save-private" && domain === "progress").length;
  oldWrite.resolve({ status: "verified", revision: 3, value: partitionPrivateDomains(app.state).progress });
  await Promise.all([first, second]);
  assert.equal(callsBeforeOldCompletion, 2);
  app.controller.destroy();
});

test("shared handoffs serialize and the second transaction uses the first verified revision", async () => {
  const baseArtifact = createTechTerrariumArtifact({ artifactId: TECH_TERRARIUM_ARTIFACT_ID, nowIso: NOW });
  const firstArtifact = recordArtifactHandoff(baseArtifact, {
    handoff: "ready",
    eventId: EVENT_ID,
    visitDate: "2026-09-01",
    nowIso: NOW
  });
  const secondNow = "2026-09-02T13:00:00.000Z";
  const secondArtifact = recordArtifactHandoff(firstArtifact, {
    handoff: "repeat",
    eventId: SECOND_EVENT_ID,
    visitDate: "2026-09-02",
    nowIso: secondNow
  });
  const firstSave = deferred();
  let saves = 0;
  const state = stateFixture({ plan: planFixture() });
  state.sharedArtifacts = { [TECH_TERRARIUM_ARTIFACT_ID]: baseArtifact };
  const cloud = fakeCloudClient({
    roomMembership: memberRoom("teacher"),
    sharedResult: {
      status: "loaded",
      revision: 1,
      value: baseArtifact,
      projectProgress: artifactProgress(baseArtifact)
    },
    async saveSharedArtifact(input) {
      saves += 1;
      if (saves === 1) return firstSave.promise;
      return {
        status: "verified",
        revision: input.expectedRevision + 1,
        value: secondArtifact,
        projectProgress: artifactProgress(secondArtifact)
      };
    }
  });
  const app = harness({ initialState: state, cloud });
  authorizeDevice(app, { tenantId: "tenant-safe", roomId: "room-safe" });
  cloud.emitAuth({ uid: "teacher-uid", displayName: "Teacher Example", email: "teacher@example.invalid" });
  await settle();

  const first = app.controller.afterSharedHandoff({
    state: app.state,
    handoff: { handoff: "ready", eventId: EVENT_ID, visitDate: "2026-09-01", nowIso: NOW }
  });
  await settle();
  const second = app.controller.afterSharedHandoff({
    state: app.state,
    handoff: { handoff: "repeat", eventId: SECOND_EVENT_ID, visitDate: "2026-09-02", nowIso: secondNow }
  });
  await settle();
  const callsBeforeFirstResult = cloud.calls.filter(({ kind }) => kind === "save-shared").length;
  firstSave.resolve({
    status: "verified",
    revision: 2,
    value: firstArtifact,
    projectProgress: artifactProgress(firstArtifact)
  });
  await Promise.all([first, second]);

  const expectedRevisions = cloud.calls.filter(({ kind }) => kind === "save-shared")
    .map(({ input }) => input.expectedRevision);
  assert.equal(callsBeforeFirstResult, 1);
  assert.deepEqual(expectedRevisions, [1, 2]);
  assert.equal(app.store.loadDeviceMetadata().lastVerifiedRevisions.sharedArtifact, 3);
  app.controller.destroy();
});

test("demo actions perform no storage or cloud operation and always expose an exit route", () => {
  const app = harness();
  const beforeStorage = [...app.storage.values.entries()];
  const actions = app.controller.getSetupActions();

  actions.exploreDemo();
  actions.previewExperience();
  actions.exitDemo();

  assert.deepEqual([...app.storage.values.entries()], beforeStorage);
  assert.deepEqual(app.cloud.calls.filter(({ kind }) => !["observe", "unsubscribe"].includes(kind)), []);
  assert.deepEqual(app.cloud.calls.map(({ kind }) => kind), ["observe", "unsubscribe", "observe"]);
  assert.deepEqual(app.routes.slice(-3), ["enterDemo", "previewExperience", "exitDemo"]);
  assert.equal(app.controller.getSetupModel().mode, "setup");
  app.controller.destroy();
});
