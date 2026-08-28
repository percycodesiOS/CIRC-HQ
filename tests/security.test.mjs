import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import * as access from "../src/model/access.js";
import * as devServer from "../scripts/dev-server.mjs";
import { createClassroomProjection, createInitialState } from "../src/model/state.js";
import { validateTeacherPlan } from "../src/model/teacher-plan.js";
import { buildTeacherDocumentPatch, createFirebaseAdapter } from "../src/storage/firebase-adapter.js";
import { LocalStore, STATE_KEY } from "../src/storage/local-store.js";
import { mergeStates } from "../src/storage/sync-engine.js";
import { buildRoomView } from "../src/ui/room.js";
import { previewPlanImport } from "../src/ui/settings.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const LEGACY_SHA256 =
  "6E7FF5AA3B15A57A44F0D3351C6C6A5A3B3D14813E9B5616AF3D138C5E41B69F";
const verifier = await import("../scripts/verify-public.mjs").catch(() => null);

async function listFilesRecursively(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFilesRecursively(target));
    else if (entry.isFile()) files.push(target);
  }
  return files;
}

test("broad classroom projection returns only reviewed Board-safe fields", () => {
  const state = {
    format: "playbook.state.v1",
    schemaVersion: 1,
    updatedAt: "2026-08-28T12:00:00.000Z",
    plan: {
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
        id: "PRIVATE_TEACHER_ID",
        name: "PRIVATE_TEACHER_NAME",
        email: "private.teacher@example.invalid",
        days: {
          1: [{
            id: "event-safe",
            type: "teach",
            label: "PRIVATE_EVENT_LABEL",
            start: "09:00",
            end: "09:30",
            classId: "class-safe",
            lessonGuideId: "guide-safe",
            dutyDetails: { assignment: "PRIVATE_DUTY" },
            privateNote: "PRIVATE_EVENT_NOTE"
          }]
        }
      }],
      specialEvents: [{
        id: "private-special",
        type: "special",
        label: "PRIVATE_SPECIAL_EVENT",
        date: "2026-09-01",
        dutyDetails: { assignment: "PRIVATE_SPECIAL_DUTY" }
      }],
      resources: []
    },
    classes: [{
      id: "class-safe",
      title: "Reviewed class title",
      visibility: "classroom",
      reviewedForBoard: true,
      roster: ["PRIVATE_ROSTER_VALUE"],
      classCode: "PRIVATE_CLASS_CODE"
    }],
    lessonGuides: [{
      id: "guide-safe",
      title: "Reviewed lesson title",
      visibility: "classroom",
      reviewedForBoard: true,
      objective: "Reviewed objective",
      directions: ["Reviewed direction"],
      materials: ["Reviewed material"],
      currentProcessStep: "Reviewed process step",
      privateNote: "PRIVATE_LESSON_NOTE",
      teacherNotes: "PRIVATE_TEACHER_NOTE",
      privateLink: "https://example.invalid/private"
    }],
    specialEvents: [{
      id: "private-state-special",
      label: "PRIVATE_STATE_SPECIAL",
      dutyDetails: { assignment: "PRIVATE_STATE_DUTY" }
    }],
    resources: [],
    notes: [{ visibility: "teacher-private", text: "PRIVATE_NOTE" }],
    preferences: {
      teacherId: "PRIVATE_TEACHER_ID",
      privateSetting: "PRIVATE_PREFERENCE"
    }
  };

  assert.deepEqual(
    createClassroomProjection(state, "event-safe", {
      liveCountdown: { eventId: "event-safe", minutes: 7, target: "end" }
    }),
    {
      classTitle: "Reviewed class title",
      countdown: "7m to end",
      lessonTitle: "Reviewed lesson title",
      materials: ["Reviewed material"],
      directions: ["Reviewed direction"],
      objective: "Reviewed objective",
      currentProcessStep: "Reviewed process step"
    }
  );
});

