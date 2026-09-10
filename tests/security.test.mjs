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
import { assertCloudDomainShape } from "../src/storage/cloud-domains.js";
import * as firebaseAdapter from "../src/storage/firebase-adapter.js";
import { LocalStore, STATE_KEY } from "../src/storage/local-store.js";
import { mergeStates } from "../src/storage/sync-engine.js";
import { buildRoomView } from "../src/ui/room.js";
import { previewPlanImport } from "../src/ui/settings.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const LEGACY_SHA256 =
  "6E7FF5AA3B15A57A44F0D3351C6C6A5A3B3D14813E9B5616AF3D138C5E41B69F";
const ROOT_GITIGNORE = "/.superpowers/\n/.worktrees/\n/.firebase/\n/.firebaserc\n/firebase-debug.log\n/firestore-debug.log\n/ui-debug.log\n/node_modules/\n";
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
            id: "event-hee0dfaca3f560f370b8ed6a2cefbd243",
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
    createClassroomProjection(state, "event-hee0dfaca3f560f370b8ed6a2cefbd243", {
      liveCountdown: { eventId: "event-hee0dfaca3f560f370b8ed6a2cefbd243", minutes: 7, target: "end" }
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
    href: "mission-control.html?mode=one#start",
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
    source: "local"
  });

  const validated = validateTeacherPlan(resourcePlan([resource]));

  assert.equal(validated.ok, true);
  assert.deepEqual(validated.value.resources, [{
    id: "safe-resource",
    title: "Reviewed resource",
    visibility: "teacher-private",
    href: "/mission-control.html?mode=one#start",
    external: false,
    note: "Reviewed note",
    updatedAt: "2026-08-28T12:00:00.000Z"
  }]);

  const withUnknownFields = safeResource({
    privateNote: "PRIVATE_RESOURCE_NOTE",
    arbitrary: "PRIVATE_ARBITRARY_FIELD"
  });
  assert.equal(validateTeacherPlan(resourcePlan([withUnknownFields])).ok, false);
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

test("Firebase private domain admission rejects unsafe resources before I/O", async () => {
  let ioCount = 0;
  const client = firebaseAdapter.createFirebaseClient({
    config: { projectId: "injected-test-project" },
    firebase: {
      currentUser: () => ({ uid: "teacher-uid" }),
      getDocument: async () => { ioCount += 1; return null; },
      runTransaction: async () => { ioCount += 1; },
      serverTimestamp: () => ({ toDate: () => new Date("2026-09-01T12:00:00.000Z") })
    }
  });
  const result = await client.savePrivateDomain("teacher-uid", "content", {
    checklist: [],
    classes: [],
    lessonGuides: [],
    specialEvents: [],
    resources: [safeResource(), unsafeResource()],
    notes: [],
    tombstones: []
  }, 0);

  assert.deepEqual(result, { status: "denied", revision: null, value: null });
  assert.equal(ioCount, 0);
});

test("Room presents only fields returned by shared resource admission", () => {
  const view = buildRoomView({
    resources: [safeResource({
      validated: true,
      source: "local"
    }), unsafeResource()]
  });

  assert.deepEqual(view.privateResources, [{
    id: "safe-resource",
    title: "Reviewed resource",
    note: "Reviewed note",
    safeHref: "/mission-control.html?mode=one#start",
    external: false
  }]);
  assert.equal(JSON.stringify(view).includes("PRIVATE_RESOURCE_NOTE"), false);
  assert.equal(JSON.stringify(view).includes("genericProbe"), false);
});

