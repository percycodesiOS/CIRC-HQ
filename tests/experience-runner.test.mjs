import assert from "node:assert/strict";
import test from "node:test";

import {
  EXPERIENCE_TIMING_PLANS,
  getExperienceTimingPlan,
} from "../src/model/experience-timing-plans.js";

const moduleUrl = new URL("../src/model/experience-runner.js", import.meta.url);
let runnerModel;
let runnerModelError;

try {
  runnerModel = await import(moduleUrl);
} catch (error) {
  runnerModelError = error;
}

const NOW = "2026-08-30T12:00:00.000Z";
const TEACHER_KEY = "teacher:teacher-alpha";

function getRunnerModel() {
  assert.ifError(runnerModelError);
  assert.ok(runnerModel, "the experience runner model should load");
  return runnerModel;
}

function runningWorkStep(nowIso = NOW) {
  const { applyExperienceRunnerAction, createExperienceRunner } = getRunnerModel();
  let runner = createExperienceRunner(EXPERIENCE_TIMING_PLANS[0], {
    teacherKey: TEACHER_KEY,
    nowIso,
  });
  runner = applyExperienceRunnerAction(runner, "start", {
    teacherKey: TEACHER_KEY,
    nowIso,
  });
  while (runner.steps[runner.timer.currentStepIndex].kind !== "work") {
    runner = applyExperienceRunnerAction(runner, "next", {
      teacherKey: TEACHER_KEY,
      nowIso,
    });
  }
  return runner;
}

test("adapts every timing plan without losing student step content", () => {
  const { createExperienceRunner } = getRunnerModel();

  for (const plan of EXPERIENCE_TIMING_PLANS) {
    const expectedPlan = plan.projectNumber === 2
      ? getExperienceTimingPlan(2, { modeId: "build-new" })
      : plan;
    const runner = createExperienceRunner(plan, {
      teacherKey: TEACHER_KEY,
      nowIso: NOW,
      ...(plan.projectNumber === 2 ? { modeId: "build-new" } : {}),
    });

    assert.equal(runner.schemaVersion, 1);
    assert.equal(runner.teacherKey, TEACHER_KEY);
    assert.equal(runner.projectNumber, expectedPlan.projectNumber);
    assert.equal(runner.title, expectedPlan.title);
    assert.equal(runner.steps.length, expectedPlan.steps.length);
    for (const [index, step] of runner.steps.entries()) {
      const expectedStep = expectedPlan.steps[index];
      assert.equal(step.id, expectedStep.id);
      assert.equal(step.label, expectedStep.label);
      assert.equal(step.kind, expectedStep.kind);
      assert.equal(step.minutes, expectedStep.minutes);
      assert.deepEqual(step.directions, expectedStep.directions);
      if (expectedStep.teacherDirections.length > 0) {
        assert.deepEqual(step.teacher.directions, expectedStep.teacherDirections);
      } else {
        assert.equal(step.teacher, undefined);
      }
    }
    assert.deepEqual(runner.timer.plan, {
      id: `experience-${expectedPlan.projectNumber}`,
      name: expectedPlan.title,
      steps: expectedPlan.steps.map((step) => ({
        name: step.label,
        minutes: step.minutes,
      })),
    });
    assert.equal(runner.timer.status, "ready");
    assert.equal(runner.timer.currentStepIndex, 0);
    assert.equal(runner.timer.totalRemainingSeconds, 2100);
    assert.equal(runner.lastTickAt, NOW);
    assert.equal(runner.updatedAt, NOW);
  }
});

test("runner validation rejects a structurally valid six-step snapshot", () => {
  const { createExperienceRunner, validateExperienceRunner } = getRunnerModel();
  const runner = structuredClone(createExperienceRunner(EXPERIENCE_TIMING_PLANS[3], {
    teacherKey: TEACHER_KEY,
    nowIso: NOW,
  }));
  const removedRunnerStep = runner.steps.pop();
  const removedTimerStep = runner.timer.plan.steps.pop();

  runner.steps[0].minutes += removedRunnerStep.minutes;
  runner.timer.plan.steps[0].minutes += removedTimerStep.minutes;

  const result = validateExperienceRunner(runner, { teacherKey: TEACHER_KEY });
  assert.deepEqual(result, {
    ok: false,
    errors: ["runner-step-count-invalid"],
  });
});

test("active content maps exactly through a JSON route handoff", () => {
  const { createExperienceRunner, getActiveRunnerStep } = getRunnerModel();
  const source = createExperienceRunner(EXPERIENCE_TIMING_PLANS[5], {
    teacherKey: TEACHER_KEY,
    nowIso: NOW,
  });
  const handedOff = JSON.parse(JSON.stringify(source));

  assert.deepEqual(handedOff, source);
  assert.equal(JSON.stringify(handedOff).includes('"route"'), false);
  const active = getActiveRunnerStep(handedOff, { teacherKey: TEACHER_KEY });
  const sourceStep = EXPERIENCE_TIMING_PLANS[5].steps[0];
  assert.equal(active.id, "p06-ready");
  assert.equal(active.label, "GET READY");
  assert.equal(active.kind, "ready");
  assert.equal(active.minutes, 3);
  assert.deepEqual(active.directions, sourceStep.directions);
  assert.deepEqual(active.teacher, {
    directions: sourceStep.teacherDirections,
  });
});