test("shared resource admission rejects self-authorized unsafe records", () => {
  assert.equal(typeof access.admitResourceState, "function");

  const state = {
    resources: [{
      id: "safe-resource",
      title: "Reviewed resource",
      visibility: "teacher-private",
      href: "https://example.invalid/reviewed",
      note: "Reviewed note"
    }, {
      id: "self-authorized",
      title: "Unsafe resource",
      visibility: "teacher-private",
      validated: true,
      source: "authorized-cloud",
      href: "javascript:globalThis.genericProbe=1"
    }],
    plan: {
      resources: [{
        id: "unsafe-plan-resource",
        title: "Unsafe plan resource",
        visibility: "teacher-private",
        validated: true,
        source: "local",
        href: "/__private__/plan.json"
      }]
    }
  };

  const admitted = access.admitResourceState(state, { source: "local" });

  assert.deepEqual(admitted.resources, [{
    id: "safe-resource",
    title: "Reviewed resource",
    visibility: "teacher-private",
    href: "https://example.invalid/reviewed",
    external: true,
    note: "Reviewed note"
  }]);
  assert.deepEqual(admitted.plan.resources, []);
});

function resourcePlan(resources) {
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
    teachers: [{ id: "teacher-alpha", name: "Teacher Alpha", days: {} }],
    specialEvents: [],
    resources
  };
}

function safeResource(overrides = {}) {
  return {
    id: "safe-resource",
    title: "Reviewed resource",
    visibility: "teacher-private",
    href: "classroom-legacy.html?mode=one#start",
    note: "Reviewed note",
    updatedAt: "2026-08-28T12:00:00.000Z",
    ...overrides
  };
}

function unsafeResource(overrides = {}) {
  return {
    id: "unsafe-resource",
    title: "Unsafe resource",
    visibility: "teacher-private",
    validated: true,
    source: "authorized-cloud",
    href: "javascript:globalThis.genericProbe=1",
    privateNote: "PRIVATE_RESOURCE_NOTE",
    ...overrides
  };
}

function stateWithResources(resources) {
  return {
    ...createInitialState("2026-08-28T12:00:00.000Z"),
    resources
  };
}

function memoryStorage(entries = {}) {
  const values = new Map(Object.entries(entries));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    }
  };
}

test("plan import rejects an unsafe resource before preview", () => {
  const plan = resourcePlan([unsafeResource()]);

  const validated = validateTeacherPlan(plan);
  const preview = previewPlanImport(null, JSON.stringify(plan));

  assert.equal(validated.ok, false);
  assert.equal(validated.errors.some((error) => /resources\[0\]/.test(error)), true);
  assert.equal(preview.ok, false);
  assert.equal(preview.candidate, null);
});

test("plan validation stores only the normalized resource schema", () => {
  const resource = safeResource({
    validated: true,
    source: "local",
    privateNote: "PRIVATE_RESOURCE_NOTE",
    arbitrary: "PRIVATE_ARBITRARY_FIELD"
  });

  const validated = validateTeacherPlan(resourcePlan([resource]));

  assert.equal(validated.ok, true);
  assert.deepEqual(validated.value.resources, [{
    id: "safe-resource",
    title: "Reviewed resource",
    visibility: "teacher-private",
    href: "/classroom-legacy.html?mode=one#start",
    external: false,
    note: "Reviewed note",
    updatedAt: "2026-08-28T12:00:00.000Z"
  }]);
});

test("local persistence drops unsafe resources on load save and export", () => {
  const storage = memoryStorage({
    [STATE_KEY]: JSON.stringify(stateWithResources([safeResource(), unsafeResource()]))
  });
  const store = new LocalStore(storage, {
    now: () => "2026-08-28T12:00:00.000Z"
  });

  const loaded = store.load().state;
  store.save(stateWithResources([safeResource(), unsafeResource()]));
  const saved = JSON.parse(storage.getItem(STATE_KEY));
  const exported = store.exportState();

  for (const resources of [loaded.resources, saved.resources, exported.resources]) {
    assert.deepEqual(resources.map((resource) => resource.id), ["safe-resource"]);
    assert.equal(JSON.stringify(resources).includes("genericProbe"), false);
    assert.equal(JSON.stringify(resources).includes("PRIVATE_RESOURCE_NOTE"), false);
  }
});

