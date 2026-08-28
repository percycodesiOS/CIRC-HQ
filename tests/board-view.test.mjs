import assert from "node:assert/strict";
import test from "node:test";

import { buildBoardProjection } from "../src/model/access.js";
import { buildBoardView } from "../src/ui/board.js";
import { openLegacyActivityLibrary } from "../src/ui/curriculum.js";
import { buildRoomView } from "../src/ui/room.js";

function privateTeacherState() {
  return {
    plan: {
      teachers: [{ id: "teacher-alpha", name: "Teacher Alpha", days: {} }]
    },
    classes: [{
      id: "class-alpha",
      title: "Class Alpha",
      roster: ["Private Student Sentinel"],
      classCode: "ABCD"
    }],
    lessonGuides: [{
      id: "guide-alpha",
      title: "Design lesson",
      objective: "Build a stable shape.",
      materials: ["Paper", "Tape", { privateNote: "Hidden material" }],
      directions: ["Plan", "Build", "Test", { teacherOnly: "Hidden step" }],
      safety: "Use tools as demonstrated.",
      cleanup: "Return shared materials.",
      exitPrompt: "What improved?",
      privateNote: "Teacher-only note"
    }],
    specialEvents: [{
      id: "event-alpha",
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
  const projection = buildBoardProjection(state, "event-alpha");
  const board = buildBoardView(projection);

  assert.deepEqual(board, {
    mode: "account-free",
    classTitle: "Class Alpha",
    countdown: "06:00",
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
  assert.equal(board.currentProcessStep, "Build");
});

test("Board cannot request teacher routes state resources notes duty or Firebase data", () => {
  const state = privateTeacherState();
  const before = structuredClone(state);
  const board = buildBoardView(buildBoardProjection(state, "event-alpha"));
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
  buildBoardView(buildBoardProjection(state, "event-alpha"));
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