test("runner actions preserve content while changing only timer state and timestamps", () => {
  const {
    advanceExperienceRunnerClock,
    applyExperienceRunnerAction,
    createExperienceRunner,
    getActiveRunnerStep,
  } = getRunnerModel();
  const source = createExperienceRunner(EXPERIENCE_TIMING_PLANS[1], {
    teacherKey: TEACHER_KEY,
    nowIso: NOW,
    modeId: "build-new",
  });
  const sourceSteps = structuredClone(source.steps);
  const started = applyExperienceRunnerAction(source, "start", {
    teacherKey: TEACHER_KEY,
    nowIso: "2026-08-30T12:00:00.000Z",
  });
  const elapsed = advanceExperienceRunnerClock(started, {
    teacherKey: TEACHER_KEY,
    nowIso: "2026-08-30T12:00:30.900Z",
  });
  const adjusted = applyExperienceRunnerAction(elapsed, "add-minute", {
    teacherKey: TEACHER_KEY,
    nowIso: "2026-08-30T12:00:30.900Z",
  });
  const next = applyExperienceRunnerAction(adjusted, "next", {
    teacherKey: TEACHER_KEY,
    nowIso: "2026-08-30T12:00:30.900Z",
  });
  const paused = applyExperienceRunnerAction(next, "pause", {
    teacherKey: TEACHER_KEY,
    nowIso: "2026-08-30T12:00:31.000Z",
  });
  const resumed = applyExperienceRunnerAction(paused, "resume", {
    teacherKey: TEACHER_KEY,
    nowIso: "2026-08-30T12:00:32.000Z",
  });
  const previous = applyExperienceRunnerAction(resumed, "previous", {
    teacherKey: TEACHER_KEY,
    nowIso: "2026-08-30T12:00:32.000Z",
  });
  const reset = applyExperienceRunnerAction(previous, "reset", {
    teacherKey: TEACHER_KEY,
    nowIso: "2026-08-30T12:00:33.000Z",
  });

  assert.equal(started.timer.status, "running");
  assert.equal(elapsed.timer.currentStepRemainingSeconds, 150);
  assert.equal(elapsed.timer.totalRemainingSeconds, 2070);
  assert.equal(elapsed.lastTickAt, "2026-08-30T12:00:30.000Z");
  assert.equal(elapsed.updatedAt, "2026-08-30T12:00:30.900Z");
  assert.equal(adjusted.timer.currentStepRemainingSeconds, 210);
  assert.equal(adjusted.timer.totalRemainingSeconds, 2130);
  assert.equal(next.timer.currentStepIndex, 1);
  assert.equal(next.timer.currentStepRemainingSeconds, 180);
  assert.equal(next.timer.totalRemainingSeconds, 2130);
  assert.equal(paused.timer.status, "paused");
  assert.equal(resumed.timer.status, "running");
  assert.equal(previous.timer.currentStepIndex, 0);
  assert.equal(previous.timer.currentStepRemainingSeconds, 180);
  assert.deepEqual(getActiveRunnerStep(previous, { teacherKey: TEACHER_KEY }), sourceSteps[0]);
  assert.equal(reset.timer.status, "ready");
  assert.equal(reset.timer.currentStepIndex, 0);
  assert.equal(reset.timer.currentStepRemainingSeconds, 180);
  assert.equal(reset.timer.totalRemainingSeconds, 2100);
  assert.equal(reset.lastTickAt, "2026-08-30T12:00:33.000Z");
  assert.equal(reset.updatedAt, "2026-08-30T12:00:33.000Z");
  for (const runner of [started, elapsed, adjusted, next, paused, resumed, previous, reset]) {
    assert.deepEqual(runner.steps, sourceSteps);
  }
  assert.equal(source.timer.status, "ready");
});

test("delayed reconciliation keeps an expired step visible while class time continues", () => {
  const {
    advanceExperienceRunnerClock,
    applyExperienceRunnerAction,
    createExperienceRunner,
  } = getRunnerModel();
  const ready = createExperienceRunner(EXPERIENCE_TIMING_PLANS[1], {
    teacherKey: TEACHER_KEY,
    nowIso: NOW,
    modeId: "build-new",
  });
  const running = applyExperienceRunnerAction(ready, "start", {
    teacherKey: TEACHER_KEY,
    nowIso: NOW,
  });
  const delayed = advanceExperienceRunnerClock(running, {
    teacherKey: TEACHER_KEY,
    nowIso: "2026-08-30T12:03:20.900Z",
  });
  const oneMoreSecond = advanceExperienceRunnerClock(delayed, {
    teacherKey: TEACHER_KEY,
    nowIso: "2026-08-30T12:03:21.100Z",
  });

  assert.equal(delayed.timer.status, "step-expired");
  assert.equal(delayed.timer.currentStepIndex, 0);
  assert.equal(delayed.timer.currentStepRemainingSeconds, 0);
  assert.equal(delayed.timer.totalRemainingSeconds, 1900);
  assert.equal(delayed.lastTickAt, "2026-08-30T12:03:20.000Z");
  assert.equal(oneMoreSecond.timer.currentStepRemainingSeconds, 0);
  assert.equal(oneMoreSecond.timer.totalRemainingSeconds, 1899);
  assert.equal(oneMoreSecond.lastTickAt, "2026-08-30T12:03:21.000Z");
});

test("ready and paused runners do not consume elapsed time", () => {
  const {
    advanceExperienceRunnerClock,
    applyExperienceRunnerAction,
    createExperienceRunner,
  } = getRunnerModel();
  const ready = createExperienceRunner(EXPERIENCE_TIMING_PLANS[1], {
    teacherKey: TEACHER_KEY,
    nowIso: NOW,
    modeId: "build-new",
  });
  const readyLater = advanceExperienceRunnerClock(ready, {
    teacherKey: TEACHER_KEY,
    nowIso: "2026-08-30T12:10:00.000Z",
  });
  const running = applyExperienceRunnerAction(ready, "start", {
    teacherKey: TEACHER_KEY,
    nowIso: NOW,
  });
  const paused = applyExperienceRunnerAction(running, "pause", {
    teacherKey: TEACHER_KEY,
    nowIso: "2026-08-30T12:00:10.000Z",
  });
  const pausedLater = advanceExperienceRunnerClock(paused, {
    teacherKey: TEACHER_KEY,
    nowIso: "2026-08-30T12:10:00.000Z",
  });

  assert.deepEqual(readyLater, ready);
  assert.deepEqual(pausedLater, paused);
  assert.equal(paused.timer.currentStepRemainingSeconds, 170);
  assert.equal(paused.timer.totalRemainingSeconds, 2090);
});

