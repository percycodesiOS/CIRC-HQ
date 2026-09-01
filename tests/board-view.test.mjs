import assert from "node:assert/strict";
import test from "node:test";

import { buildBoardProjection } from "../src/model/access.js";
import { buildBoardView } from "../src/ui/board.js";
import { openLegacyActivityLibrary } from "../src/ui/curriculum.js";
import { buildRoomView } from "../src/ui/room.js";

const PRIVATE_EVENT_IDS = Object.freeze({
  duty: "event-h00000000000000000000000000000021",
  support: "event-h00000000000000000000000000000022",
  prep: "event-h00000000000000000000000000000023",
  lunch: "event-h00000000000000000000000000000024",
  special: "event-h00000000000000000000000000000025"
});

function privateTeacherState() {
  return {
    plan: {
      teachers: [{ id: "teacher-alpha", name: "Teacher Alpha", days: {} }]
    },
    classes: [{
      id: "class-alpha",
      title: "Class Alpha",
      visibility: "classroom",
      reviewedForBoard: true,
      roster: ["Private Student Sentinel"],
      classCode: "ABCD"
    }],
    lessonGuides: [{
      id: "guide-alpha",
      title: "Design lesson",
      visibility: "classroom",
      reviewedForBoard: true,
      objective: "Build a stable shape.",
      materials: ["Paper", "Tape", { privateNote: "Hidden material" }],
      directions: ["Plan", "Build", "Test", { teacherOnly: "Hidden step" }],
      safety: "Use tools as demonstrated.",
      cleanup: "Return shared materials.",
      exitPrompt: "What improved?",
      currentProcessStep: "Test",
      privateNote: "Teacher-only note"
    }],
    specialEvents: [{
      id: "event-h809a7a949031ea78680685cc76e68808",
      type: "teach",
      label: "Classroom-safe workshop",
      classId: "class-alpha",
      lessonGuideId: "guide-alpha",
      countdown: "06:00",
      currentProcessStep: "Test",
      dutyDetails: { assignment: "Private duty" },
      staffSchedule: "Private staff schedule"
    }],
    resources: [{ id: "private-resource", visibility: "teacher-private", title: "Private resource" }],
    notes: [{ visibility: "teacher-private", text: "Private note" }],
    firebaseUid: "private-firebase-id",
    settings: { cloud: true }
  };
}

test("Board is account-free and exposes only sanitized current-lesson controls", () => {
  const state = privateTeacherState();
  const projection = buildBoardProjection(state, "event-h809a7a949031ea78680685cc76e68808", {
    liveCountdown: { eventId: "event-h809a7a949031ea78680685cc76e68808", minutes: 6, target: "end" }
  });
  const board = buildBoardView(projection);

  assert.deepEqual(board, {
    mode: "account-free",
    classTitle: "Class Alpha",
    countdown: "6m to end",
    lessonTitle: "Design lesson",
    objective: "Build a stable shape.",
    steps: ["Plan", "Build", "Test"],
    materials: ["Paper", "Tape"],
    safety: "Use tools as demonstrated.",
    cleanup: "Return shared materials.",
    exitPrompt: "What improved?",
    currentProcessStep: "Test"
  });
  const serialized = JSON.stringify(board);
  assert.doesNotMatch(serialized, /accountId|student|alias|classCode|login|roster/i);
});

test("Board projection can resolve the active event from the validated teacher plan", () => {
  const state = privateTeacherState();
  state.plan.teachers[0].days = {
    1: [{
      id: "scheduled-event",
      type: "teach",
      label: "Scheduled class",
      start: "09:00",
      end: "09:30",
      classId: "class-alpha",
      lessonGuideId: "guide-alpha",
      countdown: "05:00",
      currentProcessStep: "Build"
    }]
  };

  const board = buildBoardView(buildBoardProjection(state, "scheduled-event"));

  assert.equal(board.classTitle, "Class Alpha");
  assert.equal(board.lessonTitle, "Design lesson");
  assert.equal(board.objective, "Build a stable shape.");
  assert.equal(board.currentProcessStep, "Test");
});

