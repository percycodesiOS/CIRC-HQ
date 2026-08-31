import assert from "node:assert/strict";
import test from "node:test";

import { buildBoardProjection } from "../src/model/access.js";
import { buildLessonGuide } from "../src/model/lesson-guide.js";
import { buildCurriculumView } from "../src/ui/curriculum.js";

function guide(overrides = {}) {
  return {
    id: "rotation-guide",
    rotationId: "rotation-one",
    title: "Rotation guide",
    objective: "Practice one design skill.",
    opening: "Name the goal in one sentence.",
    steps: ["Plan", "Build", "Test"],
    materials: ["Paper", "Tape"],
    safety: "Use tools as demonstrated.",
    cleanup: "Return shared materials.",
    transition: "Pause before lining up.",
    exitPrompt: "What changed after testing?",
    privateNote: "Teacher-only pacing note",
    ...overrides
  };
}

test("a class-specific guide wins over a rotation guide", () => {
  const state = {
    lessonGuides: [
      guide(),
      guide({
        id: "class-guide",
        classId: "class-alpha",
        title: "Class guide",
        objective: "Use the class-specific objective.",
        privateNote: "Class-specific private note"
      })
    ]
  };

  const result = buildLessonGuide({
    id: "event-hcbf7f07b5859c901a6d66590bc32250d",
    type: "teach",
    classId: "class-alpha",
    rotationId: "rotation-one"
  }, state);

  assert.equal(result.source, "class-specific");
  assert.equal(result.objective, "Use the class-specific objective.");
  assert.equal(result.privateNote, "Class-specific private note");
  assert.equal(result.status, "Ready");
});

test("the Tech Terrarium default covers safe tools reclaimed materials shared ownership cleanup and transition", () => {
  const result = buildLessonGuide({
    id: "event-he52c1fa7a33a3f5b4e4b08b10a6d2108",
    type: "teach",
    unitId: "tech-terrarium",
    classId: "class-beta",
    rotationId: "rotation-two"
  }, { lessonGuides: [] });

  assert.equal(result.source, "tech-terrarium-default");
  assert.match(result.safety, /safe tool|adult-only/i);
  assert.match(result.materials.join(" "), /reclaimed|reused/i);
  assert.match([result.objective, ...result.steps].join(" "), /shared|ownership/i);
  assert.match(result.cleanup, /five-minute cleanup/i);
  assert.match(result.transition, /two-minute door decompression/i);
  assert.equal(result.status, "Needs class-specific detail");
});

test("a rotation guide remains useful while naming missing class-specific detail", () => {
  const result = buildLessonGuide({
    id: "event-h4a4efd5e55362ed79f63e76aaed4fea2",
    type: "teach",
    classId: "class-missing",
    rotationId: "rotation-one"
  }, { lessonGuides: [guide()] });

  assert.equal(result.source, "rotation");
  assert.equal(result.objective, "Practice one design skill.");
  assert.equal(result.status, "Needs class-specific detail");
});

test("an unresolved administrative block says Confirmation needed", () => {
  const result = buildLessonGuide({
    id: "event-hdb81c222b9f682715bfecda66008b200",
    type: "support",
    confirmation: { status: "needed", reason: "assignment-unconfirmed" }
  }, { lessonGuides: [] });

  assert.equal(result.status, "Confirmation needed");
  assert.match(result.objective, /confirm/i);
});

test("private teacher note stays in the teacher guide and is excluded from Board projection", () => {
  const lesson = guide({ id: "class-guide", classId: "class-alpha" });
  const teacherGuide = buildLessonGuide({
    id: "event-h90e3eea270f11277e5fbd39423f8fe39",
    type: "teach",
    classId: "class-alpha",
    rotationId: "rotation-one"
  }, { lessonGuides: [lesson] });
  const board = buildBoardProjection({
    classes: [{ id: "class-alpha", title: "Class Alpha" }],
    lessonGuides: [{
      ...lesson,
      materials: teacherGuide.materials,
      directions: teacherGuide.steps,
      teacherNotes: teacherGuide.privateNote,
      privateNote: teacherGuide.privateNote
    }],
    specialEvents: [{
      id: "event-h90e3eea270f11277e5fbd39423f8fe39",
      classId: "class-alpha",
      lessonGuideId: "class-guide",
      countdown: "08:00",
      currentProcessStep: "Build"
    }]
  }, "event-h90e3eea270f11277e5fbd39423f8fe39");

  assert.equal(teacherGuide.privateNote, "Teacher-only pacing note");
  assert.equal(JSON.stringify(board).includes("Teacher-only pacing note"), false);
  assert.equal(Object.hasOwn(board, "privateNote"), false);
  assert.equal(Object.hasOwn(board, "teacherNotes"), false);
});

test("all guide copy remains plain string data", () => {
  const result = buildLessonGuide({
    id: "event-h028339fbb87b2a481da53a7872bb4886",
    type: "teach",
    classId: "class-alpha",
    rotationId: "rotation-one"
  }, {
    lessonGuides: [guide({
      classId: "class-alpha",
      opening: "<strong>Say this literally</strong>",
      steps: ["<img src=x onerror=alert(1)>", 42, { private: true }],
      materials: ["Cardboard", null, { label: "Hidden object" }]
    })]
  });

  for (const value of [
    result.objective,
    result.opening,
    result.safety,
    result.cleanup,
    result.transition,
    result.exitPrompt,
    result.privateNote,
    result.status,
    ...result.steps,
    ...result.materials
  ]) {
    assert.equal(typeof value, "string");
  }
  assert.equal(result.opening, "<strong>Say this literally</strong>");
  assert.deepEqual(result.steps, ["<img src=x onerror=alert(1)>"]);
  assert.deepEqual(result.materials, ["Cardboard"]);
});

test("Curriculum exposes the say-and-do cards and one route to all 57 preserved experiences", () => {
  const state = { lessonGuides: [guide({ classId: "class-alpha" })] };
  const view = buildCurriculumView({
    id: "event-h0a122940743341198300cf5d8ba2842a",
    type: "teach",
    classId: "class-alpha",
    rotationId: "rotation-one"
  }, state);

  assert.deepEqual(view.cards.map((card) => card.label), [
    "Objective",
    "Say this",
    "Do this",
    "Materials",
    "Safety",
    "Cleanup",
    "Transition",
    "Exit",
    "Private note"
  ]);
  assert.deepEqual(view.legacyLibrary, {
    title: "Legacy Activity Library",
    count: 57,
    href: "classroom-legacy.html",
    opensSameOrigin: true
  });
  assert.equal(view.status, "Ready");
});