test("Question Detour runs a serializable three-minute clock while holding the work step", () => {
  const {
    advanceExperienceRunnerClock,
    applyExperienceRunnerAction,
    validateExperienceRunner,
  } = getRunnerModel();
  const running = runningWorkStep();
  const beforeStepIndex = running.timer.currentStepIndex;
  const beforeStep = running.timer.currentStepRemainingSeconds;
  const beforeTotal = running.timer.totalRemainingSeconds;
  const detoured = applyExperienceRunnerAction(running, "start-detour", {
    teacherKey: TEACHER_KEY,
    nowIso: NOW,
  });
  const handedOff = JSON.parse(JSON.stringify(detoured));
  const extended = applyExperienceRunnerAction(handedOff, "add-detour-time", {
    teacherKey: TEACHER_KEY,
    nowIso: NOW,
  });
  const afterOneMinute = advanceExperienceRunnerClock(detoured, {
    teacherKey: TEACHER_KEY,
    nowIso: "2026-08-30T12:01:00.000Z",
  });
  const returned = applyExperienceRunnerAction(afterOneMinute, "return-to-build", {
    teacherKey: TEACHER_KEY,
    nowIso: "2026-08-30T12:01:00.000Z",
  });
  const resumed = advanceExperienceRunnerClock(returned, {
    teacherKey: TEACHER_KEY,
    nowIso: "2026-08-30T12:01:30.000Z",
  });

  assert.deepEqual(detoured.detour, { status: "active", remainingSeconds: 180 });
  assert.deepEqual(handedOff, detoured);
  assert.deepEqual(validateExperienceRunner(handedOff, { teacherKey: TEACHER_KEY }), {
    ok: true,
    errors: [],
  });
  assert.equal(extended.detour.remainingSeconds, 300);
  assert.equal(afterOneMinute.detour.remainingSeconds, 120);
  assert.equal(afterOneMinute.timer.totalRemainingSeconds, beforeTotal - 60);
  assert.equal(afterOneMinute.timer.currentStepRemainingSeconds, beforeStep);
  assert.equal(afterOneMinute.timer.currentStepIndex, beforeStepIndex);
  assert.equal(Object.hasOwn(returned, "detour"), false);
  assert.equal(returned.timer.currentStepIndex, beforeStepIndex);
  assert.equal(returned.timer.currentStepRemainingSeconds, beforeStep);
  assert.equal(resumed.timer.totalRemainingSeconds, beforeTotal - 90);
  assert.equal(resumed.timer.currentStepRemainingSeconds, beforeStep - 30);
});

test("an expired detour stays active at zero while later class time continues and repeated extensions accumulate", () => {
  const {
    advanceExperienceRunnerClock,
    applyExperienceRunnerAction,
  } = getRunnerModel();
  const running = runningWorkStep();
  const beforeStep = running.timer.currentStepRemainingSeconds;
  const beforeTotal = running.timer.totalRemainingSeconds;
  const detoured = applyExperienceRunnerAction(running, "start-detour", {
    teacherKey: TEACHER_KEY,
    nowIso: NOW,
  });
  const expired = advanceExperienceRunnerClock(detoured, {
    teacherKey: TEACHER_KEY,
    nowIso: "2026-08-30T12:03:00.000Z",
  });
  const later = advanceExperienceRunnerClock(expired, {
    teacherKey: TEACHER_KEY,
    nowIso: "2026-08-30T12:04:00.000Z",
  });
  const addedOnce = applyExperienceRunnerAction(later, "add-detour-time", {
    teacherKey: TEACHER_KEY,
    nowIso: "2026-08-30T12:04:00.000Z",
  });
  const addedTwice = applyExperienceRunnerAction(addedOnce, "add-detour-time", {
    teacherKey: TEACHER_KEY,
    nowIso: "2026-08-30T12:04:00.000Z",
  });

  assert.deepEqual(expired.detour, { status: "active", remainingSeconds: 0 });
  assert.deepEqual(later.detour, { status: "active", remainingSeconds: 0 });
  assert.equal(later.timer.totalRemainingSeconds, beforeTotal - 240);
  assert.equal(later.timer.currentStepRemainingSeconds, beforeStep);
  assert.equal(addedOnce.detour.remainingSeconds, 120);
  assert.equal(addedTwice.detour.remainingSeconds, 240);
});

test("detour actions stay inert while ready or paused and ordinary pause cannot suspend an active detour", () => {
  const { applyExperienceRunnerAction, createExperienceRunner } = getRunnerModel();
  const ready = createExperienceRunner(EXPERIENCE_TIMING_PLANS[0], {
    teacherKey: TEACHER_KEY,
    nowIso: NOW,
  });
  const running = applyExperienceRunnerAction(ready, "start", {
    teacherKey: TEACHER_KEY,
    nowIso: NOW,
  });
  const paused = applyExperienceRunnerAction(running, "pause", {
    teacherKey: TEACHER_KEY,
    nowIso: NOW,
  });

  for (const runner of [ready, paused]) {
    for (const action of ["start-detour", "add-detour-time", "return-to-build", "safe-landing"]) {
      assert.deepEqual(
        applyExperienceRunnerAction(structuredClone(runner), action, {
          teacherKey: TEACHER_KEY,
          nowIso: NOW,
        }),
        runner,
        `${runner.timer.status}:${action}`,
      );
    }
  }

  const detoured = applyExperienceRunnerAction(running, "start-detour", {
    teacherKey: TEACHER_KEY,
    nowIso: NOW,
  });
  assert.deepEqual(
    applyExperienceRunnerAction(detoured, "pause", {
      teacherKey: TEACHER_KEY,
      nowIso: NOW,
    }),
    detoured,
  );
});