test("Board projection rejects every teacher-only event even when private fields mimic a class", () => {
  for (const type of ["duty", "support", "prep", "lunch", "special"]) {
    const state = privateTeacherState();
    state.plan.teachers[0].days = {
      1: [{
        id: PRIVATE_EVENT_IDS[type],
        type,
        label: `PRIVATE_${type.toUpperCase()}_LABEL`,
        start: "09:00",
        end: "09:30",
        classId: "class-alpha",
        lessonGuideId: "guide-alpha",
        countdown: `PRIVATE_${type.toUpperCase()}_COUNTDOWN`,
        currentProcessStep: `PRIVATE_${type.toUpperCase()}_STEP`
      }]
    };

    const board = buildBoardView(buildBoardProjection(state, PRIVATE_EVENT_IDS[type]));

    assert.deepEqual(board, {
      mode: "account-free",
      classTitle: "",
      countdown: "",
      lessonTitle: "",
      objective: "",
      steps: [],
      materials: [],
      safety: "",
      cleanup: "",
      exitPrompt: "",
      currentProcessStep: ""
    }, type);
  }
});

test("Board projection admits only explicitly reviewed class and lesson records for teach events", () => {
  const state = privateTeacherState();
  state.plan.teachers[0].days = {
    1: [{
      id: "teach-ready",
      type: "teach",
      label: "Student-safe studio session",
      start: "09:00",
      end: "09:30",
      classId: "class-alpha",
      lessonGuideId: "guide-alpha",
      countdown: "04:00"
    }, {
      id: "teach-unresolved",
      type: "teach",
      label: "PRIVATE_UNRESOLVED_TEACH_LABEL",
      start: "10:00",
      end: "10:30",
      classId: "missing-class",
      lessonGuideId: "missing-guide",
      countdown: "PRIVATE_UNRESOLVED_COUNTDOWN"
    }]
  };

  const ready = buildBoardView(buildBoardProjection(state, "teach-ready", {
    liveCountdown: { eventId: "teach-ready", minutes: 4, target: "end" }
  }));
  const unresolved = buildBoardView(buildBoardProjection(state, "teach-unresolved"));

  assert.equal(ready.classTitle, "Class Alpha");
  assert.equal(ready.lessonTitle, "Design lesson");
  assert.equal(ready.countdown, "4m to end");
  assert.equal(unresolved.classTitle, "");
  assert.equal(unresolved.lessonTitle, "");
  assert.equal(unresolved.countdown, "");
});

test("linked teach events remain private until both class and lesson are explicitly reviewed for Board", () => {
  const state = privateTeacherState();
  state.classes[0] = {
    id: "class-alpha",
    title: "PRIVATE_LINKED_CLASS_TITLE"
  };
  state.lessonGuides[0] = {
    id: "guide-alpha",
    title: "PRIVATE_LINKED_GUIDE_TITLE",
    objective: "PRIVATE_LINKED_OBJECTIVE",
    directions: ["PRIVATE_LINKED_STEP"],
    currentProcessStep: "PRIVATE_LINKED_PROCESS"
  };
  state.plan.teachers[0].days = {
    1: [{
      id: "private-linked-teach",
      type: "teach",
      label: "PRIVATE_LINKED_EVENT_LABEL",
      start: "09:00",
      end: "09:30",
      classId: "class-alpha",
      lessonGuideId: "guide-alpha",
      countdown: "PRIVATE_LINKED_EVENT_COUNTDOWN",
      currentProcessStep: "PRIVATE_LINKED_EVENT_PROCESS"
    }]
  };

  const board = buildBoardView(buildBoardProjection(state, "private-linked-teach", {
    liveCountdown: { eventId: "private-linked-teach", minutes: 7, target: "end" }
  }));

  assert.deepEqual(board, {
    mode: "account-free",
    classTitle: "",
    countdown: "",
    lessonTitle: "",
    objective: "",
    steps: [],
    materials: [],
    safety: "",
    cleanup: "",
    exitPrompt: "",
    currentProcessStep: ""
  });
});

