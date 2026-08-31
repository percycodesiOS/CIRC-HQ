import test from "node:test";
import assert from "node:assert/strict";
import * as stateModel from "../src/model/state.js";
import {
  createInitialState,
  createClassroomProjection,
  migrateLegacyState,
  stableId
} from "../src/model/state.js";

const NOW = "2026-08-28T12:00:00.000Z";

function storageWith(entries) {
  const values = new Map(Object.entries(entries));
  return {
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

test("creates a versioned empty state with the supplied timestamp", () => {
  const state = createInitialState(NOW);

  assert.equal(state.format, "playbook.state.v1");
  assert.equal(state.schemaVersion, 1);
  assert.equal(state.updatedAt, NOW);
  assert.deepEqual(state.checklist, []);
  assert.deepEqual(state.teacherProgress, {});
  assert.deepEqual(state.sharedArtifacts, {});
  assert.deepEqual(state.classes, []);
  assert.deepEqual(state.resources, []);
  assert.deepEqual(state.notes, []);
  assert.deepEqual(state.preferences, {});
});

test("returns a deterministic safe ID for imported content", () => {
  const first = stableId("check", "Buy batteries!");
  const second = stableId("check", "Buy batteries!");

  assert.equal(first, second);
  assert.match(first, /^check-[a-z0-9]+$/);
  assert.notEqual(first, stableId("check", "Buy chargers!"));
});

test("maps synthetic and real owners into separate injective namespaces", () => {
  assert.equal(stateModel.ownerKeyForTeacher(null), "local:default");
  assert.equal(stateModel.ownerKeyForTeacher("teacher-alpha"), "teacher:teacher-alpha");
  assert.equal(stateModel.ownerKeyForTeacher("teacher@example.com"), "teacher:teacher@example.com");
  assert.equal(stateModel.ownerKeyForTeacher("default"), "teacher:default");
  assert.notEqual(stateModel.ownerKeyForTeacher(null), stateModel.ownerKeyForTeacher("default"));
  assert.throws(() => stateModel.ownerKeyForTeacher("   "), /teacherId/);
});

test("reads legacy values without removing their source keys", () => {
  const plan = {
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
    teachers: [{ id: "teacher-1", days: {} }],
    specialEvents: [],
    resources: []
  };
  const storage = storageWith({
    "missionControl.teacherPlan.v1": JSON.stringify(plan),
    circBuyList: JSON.stringify(["Blue tape", { text: "Markers" }]),
    circNotes: JSON.stringify(["Call office"])
  });

  const result = migrateLegacyState(storage, NOW);

  assert.deepEqual(result.state.plan, plan);
  assert.deepEqual(
    result.state.checklist.map((item) => item.text),
    ["Blue tape", "Markers"]
  );
  assert.ok(result.state.checklist.every((item) => /^check-[a-z0-9]+$/.test(item.id)));
  assert.deepEqual(result.state.notes.map((note) => note.text), ["Call office"]);
  assert.equal(storage.getItem("missionControl.teacherPlan.v1"), JSON.stringify(plan));
  assert.equal(storage.getItem("circBuyList"), JSON.stringify(["Blue tape", { text: "Markers" }]));
  assert.equal(storage.getItem("circNotes"), JSON.stringify(["Call office"]));
  assert.ok(result.notes.some((note) => note.includes("missionControl.teacherPlan.v1")));
});

test("classroom projection returns only reviewed Board-safe fields", () => {
  const projection = createClassroomProjection({
    ...createInitialState(NOW),
    plan: {
      format: "playbook.teacherPlan.v2",
      version: 1,
      calendar: {},
      teachers: [
        {
          id: "private-teacher",
          days: {
            1: [
              {
                id: "teach",
                type: "teach",
                label: "Private event label",
                classId: "class-safe",
                lessonGuideId: "guide-safe",
                privateLink: "https://example.test/private-event"
              },
              { id: "duty", type: "duty", label: "Hall duty" }
            ]
          }
        }
      ],
      specialEvents: [],
      resources: []
    },
    classes: [{
      id: "class-safe",
      title: "Welcome builders",
      visibility: "classroom",
      reviewedForBoard: true,
      roster: ["Private roster value"],
      classCode: "PRIVATE"
    }],
    lessonGuides: [{
      id: "guide-safe",
      title: "Build guide",
      visibility: "classroom",
      reviewedForBoard: true,
      materials: ["Paper"],
      directions: ["Build"],
      privateNote: "Private note"
    }],
    preferences: { teacherId: "private-teacher" }
  }, "teach");

  assert.deepEqual(projection, {
    classTitle: "Welcome builders",
    countdown: "",
    lessonTitle: "Build guide",
    materials: ["Paper"],
    directions: ["Build"],
    currentProcessStep: ""
  });
});