test("denied detour actions preserve ready paused and complete snapshots at later timestamps", () => {
  const { applyExperienceRunnerAction, createExperienceRunner } = getRunnerModel();
  const ready = createExperienceRunner(EXPERIENCE_TIMING_PLANS[0], {
    teacherKey: TEACHER_KEY,
    nowIso: NOW,
  });
  const running = applyExperienceRunnerAction(ready, "start", {
    teacherKey: TEACHER_KEY,
    nowIso: NOW,
  });
  const paused = applyExperienceRunnerAction(running, "pause", {
    teacherKey: TEACHER_KEY,
    nowIso: NOW,
  });
  let complete = running;
  while (complete.timer.status !== "complete") {
    complete = applyExperienceRunnerAction(complete, "next", {
      teacherKey: TEACHER_KEY,
      nowIso: NOW,
    });
  }

  const later = "2026-08-30T12:05:00.000Z";
  for (const source of [ready, paused, complete]) {
    for (const action of ["start-detour", "add-detour-time", "return-to-build", "safe-landing"]) {
      const normalizedSource = JSON.parse(JSON.stringify(source));
      const result = applyExperienceRunnerAction(source, action, {
        teacherKey: TEACHER_KEY,
        nowIso: later,
      });

      assert.deepEqual(result, normalizedSource, `${source.timer.status}:${action}:result`);
      assert.deepEqual(source, normalizedSource, `${source.timer.status}:${action}:source`);
      assert.equal(result.lastTickAt, NOW, `${source.timer.status}:${action}:lastTickAt`);
      assert.equal(result.updatedAt, NOW, `${source.timer.status}:${action}:updatedAt`);
    }
  }

  const readyBeforeFailures = structuredClone(ready);
  assert.throws(
    () => applyExperienceRunnerAction(ready, "start-detour", {
      teacherKey: "teacher:teacher-beta",
      nowIso: later,
    }),
    /runner-teacher-mismatch/,
  );
  assert.throws(
    () => applyExperienceRunnerAction(ready, "not-a-runner-action", {
      teacherKey: TEACHER_KEY,
      nowIso: later,
    }),
    /runner-action-invalid/,
  );
  assert.deepEqual(ready, readyBeforeFailures);
});

test("runner validation rejects malformed detour snapshots while admitting active zero", () => {
  const {
    applyExperienceRunnerAction,
    validateExperienceRunner,
  } = getRunnerModel();
  const running = runningWorkStep();
  const detoured = applyExperienceRunnerAction(running, "start-detour", {
    teacherKey: TEACHER_KEY,
    nowIso: NOW,
  });
  const activeZero = structuredClone(detoured);
  activeZero.detour.remainingSeconds = 0;
  assert.deepEqual(validateExperienceRunner(activeZero, { teacherKey: TEACHER_KEY }), {
    ok: true,
    errors: [],
  });

  const malformed = [
    null,
    {},
    { status: "inactive", remainingSeconds: 180 },
    { status: "active", remainingSeconds: -1 },
    { status: "active", remainingSeconds: 1.5 },
    { status: "active", remainingSeconds: "180" },
    { status: "active", remainingSeconds: 180, teacherNote: "private" },
  ];
  for (const detour of malformed) {
    const candidate = structuredClone(running);
    candidate.detour = detour;
    const validation = validateExperienceRunner(candidate, { teacherKey: TEACHER_KEY });
    assert.equal(validation.ok, false, JSON.stringify(detour));
    assert.ok(validation.errors.includes("runner-detour-invalid"), JSON.stringify(detour));
  }

  for (const invalidStatus of ["ready", "paused", "complete"]) {
    const candidate = structuredClone(detoured);
    candidate.timer.status = invalidStatus;
    if (invalidStatus === "complete") {
      candidate.timer.currentStepRemainingSeconds = 0;
      candidate.timer.totalRemainingSeconds = 0;
    }
    const validation = validateExperienceRunner(candidate, { teacherKey: TEACHER_KEY });
    assert.equal(validation.ok, false, invalidStatus);
    assert.ok(validation.errors.includes("runner-detour-state-invalid"), invalidStatus);
  }
});

test("Safe Landing clears the detour and selects the first cleanup step without changing content", () => {
  const { applyExperienceRunnerAction } = getRunnerModel();
  const running = runningWorkStep();
  const beforeSteps = structuredClone(running.steps);
  const beforePlan = structuredClone(running.timer.plan);
  const beforeTotal = running.timer.totalRemainingSeconds;
  const cleanupIndex = running.steps.findIndex((step) => step.kind === "cleanup");
  const detoured = applyExperienceRunnerAction(running, "start-detour", {
    teacherKey: TEACHER_KEY,
    nowIso: NOW,
  });
  const landed = applyExperienceRunnerAction(detoured, "safe-landing", {
    teacherKey: TEACHER_KEY,
    nowIso: NOW,
  });

  assert.ok(cleanupIndex >= 0);
  assert.equal(Object.hasOwn(landed, "detour"), false);
  assert.equal(landed.timer.currentStepIndex, cleanupIndex);
  assert.equal(
    landed.timer.currentStepRemainingSeconds,
    running.steps[cleanupIndex].minutes * 60,
  );
  assert.equal(landed.timer.totalRemainingSeconds, beforeTotal);
  assert.equal(landed.timer.status, "running");
  assert.deepEqual(landed.steps, beforeSteps);
  assert.deepEqual(landed.timer.plan, beforePlan);
});