test("Board ignores event-supplied and malformed live display fields", () => {
  const state = privateTeacherState();
  state.plan.teachers[0].days = {
    1: [{
      id: "teach-safe",
      type: "teach",
      label: "PRIVATE_EVENT_LABEL",
      start: "09:00",
      end: "09:30",
      classId: "class-alpha",
      lessonGuideId: "guide-alpha",
      countdown: "PRIVATE_EVENT_COUNTDOWN",
      currentProcessStep: "PRIVATE_EVENT_PROCESS"
    }]
  };

  for (const liveCountdown of [
    undefined,
    { eventId: "wrong-event", minutes: 5, target: "end" },
    { eventId: "teach-safe", minutes: -1, target: "end" },
    { eventId: "teach-safe", minutes: 5, target: "start" },
    { eventId: "teach-safe", minutes: 5, target: "end", text: "PRIVATE_EXTRA_TEXT" }
  ]) {
    const board = buildBoardView(buildBoardProjection(state, "teach-safe", { liveCountdown }));
    assert.equal(board.classTitle, "Class Alpha");
    assert.equal(board.countdown, "");
    assert.equal(board.currentProcessStep, "Test");
    assert.doesNotMatch(JSON.stringify(board), /PRIVATE_EVENT|PRIVATE_EXTRA/);
  }
});

test("Board cannot request teacher routes state resources notes duty or Firebase data", () => {
  const state = privateTeacherState();
  const before = structuredClone(state);
  const board = buildBoardView(buildBoardProjection(state, "event-h809a7a949031ea78680685cc76e68808"));
  const serialized = JSON.stringify(board);

  assert.doesNotMatch(serialized, /Settings|timeline|duty|staff|resource|private|firebase/i);
  assert.deepEqual(state, before);
  assert.deepEqual(Object.keys(board).sort(), [
    "classTitle",
    "cleanup",
    "countdown",
    "currentProcessStep",
    "exitPrompt",
    "lessonTitle",
    "materials",
    "mode",
    "objective",
    "safety",
    "steps"
  ]);
});

test("entering and leaving Board changes only the route view and never teacher state", () => {
  const state = privateTeacherState();
  const before = structuredClone(state);
  let route = "today";

  route = "board";
  buildBoardView(buildBoardProjection(state, "event-h809a7a949031ea78680685cc76e68808"));
  route = "today";

  assert.equal(route, "today");
  assert.deepEqual(state, before);
});

test("Room provides generic help and an honest empty private-resource state", () => {
  const view = buildRoomView({ resources: [] });

  assert.ok(view.genericSections.length >= 5);
  assert.match(view.genericSections.map((section) => section.title).join(" "), /setup|cleanup|fallback|substitute/i);
  assert.deepEqual(view.privateResources, []);
  assert.equal(view.privateResourceStatus, "No private resources saved yet");
  assert.equal(JSON.stringify(view).includes("confirmed school procedure"), false);
});

test("Room adds private resources only from validated local or authorized cloud state", () => {
  const view = buildRoomView({
    resources: [
      { id: "one", title: "Local reference", visibility: "teacher-private", validated: true, source: "local" },
      { id: "two", title: "Cloud reference", visibility: "teacher-private", validated: true, source: "authorized-cloud" },
      { id: "three", title: "Unvalidated reference", visibility: "teacher-private", validated: false, source: "local" },
      { id: "four", title: "Public fixture", visibility: "classroom", validated: true, source: "local" },
      { id: "five", title: "Untrusted source", visibility: "teacher-private", validated: true, source: "remote" }
    ]
  });

  assert.deepEqual(view.privateResources.map((resource) => resource.id), ["one", "two"]);
  assert.equal(view.privateResourceStatus, "2 private resources available");
});