test("sync admission removes unsafe local and remote resources", () => {
  const local = stateWithResources([safeResource()]);
  const remote = stateWithResources([unsafeResource()]);

  const merged = mergeStates(local, remote);

  assert.deepEqual(merged.state.resources.map((resource) => resource.id), ["safe-resource"]);
  assert.equal(JSON.stringify(merged.state.resources).includes("genericProbe"), false);
});

test("Firebase load and write patch admit only safe resources", async () => {
  const remote = stateWithResources([safeResource(), unsafeResource()]);
  const firebase = {
    currentUser: () => ({ uid: "teacher-uid" }),
    getDocument: async () => remote,
    setDocument: async () => {}
  };
  const adapter = createFirebaseAdapter({ config: { projectId: "injected" }, firebase });

  const loaded = await adapter.loadPrivateState();
  const patch = buildTeacherDocumentPatch(remote);

  assert.deepEqual(loaded.state.resources.map((resource) => resource.id), ["safe-resource"]);
  assert.deepEqual(
    patch.playbookPrivateV1.resources.map((resource) => resource.id),
    ["safe-resource"]
  );
  assert.equal(JSON.stringify({ loaded, patch }).includes("genericProbe"), false);
});

test("Room presents only fields returned by shared resource admission", () => {
  const view = buildRoomView({
    resources: [safeResource({
      validated: true,
      source: "local",
      privateNote: "PRIVATE_RESOURCE_NOTE",
      arbitrary: "PRIVATE_ARBITRARY_FIELD"
    }), unsafeResource()]
  });

  assert.deepEqual(view.privateResources, [{
    id: "safe-resource",
    title: "Reviewed resource",
    note: "Reviewed note",
    safeHref: "/classroom-legacy.html?mode=one#start",
    external: false
  }]);
  assert.equal(JSON.stringify(view).includes("PRIVATE_RESOURCE_NOTE"), false);
  assert.equal(JSON.stringify(view).includes("genericProbe"), false);
});

test("public server manifest is an exact reviewed allowlist", () => {
  assert.equal(typeof devServer.getPublicStaticManifest, "function");
  assert.deepEqual(devServer.getPublicStaticManifest(), [
    "app.css",
    "classroom-legacy.html",
    "index.html",
    "mission-control.html",
    "src/app.js",
    "src/model/access.js",
    "src/model/lesson-guide.js",
    "src/model/schedule.js",
    "src/model/state.js",
    "src/model/teacher-plan-v1.js",
    "src/model/teacher-plan.js",
    "src/services/weather.js",
    "src/storage/local-store.js",
    "src/ui/board.js",
    "src/ui/curriculum.js",
    "src/ui/room.js",
    "src/ui/settings.js",
    "src/ui/today-ui.js",
    "src/ui/view-model.js"
  ]);
});

test("public verifier has a recursive-safe sanitized gate contract", () => {
  assert.notEqual(verifier, null);
  assert.equal(typeof verifier.parseNulList, "function");
  assert.equal(typeof verifier.classifyCandidatePaths, "function");
  assert.equal(typeof verifier.getGateNames, "function");
  assert.deepEqual(verifier.getGateNames(), [
    "candidate-boundary",
    "entrypoint-identity",
    "legacy-lock",
    "firebase-placeholders",
    "typography-scan",
    "credential-scan",
    "privacy-sentinel-scan",
    "public-runtime-policy",
    "dom-sink-scan",
    "server-allowlist",
    "javascript-syntax",
    "node-tests"
  ]);

  assert.deepEqual(
    verifier.parseNulList(Buffer.from("index.html\0src/app.js\0", "utf8")),
    ["index.html", "src/app.js"]
  );
  assert.deepEqual(
    verifier.classifyCandidatePaths(
      ["index.html", "tests/security.test.mjs", "unexpected.txt"],
      ["index.html"]
    ),
    {
      candidateCount: 3,
      trackedCount: 1,
      allowedUntrackedCount: 1,
      unexpectedUntrackedCount: 1,
      forbiddenCandidateCount: 0,
      unreviewedCandidateCount: 1,
      unsupportedCandidateCount: 0
    }
  );
});

