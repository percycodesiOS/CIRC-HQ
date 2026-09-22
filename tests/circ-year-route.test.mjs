import assert from "node:assert/strict";
import test from "node:test";
import { CIRC_YEAR_LESSONS, CIRC_YEAR_ROUTE } from "../src/model/circ-year-route.js";
import { getExperienceTimingPlan, getReplicaLessonChoice, validateExperienceTimingPlan } from "../src/model/experience-timing-plans.js";
import { createExperienceRunner, validateExperienceRunner } from "../src/model/experience-runner.js";

test("every year meeting opens a complete valid 35-minute plan and survives runner validation", () => {
  assert.equal(CIRC_YEAR_ROUTE.length, 31);
  assert.deepEqual(CIRC_YEAR_ROUTE.map(row => row.contact), Array.from({ length: 31 }, (_, i) => i + 1));
  assert.equal(CIRC_YEAR_LESSONS.length, 21);
  for (const row of CIRC_YEAR_ROUTE) {
    const plan = getExperienceTimingPlan(row.projectNumber, row.modeId ? { modeId: row.modeId } : undefined);
    assert.ok(plan, row.title);
    assert.equal(validateExperienceTimingPlan(plan).ok, true, row.title);
    assert.equal(plan.steps.reduce((sum, step) => sum + step.minutes, 0), 35);
    const runner = createExperienceRunner(getExperienceTimingPlan(row.projectNumber), {
      teacherKey: "teacher:year-test", nowIso: "2026-09-22T13:00:00.000Z",
      ...(row.modeId ? { modeId: row.modeId } : {})
    });
    assert.equal(validateExperienceRunner(JSON.parse(JSON.stringify(runner)), { teacherKey: "teacher:year-test" }).ok, true, row.title);
    assert.equal(runner.steps.length, plan.steps.length);
    if (row.lessonId) {
      assert.equal(runner.title, row.title);
      assert.equal(getReplicaLessonChoice(row.modeId)?.objective, row.purpose);
    }
  }
});

test("new lessons retain materials, grade support, cleanup and usable teacher directions", () => {
  for (const lesson of CIRC_YEAR_LESSONS) {
    assert.ok(lesson.materials.length, lesson.title);
    assert.ok(lesson.teacherContext.some(text => text.includes("Grade 5")), lesson.title);
    assert.ok(lesson.teacherContext.some(text => text.includes("Grade 6")), lesson.title);
    assert.ok(lesson.steps.some(step => step.kind === "cleanup"));
    assert.ok(lesson.steps.some(step => step.kind === "exit"));
    for (const step of lesson.steps) {
      assert.ok(step.directions.length && step.teacherDirections.length, step.id);
      assert.ok(step.directions.every(text => text.trim().split(/\s+/).length <= 18), step.id);
    }
  }
  assert.equal(CIRC_YEAR_ROUTE[29].modeId, "refresh-existing", "keep the existing habitat intact");
  assert.match(CIRC_YEAR_LESSONS.find(lesson => lesson.id === "circ-resin-plan").title, /without pouring/);
});