test("Safe Landing fails closed when an admitted runner has no cleanup step", () => {
  const {
    applyExperienceRunnerAction,
    validateExperienceRunner,
  } = getRunnerModel();
  const running = runningWorkStep();
  const detoured = applyExperienceRunnerAction(running, "start-detour", {
    teacherKey: TEACHER_KEY,
    nowIso: NOW,
  });
  const noCleanup = structuredClone(detoured);
  for (const step of noCleanup.steps) {
    if (step.kind === "cleanup") step.kind = "work";
  }
  assert.deepEqual(validateExperienceRunner(noCleanup, { teacherKey: TEACHER_KEY }), {
    ok: true,
    errors: [],
  });
  assert.throws(
    () => applyExperienceRunnerAction(noCleanup, "safe-landing", {
      teacherKey: TEACHER_KEY,
      nowIso: NOW,
    }),
    /runner-cleanup-step-missing/,
  );
  assert.equal(noCleanup.detour.remainingSeconds, 180);
});

test("a schedule-sized runner stays ready with a full first step and a stationary class clock", () => {
  const {
    advanceExperienceRunnerClock,
    createExperienceRunner,
  } = getRunnerModel();
  const ready = createExperienceRunner(EXPERIENCE_TIMING_PLANS[0], {
    teacherKey: TEACHER_KEY,
    nowIso: NOW,
    classDurationSeconds: 31 * 60,
  });

  assert.equal(ready.timer.status, "ready");
  assert.equal(ready.timer.currentStepRemainingSeconds, 180);
  assert.equal(ready.timer.totalRemainingSeconds, 1860);
  const later = advanceExperienceRunnerClock(ready, {
    teacherKey: TEACHER_KEY,
    nowIso: "2026-08-30T12:04:00.000Z",
  });
  assert.equal(later.timer.totalRemainingSeconds, 1860);
  assert.equal(later.lastTickAt, NOW);
});

test("runner creation rejects invalid scheduled class durations", () => {
  const { createExperienceRunner } = getRunnerModel();

  for (const classDurationSeconds of [0, -1, 60.5, 2101, Number.NaN]) {
    assert.throws(
      () => createExperienceRunner(EXPERIENCE_TIMING_PLANS[0], {
        teacherKey: TEACHER_KEY,
        nowIso: NOW,
        classDurationSeconds,
      }),
      /classDurationSeconds/,
      String(classDurationSeconds),
    );
  }
});

test("every non-Start runner action keeps a validator-accepted later-step ready runner out of running", () => {
  const {
    applyExperienceRunnerAction,
    createExperienceRunner,
    validateExperienceRunner,
  } = getRunnerModel();
  const ready = createExperienceRunner(EXPERIENCE_TIMING_PLANS[0], {
    teacherKey: TEACHER_KEY,
    nowIso: NOW,
  });
  ready.timer.currentStepIndex = 1;
  ready.timer.currentStepRemainingSeconds = ready.steps[1].minutes * 60;
  assert.deepEqual(validateExperienceRunner(ready, { teacherKey: TEACHER_KEY }), {
    ok: true,
    errors: [],
  });

  for (const action of ["pause", "resume", "add-minute", "next", "previous", "reset"]) {
    const result = applyExperienceRunnerAction(structuredClone(ready), action, {
      teacherKey: TEACHER_KEY,
      nowIso: NOW,
    });
    assert.equal(result.timer.status, "ready", action);
    if (action === "next" || action === "previous") {
      assert.equal(result.timer.currentStepIndex, 1, action);
      assert.equal(result.timer.currentStepRemainingSeconds, ready.timer.currentStepRemainingSeconds, action);
    }
  }
});

test("manual next releases an expired step while preserving the remaining class clock", () => {
  const {
    advanceExperienceRunnerClock,
    applyExperienceRunnerAction,
    createExperienceRunner,
    validateExperienceRunner,
  } = getRunnerModel();
  const ready = createExperienceRunner(EXPERIENCE_TIMING_PLANS[0], {
    teacherKey: TEACHER_KEY,
    nowIso: NOW,
  });
  const running = applyExperienceRunnerAction(ready, "start", {
    teacherKey: TEACHER_KEY,
    nowIso: NOW,
  });
  const late = advanceExperienceRunnerClock(running, {
    teacherKey: TEACHER_KEY,
    nowIso: "2026-08-30T12:33:00.000Z",
  });
  const previous = applyExperienceRunnerAction(late, "previous", {
    teacherKey: TEACHER_KEY,
    nowIso: "2026-08-30T12:33:00.000Z",
  });
  const next = applyExperienceRunnerAction(previous, "next", {
    teacherKey: TEACHER_KEY,
    nowIso: "2026-08-30T12:33:00.000Z",
  });
  const ticked = advanceExperienceRunnerClock(next, {
    teacherKey: TEACHER_KEY,
    nowIso: "2026-08-30T12:33:30.000Z",
  });

  assert.equal(late.timer.totalRemainingSeconds, 120);
  assert.equal(previous.timer.currentStepRemainingSeconds, 0);
  assert.equal(previous.timer.totalRemainingSeconds, 120);
  assert.deepEqual(validateExperienceRunner(previous, { teacherKey: TEACHER_KEY }), {
    ok: true,
    errors: [],
  });
  assert.equal(next.timer.currentStepIndex, 1);
  assert.equal(next.timer.currentStepRemainingSeconds, 240);
  assert.equal(next.timer.totalRemainingSeconds, 120);
  assert.equal(ticked.timer.currentStepRemainingSeconds, 210);
  assert.equal(ticked.timer.totalRemainingSeconds, 90);
});

