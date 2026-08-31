import assert from "node:assert/strict";
import test from "node:test";

import * as timer from "../src/model/step-timer.js";

const expectedOutdoorSteps = [
  { name: "Meet the mission", minutes: 2 },
  { name: "Get your team job", minutes: 3 },
  { name: "Choose two map spots", minutes: 3 },
  { name: "Measure and mark the map", minutes: 12 },
  { name: "Compare hot and cool spots", minutes: 5 },
  { name: "Add labels and one pattern", minutes: 5 },
  { name: "Share one finding", minutes: 3 },
  { name: "Clean up and exit", minutes: 2 }
];

function runningOutdoorTimer() {
  return timer.startStepTimer(
    timer.createStepTimer(timer.OUTDOOR_MICROCLIMATE_MAP_PLAN)
  );
}

test("provides the ordered 35-minute Outdoor Microclimate Map plan", () => {
  assert.equal(timer.OUTDOOR_MICROCLIMATE_MAP_PLAN.name, "Outdoor Microclimate Map");
  assert.deepEqual(timer.OUTDOOR_MICROCLIMATE_MAP_PLAN.steps, expectedOutdoorSteps);
  assert.equal(
    timer.OUTDOOR_MICROCLIMATE_MAP_PLAN.steps.reduce(
      (total, step) => total + step.minutes,
      0
    ),
    35
  );
});

test("creates a ready serializable timer with step and class countdowns", () => {
  const state = timer.createStepTimer(timer.OUTDOOR_MICROCLIMATE_MAP_PLAN);

  assert.deepEqual(state, {
    schemaVersion: 1,
    plan: {
      id: "outdoor-microclimate-map",
      name: "Outdoor Microclimate Map",
      steps: expectedOutdoorSteps
    },
    status: "ready",
    currentStepIndex: 0,
    currentStepRemainingSeconds: 120,
    totalRemainingSeconds: 2100
  });
  assert.deepEqual(JSON.parse(JSON.stringify(state)), state);
});

test("rejects malformed plans and plans that do not total 35 minutes", () => {
  const validSteps = expectedOutdoorSteps.map((step) => ({ ...step }));
  const invalidPlans = [
    null,
    {},
    { name: "", steps: validSteps },
    { name: "Invalid", steps: [] },
    {
      name: "Invalid",
      steps: [{ name: "", minutes: 35 }]
    },
    {
      name: "Invalid",
      steps: [{ name: "Only step", minutes: 0 }]
    },
    {
      name: "Invalid",
      steps: [{ name: "Only step", minutes: 35.5 }]
    },
    {
      name: "Invalid",
      steps: [{ name: "Only step", minutes: "35" }]
    },
    {
      name: "Too short",
      steps: [{ name: "Only step", minutes: 34 }]
    },
    {
      name: "Too long",
      steps: [{ name: "Only step", minutes: 36 }]
    }
  ];

  for (const plan of invalidPlans) {
    assert.throws(
      () => timer.createStepTimer(plan),
      { name: "TypeError" },
      `expected plan to be rejected: ${JSON.stringify(plan)}`
    );
  }
});

test("starts, pauses, and resumes without mutating earlier states", () => {
  const ready = timer.createStepTimer(timer.OUTDOOR_MICROCLIMATE_MAP_PLAN);
  const readySnapshot = structuredClone(ready);
  const running = timer.startStepTimer?.(ready);

  assert.equal(running?.status, "running");
  assert.deepEqual(ready, readySnapshot);

  const paused = timer.pauseStepTimer?.(running);
  assert.equal(paused?.status, "paused");
  assert.equal(timer.resumeStepTimer?.(paused)?.status, "running");
});

test("resets controls and countdowns to the original ready state", () => {
  const ready = timer.createStepTimer(timer.OUTDOOR_MICROCLIMATE_MAP_PLAN);
  const running = timer.startStepTimer?.(ready);
  const paused = timer.pauseStepTimer?.(running);

  assert.deepEqual(timer.resetStepTimer?.(paused), ready);
});

test("survives a JSON route handoff without route-specific state", () => {
  const running = timer.startStepTimer?.(
    timer.createStepTimer(timer.OUTDOOR_MICROCLIMATE_MAP_PLAN)
  );
  const transferred = JSON.parse(JSON.stringify(running));

  assert.deepEqual(transferred, running);
  assert.equal(Object.hasOwn(transferred, "route"), false);
  assert.equal(timer.pauseStepTimer?.(transferred)?.status, "paused");
});