test("public server manifest is an exact reviewed allowlist", () => {
  assert.equal(typeof devServer.getPublicStaticManifest, "function");
  assert.deepEqual(devServer.getPublicStaticManifest(), [
    "app.css",
    "assets/circ-hq-maker.webp",
    "assets/designers-challenge-sketch.webp",
    "assets/icons/arrow-right.svg",
    "assets/icons/books.svg",
    "assets/icons/calendar-dots.svg",
    "assets/icons/chalkboard-teacher.svg",
  "assets/icons/circ-mark.svg",
    "assets/icons/cloud-lightning.svg",
    "assets/icons/cloud-rain.svg",
    "assets/icons/cloud-sun.svg",
    "assets/icons/cloud.svg",
    "assets/icons/download-simple.svg",
    "assets/icons/gear-six.svg",
    "assets/icons/house.svg",
    "assets/icons/play-circle.svg",
    "assets/icons/presentation-chart.svg",
    "assets/icons/snowflake.svg",
    "assets/icons/student.svg",
    "assets/icons/sun.svg",
    "assets/icons/warning-circle.svg",
    "assets/tech-terrarium-hero.webp",
    "firebase-config.js",
    "index.html",
    "mission-control.html",
    "src/app.js",
    "src/model/access.js",
    "src/model/admin-plan.js",
    "src/model/announcements.js",
  "src/model/crew-signup.js",
    "src/model/experience-runner.js",
    "src/model/experience-timing-plans.js",
    "src/model/lesson-guide.js",
    "src/model/project-catalog.js",
    "src/model/schedule-editor.js",
    "src/model/schedule.js",
    "src/model/schema-admission.js",
    "src/model/setup-flow.js",
    "src/model/shared-artifact.js",
    "src/model/state.js",
    "src/model/step-timer.js",
    "src/model/teacher-plan-v1.js",
    "src/model/teacher-plan.js",
    "src/runtime/cloud-runtime.js",
    "src/services/weather.js",
    "src/storage/cloud-domains.js",
    "src/storage/cloud-sync.js",
    "src/storage/firebase-adapter.js",
    "src/storage/local-store.js",
    "src/storage/room-sync.js",
    "src/storage/sync-engine.js",
    "src/ui/announcements.js",
    "src/ui/board.js",
    "src/ui/project-home.js",
    "src/ui/room.js",
    "src/ui/schedule-editor.js",
    "src/ui/settings.js",
    "src/ui/setup.js",
    "src/ui/today-ui.js",
    "src/ui/view-model.js"
  ]);
});

test("the reviewed public Firebase config has a closed lock and narrow credential exception", async (context) => {
  assert.equal(typeof verifier.inspectFirebaseConfigLock, "function");
  assert.deepEqual(await verifier.inspectFirebaseConfigLock(ROOT), { ok: true, count: 1 });

  const configSource = await readFile(path.join(ROOT, "firebase-config.js"), "utf8");
  assert.doesNotMatch(configSource, /measurementId|serviceAccount|export default|PRIVATE KEY/i);
  assert.equal((configSource.match(/apiKey:/g) ?? []).length, 1);

  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "circ-hq-firebase-config-lock-"));
  context.after(() => rm(fixtureRoot, { recursive: true, force: true }));
  for (const [name, mutation] of [
    ["extra-field", (source) => source.replace("  appId:", "  measurementId: \"not-used\",\n  appId:")],
    ["changed-project", (source) => source.replace("circ-hq-k6-2026", "different-project")],
    ["second-export", (source) => `${source}export const extra = true;\n`],
    ["service-account", (source) => `${source}\nexport const serviceAccount = {};\n`]
  ]) {
    const file = path.join(fixtureRoot, "firebase-config.js");
    await writeFile(file, mutation(configSource));
    assert.deepEqual(await verifier.inspectFirebaseConfigLock(fixtureRoot), { ok: false, count: 1 }, name);
  }

  const syntheticGoogleKey = `AIza${"0".repeat(32)}`;
  assert.equal(verifier.countCredentialViolations(`README fixture ${syntheticGoogleKey}`), 1);
  assert.equal(verifier.countCredentialViolations(`README fixture ${syntheticGoogleKey}`, { allowPublicFirebaseKey: true }), 0);
});

test("public verifier has a recursive-safe sanitized gate contract", () => {
  assert.notEqual(verifier, null);
  assert.equal(typeof verifier.parseNulList, "function");
  assert.equal(typeof verifier.classifyCandidatePaths, "function");
  assert.equal(typeof verifier.getGateNames, "function");
  assert.deepEqual(verifier.getGateNames(), [
    "candidate-boundary",
    "pages-boundary",
    "runtime-import-boundary",
    "entrypoint-identity",
    "legacy-lock",
    "asset-lock",
    "firebase-placeholders",
    "typography-scan",
    "credential-scan",
    "local-path-scan",
    "privacy-sentinel-scan",
    "public-runtime-policy",
    "dom-sink-scan",
    "server-allowlist",
    "javascript-syntax",
    "node-tests"
  ]);
  assert.equal(typeof verifier.getExpectedPublicManifest, "function");
  assert.deepEqual(verifier.getExpectedPublicManifest(), devServer.getPublicStaticManifest());

  assert.deepEqual(
    verifier.parseNulList(Buffer.from("index.html\0src/app.js\0", "utf8")),
    ["index.html", "src/app.js"]
  );
  assert.deepEqual(
    verifier.classifyCandidatePaths(
      [
        "index.html",
        "tests/security.test.mjs",
        "src/model/shared-artifact.js",
        "tests/shared-artifact.test.mjs",
        "unexpected.txt"
      ],
      ["index.html"]
    ),
    {
      candidateCount: 5,
      trackedCount: 1,
      allowedUntrackedCount: 3,
      unexpectedUntrackedCount: 1,
      forbiddenCandidateCount: 0,
      unreviewedCandidateCount: 1,
      unsupportedCandidateCount: 0
    }
  );
});

