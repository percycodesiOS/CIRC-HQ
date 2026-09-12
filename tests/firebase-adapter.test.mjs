import test from "node:test";
import assert from "node:assert/strict";

import * as firebaseAdapter from "../src/storage/firebase-adapter.js";

function requireFactory(name) {
  assert.equal(typeof firebaseAdapter[name], "function", `${name} must be exported`);
  return firebaseAdapter[name];
}

function firebaseDouble({ uid = "teacher-uid" } = {}) {
  const calls = [];
  let authListener = null;
  const unsubscribe = () => {};
  return {
    calls,
    currentUser: () => uid ? {
      uid,
      displayName: "Teacher Name",
      email: "teacher@example.invalid",
      accessToken: "must-not-escape",
      providerData: [{ providerId: "google.com" }]
    } : null,
    observeAuth(listener) {
      calls.push({ kind: "observe" });
      authListener = listener;
      return unsubscribe;
    },
    emitAuth(user) {
      authListener(user);
    },
    async signInWithPopup() {
      calls.push({ kind: "popup" });
      return { user: this.currentUser(), credential: "must-not-escape" };
    },
    async signInWithRedirect() {
      calls.push({ kind: "redirect" });
    },
    async signOut() {
      calls.push({ kind: "sign-out" });
    }
  };
}

test("browser client delegates pinned dependency loading to the injectable client", async () => {
  const createBrowserFirebaseClient = requireFactory("createBrowserFirebaseClient");
  const firebase = firebaseDouble();
  const config = { projectId: "injected-test-project" };
  const seen = [];

  const client = await createBrowserFirebaseClient(config, {
    loadDependencies: async (received) => {
      seen.push(received);
      return firebase;
    }
  });

  assert.deepEqual(seen, [config]);
  assert.equal(client.status, "ready");
  assert.equal("loadPrivateState" in client, false);
  assert.equal("savePrivateState" in client, false);
  assert.equal(typeof client.signUpWithEmail, "function");
  assert.equal(typeof client.signInWithEmail, "function");
  assert.equal(typeof client.requestPasswordReset, "function");
});

test("auth observation emits only normalized Firebase identity", () => {
  const createFirebaseClient = requireFactory("createFirebaseClient");
  const firebase = firebaseDouble();
  const client = createFirebaseClient({
    config: { projectId: "injected-test-project" },
    firebase
  });
  const observed = [];

  const unsubscribe = client.observeAuth((user) => observed.push(user));
  firebase.emitAuth(firebase.currentUser());
  firebase.emitAuth(null);

  assert.equal(typeof unsubscribe, "function");
  assert.deepEqual(observed, [{
    uid: "teacher-uid",
    displayName: "Teacher Name",
    email: "teacher@example.invalid"
  }, null]);
  assert.equal(JSON.stringify(observed).includes("must-not-escape"), false);
  assert.equal(JSON.stringify(observed).includes("providerData"), false);
});

test("email signup and sign-in call distinct Firebase operations without returning credentials", async () => {
  const firebase = firebaseDouble();
  const calls = [];
  for (const method of ["createUserWithEmailAndPassword", "signInWithEmailAndPassword"]) {
    firebase[method] = async (...args) => { calls.push([method, ...args]); return { credential: "private-result" }; };
  }
  const client = firebaseAdapter.createFirebaseClient({ config: {}, firebase });
  const credentials = { email: " teacher@school.example ", password: " separate-CIRC-password " };
  assert.deepEqual(await client.signUpWithEmail(credentials), { status: "pending" });
  assert.deepEqual(await client.signInWithEmail(credentials), { status: "pending" });
  assert.deepEqual(calls, [
    ["createUserWithEmailAndPassword", "teacher@school.example", credentials.password],
    ["signInWithEmailAndPassword", "teacher@school.example", credentials.password]
  ]);
  assert.deepEqual(credentials, { email: " teacher@school.example ", password: " separate-CIRC-password " });
});

test("email validation rejects invalid fields without calling Firebase and preserves existing password sign-in", async () => {
  const firebase = firebaseDouble();
  let requests = 0;
  firebase.createUserWithEmailAndPassword = firebase.signInWithEmailAndPassword = async () => { requests += 1; };
  const client = firebaseAdapter.createFirebaseClient({ config: {}, firebase });
  assert.deepEqual(await client.signUpWithEmail({ email: "not-an-email", password: "long-enough" }), { status: "invalid-email" });
  assert.deepEqual(await client.signUpWithEmail({ email: "teacher@school.example", password: "short" }), { status: "weak-password" });
  assert.deepEqual(await client.signInWithEmail({ email: "teacher@school.example", password: "" }), { status: "invalid-credentials" });
  assert.equal(requests, 0);
  assert.deepEqual(await client.signInWithEmail({ email: "teacher@school.example", password: "older" }), { status: "pending" });
  assert.equal(requests, 1);
});

test("email failures identify provider and recovery states without exposing raw errors", async () => {
  for (const [code, status] of [
    ["auth/operation-not-allowed", "provider-disabled"],
    ["auth/invalid-email", "invalid-email"],
    ["auth/email-already-in-use", "email-in-use"],
    ["auth/weak-password", "weak-password"],
    ["auth/password-does-not-meet-requirements", "weak-password"],
    ["auth/invalid-credential", "invalid-credentials"],
    ["auth/wrong-password", "invalid-credentials"],
    ["auth/user-not-found", "invalid-credentials"],
    ["auth/too-many-requests", "too-many-requests"],
    ["auth/user-disabled", "account-disabled"],
    ["auth/network-request-failed", "offline"]
  ]) {
    const firebase = firebaseDouble();
    firebase.signInWithEmailAndPassword = async () => { throw Object.assign(new Error("secret account details"), { code }); };
    const client = firebaseAdapter.createFirebaseClient({ config: {}, firebase });
    assert.deepEqual(await client.signInWithEmail({ email: "teacher@school.example", password: "test-password" }), { status });
  }
});