test("teacher metadata stays separate from student directions through JSON and timer actions", () => {
  const {
    applyExperienceRunnerAction,
    createExperienceRunner,
  } = getRunnerModel();
  const plan = structuredClone(EXPERIENCE_TIMING_PLANS[5]);
  plan.steps[0].teacher = {
    cue: "Keep the launch short.",
    model: ["Point to the map.", "Show one sample mark."],
  };
  plan.steps[1].teacherDirections = "Assign one job to each student.";
  plan.steps[2].teacherDirections = [
    "Name the outdoor boundary.",
    "Check every team before leaving.",
  ];
  const ready = createExperienceRunner(plan, {
    teacherKey: TEACHER_KEY,
    nowIso: NOW,
  });
  const handedOff = JSON.parse(JSON.stringify(ready));
  const started = applyExperienceRunnerAction(handedOff, "start", {
    teacherKey: TEACHER_KEY,
    nowIso: NOW,
  });

  assert.deepEqual(started.steps[0].teacher, {
    cue: "Keep the launch short.",
    model: ["Point to the map.", "Show one sample mark."],
    directions: plan.steps[0].teacherDirections,
  });
  assert.deepEqual(started.steps[1].teacher, {
    directions: ["Assign one job to each student."],
  });
  assert.deepEqual(started.steps[2].teacher, {
    directions: [
      "Name the outdoor boundary.",
      "Check every team before leaving.",
    ],
  });
  assert.deepEqual(started.steps[0].directions, plan.steps[0].directions);
  assert.equal(started.steps[0].directions.includes("Keep the launch short."), false);
  assert.equal(JSON.stringify(started.timer.plan).includes("Keep the launch short."), false);
});

test("teacher keys and teacher metadata use namespaced explicit schemas", () => {
  const {
    createExperienceRunner,
    getActiveRunnerStep,
    validateExperienceRunner,
  } = getRunnerModel();
  const plan = structuredClone(EXPERIENCE_TIMING_PLANS[5]);

  for (const teacherKey of [
    "teacher@example.com",
    "teacher alpha",
    "../teacher-alpha",
    "default",
    "teacher:",
    "teacher:   ",
    "local:teacher-alpha",
  ]) {
    assert.throws(
      () => createExperienceRunner(plan, { teacherKey, nowIso: NOW }),
      /teacherKey/,
      teacherKey,
    );
  }

  plan.steps[0].teacher = { privateNote: "Do not preserve this field." };
  assert.throws(
    () => createExperienceRunner(plan, { teacherKey: TEACHER_KEY, nowIso: NOW }),
    /teacher field/i,
  );

  const valid = createExperienceRunner(EXPERIENCE_TIMING_PLANS[5], {
    teacherKey: "teacher:teacher@example.com",
    nowIso: NOW,
  });
  const unsafeOwner = structuredClone(valid);
  unsafeOwner.teacherKey = "teacher:";
  assert.ok(
    validateExperienceRunner(unsafeOwner, { teacherKey: "teacher:teacher@example.com" }).errors.includes(
      "runner-teacher-key-invalid",
    ),
  );

  const injectedTeacherField = structuredClone(valid);
  injectedTeacherField.steps[0].teacher.privateNote = "Injected later.";
  assert.ok(
    validateExperienceRunner(injectedTeacherField, { teacherKey: "teacher:teacher@example.com" }).errors.includes(
      "runner-teacher-field-invalid",
    ),
  );
  assert.throws(
    () => getActiveRunnerStep(injectedTeacherField, { teacherKey: "teacher:teacher@example.com" }),
    /invalid-experience-runner:runner-teacher-field-invalid/,
  );
});

test("Tech Terrarium snapshots exactly one mode and hides the other modes", () => {
  const { createExperienceRunner } = getRunnerModel();
  const basePlan = EXPERIENCE_TIMING_PLANS[1];
  const modeIds = ["build-new", "refresh-existing", "alternate-shared-build"];

  assert.throws(
    () => createExperienceRunner(basePlan, {
      teacherKey: TEACHER_KEY,
      nowIso: NOW,
    }),
    /runner-mode-required/,
  );
  assert.throws(
    () => createExperienceRunner(basePlan, {
      teacherKey: TEACHER_KEY,
      nowIso: NOW,
      modeId: "not-a-mode",
    }),
    /runner-mode-invalid/,
  );
  assert.throws(
    () => createExperienceRunner(EXPERIENCE_TIMING_PLANS[2], {
      teacherKey: TEACHER_KEY,
      nowIso: NOW,
      modeId: "build-new",
    }),
    /runner-mode-not-supported/,
  );
  const modeProjectImpostor = structuredClone(basePlan);
  modeProjectImpostor.projectNumber = 3;
  assert.throws(
    () => createExperienceRunner(modeProjectImpostor, {
      teacherKey: TEACHER_KEY,
      nowIso: NOW,
      modeId: "build-new",
    }),
    /invalid-experience-plan|runner-mode-invalid/,
  );

  for (const modeId of modeIds) {
    const selected = getExperienceTimingPlan(2, { modeId });
    const runner = createExperienceRunner(basePlan, {
      teacherKey: TEACHER_KEY,
      nowIso: NOW,
      modeId,
    });
    const serialized = JSON.stringify(runner);

    assert.equal(runner.modeId, modeId);
    assert.deepEqual(runner.steps.map((step) => step.directions), selected.steps.map((step) => step.directions));
    assert.deepEqual(runner.parallelJobs, selected.parallelJobs);
    assert.deepEqual(runner.preservation, selected.preservation);
    assert.equal(serialized.includes("modeVariants"), false);
    for (const otherModeId of modeIds.filter((candidate) => candidate !== modeId)) {
      assert.equal(serialized.includes(`\"${otherModeId}\"`), false);
    }
  }

  const refresh = createExperienceRunner(basePlan, {
    teacherKey: TEACHER_KEY,
    nowIso: NOW,
    modeId: "refresh-existing",
  });
  assert.deepEqual(refresh.preservation, {
    preserveExisting: true,
    requiresExistingArtifact: true,
    dismantleGluedStructure: false,
  });
  assert.match(refresh.steps.flatMap((step) => step.directions).join(" "), /keep all glued parts together/i);
  assert.doesNotMatch(refresh.steps.flatMap((step) => step.directions).join(" "), /build a new base/i);
});

