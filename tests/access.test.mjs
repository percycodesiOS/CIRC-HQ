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
    classes: [{ id: "class-5", title: "Period 2 Grade 5", roster: ["Student"] }],
    lessonGuides: [{ id: "lesson-1", title: "Binary Basics", materials: ["Cards"], directions: ["Pair up"], teacherNotes: "Keep it moving" }],
    specialEvents: [{ id: "event-1", classId: "class-5", lessonGuideId: "lesson-1", countdown: "04:00", currentProcessStep: "Test the pattern", dutyDetails: "Hall duty", staffSchedule: "Private" }],
    notes: [{ text: "Call family", visibility: "teacher-private" }],
    firebaseUid: "kenny"
  };

  assert.deepEqual(buildBoardProjection(state, "event-1"), {
    classTitle: "Period 2 Grade 5",
    countdown: "04:00",
    lessonTitle: "Binary Basics",
    materials: ["Cards"],
    directions: ["Pair up"],
    currentProcessStep: "Test the pattern"
  });
});
