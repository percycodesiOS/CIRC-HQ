# CIRC HQ Guided Setup and Cloud Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace CIRC HQ's cartoon first-run branch with a mature guided teacher setup and add verified Firebase authentication, private per-teacher synchronization, and trusted shared-room project state.

**Architecture:** Keep the current local state as the offline and recovery source, then partition admitted cloud data into private UID-scoped domains and trusted room domains. A new setup controller drives authentication, plan preview, room membership, explicit upload, and read-back verification while the existing Today and runner code remain intact.

**Tech Stack:** Static HTML and CSS, native ES modules, Node test runner, Firebase JavaScript SDK 10.12.2, Firebase Authentication, Cloud Firestore, Web Crypto, Firestore Rules emulator, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-09-01-circ-hq-cloud-setup-design.md`

## Global Constraints

- CIRC HQ and CyberGrader use separate Firebase projects and namespaces.
- No teacher plan, schedule, duty, note, private resource, credential, access token, invite token, or student data is committed to Git.
- Kenny and Tammy use separate authenticated accounts.
- Private teacher data is UID-scoped and is never readable by another teacher.
- Shared room data is available only to trusted room members.
- Board and Student views have no accounts and no direct cloud-write path.
- Live experience runners remain owned by the device running the class for this release.
- Local storage remains the offline cache and recovery layer.
- Cloud migration requires preview, explicit confirmation, write, read-back verification, and preserved local backup.
- Sync conflicts stop the affected cloud write and are never silently discarded.
- Product copy contains no em dash or en dash.
- Do not push until the full local verification sequence passes. Kenny's September 1 message explicitly authorizes the final push.

---

### Task 1: Setup State Machine and Human-Readable Plan Summary

**Files:**
- Create: `src/model/setup-flow.js`
- Test: `tests/setup-flow.test.mjs`

**Interfaces:**
- Consumes: validated `playbook.teacherPlan.v2` values from `validateTeacherPlan()`.
- Produces: `SETUP_STEPS`, `createSetupState()`, `advanceSetup()`, `summarizeTeacherPlan()`, and `setupCompletionSummary()`.

- [ ] **Step 1: Write the failing setup-state tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  SETUP_STEPS,
  advanceSetup,
  createSetupState,
  summarizeTeacherPlan
} from "../src/model/setup-flow.js";

test("setup begins with Google sign-in as the single current action", () => {
  const state = createSetupState();
  assert.equal(state.current, "account");
  assert.deepEqual(SETUP_STEPS, ["account", "teacher", "plan", "room", "upload", "verify", "complete"]);
});

test("setup cannot skip required verification", () => {
  const state = createSetupState({ account: { uid: "kenny" } });
  assert.throws(() => advanceSetup(state, "complete"), /setup-step-blocked/);
});

test("teacher plan summary uses teacher-facing facts", () => {
  const summary = summarizeTeacherPlan(globalThis.teacherPlanFixture);
  assert.equal(summary.teacherName, "Kenny");
  assert.equal(summary.cycleDayCount, 5);
  assert.ok(summary.eventCount > 0);
  assert.match(summary.dateRange, /2026/);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/setup-flow.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/model/setup-flow.js`.

- [ ] **Step 3: Implement the minimal setup state machine**

```js
export const SETUP_STEPS = Object.freeze([
  "account", "teacher", "plan", "room", "upload", "verify", "complete"
]);

export function createSetupState(seed = {}) {
  return {
    current: seed.account ? "teacher" : "account",
    account: seed.account ?? null,
    teacherConfirmed: false,
    planPreview: null,
    room: null,
    uploadConfirmed: false,
    verification: null
  };
}

export function advanceSetup(state, target) {
  const currentIndex = SETUP_STEPS.indexOf(state.current);
  const targetIndex = SETUP_STEPS.indexOf(target);
  if (targetIndex !== currentIndex + 1) throw new Error("setup-step-blocked");
  return { ...structuredClone(state), current: target };
}
```