test("password reset sends only the email and does not reveal an unregistered address", async () => {
  const firebase = firebaseDouble();
  const calls = [];
  firebase.sendPasswordResetEmail = async (...args) => calls.push(args);
  const client = firebaseAdapter.createFirebaseClient({ config: {}, firebase });
  assert.deepEqual(await client.requestPasswordReset({ email: " teacher@school.example ", password: "must-not-send" }), { status: "reset-requested" });
  assert.deepEqual(calls, [["teacher@school.example"]]);
  firebase.sendPasswordResetEmail = async () => { throw Object.assign(new Error("raw email"), { code: "auth/user-not-found" }); };
  assert.deepEqual(await client.requestPasswordReset({ email: "missing@school.example" }), { status: "reset-requested" });
  assert.deepEqual(await firebaseAdapter.createFirebaseClient().signUpWithEmail({}), { status: "not-configured" });
});

test("Google sign-in uses one popup on desktop and mobile-shaped calls", async () => {
  const createFirebaseClient = requireFactory("createFirebaseClient");
  const firebase = firebaseDouble();
  const client = createFirebaseClient({
    config: { projectId: "injected-test-project" },
    firebase
  });

  assert.deepEqual(await client.signInWithGoogle(), { status: "pending" });
  assert.deepEqual(await client.signInWithGoogle({ mobile: true }), { status: "pending" });
  assert.deepEqual(await client.signOut(), { status: "signed-out" });
  assert.deepEqual(firebase.calls.map((call) => call.kind), ["popup", "popup", "sign-out"]);
});

test("missing configuration and blocked dependency loading preserve safe local mode", async () => {
  const createBrowserFirebaseClient = requireFactory("createBrowserFirebaseClient");
  const notConfigured = await createBrowserFirebaseClient(null);
  const blocked = await createBrowserFirebaseClient(
    { projectId: "injected-test-project" },
    { loadDependencies: async () => { throw new Error("private module detail"); } }
  );

  assert.equal(notConfigured.status, "not-configured");
  assert.equal(blocked.status, "cloud-blocked");
  assert.equal(JSON.stringify({ notConfigured, blocked }).includes("private module detail"), false);
  assert.deepEqual(await notConfigured.signInWithGoogle({ mobile: false }), { status: "not-configured" });
  assert.deepEqual(await blocked.signOut(), { status: "cloud-blocked" });
});

test("auth failures are structured and never expose raw Firebase errors", async () => {
  const createFirebaseClient = requireFactory("createFirebaseClient");
  const firebase = firebaseDouble();
  firebase.signInWithPopup = async () => {
    const error = new Error("credential and account detail must not escape");
    error.code = "auth/network-request-failed";
    throw error;
  };
  firebase.signOut = async () => {
    const error = new Error("permission detail must not escape");
    error.code = "auth/unauthenticated";
    throw error;
  };
  const client = createFirebaseClient({
    config: { projectId: "injected-test-project" },
    firebase
  });

  const signInResult = await client.signInWithGoogle({ mobile: false });
  const signOutResult = await client.signOut();

  assert.deepEqual(signInResult, { status: "offline" });
  assert.deepEqual(signOutResult, { status: "denied" });
  assert.equal(JSON.stringify({ signInResult, signOutResult }).includes("detail"), false);
});

test("popup failures map to exact recoverable auth statuses without raw details", async () => {
  const createFirebaseClient = requireFactory("createFirebaseClient");
  const cases = [
    ["auth/popup-blocked", "popup-blocked"],
    ["auth/popup-closed-by-user", "popup-closed"],
    ["auth/cancelled-popup-request", "popup-closed"],
    ["auth/unauthorized-domain", "unauthorized-domain"],
    ["auth/network-request-failed", "offline"],
    ["auth/internal-error", "denied"]
  ];

  for (const [code, status] of cases) {
    const firebase = firebaseDouble();
    firebase.signInWithPopup = async () => {
      throw Object.assign(new Error(`raw ${code} credential detail`), { code });
    };
    const client = createFirebaseClient({
      config: { projectId: "injected-test-project" },
      firebase
    });

    const result = await client.signInWithGoogle();

    assert.deepEqual(result, { status });
    assert.doesNotMatch(JSON.stringify(result), /raw|credential|auth\//i);
  }
});

test("all Firebase lifecycle clients expose the closed room surface", async () => {
  const createFirebaseClient = requireFactory("createFirebaseClient");
  const client = createFirebaseClient();

  assert.deepEqual(await client.loadRoomMembership("teacher-uid"), {
    status: "not-configured",
    membership: null,
    room: null
  });
  assert.deepEqual(await client.loadSharedArtifact({ tenantId: "tenant-1", roomId: "room-1" }), {
    status: "not-configured",
    revision: null,
    value: null,
    projectProgress: null
  });
  assert.deepEqual(await client.redeemRoomInvite("TEST"), {
    status: "not-configured",
    membership: null
  });
  assert.deepEqual(await client.createTenantRoom({}), { status: "not-configured" });
  assert.deepEqual(await client.saveSharedArtifact({}), {
    status: "not-configured",
    revision: null,
    value: null,
    projectProgress: null
  });
});
