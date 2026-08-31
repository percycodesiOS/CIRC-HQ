import test from "node:test";
import assert from "node:assert/strict";
import { buildBoardProjection, getAccessMode } from "../src/model/access.js";

test("derives local and signed-out modes from configuration and authentication", () => {
  assert.equal(getAccessMode({ configured: false }), "local");
  assert.equal(getAccessMode({ configured: true, user: null }), "signed-out");
});

test("keeps authenticated teachers private until trusted shared membership is present", () => {
  assert.equal(getAccessMode({ configured: true, user: { uid: "kenny" } }), "private-sync");
  assert.equal(getAccessMode({ configured: true, user: { uid: "kenny" }, requestedShared: true }), "shared-blocked");
  assert.equal(getAccessMode({ configured: true, user: { uid: "kenny" }, requestedShared: true, membership: { trusted: true } }), "teacher");
});

test("buildBoardProjection exposes only the active classroom content", () => {
  const state = {
    classes: [{ id: "class-5", title: "Period 2 Grade 5", visibility: "classroom", reviewedForBoard: true, roster: ["Student"] }],
    lessonGuides: [{ id: "lesson-1", title: "Binary Basics", visibility: "classroom", reviewedForBoard: true, materials: ["Cards"], directions: ["Pair up"], currentProcessStep: "Test the pattern", teacherNotes: "Keep it moving" }],
    specialEvents: [{ id: "event-hce36863f51b6baf9d16397ffb3e9af50", type: "teach", classId: "class-5", lessonGuideId: "lesson-1", countdown: "PRIVATE_EVENT_COUNTDOWN", currentProcessStep: "PRIVATE_EVENT_PROCESS", dutyDetails: "Hall duty", staffSchedule: "Private" }],
    notes: [{ text: "Call family", visibility: "teacher-private" }],
    firebaseUid: "kenny",
    sharedArtifacts: {
      "tech-terrarium-2026-27": {
        artifactId: "tech-terrarium-2026-27",
        visits: [{ eventId: "PRIVATE_ARTIFACT_EVENT" }],
        classLabel: "PRIVATE_ARTIFACT_CLASS"
      }
    }
  };

  const projection = buildBoardProjection(state, "event-hce36863f51b6baf9d16397ffb3e9af50", {
    liveCountdown: { eventId: "event-hce36863f51b6baf9d16397ffb3e9af50", minutes: 4, target: "end" }
  });
  assert.deepEqual(projection, {
    classTitle: "Period 2 Grade 5",
    countdown: "4m to end",
    lessonTitle: "Binary Basics",
    materials: ["Cards"],
    directions: ["Pair up"],
    currentProcessStep: "Test the pattern"
  });
  assert.doesNotMatch(JSON.stringify(projection), /sharedArtifacts|visits|PRIVATE_ARTIFACT/);
});

test("buildBoardProjection excludes nested private data from materials and directions", () => {
  const state = {
    classes: [{ id: "class-5", title: "Period 2 Grade 5", visibility: "classroom", reviewedForBoard: true }],
    lessonGuides: [{
      id: "lesson-1",
      title: "Binary Basics",
      visibility: "classroom",
      reviewedForBoard: true,
      materials: ["Cards", { text: "Private device", teacherNotes: "Do not show", firebaseUid: "kenny" }],
      directions: ["Pair up", { step: "Secret", dutyDetails: "Hall", privateLink: "https://private.example" }]
    }],
    specialEvents: [{ id: "event-hce36863f51b6baf9d16397ffb3e9af50", type: "teach", classId: "class-5", lessonGuideId: "lesson-1", countdown: "PRIVATE_EVENT_COUNTDOWN", currentProcessStep: "PRIVATE_EVENT_PROCESS" }]
  };

  const projection = buildBoardProjection(state, "event-hce36863f51b6baf9d16397ffb3e9af50");

  assert.deepEqual(projection.materials, ["Cards"]);
  assert.deepEqual(projection.directions, ["Pair up"]);
  assert.equal(JSON.stringify(projection).includes("teacherNotes"), false);
  assert.equal(JSON.stringify(projection).includes("firebaseUid"), false);
  assert.equal(JSON.stringify(projection).includes("dutyDetails"), false);
  assert.equal(JSON.stringify(projection).includes("privateLink"), false);
});