test("reviewed visual assets are exact and opaque files fail closed", async (context) => {
  assert.equal(typeof verifier.inspectAssetLocks, "function");
  assert.deepEqual(await verifier.inspectAssetLocks(ROOT), { ok: true, count: 3 });

  const repository = await mkdtemp(path.join(os.tmpdir(), "circ-hq-asset-lock-"));
  context.after(() => rm(repository, { recursive: true, force: true }));
  await mkdir(path.join(repository, "assets"), { recursive: true });
  await writeFile(path.join(repository, "assets", "circ-hq-maker.webp"), "TAMPERED");
  assert.deepEqual(await verifier.inspectAssetLocks(repository), { ok: false, count: 3 });

  const counts = verifier.classifyCandidatePaths([
    "assets/circ-hq-maker.webp",
    "unexpected.webp"
  ], [
    "assets/circ-hq-maker.webp",
    "unexpected.webp"
  ]);
  assert.equal(counts.unreviewedCandidateCount, 1);
  assert.equal(counts.unsupportedCandidateCount, 1);
});

test("candidate classifier rejects forbidden namespaces even when tracked", () => {
  assert.deepEqual(
    verifier.classifyCandidatePaths([
      ".gitignore",
      ".env",
      "index.html",
      ".superpowers/private/generic.json",
      ".git/config",
      ".internal/generic.txt",
      "private-data/generic.json",
      "src/.generic.js",
      "scripts/verify-public.mjs"
    ], [
      ".gitignore",
      ".env",
      "index.html",
      ".superpowers/private/generic.json",
      ".git/config",
      ".internal/generic.txt",
      "private-data/generic.json",
      "src/.generic.js"
    ]),
    {
      candidateCount: 9,
      trackedCount: 8,
      allowedUntrackedCount: 1,
      unexpectedUntrackedCount: 0,
      forbiddenCandidateCount: 6,
      unreviewedCandidateCount: 6,
      unsupportedCandidateCount: 2
    }
  );
});

test("validation and import reject forbidden plan records without retaining adversarial values", () => {
  const plan = resourcePlan([]);
  plan.teachers[0].days = {
    1: [{
      id: "event-hee0dfaca3f560f370b8ed6a2cefbd243",
      type: "teach",
      label: "Safe class label",
      start: "09:00",
      end: "09:30"
    }]
  };
  const probes = [
    (candidate) => { candidate.studentRoster = ["ROOT_PRIVATE_VALUE"]; },
    (candidate) => { candidate.teachers[0].studentRecords = ["TEACHER_PRIVATE_VALUE"]; },
    (candidate) => { candidate.teachers[0].days[1][0].studentNames = ["EVENT_PRIVATE_VALUE"]; },
    (candidate) => { candidate.teachers[0].days[1][0].privateNote = "PRIVATE_NOTE_VALUE"; }
  ];

  for (const inject of probes) {
    const candidate = structuredClone(plan);
    inject(candidate);
    const validated = validateTeacherPlan(candidate);
    const previewed = previewPlanImport(null, JSON.stringify(candidate));
    assert.equal(validated.ok, false);
    assert.equal(validated.value, null);
    assert.equal(previewed.ok, false);
    assert.equal(previewed.candidate, null);
    assert.doesNotMatch(
      JSON.stringify({ validated, previewed }),
      /ROOT_PRIVATE_VALUE|TEACHER_PRIVATE_VALUE|EVENT_PRIVATE_VALUE|PRIVATE_NOTE_VALUE/
    );
  }
});