test("candidate classifier rejects forbidden namespaces even when tracked", () => {
  assert.deepEqual(
    verifier.classifyCandidatePaths([
      "index.html",
      ".superpowers/private/generic.json",
      ".git/config",
      ".internal/generic.txt",
      "private-data/generic.json",
      "scripts/verify-public.mjs"
    ], [
      "index.html",
      ".superpowers/private/generic.json",
      ".git/config",
      ".internal/generic.txt",
      "private-data/generic.json"
    ]),
    {
      candidateCount: 6,
      trackedCount: 5,
      allowedUntrackedCount: 1,
      unexpectedUntrackedCount: 0,
      forbiddenCandidateCount: 4,
      unreviewedCandidateCount: 4,
      unsupportedCandidateCount: 1
    }
  );
});

test("candidate boundary reads a temporary Git repository and fails closed", async (context) => {
  assert.equal(typeof verifier.inspectCandidateBoundary, "function");
  const repository = await mkdtemp(path.join(os.tmpdir(), "circ-hq-candidate-boundary-"));
  context.after(() => rm(repository, { recursive: true, force: true }));
  execFileSync("git", ["init", "-q"], { cwd: repository });
  await Promise.all([
    writeFile(path.join(repository, "index.html"), "GENERIC_INDEX"),
    mkdir(path.join(repository, ".superpowers", "private"), { recursive: true }),
    mkdir(path.join(repository, "scripts"), { recursive: true }),
    mkdir(path.join(repository, "tests"), { recursive: true })
  ]);
  await Promise.all([
    writeFile(
      path.join(repository, ".superpowers", "private", "generic.json"),
      "GENERIC_FORBIDDEN"
    ),
    writeFile(path.join(repository, "scripts", "verify-public.mjs"), "GENERIC_ALLOWED"),
    writeFile(path.join(repository, "tests", "security.test.mjs"), "GENERIC_ALLOWED"),
    writeFile(path.join(repository, "unexpected.txt"), "GENERIC_UNEXPECTED")
  ]);
  execFileSync(
    "git",
    ["add", "--", "index.html", ".superpowers/private/generic.json"],
    { cwd: repository }
  );

  const result = verifier.inspectCandidateBoundary(repository);

  assert.deepEqual(result, {
    ok: false,
    count: 2,
    candidateCount: 5,
    trackedCount: 2,
    allowedUntrackedCount: 2,
    unexpectedUntrackedCount: 1,
    forbiddenCandidateCount: 1,
    unreviewedCandidateCount: 2,
    unsupportedCandidateCount: 0
  });
});

test("public verifier rejects tracked opaque and unreviewed text candidates end to end", async (context) => {
  const repository = await mkdtemp(path.join(os.tmpdir(), "circ-hq-candidate-manifest-"));
  context.after(() => rm(repository, { recursive: true, force: true }));
  execFileSync("git", ["init", "-q"], { cwd: repository });
  await mkdir(path.join(repository, "notes"), { recursive: true });
  await Promise.all([
    writeFile(path.join(repository, "index.html"), "GENERIC_INDEX"),
    writeFile(path.join(repository, "opaque.pdf"), Buffer.from([0xff])),
    writeFile(path.join(repository, "notes", "generic.txt"), "GENERIC_UNREVIEWED_CONTENT")
  ]);
  execFileSync("git", ["add", "--", "index.html", "opaque.pdf", "notes/generic.txt"], {
    cwd: repository
  });

  const moduleUrl = pathToFileURL(path.join(ROOT, "scripts", "verify-public.mjs")).href;
  const childSource = [
    `import { runPublicVerification } from ${JSON.stringify(moduleUrl)};`,
    `const passed = await runPublicVerification(${JSON.stringify(repository)});`,
    "if (!passed) process.exitCode = 1;"
  ].join("\n");
  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", childSource], {
    cwd: repository,
    encoding: "utf8",
    windowsHide: true
  });

  assert.equal(result.status, 1);
  assert.equal(result.stderr, "");
  const lines = result.stdout.trim().split(/\r?\n/);
  assert.equal(lines.length, verifier.getGateNames().length);
  assert.equal(lines.some((line) => line === "FAIL candidate-boundary count=2"), true);
  assert.equal(lines.every((line) => /^(?:PASS|FAIL) [a-z-]+ count=\d+$/.test(line)), true);
  assert.doesNotMatch(result.stdout, /opaque|generic|unreviewed|content/i);
});