test("Helping Hand preserves one shared prototype boundary and 30-student roles", () => {
  const {
    applyExperienceRunnerAction,
    createExperienceRunner,
    validateExperienceRunner,
  } = getRunnerModel();
  const plan = EXPERIENCE_TIMING_PLANS[22];
  const ready = createExperienceRunner(plan, {
    teacherKey: TEACHER_KEY,
    nowIso: NOW,
  });
  const started = applyExperienceRunnerAction(JSON.parse(JSON.stringify(ready)), "start", {
    teacherKey: TEACHER_KEY,
    nowIso: NOW,
  });

  assert.deepEqual(started.assistiveBoundary, {
    sharedPrototypeLimit: 1,
    educationalPrototypeOnly: true,
    studentPiiAllowed: false,
    medicalClaimsAllowed: false,
  });
  assert.deepEqual(started.parallelRoles, plan.parallelRoles);
  assert.ok(started.parallelRoles.reduce((sum, role) => sum + role.maxStudents, 0) >= 30);
  assert.equal(new Set(started.parallelRoles.map((role) => role.id)).size, started.parallelRoles.length);
  assert.equal(
    started.steps.flatMap((step) => step.directions).includes(plan.parallelRoles[0].directions[0]),
    false,
  );
  assert.equal(JSON.stringify(started.timer).includes(plan.parallelRoles[0].directions[0]), false);

  const tamperCases = [
    {
      code: "runner-assistive-boundary-invalid",
      mutate(runner) {
        runner.assistiveBoundary.sharedPrototypeLimit = 2;
      },
    },
    {
      code: "runner-assistive-boundary-invalid",
      mutate(runner) {
        runner.assistiveBoundary.studentPiiAllowed = true;
      },
    },
    {
      code: "runner-assistive-boundary-invalid",
      mutate(runner) {
        runner.assistiveBoundary.educationalPrototypeOnly = false;
      },
    },
    {
      code: "runner-assistive-boundary-invalid",
      mutate(runner) {
        runner.assistiveBoundary.medicalClaimsAllowed = true;
      },
    },
    {
      code: "runner-parallel-roles-invalid",
      mutate(runner) {
        runner.parallelRoles = runner.parallelRoles.slice(0, 5);
      },
    },
  ];
  for (const testCase of tamperCases) {
    const tampered = structuredClone(started);
    testCase.mutate(tampered);
    assert.ok(
      validateExperienceRunner(tampered, { teacherKey: TEACHER_KEY }).errors.includes(testCase.code),
      testCase.code,
    );
    assert.throws(
      () => applyExperienceRunnerAction(tampered, "pause", {
        teacherKey: TEACHER_KEY,
        nowIso: NOW,
      }),
      /invalid-experience-runner/,
      testCase.code,
    );
  }
});

test("fallback paths stay separate from the default path and select explicitly", () => {
  const { createExperienceRunner } = getRunnerModel();
  const cases = [
    { projectNumber: 6, fallbackId: "indoor-weather" },
    { projectNumber: 31, fallbackId: "indoor-weather" },
    { projectNumber: 28, fallbackId: "paper-data-cards" },
  ];

  for (const { projectNumber, fallbackId } of cases) {
    const basePlan = EXPERIENCE_TIMING_PLANS[projectNumber - 1];
    const selectedPlan = getExperienceTimingPlan(projectNumber, { fallbackId });
    const defaultRunner = createExperienceRunner(basePlan, {
      teacherKey: TEACHER_KEY,
      nowIso: NOW,
    });
    const selectedRunner = createExperienceRunner(basePlan, {
      teacherKey: TEACHER_KEY,
      nowIso: NOW,
      fallbackId,
    });

    assert.deepEqual(
      defaultRunner.steps.map((step) => step.directions),
      basePlan.steps.map((step) => step.directions),
      "fallback directions must not merge into the default path",
    );
    assert.ok(defaultRunner.fallbacks[fallbackId]);
    assert.deepEqual(
      defaultRunner.fallbacks[fallbackId].steps.map((step) => step.directions),
      basePlan.fallbacks[fallbackId].steps.map((step) => step.directions),
    );
    assert.deepEqual(
      defaultRunner.fallbacks[fallbackId].steps[0].teacher.directions,
      basePlan.fallbacks[fallbackId].steps[0].teacherDirections,
    );

    assert.equal(selectedRunner.selectedFallbackId, fallbackId);
    assert.equal(selectedRunner.fallbackReason, selectedPlan.fallbackReason);
    assert.equal("fallbacks" in selectedRunner, false);
    assert.deepEqual(
      selectedRunner.steps.map((step) => step.directions),
      selectedPlan.steps.map((step) => step.directions),
    );
    assert.deepEqual(
      selectedRunner.steps[0].teacher.directions,
      selectedPlan.steps[0].teacherDirections,
    );
    assert.equal(selectedRunner.steps.reduce((sum, step) => sum + step.minutes, 0), 35);
  }

  assert.throws(
    () => createExperienceRunner(EXPERIENCE_TIMING_PLANS[5], {
      teacherKey: TEACHER_KEY,
      nowIso: NOW,
      fallbackId: "not-a-fallback",
    }),
    /runner-fallback-invalid/,
  );
  assert.throws(
    () => createExperienceRunner(EXPERIENCE_TIMING_PLANS[4], {
      teacherKey: TEACHER_KEY,
      nowIso: NOW,
      fallbackId: "indoor-weather",
    }),
    /runner-fallback-not-supported/,
  );
  const fallbackProjectImpostor = structuredClone(EXPERIENCE_TIMING_PLANS[5]);
  fallbackProjectImpostor.projectNumber = 31;
  assert.throws(
    () => createExperienceRunner(fallbackProjectImpostor, {
      teacherKey: TEACHER_KEY,
      nowIso: NOW,
      fallbackId: "indoor-weather",
    }),
    /invalid-experience-plan|runner-fallback-invalid/,
  );
  assert.throws(
    () => createExperienceRunner(EXPERIENCE_TIMING_PLANS[1], {
      teacherKey: TEACHER_KEY,
      nowIso: NOW,
      modeId: "build-new",
      fallbackId: "indoor-weather",
    }),
    /runner-selection-conflict/,
  );
});