`summarizeTeacherPlan()` must call `validateTeacherPlan()`, count cycle days and events, derive the calendar date range, and return validation warnings without returning the original plan.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run: `node --test tests/setup-flow.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit the setup model**

```bash
git add src/model/setup-flow.js tests/setup-flow.test.mjs
git commit -m "feat: model guided teacher setup"
```

### Task 2: Private and Shared Cloud Partitioning

**Files:**
- Create: `src/storage/cloud-domains.js`
- Test: `tests/cloud-domains.test.mjs`
- Modify: `src/model/access.js`

**Interfaces:**
- Consumes: admitted local state from `admitLocalState()`.
- Produces: `partitionPrivateDomains(state)`, `partitionSharedDomains(state)`, `applyPrivateDomains(local, cloud)`, `applySharedDomains(local, cloud)`, and `assertCloudDomainShape(domain, value)`.

- [ ] **Step 1: Write failing partition tests**

```js
test("private cloud data excludes runners and shared artifacts", () => {
  const domains = partitionPrivateDomains(stateFixture());
  const serialized = JSON.stringify(domains);
  assert.doesNotMatch(serialized, /experienceRunners|sharedArtifacts/);
  assert.deepEqual(Object.keys(domains).sort(), ["content", "plan", "preferences", "progress"]);
});

test("shared cloud data contains only admitted room domains", () => {
  const domains = partitionSharedDomains(stateFixture());
  assert.deepEqual(Object.keys(domains).sort(), ["artifacts", "projectProgress"]);
  assert.doesNotMatch(JSON.stringify(domains), /schedule|duty|notes|resources|preferences/);
});