test("local path gate scans tracked text including excluded docs, ignores binaries, and passes this tree", async (context) => {
  assert.equal(typeof verifier.inspectLocalPaths, "function");
  const currentTree = await verifier.inspectLocalPaths(ROOT);
  assert.equal(currentTree.ok, true);
  assert.ok(currentTree.count > 0);

  const repository = await mkdtemp(path.join(os.tmpdir(), "circ-hq-local-path-scan-"));
  context.after(() => rm(repository, { recursive: true, force: true }));
  await mkdir(path.join(repository, "docs"), { recursive: true });
  const probes = [
    ["C:", "\\", "Users", "\\", "Generic", "\\", "private.txt"].join(""),
    ["C:", "\\", "Generic", "\\", ".", "codex", "\\", "skills"].join(""),
    ["/", "Users", "/", "generic", "/", "private.txt"].join(""),
    ["/", "home", "/", "generic", "/", "private.txt"].join(""),
    ["~", "/", "private.txt"].join(""),
    ["$", "HOME", "/", "private.txt"].join(""),
    ["$", "{", "HOME", "}", "/", "private.txt"].join(""),
    ["%", "USERPROFILE", "%", "\\", "private.txt"].join(""),
    ["D:", "\\", "generic", "\\", "private.txt"].join(""),
    ["K:", "\\", "Projects", "\\", "generic", "\\", "private.txt"].join(""),
    ["\\", "\\", "generic-server", "\\", "share", "\\", "private.txt"].join(""),
    ["\\", "\\", "?", "\\", "C:", "\\", "generic", "\\", "private.txt"].join(""),
    ["\\", "\\", "?", "\\", "UNC", "\\", "generic-server", "\\", "share", "\\", "private.txt"].join(""),
    ["file", ":", "/", "/", "/", "C:", "/", "generic", "/", "private.txt"].join(""),
    ["file", ":", "/", "/", "generic-server", "/", "share", "/", "private.txt"].join(""),
    ["%", "HOMEDRIVE", "%", "%", "HOMEPATH", "%", "\\", "private.txt"].join(""),
    ["$", "env", ":", "HOMEDRIVE", "$", "env", ":", "HOMEPATH", "\\", "private.txt"].join(""),
    ["$", "{", "HOMEDRIVE", "}", "$", "{", "HOMEPATH", "}", "/", "private.txt"].join("")
  ];
  await Promise.all([
    writeFile(path.join(repository, "design-qa.md"), probes.slice(0, 4).join("\n")),
    writeFile(path.join(repository, "docs", "excluded.md"), probes.slice(4).join("\n")),
    writeFile(path.join(repository, "assets.bin"), Buffer.from(probes.join("\n")))
  ]);
  execFileSync("git", ["init", "-q"], { cwd: repository });
  execFileSync("git", ["add", "--", "design-qa.md", "docs/excluded.md", "assets.bin"], { cwd: repository });

  const failed = await verifier.inspectLocalPaths(repository);
  assert.equal(failed.ok, false);
  assert.equal(failed.count, probes.length);

  await Promise.all([
    writeFile(path.join(repository, "design-qa.md"), "Repository-relative provenance only\n"),
    writeFile(path.join(repository, "docs", "excluded.md"), "No local path disclosure\n")
  ]);
  assert.deepEqual(await verifier.inspectLocalPaths(repository), { ok: true, count: 2 });
});

test("Jekyll exclusions cover every nonruntime release path and expose every public runtime path", async () => {
  const config = await readFile(path.join(ROOT, "_config.yml"));
  const publication = verifier.parseJekyllPublicationConfig(config);
  const exclusions = publication?.exclusions;
  const requiredExclusions = [
    "README.md",
    "BUILDLOG.md",
    "classroom-legacy.html",
    "design-qa.md",
    "docs",
    "firebase",
    ".firebaserc.example",
    "firebase-config.example.js",
    "firebase.json",
    "firestore.rules",
    "package-lock.json",
    "package.json",
    "scripts",
    "src/ui/curriculum.js",
    "tests"
  ];

  assert.notEqual(publication, null);
  assert.deepEqual(publication.includes, ["firebase-config.js"]);
  assert.equal(
    verifier.parseJekyllPublicationConfig(
      config.toString("utf8").replace(/include:\r?\n  - firebase-config\.js\r?\n\r?\n/, "")
    ),
    null
  );
  const wrongInclude = verifier.parseJekyllPublicationConfig(
    config.toString("utf8").replace("  - firebase-config.js", "  - other-config.js")
  );
  assert.equal(
    verifier.pagesPublicationBoundaryResult(
      devServer.getPublicStaticManifest(),
      wrongInclude
    ).ok,
    false
  );
  assert.equal(
    verifier.pagesPublicationBoundaryResult(
      ["firebase-config.js"],
      { includes: [], exclusions: ["firebase"] }
    ).ok,
    false
  );
  assert.deepEqual(
    verifier.pagesPublicationBoundaryResult(
      ["firebase-config.js"],
      { includes: ["firebase-config.js"], exclusions: ["firebase"] }
    ),
    { ok: true, count: 1 }
  );
  for (const relativePath of requiredExclusions) {
    assert.equal(exclusions.includes(relativePath), true, relativePath);
  }
  for (const relativePath of [
    "firebase-config.js",
    "src/runtime/cloud-runtime.js",
    "src/storage/cloud-domains.js",
    "src/storage/cloud-sync.js",
    "src/storage/firebase-adapter.js",
    "src/storage/local-store.js",
    "src/storage/room-sync.js",
    "src/storage/sync-engine.js",
    "src/ui/setup.js"
  ]) {
    assert.equal(exclusions.includes(relativePath), false, relativePath);
  }
  const publicManifest = devServer.getPublicStaticManifest();
  assert.deepEqual(verifier.pagesPublicationBoundaryResult(publicManifest, publication), {
    ok: true,
    count: publicManifest.length
  });
});