test("validation fails closed when the content and timer snapshots no longer match", () => {
  const {
    applyExperienceRunnerAction,
    createExperienceRunner,
    validateExperienceRunner,
  } = getRunnerModel();
  const source = createExperienceRunner(EXPERIENCE_TIMING_PLANS[5], {
    teacherKey: TEACHER_KEY,
    nowIso: NOW,
  });
  assert.deepEqual(validateExperienceRunner(source, { teacherKey: TEACHER_KEY }), {
    ok: true,
    errors: [],
  });

  const cases = [
    {
      code: "runner-step-count-mismatch",
      mutate(runner) {
        runner.steps.pop();
      },
    },
    {
      code: "runner-step-minutes-mismatch",
      mutate(runner) {
        runner.steps[0].minutes += 1;
      },
    },
    {
      code: "runner-project-mismatch",
      mutate(runner) {
        runner.projectNumber = 7;
      },
    },
    {
      code: "runner-step-index-invalid",
      mutate(runner) {
        runner.timer.currentStepIndex = 99;
      },
    },
    {
      code: "runner-step-minutes-mismatch",
      mutate(runner) {
        runner.timer.plan.steps[0].minutes += 1;
      },
    },
    {
      code: "runner-last-tick-invalid",
      mutate(runner) {
        runner.lastTickAt = "2026-08-30 12:00:00";
      },
    },
  ];

  for (const testCase of cases) {
    const tampered = structuredClone(source);
    testCase.mutate(tampered);
    const result = validateExperienceRunner(tampered, { teacherKey: TEACHER_KEY });
    assert.equal(result.ok, false, testCase.code);
    assert.ok(result.errors.includes(testCase.code), testCase.code);
    assert.throws(
      () => applyExperienceRunnerAction(tampered, "start", {
        teacherKey: TEACHER_KEY,
        nowIso: NOW,
      }),
      /invalid-experience-runner/,
      testCase.code,
    );
  }
});

test("every public operation rejects a different teacher key", () => {
  const {
    advanceExperienceRunnerClock,
    applyExperienceRunnerAction,
    createExperienceRunner,
    getActiveRunnerStep,
    validateExperienceRunner,
  } = getRunnerModel();
  const runner = createExperienceRunner(EXPERIENCE_TIMING_PLANS[5], {
    teacherKey: TEACHER_KEY,
    nowIso: NOW,
  });
  const wrongTeacher = { teacherKey: "teacher:teacher-beta", nowIso: NOW };

  assert.deepEqual(validateExperienceRunner(runner, wrongTeacher), {
    ok: false,
    errors: ["runner-teacher-mismatch"],
  });
  assert.throws(() => getActiveRunnerStep(runner, wrongTeacher), /runner-teacher-mismatch/);
  assert.throws(
    () => advanceExperienceRunnerClock(runner, wrongTeacher),
    /runner-teacher-mismatch/,
  );
  assert.throws(
    () => applyExperienceRunnerAction(runner, "start", wrongTeacher),
    /runner-teacher-mismatch/,
  );
});

test("timestamps and action names fail closed instead of being corrected silently", () => {
  const {
    applyExperienceRunnerAction,
    createExperienceRunner,
  } = getRunnerModel();

  assert.throws(
    () => createExperienceRunner(EXPERIENCE_TIMING_PLANS[0], {
      teacherKey: TEACHER_KEY,
      nowIso: "2026-08-30T12:00:00Z",
    }),
    /canonical ISO timestamp/,
  );
  const runner = createExperienceRunner(EXPERIENCE_TIMING_PLANS[0], {
    teacherKey: TEACHER_KEY,
    nowIso: NOW,
  });
  assert.throws(
    () => applyExperienceRunnerAction(runner, "skip-everything", {
      teacherKey: TEACHER_KEY,
      nowIso: NOW,
    }),
    /runner-action-invalid/,
  );
});


test("replica selections keep existing runner schema, stationary clocks, and manual step transitions", () => {
  const { createExperienceRunner, applyExperienceRunnerAction, advanceExperienceRunnerClock, validateExperienceRunner } = getRunnerModel();
  for (const modeId of ["replica-sort", "replica-layout", "replica-service"]) {
    let runner = createExperienceRunner(EXPERIENCE_TIMING_PLANS[1], { teacherKey: TEACHER_KEY, nowIso: NOW, modeId });
    assert.equal(runner.schemaVersion, 1);
    assert.equal(runner.modeId, modeId);
    assert.equal(runner.timer.status, "ready");
    assert.equal(runner.timer.totalRemainingSeconds, 2100);
    assert.equal(validateExperienceRunner(runner, { teacherKey: TEACHER_KEY }).ok, true);
    runner = applyExperienceRunnerAction(runner, "start", { teacherKey: TEACHER_KEY, nowIso: NOW });
    const firstSeconds = runner.steps[0].minutes * 60;
    const later = new Date(Date.parse(NOW) + (firstSeconds + 1) * 1000).toISOString();
    runner = advanceExperienceRunnerClock(runner, { teacherKey: TEACHER_KEY, nowIso: later });
    assert.equal(runner.timer.status, "step-expired");
    assert.equal(runner.timer.currentStepIndex, 0);
    assert.equal(runner.timer.totalRemainingSeconds, 2100 - firstSeconds - 1);
    runner = applyExperienceRunnerAction(runner, "next", { teacherKey: TEACHER_KEY, nowIso: later });
    assert.equal(runner.timer.currentStepIndex, 1);
  }
});