test("release locks accept both autocrlf checkouts and reject substantive changes", async (context) => {
  assert.equal(typeof verifier.inspectReleaseLocks, "function");
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "circ-hq-eol-locks-"));
  context.after(() => rm(fixtureRoot, { recursive: true, force: true }));
  const source = path.join(fixtureRoot, "source");
  await mkdir(source, { recursive: true });
  const canonicalLegacy = (await readFile(path.join(ROOT, "classroom-legacy.html"), "utf8"))
    .replaceAll("\r\n", "\n");
  const canonicalFirebase = (await readFile(path.join(ROOT, "firebase-config.example.js"), "utf8"))
    .replaceAll("\r\n", "\n");
  await Promise.all([
    writeFile(path.join(source, "classroom-legacy.html"), canonicalLegacy),
    writeFile(path.join(source, "firebase-config.example.js"), canonicalFirebase)
  ]);
  execFileSync("git", ["init", "-q"], { cwd: source });
  execFileSync("git", ["add", "--", "classroom-legacy.html", "firebase-config.example.js"], {
    cwd: source
  });
  execFileSync("git", [
    "-c", "user.name=Generic Test",
    "-c", "user.email=generic@example.invalid",
    "commit", "-qm", "generic fixture"
  ], { cwd: source });

  for (const autocrlf of ["true", "false"]) {
    const checkout = path.join(fixtureRoot, `checkout-${autocrlf}`);
    execFileSync("git", ["clone", "-q", "--no-checkout", source, checkout]);
    execFileSync("git", ["config", "core.autocrlf", autocrlf], { cwd: checkout });
    execFileSync("git", ["checkout", "-q"], { cwd: checkout });

    assert.deepEqual(await verifier.inspectReleaseLocks(checkout), {
      legacyOk: true,
      firebaseOk: true
    });
    await writeFile(path.join(checkout, "classroom-legacy.html"), `${canonicalLegacy}GENERIC_CHANGE\n`);
    assert.deepEqual(await verifier.inspectReleaseLocks(checkout), {
      legacyOk: false,
      firebaseOk: true
    });
    await writeFile(path.join(checkout, "classroom-legacy.html"), canonicalLegacy);
    await writeFile(
      path.join(checkout, "firebase-config.example.js"),
      `${canonicalFirebase}GENERIC_CHANGE\n`
    );
    assert.deepEqual(await verifier.inspectReleaseLocks(checkout), {
      legacyOk: true,
      firebaseOk: false
    });
  }
});