test("release candidate gate rejects private internal test-result and output paths", async (context) => {
  const repository = await mkdtemp(path.join(os.tmpdir(), "circ-hq-release-boundary-"));
  context.after(() => rm(repository, { recursive: true, force: true }));
  const candidatePaths = [
    "private/generic.json",
    "private-data/generic.json",
    "internal/generic.md",
    "test-results/generic.json",
    "src/__private__/generic.js",
    "outputs/generic-release-note.md"
  ];
  for (const relativePath of candidatePaths) {
    const target = path.join(repository, ...relativePath.split("/"));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, "GENERIC_RELEASE_BOUNDARY_FIXTURE\n");
  }
  execFileSync("git", ["init", "-q"], { cwd: repository });
  execFileSync("git", ["add", "--", ...candidatePaths], { cwd: repository });

  assert.deepEqual(verifier.inspectCandidateBoundary(repository), {
    ok: false,
    count: 6,
    candidateCount: 6,
    trackedCount: 6,
    allowedUntrackedCount: 0,
    unexpectedUntrackedCount: 0,
    forbiddenCandidateCount: 5,
    unreviewedCandidateCount: 6,
    unsupportedCandidateCount: 0
  });
});

test("release documentation cannot activate Firebase accounts or shared data", async () => {
  const [readme, firebaseGate] = await Promise.all([
    readFile(path.join(ROOT, "README.md"), "utf8"),
    readFile(path.join(ROOT, "docs", "FIREBASE-ACTIVATION-GATE.md"), "utf8")
  ]);

  assert.match(readme, /configured Firebase project/i);
  assert.match(firebaseGate, /configured Firebase project/i);
  assert.match(readme, /not proof that Google Auth is enabled/i);
  assert.match(firebaseGate, /not proof that Google Auth is enabled/i);
  assert.match(firebaseGate, /required access model, not current production access/i);
});

test("Pages boundary fails closed for an unexcluded file and an excluded runtime file", async (context) => {
  assert.equal(typeof verifier.inspectPagesPublicationBoundary, "function");
  const repository = await mkdtemp(path.join(os.tmpdir(), "circ-hq-pages-boundary-"));
  context.after(() => rm(repository, { recursive: true, force: true }));
  await mkdir(path.join(repository, "notes"), { recursive: true });
  await Promise.all([
    writeFile(path.join(repository, ".gitignore"), ROOT_GITIGNORE),
    writeFile(path.join(repository, "_config.yml"), [
      "include:",
      "  - firebase-config.js",
      "",
      "exclude:",
      "  - classroom-legacy.html",
      "  - index.html",
      ""
    ].join("\n")),
    writeFile(path.join(repository, "index.html"), "<!doctype html>"),
    writeFile(path.join(repository, "classroom-legacy.html"), "GENERIC_LEGACY"),
    writeFile(path.join(repository, "notes", "release-note.md"), "GENERIC_NOTE")
  ]);
  execFileSync("git", ["init", "-q"], { cwd: repository });
  execFileSync("git", ["add", "--", ".gitignore", "_config.yml", "index.html", "classroom-legacy.html", "notes/release-note.md"], {
    cwd: repository,
    stdio: "pipe"
  });

  assert.deepEqual(await verifier.inspectPagesPublicationBoundary(repository), {
    ok: false,
    count: 2
  });
});