test("ticks deterministically from elapsed whole seconds without mutation", () => {
  const running = runningOutdoorTimer();
  const snapshot = structuredClone(running);
  const after = timer.tickStepTimer?.(running, 45);

  assert.equal(after?.status, "running");
  assert.equal(after?.currentStepIndex, 0);
  assert.equal(after?.currentStepRemainingSeconds, 75);
  assert.equal(after?.totalRemainingSeconds, 2055);
  assert.deepEqual(running, snapshot);
});

test("does not consume elapsed time while ready or paused", () => {
  const ready = timer.createStepTimer(timer.OUTDOOR_MICROCLIMATE_MAP_PLAN);
  const paused = timer.pauseStepTimer(runningOutdoorTimer());

  assert.deepEqual(timer.tickStepTimer?.(ready, 600), ready);
  assert.deepEqual(timer.tickStepTimer?.(paused, 600), paused);
  assert.deepEqual(timer.tickStepTimer?.(runningOutdoorTimer(), 0), runningOutdoorTimer());
});

test("rejects invalid elapsed-second values", () => {
  for (const elapsed of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, "1", null]) {
    assert.throws(
      () => timer.tickStepTimer?.(runningOutdoorTimer(), elapsed),
      { name: "TypeError" },
      `expected elapsed value to be rejected: ${String(elapsed)}`
    );
  }
});

test("marks the active step expired at its boundary without losing class time", () => {
  const afterFirst = timer.tickStepTimer?.(runningOutdoorTimer(), 120);
  assert.equal(afterFirst?.status, "step-expired");
  assert.equal(afterFirst?.currentStepIndex, 0);
  assert.equal(afterFirst?.currentStepRemainingSeconds, 0);
  assert.equal(afterFirst?.totalRemainingSeconds, 1980);

  const afterSecond = timer.tickStepTimer?.(runningOutdoorTimer(), 300);
  assert.equal(afterSecond?.status, "step-expired");
  assert.equal(afterSecond?.currentStepIndex, 0);
  assert.equal(afterSecond?.currentStepRemainingSeconds, 0);
  assert.equal(afterSecond?.totalRemainingSeconds, 1800);

  const oneSecondIntoThird = timer.tickStepTimer?.(runningOutdoorTimer(), 301);
  assert.equal(oneSecondIntoThird?.status, "step-expired");
  assert.equal(oneSecondIntoThird?.currentStepIndex, 0);
  assert.equal(oneSecondIntoThird?.currentStepRemainingSeconds, 0);
  assert.equal(oneSecondIntoThird?.totalRemainingSeconds, 1799);
});

test("step expiry waits on the expired step while the class clock continues", () => {
  const expired = timer.tickStepTimer(runningOutdoorTimer(), 120);

  assert.equal(expired.status, "step-expired");
  assert.equal(expired.currentStepIndex, 0);
  assert.equal(expired.currentStepRemainingSeconds, 0);
  assert.equal(expired.totalRemainingSeconds, 1980);

  const later = timer.tickStepTimer(expired, 60);
  assert.equal(later.status, "step-expired");
  assert.equal(later.currentStepIndex, 0);
  assert.equal(later.currentStepRemainingSeconds, 0);
  assert.equal(later.totalRemainingSeconds, 1920);

  const next = timer.nextStepTimer(later);
  assert.equal(next.status, "running");
  assert.equal(next.currentStepIndex, 1);
  assert.equal(next.currentStepRemainingSeconds, 180);
  assert.equal(next.totalRemainingSeconds, 1920);
});

test("completes at the final boundary and clamps oversized ticks at zero", () => {
  const exact = timer.tickStepTimer?.(runningOutdoorTimer(), 2100);
  assert.equal(exact?.status, "complete");
  assert.equal(exact?.currentStepIndex, 0);
  assert.equal(exact?.currentStepRemainingSeconds, 0);
  assert.equal(exact?.totalRemainingSeconds, 0);

  const oversized = timer.tickStepTimer?.(runningOutdoorTimer(), 9999);
  assert.equal(oversized?.status, "complete");
  assert.equal(oversized?.currentStepRemainingSeconds, 0);
  assert.equal(oversized?.totalRemainingSeconds, 0);
  assert.deepEqual(timer.tickStepTimer?.(oversized, 10), oversized);
});