test("verifier refreshes candidates after reviewed tests finish", async (context) => {
  const repository = await mkdtemp(path.join(os.tmpdir(), "circ-hq-post-test-refresh-"));
  context.after(() => rm(repository, { recursive: true, force: true }));
  await mkdir(path.join(repository, "tests"), { recursive: true });
  await writeFile(path.join(repository, "tests", "security.test.mjs"), [
    'import { writeFileSync } from "node:fs";',
    'import test from "node:test";',
    `const artifactPath = ${JSON.stringify(path.join(repository, "unexpected6.pdf"))};`,
    'test("generic reviewed test", () => writeFileSync(artifactPath, Buffer.from([6])));'
  ].join("\n"));
  execFileSync("git", ["init", "-q"], { cwd: repository });
  execFileSync("git", ["add", "--", "tests/security.test.mjs"], { cwd: repository });
  const cleanTestEnvironment = { ...process.env };
  delete cleanTestEnvironment.NODE_TEST_CONTEXT;

  const moduleUrl = pathToFileURL(path.join(ROOT, "scripts", "verify-public.mjs")).href;
  const childSource = [
    `import { runPublicVerification } from ${JSON.stringify(moduleUrl)};`,
    `const passed = await runPublicVerification(${JSON.stringify(repository)});`,
    "if (!passed) process.exitCode = 1;"
  ].join("\n");
  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", childSource], {
    cwd: repository,
    encoding: "utf8",
    env: cleanTestEnvironment,
    windowsHide: true
  });

  assert.equal(result.status, 1);
  assert.equal(result.stderr, "");
  const lines = result.stdout.trim().split(/\r?\n/);
  assert.equal(lines.length, verifier.getGateNames().length);
  assert.equal(lines.find((line) => line.includes("node-tests")), "PASS node-tests count=1");
  const artifact = await readFile(path.join(repository, "unexpected6.pdf"));
  assert.equal(artifact.equals(Buffer.from([6])), true);
  assert.equal(lines.filter((line) => line.startsWith("FAIL candidate-boundary ")).length, 1);
  assert.equal(lines.includes("FAIL candidate-boundary count=1"), true);
  assert.equal(lines.every((line) => /^(?:PASS|FAIL) [a-z-]+ count=\d+$/.test(line)), true);
  assert.doesNotMatch(result.stdout, /unexpected6|generic reviewed|Buffer/i);
});

test("public candidates exclude ignored private and SDD paths", () => {
  const candidates = verifier.parseNulList(execFileSync(
    "git",
    ["ls-files", "-co", "--exclude-standard", "-z"],
    { cwd: ROOT }
  ));
  const tracked = verifier.parseNulList(execFileSync(
    "git",
    ["ls-files", "-z"],
    { cwd: ROOT }
  ));
  const counts = verifier.classifyCandidatePaths(candidates, tracked);

  assert.equal(counts.unexpectedUntrackedCount, 0);
  assert.equal(counts.unreviewedCandidateCount, 0);
  assert.equal(counts.unsupportedCandidateCount, 0);
  assert.equal(candidates.some((candidate) => candidate.startsWith(".superpowers/")), false);
  assert.equal(execFileSync(
    "git",
    ["ls-files", "-z", "--", ".superpowers"],
    { cwd: ROOT }
  ).length, 0);
  for (const ignoredPath of [
    ".superpowers/private/task-5-migration-options.json",
    ".superpowers/sdd/2026-08-27-circ-hq-playbook/task-6-report.md"
  ]) {
    const ignored = spawnSync("git", ["check-ignore", "-q", "--", ignoredPath], { cwd: ROOT });
    assert.equal(ignored.status, 0);
  }
});

test("verifier detectors fail closed for credential shapes and unsafe web links", () => {
  assert.equal(typeof verifier.countCredentialViolations, "function");
  assert.equal(typeof verifier.countUnsafeRuntimeLinks, "function");

  const credentialShape = ["AK", "IA", "A".repeat(16)].join("");
  const privateKeyMarker = ["-----BEGIN ", "PRIVATE ", "KEY-----"].join("");
  assert.equal(verifier.countCredentialViolations(`${credentialShape}\n${privateKeyMarker}`), 2);
  assert.equal(verifier.countCredentialViolations("YOUR_API_KEY"), 0);

  assert.equal(verifier.countUnsafeRuntimeLinks([
    "https://open-meteo.com/",
    "https://api.open-meteo.com/v1/forecast",
    "http://www.w3.org/2000/svg",
    "http://127.0.0.1:4173/"
  ].join("\n")), 0);
  assert.equal(verifier.countUnsafeRuntimeLinks([
    "http://example.invalid/",
    "https://unreviewed.example.invalid/"
  ].join("\n")), 2);
});

test("Firebase teacher writes keep one private document boundary", async () => {
  const writes = [];
  const adapter = createFirebaseAdapter({
    config: { projectId: "injected" },
    firebase: {
      currentUser: () => ({ uid: "teacher-uid" }),
      getDocument: async () => null,
      setDocument: async (...args) => writes.push(args)
    }
  });
  const result = await adapter.savePrivateState(stateWithResources([safeResource()]));

  assert.equal(result.status, "saved");
  assert.equal(writes.length, 1);
  assert.equal(writes[0][0], "playbookTeachers/teacher-uid");
  assert.deepEqual(Object.keys(writes[0][1]), ["playbookPrivateV1"]);
  assert.deepEqual(writes[0][2], { merge: true });
});