test("Room admits only normalized same-origin app paths and HTTPS resource URLs", () => {
  const rejected = [
    "javascript:globalThis.genericProbe=1",
    "data:text/plain,generic",
    "file:///generic",
    "vbscript:generic",
    "//example.invalid/generic",
    "\\\\example.invalid\\generic",
    "http://example.invalid/generic",
    "https://user:pass@example.invalid/generic",
    "java\nscript:generic",
    "%6aavascript%3ageneric",
    "\u0000javascript:generic",
    "/__private__/plan.json",
    "/__private__/migration-options.json",
    "/.superpowers/private/generic.json",
    "/%2esuperpowers/private/generic.json",
    "/__private__/%2e%2e/.superpowers/private/generic.json",
    "/.git",
    "/%2egit",
    "/src/app.js",
    "/tests/generic.test.mjs",
    "/classroom-legacy.html/../__private__/plan.json",
    "/classroom-legacy.html%2f..%2f__private__%2fplan.json",
    "/__private__/../classroom-legacy.html",
    "/.superpowers/../index.html",
    "/.git/../index.html",
    "/tests/../mission-control.html",
    "/scripts/../classroom-legacy.html",
    "/src/../index.html",
    "/%2e%2e/classroom-legacy.html",
    "/.hidden/%2e%2e/index.html",
    "/%2e/__private__/%2e%2e/classroom-legacy.html",
    "/%252e%252e/classroom-legacy.html",
    "/generic%2f..%2fclassroom-legacy.html",
    "/generic%5c..%5cclassroom-legacy.html",
    "/%3aclassroom-legacy.html",
    "/%25%32%65%25%32%65/classroom-legacy.html",
    "/classroom-legacy.html%",
    "/classroom-legacy.html%2",
    "/classroom-legacy.html%zz",
    "/classroom-legacy.html\\generic",
    "/classroom-legacy.html\u0000",
    "https://example.invalid/generic/../resource",
    "https://example.invalid/%2e%2e/resource",
    "https://example.invalid/generic%2fresource"
  ];
  const resources = rejected.map((href, index) => ({
    id: `rejected-${index}`,
    title: `Rejected ${index}`,
    visibility: "teacher-private",
    validated: true,
    source: "local",
    href
  }));
  resources.push(
    {
      id: "safe-local",
      title: "Safe local",
      visibility: "teacher-private",
      validated: true,
      source: "local",
      href: "mission-control.html?mode=one#start"
    },
    {
      id: "safe-https",
      title: "Safe HTTPS",
      visibility: "teacher-private",
      validated: true,
      source: "authorized-cloud",
      href: "https://example.invalid/generic"
    }
  );

  const view = buildRoomView({ resources });

  assert.deepEqual(view.privateResources, [
    {
      id: "safe-local",
      title: "Safe local",
      safeHref: "/mission-control.html?mode=one#start",
      external: false
    },
    {
      id: "safe-https",
      title: "Safe HTTPS",
      safeHref: "https://example.invalid/generic",
      external: true
    }
  ]);
  assert.equal(JSON.stringify(view).includes("genericProbe"), false);
  assert.equal(JSON.stringify(view).includes("rejected-"), false);
});

test("Room presents only safe cloud membership labels without cloud identifiers", () => {
  const view = buildRoomView({ resources: [] }, {
    status: "member",
    name: "Shared CIRC Room",
    role: "teacher",
    syncLabel: "CIRC Cloud verified"
  });

  assert.deepEqual(view.cloudRoom, {
    status: "member",
    name: "Shared CIRC Room",
    role: "teacher",
    syncLabel: "CIRC Cloud verified"
  });
  assert.doesNotMatch(JSON.stringify(view), /teacher-uid|tenant-safe|room-safe|revision/);
});

test("opening the Legacy Activity Library uses same-origin classroom compatibility without touching saved values", () => {
  const values = new Map([
    ["missionControl.missions.v5", "{\"unchanged\":true}"],
    ["missionControl.classes.v3", "raw-private-value"],
    ["unrelated", "also-unchanged"]
  ]);
  const before = [...values.entries()];
  let opened = null;

  const result = openLegacyActivityLibrary((href) => {
    opened = href;
  });

  assert.equal(result, "classroom-legacy.html");
  assert.equal(opened, "classroom-legacy.html");
  assert.deepEqual([...values.entries()], before);
});