test("unknown cloud fields fail closed", () => {
  assert.throws(() => assertCloudDomainShape("plan", { plan: null, token: "no" }), /cloud-domain-invalid/);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/cloud-domains.test.mjs`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement explicit allowlisted partitions**

```js
const PRIVATE_CONTENT_FIELDS = Object.freeze([
  "checklist", "classes", "lessonGuides", "specialEvents", "resources", "notes", "tombstones"
]);

export function partitionPrivateDomains(state) {
  const admitted = admitLocalState(state);
  return {
    plan: { plan: structuredClone(admitted.plan) },
    progress: { teacherProgress: structuredClone(admitted.teacherProgress ?? {}) },
    preferences: { preferences: structuredClone(admitted.preferences ?? {}) },
    content: Object.fromEntries(PRIVATE_CONTENT_FIELDS.map((key) => [key, structuredClone(admitted[key] ?? [])]))
  };
}
```

Implement the shared partition by projecting admitted `sharedArtifacts` and room-level project progress only. Each cloud-domain validator must reject unknown keys, runners, credentials, authentication fields, student submissions, and private fields in shared data.

- [ ] **Step 4: Run partition and security tests**

Run: `node --test tests/cloud-domains.test.mjs tests/security.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit cloud domain boundaries**

```bash
git add src/storage/cloud-domains.js src/model/access.js tests/cloud-domains.test.mjs tests/security.test.mjs
git commit -m "feat: separate private and shared cloud data"
```

### Task 3: Firebase Auth and Verified Private Sync Adapter

**Files:**
- Replace: `src/storage/firebase-adapter.js`
- Create: `src/storage/cloud-sync.js`
- Modify: `tests/firebase-adapter.test.mjs`
- Create: `tests/cloud-sync.test.mjs`

**Interfaces:**
- Consumes: Firebase dependencies and the partition functions from Task 2.
- Produces: `createBrowserFirebaseClient(config)`, `observeAuth(listener)`, `signInWithGoogle({ mobile })`, `signOut()`, `loadPrivateDomains(uid)`, `savePrivateDomain(uid, domain, value, expectedRevision)`, and `verifyPrivateDomain(uid, domain, expectedRevision)`.

- [ ] **Step 1: Write failing adapter contract tests**

```js
test("private paths are UID and domain scoped", async () => {
  const firebase = firebaseDouble({ uid: "kenny" });
  const client = createFirebaseClient({ config: { projectId: "test" }, firebase });
  await client.loadPrivateDomains("kenny");
  assert.deepEqual(firebase.readPaths, [
    "playbookTeachers/kenny/private/plan",
    "playbookTeachers/kenny/private/progress",
    "playbookTeachers/kenny/private/preferences",
    "playbookTeachers/kenny/private/content"
  ]);
});

test("verified save reads the written revision back", async () => {
  const result = await client.savePrivateDomain("kenny", "plan", value, 3);
  assert.equal(result.status, "verified");
  assert.equal(result.revision, 4);
  assert.deepEqual(firebase.calls.map((call) => call.kind), ["transaction", "get"]);
});

test("revision mismatch stops without overwrite", async () => {
  const result = await client.savePrivateDomain("kenny", "plan", value, 2);
  assert.equal(result.status, "conflict");
  assert.equal(firebase.writeCount, 0);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/firebase-adapter.test.mjs tests/cloud-sync.test.mjs`

Expected: FAIL because the old adapter exposes a whole-state API and no verified domain sync.

- [ ] **Step 3: Implement auth observation and domain transactions**

Use Firebase modular imports from the existing pinned module root. Desktop uses `signInWithPopup`; mobile fallback uses `signInWithRedirect`. `observeAuth()` wraps `onAuthStateChanged`. Private domain writes use `runTransaction`, require the expected revision, add `serverTimestamp()`, then perform a separate `getDoc()` read-back.

The client returns structured results only:

```js
{ status: "verified", revision, value }
{ status: "conflict", revision, value }
{ status: "offline", revision: null, value: null }
{ status: "denied", revision: null, value: null }
```

Do not return access tokens, Firebase internals, or raw exceptions to the UI.

- [ ] **Step 4: Run adapter, sync, and security tests**

Run: `node --test tests/firebase-adapter.test.mjs tests/cloud-sync.test.mjs tests/security.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit private cloud sync**

```bash
git add src/storage/firebase-adapter.js src/storage/cloud-sync.js tests/firebase-adapter.test.mjs tests/cloud-sync.test.mjs tests/security.test.mjs
git commit -m "feat: verify private teacher cloud sync"
```

### Task 4: Trusted Room Membership, Invites, and Artifact Transactions

**Files:**
- Create: `src/storage/room-sync.js`
- Create: `tests/room-sync.test.mjs`
- Modify: `src/model/shared-artifact.js`

**Interfaces:**
- Consumes: authenticated UID, Web Crypto, Firebase transaction primitives, and admitted shared-artifact updates.
- Produces: `generateRoomInvite()`, `hashInviteCode(code)`, `createTenantRoom(input)`, `redeemRoomInvite(code)`, `loadRoomMembership(uid)`, and `saveSharedArtifact(input)`.

- [ ] **Step 1: Write failing invite and artifact tests**

```js
test("raw room invitation is never written", async () => {
  const invite = await generateRoomInvite({ crypto: cryptoDouble });
  assert.match(invite.code, /^[A-Z2-9-]{20,}$/);
  assert.equal(invite.document.id, await hashInviteCode(invite.code));
  assert.doesNotMatch(JSON.stringify(invite.document.data), new RegExp(invite.code));
});

test("invite redemption atomically consumes invite and creates own membership", async () => {
  const result = await client.redeemRoomInvite(validCode);
  assert.equal(result.status, "joined");
  assert.equal(result.membership.uid, "tammy");
  assert.equal(firebase.transactions.length, 1);
});

test("artifact update requires the next revision", async () => {
  const result = await client.saveSharedArtifact({ expectedRevision: 8, artifact: nextArtifact });
  assert.equal(result.status, "verified");
  assert.equal(result.revision, 9);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/room-sync.test.mjs`

Expected: FAIL because `room-sync.js` does not exist.

- [ ] **Step 3: Implement secure invitation and room transactions**

Generate at least 128 bits with `crypto.getRandomValues()`. Encode with an unambiguous alphabet. Hash with `crypto.subtle.digest("SHA-256", bytes)` and store only the hexadecimal digest as the invitation document ID. Redemption writes `usedBy`, `usedAt`, and the joining user's membership in one transaction.

Artifact transactions must call the existing shared-artifact validator, compare `revision`, and preserve deterministic visit identity.

- [ ] **Step 4: Run room, artifact, and access tests**

Run: `node --test tests/room-sync.test.mjs tests/shared-artifact.test.mjs tests/access.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit trusted room sync**

```bash
git add src/storage/room-sync.js src/model/shared-artifact.js tests/room-sync.test.mjs tests/shared-artifact.test.mjs
git commit -m "feat: add trusted shared room sync"
```

### Task 5: Deployable Firestore Rules and Emulator Tests

**Files:**
- Create: `firestore.rules`
- Create: `firebase.json`
- Create: `.firebaserc.example`
- Create: `tests/firestore-rules.test.mjs`
- Modify: `package.json`
- Modify: `.gitignore`
- Remove: `firebase/playbook.rules.fragment`

**Interfaces:**
- Consumes: exact collection paths and schemas from Tasks 2 through 4.
- Produces: complete deny-by-default Firestore Rules and `npm run test:rules`.

- [ ] **Step 1: Add emulator test dependencies and failing rules tests**

Add development dependencies for `firebase-tools` and `@firebase/rules-unit-testing`, plus:

```json
"test:rules": "firebase emulators:exec --only firestore \"node --test tests/firestore-rules.test.mjs\""
```

The test suite creates contexts for `kenny`, `tammy`, `unrelated`, and unauthenticated. It must use `assertSucceeds` and `assertFails` for every acceptance rule in the design spec.

- [ ] **Step 2: Run and verify RED**

Run: `npm install && npm run test:rules`

Expected: FAIL because complete rules are not present.

- [ ] **Step 3: Implement complete deny-by-default rules**

Rules use helper functions for `signedIn()`, `ownsTeacher(uid)`, `isTenantMember(tenantId)`, `isTenantOwner(tenantId)`, allowed-key checks, and revision progression. Unknown documents and fields remain denied.

Private rule skeleton:

```text
match /playbookTeachers/{uid} {
  allow read, create, update: if request.auth != null && request.auth.uid == uid;
  allow delete: if false;
  match /private/{domain} {
    allow read, create, update: if request.auth != null
      && request.auth.uid == uid
      && domain in ["plan", "progress", "preferences", "content"]
      && validPrivateDomain(domain);
    allow delete: if false;
  }
}
```

Room rules require trusted membership. Invite creation requires owner identity. Invite consumption requires a valid unused invite and `getAfter()` proof that the joining UID's membership is created in the same transaction.

- [ ] **Step 4: Run the complete rules matrix**

Run: `npm run test:rules`

Expected: PASS for Kenny, Tammy, unrelated, and unauthenticated cases.

- [ ] **Step 5: Commit rules and tests**

```bash
git add package.json package-lock.json .gitignore firebase.json .firebaserc.example firestore.rules tests/firestore-rules.test.mjs firebase/playbook.rules.fragment
git commit -m "feat: enforce CIRC cloud security rules"
```

### Task 6: Mature Guided Setup UI

**Files:**
- Create: `src/ui/setup.js`
- Create: `tests/setup-ui.test.mjs`
- Modify: `app.css`
- Modify: `index.html`
- Modify: `mission-control.html`
- Modify: `src/ui/today-ui.js`

**Interfaces:**
- Consumes: setup state and callbacks supplied by `app.js`.
- Produces: `buildSetupView(model, actions)` and `buildSetupHelpView(model, actions)` DOM trees.

- [ ] **Step 1: Write failing rendering and accessibility tests**

```js
test("first run shows one mature setup action and a temporary demo action", () => {
  const view = buildSetupView(setupModel(), actionsDouble());
  assert.match(textOf(view), /Get CIRC HQ ready/);
  assert.match(textOf(view), /Continue with Google/);
  assert.match(textOf(view), /Explore a temporary demo/);
  assert.doesNotMatch(textOf(view), /Preview without saving/);
});

test("phone setup keeps the primary action before advanced details", () => {
  const html = serialize(buildSetupView(setupModel(), actionsDouble()));
  assert.ok(html.indexOf("Continue with Google") < html.indexOf("Setup help"));
});

test("demo help offers a direct setup exit and no dead controls", () => {
  const view = buildSetupHelpView(demoModel(), actionsDouble());
  assert.match(textOf(view), /Exit demo and set up CIRC HQ/);
  assert.equal(findEnabledMutationControls(view).length, 1);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/setup-ui.test.mjs tests/app-render.test.mjs`

Expected: FAIL because the setup UI module does not exist and old welcome copy remains.

- [ ] **Step 3: Implement setup DOM and approved visual system**

Use the current DOM helper rather than HTML strings. Use `assets/tech-terrarium-hero.webp` for the setup visual and brand crop. Build a numbered setup rail, one current-action panel, completed-step indicators, precise privacy copy, sync-status component, and setup-complete summary.

CSS requirements:

- Desktop split view at 980 pixels maximum width.
- Phone single column with primary action visible in the first 844-pixel viewport.
- No mascot asset on the first-run route.
- Minimum 44-pixel targets and at least 0.75rem navigation labels.
- Existing Today and runner selectors remain visually unchanged unless a shared token is deliberately reused.

- [ ] **Step 4: Run UI and accessibility tests**

Run: `node --test tests/setup-ui.test.mjs tests/app-render.test.mjs tests/today-render.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit the guided setup UI**

```bash
git add src/ui/setup.js src/ui/today-ui.js app.css index.html mission-control.html tests/setup-ui.test.mjs tests/app-render.test.mjs
git commit -m "feat: replace splash with guided teacher setup"
```

### Task 7: Runtime Integration and Local-First Sync Status

**Files:**
- Modify: `src/app.js`
- Modify: `src/storage/local-store.js`
- Modify: `src/ui/settings.js`
- Modify: `src/ui/room.js`
- Modify: `tests/app-render.test.mjs`
- Modify: `tests/local-store.test.mjs`
- Create: `tests/cloud-runtime.test.mjs`

**Interfaces:**
- Consumes: setup model, setup UI, Firebase client, domain sync, and room sync.
- Produces: the complete first-run and returning-user lifecycle.

- [ ] **Step 1: Write failing lifecycle tests**

```js
test("authenticated first run does not upload before explicit confirmation", async () => {
  const app = await renderCloudApp({ authUser: kenny, remote: emptyRemote() });
  await app.choosePlan(kennyPlanText);
  assert.equal(firebase.writeCount, 0);
  await app.confirmUpload();
  assert.ok(firebase.writeCount > 0);
});

test("verified returning teacher opens Today with cloud status", async () => {
  const app = await renderCloudApp({ authUser: kenny, remote: verifiedKennyRemote() });
  assert.match(textOf(app.root), /Today/);
  assert.match(textOf(app.root), /CIRC Cloud verified/);
});

test("offline teacher with a valid local plan can still teach", async () => {
  const app = await renderCloudApp({ authUser: null, local: validLocalState(), online: false });
  assert.match(textOf(app.root), /Today/);
  assert.match(textOf(app.root), /Offline, saved on this device/);
});

test("live runner is never included in a cloud write", async () => {
  await app.startRunner();
  assert.doesNotMatch(JSON.stringify(firebase.writes), /experienceRunners/);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/cloud-runtime.test.mjs tests/app-render.test.mjs tests/local-store.test.mjs`

Expected: FAIL because `app.js` still creates only `LocalStore` and has no setup controller.

- [ ] **Step 3: Wire auth, setup, migration, room, and status**

Inject the Firebase client as a service so tests never load the network SDK. Render local Today immediately for an admitted local plan. Observe auth after local render. Route a new user to guided setup, perform explicit migration, and call `replaceState()` only after local admission.

Add durable local sync metadata under `circHQ.k6.device.v1` with only non-secret values:

```js
{
  schemaVersion: 1,
  pendingDomains: ["plan"],
  lastVerifiedAt: "2026-09-01T...Z",
  lastVerifiedRevisions: { plan: 4 },
  tenantId: "...",
  roomId: "..."
}
```

Never store OAuth tokens or invite codes.

- [ ] **Step 4: Run runtime and regression tests**

Run: `node --test tests/cloud-runtime.test.mjs tests/app-render.test.mjs tests/local-store.test.mjs tests/settings.test.mjs tests/experience-runner.test.mjs tests/board-view.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit runtime integration**

```bash
git add src/app.js src/storage/local-store.js src/ui/settings.js src/ui/room.js tests/cloud-runtime.test.mjs tests/app-render.test.mjs tests/local-store.test.mjs
git commit -m "feat: connect local-first CIRC cloud runtime"
```

### Task 8: Public Boundary, Documentation, and Firebase Configuration

**Files:**
- Modify: `_config.yml`
- Modify: `scripts/dev-server.mjs`
- Modify: `scripts/verify-public.mjs`
- Replace: `firebase-config.example.js`
- Create: `firebase-config.js`
- Modify: `.gitignore`
- Modify: `README.md`
- Modify: `docs/FIREBASE-ACTIVATION-GATE.md`
- Modify: `BUILDLOG.md`
- Modify: `tests/public-shell.test.mjs`
- Modify: `tests/dev-server.test.mjs`
- Modify: `tests/security.test.mjs`

**Interfaces:**
- Consumes: the Firebase project's public web configuration.
- Produces: an exact reviewed public runtime manifest that includes cloud modules and excludes all private artifacts.

- [ ] **Step 1: Update public-boundary tests before the manifest**

Tests must require the exact cloud runtime modules, `firebase-config.js`, and no placeholder configuration in production. They must continue to reject local absolute paths, teacher-plan data, credentials, tokens, invite codes, service-account files, emulator exports, and unreviewed files.

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/public-shell.test.mjs tests/dev-server.test.mjs tests/security.test.mjs`

Expected: FAIL because cloud runtime files remain excluded and the production config is absent.

- [ ] **Step 3: Add exact public Firebase config and update gates**

Use only the Firebase console's public web options:

```js
export const firebaseConfig = Object.freeze({
  apiKey: "public Firebase web API key",
  authDomain: "project.firebaseapp.com",
  projectId: "project-id",
  storageBucket: "project.firebasestorage.app",
  messagingSenderId: "public sender id",
  appId: "public app id"
});
```

Do not include service-account credentials, private keys, server keys, access tokens, or refresh tokens. Restrict the public API key to Firebase APIs and authorized web origins in the console when available.

Update README and Setup Help to describe Google sign-in, separate teacher privacy, trusted shared room, local fallback, active-runner device ownership, and recovery.

- [ ] **Step 4: Run public and security gates**

Run: `node --test tests/public-shell.test.mjs tests/dev-server.test.mjs tests/security.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit the activation boundary**

```bash
git add _config.yml scripts/dev-server.mjs scripts/verify-public.mjs firebase-config.example.js firebase-config.js .gitignore README.md docs/FIREBASE-ACTIVATION-GATE.md BUILDLOG.md tests/public-shell.test.mjs tests/dev-server.test.mjs tests/security.test.mjs
git commit -m "docs: activate reviewed CIRC cloud boundary"
```

### Task 9: Complete Verification, Firebase Deployment, Push, and Live Smoke Test

**Files:**
- Modify if required by evidence: files from Tasks 1 through 8
- Update: `BUILDLOG.md`

**Interfaces:**
- Consumes: the completed implementation and explicit current-message push authorization.
- Produces: a verified local commit, deployed Firebase rules, pushed GitHub release, and live evidence.

- [ ] **Step 1: Run focused cloud and setup tests**

Run:

```bash
node --test tests/setup-flow.test.mjs tests/cloud-domains.test.mjs tests/firebase-adapter.test.mjs tests/cloud-sync.test.mjs tests/room-sync.test.mjs tests/setup-ui.test.mjs tests/cloud-runtime.test.mjs
```

Expected: all pass.

- [ ] **Step 2: Run Firestore Rules emulator tests**

Run: `npm run test:rules`

Expected: all persona and schema-boundary tests pass.

- [ ] **Step 3: Run the complete suite and verifier**

Run:

```bash
npm test
npm run verify
```

Expected: zero failures. The one documented private-package skip may remain only if its precondition is still true.

- [ ] **Step 4: Perform privacy and tracked-file checks**

Run:

```bash
git status --short
git diff --check
git ls-files
git grep -n -I -E "PRIVATE KEY|refresh[_-]?token|access[_-]?token|invite.*code|Kenny-CIRC-HQ-Teacher-Plan|Tammy-CIRC-HQ-Teacher-Plan"
```

Expected: only reviewed source changes; no private teacher file, secret, raw invite, or absolute local path.

- [ ] **Step 5: Deploy Firebase rules and verify denials**

Deploy only Firestore rules to the separate CIRC HQ Firebase project. Re-run one authenticated own-data read and one unrelated-user denial through the emulator or preview environment. Do not change billing.

- [ ] **Step 6: Commit final evidence**

Update `BUILDLOG.md` with exact test counts, verifier gates, Firebase project ID, rules deployment timestamp, Git commit, and unchanged private boundaries. Re-read the file after saving.

```bash
git add BUILDLOG.md
git commit -m "docs: record CIRC cloud release verification"
```

- [ ] **Step 7: Push the verified branch**

Run: `git push origin main`

Expected: remote `main` advances to the verified commit.

- [ ] **Step 8: Wait for Pages and smoke test live**

Verify HTTP 200, title, first-run setup on a clean browser context, temporary demo exit, phone viewport, Google sign-in initiation, and no private content in the page source or network manifest. Do not upload Kenny's or Tammy's private plan during an anonymous smoke test.

- [ ] **Step 9: Report exact usable-tomorrow steps**

Report the live URL and this first-use sequence:

1. Open CIRC HQ.
2. Continue with Google.
3. Confirm the teacher account.
4. Import the correct private teacher-plan file if cloud has no plan.
5. Review the schedule.
6. Create or join the CIRC room.
7. Upload and verify.
8. Open Today.

## Self-Review

- Spec coverage: Tasks 1 through 9 cover the guided setup, visual replacement, authentication, private domains, trusted shared room, migration preview, read-back verification, offline recovery, conflicts, runner ownership, rules personas, documentation, deployment, push, and live smoke tests.
- Placeholder scan: every implementation step contains an exact action and expected evidence. Project-specific Firebase web values are obtained from the created CIRC Firebase project during Task 8 and are explicitly limited to public web configuration.
- Type consistency: setup state, private domain names, room paths, revision fields, and structured result statuses are defined once and reused by later tasks.

## Execution Choice

Kenny chose immediate execution and explicitly authorized push on September 1, 2026. Use subagent-driven development for independent tasks, review each patch against this plan, integrate locally, run the complete verification sequence, and push only the verified release.