test("separate-project shared mode stays blocked without trusted membership", () => {
  assert.equal(access.getAccessMode({
    configured: true,
    user: { uid: "teacher-uid" },
    requestedShared: true,
    membership: { trusted: false }
  }), "shared-blocked");
  assert.equal(access.getAccessMode({
    configured: true,
    user: { uid: "teacher-uid" },
    requestedShared: true,
    membership: null
  }), "shared-blocked");
});

test("resource admission rejects the complete unsafe URL matrix", () => {
  const unsafeHrefs = [
    "javascript:genericProbe=1",
    "java%73cript:genericProbe=1",
    "data:text/plain,generic",
    "file:///generic.txt",
    "vbscript:genericProbe",
    "//example.invalid/generic",
    "http://example.invalid/generic",
    "https://user:password@example.invalid/generic",
    "classroom-legacy.html\\generic",
    "../classroom-legacy.html",
    "%252e%252e/classroom-legacy.html",
    "/__private__/plan.json"
  ];

  for (const href of unsafeHrefs) {
    assert.equal(access.admitResource(safeResource({ href })), null);
  }
  assert.equal(access.admitResource(safeResource({ href: "classroom-legacy.html" })).href,
    "/classroom-legacy.html");
  assert.equal(access.admitResource(safeResource({ href: "https://example.invalid/generic" })).external,
    true);
});

test("production JavaScript uses no HTML parsing sinks", async () => {
  const files = (await listFilesRecursively(path.join(ROOT, "src")))
    .filter((file) => file.endsWith(".js"));
  const source = (await Promise.all(files.map((file) => readFile(file, "utf8")))).join("\n");

  assert.doesNotMatch(source, /\.innerHTML\s*=/);
  assert.doesNotMatch(source, /\.outerHTML\s*=/);
  assert.doesNotMatch(source, /\binsertAdjacentHTML\s*\(/);
  assert.doesNotMatch(source, /\bdocument\.write\s*\(/);
  assert.doesNotMatch(source, /\bcreateContextualFragment\s*\(/);
});

test("Firebase example remains inert exact placeholders", async () => {
  const source = await readFile(path.join(ROOT, "firebase-config.example.js"), "utf8");
  assert.equal(source, `export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
`);
});

test("new public runtime has no student identity or CyberGrader path", async () => {
  const sourceFiles = (await listFilesRecursively(path.join(ROOT, "src")))
    .filter((file) => file.endsWith(".js"));
  const files = [
    path.join(ROOT, "index.html"),
    path.join(ROOT, "mission-control.html"),
    path.join(ROOT, "app.css"),
    ...sourceFiles
  ];
  const source = (await Promise.all(files.map((file) => readFile(file, "utf8")))).join("\n");

  assert.doesNotMatch(source, /CyberGrader/i);
  assert.doesNotMatch(source, /\b(?:classCode|joinCode|studentAlias|studentAccount|studentRoster)\b/i);
  assert.doesNotMatch(source, /\b(?:students|studentAccounts|classCodes)\s*\//i);
  assert.doesNotMatch(source, /district[^\n]{0,40}(?:logo|mark)|(?:logo|mark)[^\n]{0,40}district/i);
});

test("entrypoint identity and locked legacy bytes remain exact", async () => {
  const [indexBytes, mirrorBytes, legacyBytes] = await Promise.all([
    readFile(path.join(ROOT, "index.html")),
    readFile(path.join(ROOT, "mission-control.html")),
    readFile(path.join(ROOT, "classroom-legacy.html"))
  ]);
  assert.deepEqual(indexBytes, mirrorBytes);
  assert.equal(
    verifier.normalizedTextSha256(legacyBytes),
    LEGACY_SHA256
  );
});