test("runtime import boundary rejects an imported module absent from the public manifest", async (context) => {
  assert.equal(typeof verifier.inspectRuntimeImportBoundary, "function");
  const repository = await mkdtemp(path.join(os.tmpdir(), "circ-hq-runtime-import-boundary-"));
  context.after(() => rm(repository, { recursive: true, force: true }));
  await mkdir(path.join(repository, "src", "model"), { recursive: true });
  await Promise.all([
    writeFile(path.join(repository, "firebase-config.js"), "export const firebaseConfig = {};\n"),
    writeFile(path.join(repository, "src", "app.js"), [
      'import "./model/unreviewed-runtime.js";',
      "export const genericApp = true;",
      ""
    ].join("\n")),
    writeFile(
      path.join(repository, "src", "model", "unreviewed-runtime.js"),
      "export const genericRuntime = true;\n"
    )
  ]);

  assert.deepEqual(await verifier.inspectRuntimeImportBoundary(repository), {
    ok: false,
    count: 1
  });
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
    writeFile(path.join(repository, ".gitignore"), ROOT_GITIGNORE),
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
    ["add", "--", ".gitignore", "index.html"],
    { cwd: repository }
  );
  execFileSync("git", ["add", "-f", "--", ".superpowers/private/generic.json"], {
    cwd: repository
  });

  const result = verifier.inspectCandidateBoundary(repository);

  assert.deepEqual(result, {
    ok: false,
    count: 2,
    candidateCount: 6,
    trackedCount: 3,
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
    writeFile(path.join(repository, ".gitignore"), ROOT_GITIGNORE),
    writeFile(path.join(repository, "index.html"), "GENERIC_INDEX"),
    writeFile(path.join(repository, "opaque.pdf"), Buffer.from([0xff])),
    writeFile(path.join(repository, "notes", "generic.txt"), "GENERIC_UNREVIEWED_CONTENT")
  ]);
  execFileSync("git", ["add", "--", ".gitignore", "index.html", "opaque.pdf", "notes/generic.txt"], {
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
  assert.equal(typeof verifier.inspectRepositoryIgnore, "function");
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "circ-hq-eol-locks-"));
  context.after(() => rm(fixtureRoot, { recursive: true, force: true }));
  const source = path.join(fixtureRoot, "source");
  await mkdir(source, { recursive: true });
  const isolatedGlobalConfig = path.join(fixtureRoot, "isolated-global.gitconfig");
  await writeFile(isolatedGlobalConfig, "");
  const isolatedGitEnvironment = {
    ...process.env,
    GIT_CONFIG_GLOBAL: isolatedGlobalConfig,
    GIT_CONFIG_NOSYSTEM: "1"
  };
  const canonicalLegacy = (await readFile(path.join(ROOT, "classroom-legacy.html"), "utf8"))
    .replaceAll("\r\n", "\n");
  const canonicalFirebase = (await readFile(path.join(ROOT, "firebase-config.example.js"), "utf8"))
    .replaceAll("\r\n", "\n");
  await Promise.all([
    writeFile(path.join(source, ".gitignore"), ROOT_GITIGNORE),
    writeFile(path.join(source, "classroom-legacy.html"), canonicalLegacy),
    writeFile(path.join(source, "firebase-config.example.js"), canonicalFirebase)
  ]);
  execFileSync("git", ["init", "-q"], { cwd: source });
  execFileSync("git", ["add", "--", ".gitignore", "classroom-legacy.html", "firebase-config.example.js"], {
    cwd: source
  });
  execFileSync("git", [
    "-c", "user.name=Generic Test",
    "-c", "user.email=generic@example.invalid",
    "commit", "-qm", "generic fixture"
  ], { cwd: source });

  for (const autocrlf of ["true", "false"]) {
    const checkout = path.join(fixtureRoot, `checkout-${autocrlf}`);
    execFileSync("git", ["clone", "-q", "--no-checkout", source, checkout], {
      env: isolatedGitEnvironment
    });
    execFileSync("git", ["config", "core.autocrlf", autocrlf], {
      cwd: checkout,
      env: isolatedGitEnvironment
    });
    execFileSync("git", ["checkout", "-q"], {
      cwd: checkout,
      env: isolatedGitEnvironment
    });

    assert.equal(await verifier.inspectRepositoryIgnore(checkout), true);
    const privateProbe = path.join(checkout, ".superpowers", "private", "generic.json");
    await mkdir(path.dirname(privateProbe), { recursive: true });
    await writeFile(privateProbe, "GENERIC_PRIVATE_FIXTURE");
    const checkoutCandidates = verifier.parseNulList(execFileSync(
      "git",
      ["ls-files", "-co", "--exclude-standard", "-z"],
      { cwd: checkout, env: isolatedGitEnvironment }
    ));
    assert.equal(checkoutCandidates.includes(".superpowers/private/generic.json"), false);
    const ignoreAttribution = execFileSync(
      "git",
      ["check-ignore", "-v", "--", ".superpowers/private/generic.json"],
      { cwd: checkout, encoding: "utf8", env: isolatedGitEnvironment }
    );
    assert.match(ignoreAttribution.replaceAll("\\", "/"), /^\.gitignore:1:\/\.superpowers\/\s/);
    for (const invalidIgnore of [
      "/.superpowers/private/\n",
      ".superpowers/\n",
      "/.superpowers/\n/generic-extra/\n",
      "# generic comment\n/.superpowers/\n",
      "/.superpowers/\r"
    ]) {
      await writeFile(path.join(checkout, ".gitignore"), invalidIgnore);
      assert.equal(await verifier.inspectRepositoryIgnore(checkout), false);
    }
    await rm(path.join(checkout, ".gitignore"));
    assert.equal(await verifier.inspectRepositoryIgnore(checkout), false);
    await writeFile(path.join(checkout, ".gitignore"), ROOT_GITIGNORE);
    assert.equal(await verifier.inspectRepositoryIgnore(checkout), true);

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

test("candidate gate rejects every substantive root ignore change", async (context) => {
  const repository = await mkdtemp(path.join(os.tmpdir(), "circ-hq-ignore-gate-"));
  context.after(() => rm(repository, { recursive: true, force: true }));
  await Promise.all([
    writeFile(path.join(repository, ".gitignore"), ROOT_GITIGNORE),
    writeFile(path.join(repository, "index.html"), "GENERIC_INDEX")
  ]);
  execFileSync("git", ["init", "-q"], { cwd: repository });
  execFileSync("git", ["add", "--", ".gitignore", "index.html"], { cwd: repository });

  const moduleUrl = pathToFileURL(path.join(ROOT, "scripts", "verify-public.mjs")).href;
  const childSource = [
    `import { runPublicVerification } from ${JSON.stringify(moduleUrl)};`,
    `const passed = await runPublicVerification(${JSON.stringify(repository)});`,
    "if (!passed) process.exitCode = 1;"
  ].join("\n");
  const runFixture = () => spawnSync(
    process.execPath,
    ["--input-type=module", "--eval", childSource],
    { cwd: repository, encoding: "utf8", windowsHide: true }
  );
  const assertSanitized = (result, expectedCandidateLine) => {
    assert.equal(result.status, 1);
    assert.equal(result.stderr, "");
    const lines = result.stdout.trim().split(/\r?\n/);
    assert.equal(lines.length, verifier.getGateNames().length);
    assert.equal(lines[0], expectedCandidateLine);
    assert.equal(lines.every((line) => /^(?:PASS|FAIL) [a-z-]+ count=\d+$/.test(line)), true);
    assert.doesNotMatch(result.stdout, /generic|superpowers|comment/i);
  };

  assertSanitized(runFixture(), "PASS candidate-boundary count=2");
  for (const invalidIgnore of [
    "/.superpowers/private/\n",
    ".superpowers/\n",
    "/.superpowers/\n/generic-extra/\n",
    "# generic comment\n/.superpowers/\n",
    "/.superpowers/\r"
  ]) {
    await writeFile(path.join(repository, ".gitignore"), invalidIgnore);
    assertSanitized(runFixture(), "FAIL candidate-boundary count=1");
  }
  await rm(path.join(repository, ".gitignore"));
  assertSanitized(runFixture(), "FAIL candidate-boundary count=1");
});

test("verifier refreshes candidates after reviewed tests finish", async (context) => {
  const repository = await mkdtemp(path.join(os.tmpdir(), "circ-hq-post-test-refresh-"));
  context.after(() => rm(repository, { recursive: true, force: true }));
  await mkdir(path.join(repository, "tests"), { recursive: true });
  await Promise.all([
    writeFile(path.join(repository, ".gitignore"), ROOT_GITIGNORE),
    writeFile(path.join(repository, "tests", "security.test.mjs"), [
      'import { writeFileSync } from "node:fs";',
      'import test from "node:test";',
      `const artifactPath = ${JSON.stringify(path.join(repository, "unexpected6.pdf"))};`,
      'test("generic reviewed test", () => writeFileSync(artifactPath, Buffer.from([6])));'
    ].join("\n"))
  ]);
  execFileSync("git", ["init", "-q"], { cwd: repository });
  execFileSync("git", ["add", "--", ".gitignore", "tests/security.test.mjs"], {
    cwd: repository
  });
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

test("tracked root ignore policy protects private and SDD paths", async (context) => {
  assert.equal(typeof verifier.inspectRepositoryIgnore, "function");
  assert.equal(await verifier.inspectRepositoryIgnore(ROOT), true);
  const ignoredProbe = path.join(
    ROOT,
    ".superpowers",
    "private",
    "generic-ignore-probe.json"
  );
  await mkdir(path.dirname(ignoredProbe), { recursive: true });
  await writeFile(ignoredProbe, "GENERIC_PRIVATE_FIXTURE");
  context.after(() => rm(ignoredProbe, { force: true }));

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
  assert.equal(candidates.includes(".gitignore"), true);
  assert.equal(tracked.includes(".gitignore"), true);
  assert.equal(candidates.includes(".superpowers/private/generic-ignore-probe.json"), false);
  const ignoreAttribution = execFileSync(
    "git",
    ["check-ignore", "-v", "--", ".superpowers/private/generic-ignore-probe.json"],
    { cwd: ROOT, encoding: "utf8" }
  );
  assert.match(ignoreAttribution.replaceAll("\\", "/"), /^\.gitignore:1:\/\.superpowers\/\s/);
  assert.equal(execFileSync(
    "git",
    ["ls-files", "-z", "--", ".superpowers"],
    { cwd: ROOT }
  ).length, 0);
  for (const ignoredPath of [
    ".superpowers/private/generic.json",
    ".superpowers/sdd/generic.md"
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
    "http://127.0.0.1:4273/"
  ].join("\n")), 0);
  assert.equal(verifier.countUnsafeRuntimeLinks([
    "http://example.invalid/",
    "https://unreviewed.example.invalid/"
  ].join("\n")), 2);
});

test("Firebase private writes use an exact child document and closed envelope", async () => {
  const writes = [];
  let stored = null;
  const serverTime = { toDate: () => new Date("2026-09-01T12:00:00.000Z") };
  const client = firebaseAdapter.createFirebaseClient({
    config: { projectId: "injected-test-project" },
    firebase: {
      currentUser: () => ({ uid: "teacher-uid" }),
      serverTimestamp: () => serverTime,
      runTransaction: async (callback) => {
        const staged = [];
        const result = await callback({
          get: async () => null,
          set: (path, value, ...rest) => staged.push({ path, value, rest })
        });
        writes.push(...staged);
        stored = staged[0]?.value ?? null;
        return result;
      },
      getDocument: async () => stored
    }
  });

  const result = await client.savePrivateDomain("teacher-uid", "preferences", { preferences: {} }, 0);

  assert.equal(result.status, "verified");
  assert.equal(writes.length, 1);
  assert.equal(writes[0].path, "playbookTeachers/teacher-uid/private/preferences");
  assert.deepEqual(writes[0].rest, []);
  assert.deepEqual(Object.keys(writes[0].value).sort(), [
    "preferences",
    "revision",
    "schemaVersion",
    "updatedAt",
    "updatedBy"
  ]);
  assert.equal("experienceRunners" in writes[0].value, false);
  assert.equal("sharedArtifacts" in writes[0].value, false);
});

test("Firebase client exposes no whole-state or credential surface", () => {
  for (const obsolete of [
    "buildTeacherDocumentPatch",
    "createFirebaseAdapter",
    "createBrowserFirebaseAdapter"
  ]) {
    assert.equal(obsolete in firebaseAdapter, false, obsolete);
  }
  const client = firebaseAdapter.createFirebaseClient();
  for (const obsolete of [
    "loadPrivateState",
    "savePrivateState",
    "signInWithEmail",
    "createEmailAccount",
    "requestPasswordReset"
  ]) {
    assert.equal(obsolete in client, false, obsolete);
  }
});

test("cloud domains reject runners, credentials, authentication, submissions, and private shared fields", () => {
  for (const value of [
    { experienceRunners: {} },
    { auth: { provider: "google" } },
    { token: "not-a-credential" },
    { studentSubmissions: [] },
    { notes: [] }
  ]) {
    assert.throws(
      () => assertCloudDomainShape("artifacts", value),
      /cloud-domain-invalid/
    );
  }
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
  assert.equal(access.admitResource(safeResource({ href: "mission-control.html" })).href,
    "/mission-control.html");
  assert.equal(access.admitResource(safeResource({ href: "classroom-legacy.html" })), null);
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
  const locks = await verifier.inspectReleaseLocks(ROOT);
  assert.equal(locks.firebaseOk, true);
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