test("manual next preserves remaining class time and loads the next full step", () => {
  const firstStep = timer.tickStepTimer(runningOutdoorTimer(), 30);
  const snapshot = structuredClone(firstStep);
  const secondStep = timer.nextStepTimer?.(firstStep);

  assert.equal(secondStep?.status, "running");
  assert.equal(secondStep?.currentStepIndex, 1);
  assert.equal(secondStep?.currentStepRemainingSeconds, 180);
  assert.equal(secondStep?.totalRemainingSeconds, 2070);
  assert.deepEqual(firstStep, snapshot);
});

test("previous loads the prior full step without changing class time", () => {
  const firstStep = timer.tickStepTimer(runningOutdoorTimer(), 30);
  const secondStep = timer.nextStepTimer?.(firstStep);
  const back = timer.previousStepTimer?.(secondStep);

  assert.equal(back?.status, "running");
  assert.equal(back?.currentStepIndex, 0);
  assert.equal(back?.currentStepRemainingSeconds, 120);
  assert.equal(back?.totalRemainingSeconds, 2070);
  assert.deepEqual(timer.previousStepTimer?.(back), back);
});

test("Previous and Next keep a paused timer paused until Resume", () => {
  const paused = timer.pauseStepTimer(runningOutdoorTimer());
  const next = timer.nextStepTimer(paused);
  const previous = timer.previousStepTimer(next);

  assert.equal(next.status, "paused");
  assert.equal(next.currentStepIndex, 1);
  assert.equal(previous.status, "paused");
  assert.equal(previous.currentStepIndex, 0);
  assert.deepEqual(timer.tickStepTimer(previous, 30), previous);
  assert.equal(timer.resumeStepTimer(previous).status, "running");
});

test("adds one minute to both countdowns and reset removes the adjustment", () => {
  const running = timer.tickStepTimer(runningOutdoorTimer(), 30);
  const snapshot = structuredClone(running);
  const adjusted = timer.addMinuteToStepTimer?.(running);

  assert.equal(adjusted?.currentStepRemainingSeconds, 150);
  assert.equal(adjusted?.totalRemainingSeconds, 2130);
  assert.deepEqual(running, snapshot);

  const reset = timer.resetStepTimer?.(adjusted);
  assert.equal(reset?.status, "ready");
  assert.equal(reset?.currentStepIndex, 0);
  assert.equal(reset?.currentStepRemainingSeconds, 120);
  assert.equal(reset?.totalRemainingSeconds, 2100);
});

test("manual next from the final step returns complete with no negative time", () => {
  let state = runningOutdoorTimer();
  for (let index = 0; index < 7; index += 1) {
    state = timer.nextStepTimer?.(state);
  }

  assert.equal(state?.currentStepIndex, 7);
  assert.equal(state?.currentStepRemainingSeconds, 120);
  assert.equal(state?.totalRemainingSeconds, 2100);

  const complete = timer.nextStepTimer?.(state);
  assert.equal(complete?.status, "complete");
  assert.equal(complete?.currentStepIndex, 7);
  assert.equal(complete?.currentStepRemainingSeconds, 0);
  assert.equal(complete?.totalRemainingSeconds, 0);
});

test("class time expiration clamps at complete even when a step has more time", () => {
  const state = timer.tickStepTimer(runningOutdoorTimer(), 2040);

  assert.equal(state?.status, "step-expired");
  assert.equal(state?.currentStepIndex, 0);
  assert.equal(state?.currentStepRemainingSeconds, 0);
  assert.equal(state?.totalRemainingSeconds, 60);

  const complete = timer.tickStepTimer?.(state, 90);
  assert.equal(complete?.status, "complete");
  assert.equal(complete?.currentStepRemainingSeconds, 0);
  assert.equal(complete?.totalRemainingSeconds, 0);
});

test("continues ticking after JSON serialization with navigation and added time", () => {
  const advanced = timer.nextStepTimer?.(
    timer.addMinuteToStepTimer?.(
      timer.tickStepTimer(runningOutdoorTimer(), 45)
    )
  );
  const transferred = JSON.parse(JSON.stringify(advanced));
  const after = timer.tickStepTimer?.(transferred, 15);

  assert.equal(Object.hasOwn(after, "route"), false);
  assert.equal(after?.status, "running");
  assert.equal(after?.currentStepIndex, 1);
  assert.equal(after?.currentStepRemainingSeconds, 165);
  assert.equal(after?.totalRemainingSeconds, 2100);
});
