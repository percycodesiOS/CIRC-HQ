import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceProjectProgress,
  buildProjectHomeView,
  resolveCurrentProjectNumber
} from "../src/ui/project-home.js";

test("project home defaults to Tech Terrarium and exposes the complete project trail", () => {
  const view = buildProjectHomeView({ teacherProgress: {} });

  assert.equal(view.currentProject.number, 2);
  assert.equal(view.currentProject.title, "Tech Terrarium");
  assert.equal(view.projectLabel, "Experience 2 of 36");
  assert.equal(view.trail.length, 36);
  assert.deepEqual(
    view.trail.map((item) => item.number),
    Array.from({ length: 36 }, (_, index) => index + 1)
  );
  assert.equal(view.trail[0].state, "complete");
  assert.equal(view.trail[1].state, "current");
  assert.equal(view.trail[2].state, "upcoming");
});

test("project home follows validated local teacher progress", () => {
  const state = { teacherProgress: { currentProjectNumber: 18 } };
  const view = buildProjectHomeView(state);

  assert.equal(resolveCurrentProjectNumber(state), 18);
  assert.equal(view.currentProject.title, "Moving Picture Machine");
  assert.equal(view.trail.filter((item) => item.state === "complete").length, 17);
  assert.equal(view.trail.filter((item) => item.state === "current").length, 1);
});

test("project progress stays separate for each teacher", () => {
  const state = {
    teacherProgress: {
      "teacher-alpha": { currentProjectNumber: 8 },
      "teacher-beta": { currentProjectNumber: 19 }
    }
  };

  assert.equal(resolveCurrentProjectNumber(state, "teacher-alpha"), 8);
  assert.equal(resolveCurrentProjectNumber(state, "teacher-beta"), 19);
  assert.equal(buildProjectHomeView(state, { teacherId: "teacher-alpha" }).currentProject.number, 8);
  assert.equal(buildProjectHomeView(state, { teacherId: "teacher-beta" }).currentProject.number, 19);
});

test("real default teacher progress cannot adopt the synthetic no-plan record", () => {
  const source = {
    teacherProgress: {
      default: { currentProjectNumber: 19, completedProjectNumbers: [1] }
    }
  };

  assert.equal(resolveCurrentProjectNumber(source, "default"), 2);
  const updated = advanceProjectProgress(source, "default", 2, "2026-08-29T12:00:00.000Z");

  assert.equal(updated.teacherProgress.default.currentProjectNumber, 19);
  assert.equal(updated.teacherProgress["teacher:default"].currentProjectNumber, 3);
});

test("unambiguous raw teacher progress is read and migrates to the namespaced owner", () => {
  const source = {
    teacherProgress: {
      "teacher@example.com": {
        currentProjectNumber: 8,
        completedProjectNumbers: [1, 2]
      }
    }
  };

  assert.equal(resolveCurrentProjectNumber(source, "teacher@example.com"), 8);
  const updated = advanceProjectProgress(source, "teacher@example.com", 8, "2026-08-29T12:00:00.000Z");

  assert.equal(updated.teacherProgress["teacher@example.com"].currentProjectNumber, 8);
  assert.equal(updated.teacherProgress["teacher:teacher@example.com"].currentProjectNumber, 9);
});

test("canonical-shaped real teacher ids cannot adopt another owner's raw progress", () => {
  for (const { teacherId, namespacedKey } of [
    { teacherId: "teacher:x", namespacedKey: "teacher:teacher:x" },
    { teacherId: "local:default", namespacedKey: "teacher:local:default" }
  ]) {
    const source = {
      teacherProgress: {
        [teacherId]: {
          currentProjectNumber: 19,
          completedProjectNumbers: [1]
        }
      }
    };

    assert.equal(resolveCurrentProjectNumber(source, teacherId), 2, teacherId);
    const updated = advanceProjectProgress(
      source,
      teacherId,
      2,
      "2026-08-29T12:00:00.000Z"
    );

    assert.equal(updated.teacherProgress[teacherId].currentProjectNumber, 19, teacherId);
    assert.equal(updated.teacherProgress[namespacedKey].currentProjectNumber, 3, teacherId);
  }
});

test("raw progress fallback ignores inherited owner keys", () => {
  const inheritedProgress = Object.create({
    "teacher@example.com": { currentProjectNumber: 8 }
  });

  assert.equal(
    resolveCurrentProjectNumber({ teacherProgress: inheritedProgress }, "teacher@example.com"),
    2
  );
});

test("completing a project advances and preserves independent teacher progress", () => {
  const source = {
    format: "playbook.state.v1",
    teacherProgress: {
      "teacher-alpha": {
        currentProjectNumber: 2,
        completedProjectNumbers: [1]
      },
      "teacher-beta": {
        currentProjectNumber: 9,
        completedProjectNumbers: [1, 2]
      }
    }
  };
  const updated = advanceProjectProgress(
    source,
    "teacher-alpha",
    2,
    "2026-08-29T12:00:00.000Z"
  );

  assert.equal(updated.teacherProgress["teacher:teacher-alpha"].currentProjectNumber, 3);
  assert.deepEqual(updated.teacherProgress["teacher:teacher-alpha"].completedProjectNumbers, [1, 2]);
  assert.equal(updated.teacherProgress["teacher:teacher-alpha"].updatedAt, "2026-08-29T12:00:00.000Z");
  assert.deepEqual(updated.teacherProgress["teacher-beta"], source.teacherProgress["teacher-beta"]);
  assert.deepEqual(updated.teacherProgress["teacher-alpha"], source.teacherProgress["teacher-alpha"]);
  assert.equal(source.teacherProgress["teacher-alpha"].currentProjectNumber, 2);
  assert.equal(updated.updatedAt, "2026-08-29T12:00:00.000Z");
});

test("a second teacher starts clean without nesting the first teacher's progress", () => {
  const source = {
    teacherProgress: {
      kenny: {
        currentProjectNumber: 4,
        completedProjectNumbers: [1, 2, 3]
      }
    }
  };
  const updated = advanceProjectProgress(source, "tammy", 2, "2026-08-29T12:00:00.000Z");

  assert.equal(updated.teacherProgress["teacher:tammy"].currentProjectNumber, 3);
  assert.deepEqual(updated.teacherProgress["teacher:tammy"].completedProjectNumbers, [1, 2]);
  assert.equal(Object.hasOwn(updated.teacherProgress["teacher:tammy"], "kenny"), false);
  assert.deepEqual(updated.teacherProgress.kenny, source.teacherProgress.kenny);
});

test("completing project 36 safely stays at project 36", () => {
  const updated = advanceProjectProgress({
    teacherProgress: {
      default: {
        currentProjectNumber: 36,
        completedProjectNumbers: Array.from({ length: 35 }, (_, index) => index + 1)
      }
    }
  }, null, 36, "2026-08-29T12:00:00.000Z");
  assert.equal(updated.teacherProgress["local:default"].currentProjectNumber, 36);
  assert.deepEqual(
    updated.teacherProgress["local:default"].completedProjectNumbers,
    Array.from({ length: 36 }, (_, index) => index + 1)
  );
  assert.equal(updated.teacherProgress["local:default"].complete, true);
});

test("completed project 36 is shown as complete instead of current", () => {
  const view = buildProjectHomeView({
    teacherProgress: {
      default: {
        currentProjectNumber: 36,
        completedProjectNumbers: Array.from({ length: 36 }, (_, index) => index + 1),
        complete: true
      }
    }
  });

  assert.equal(view.progressComplete, true);
  assert.equal(view.projectLabel, "All 36 experiences complete");
  assert.equal(view.trail.at(-1).state, "complete");
  assert.equal(view.trail.filter((item) => item.state === "current").length, 0);
  assert.equal(view.trail.filter((item) => item.state === "complete").length, 36);
});

test("past and future project previews cannot move current progress", () => {
  const source = {
    updatedAt: "before",
    teacherProgress: {
      default: {
        currentProjectNumber: 5,
        completedProjectNumbers: [1, 2, 3, 4]
      }
    }
  };

  assert.deepEqual(
    advanceProjectProgress(source, null, 1, "after"),
    source
  );
  assert.deepEqual(
    advanceProjectProgress(source, null, 20, "after"),
    source
  );
});

test("the trail uses recorded completion instead of painting every prior number complete", () => {
  const view = buildProjectHomeView({
    teacherProgress: {
      default: {
        currentProjectNumber: 5,
        completedProjectNumbers: [1, 3]
      }
    }
  });

  assert.equal(view.trail[0].state, "complete");
  assert.equal(view.trail[1].state, "upcoming");
  assert.equal(view.trail[2].state, "complete");
  assert.equal(view.trail[3].state, "upcoming");
  assert.equal(view.trail[4].state, "current");
});

test("project home rejects unsupported progress values", () => {
  for (const currentProjectNumber of [0, 37, 2.5, "2", null]) {
    const state = { teacherProgress: { currentProjectNumber } };
    assert.equal(resolveCurrentProjectNumber(state), 2);
  }
});

test("project home presents the independence path and usable core actions", () => {
  const view = buildProjectHomeView({ teacherProgress: { currentProjectNumber: 9 } });

  assert.deepEqual(
    view.independencePath.map((stage) => stage.label),
    ["Watch me", "Guided Crew", "Shared Crew", "Team Run", "Student Studio"]
  );
  assert.equal(view.independencePath.filter((stage) => stage.active).length, 1);
  assert.equal(view.independencePath.find((stage) => stage.active).label, "Shared Crew");
  assert.deepEqual(view.actions, {
    run: "Open class runner",
    teacher: "Teacher script",
    student: "Student directions",
    admin: "Download admin plan"
  });
  assert.ok(view.fastFinish.title.length > 0);
  assert.ok(view.fastFinish.directions.length > 0);
});
