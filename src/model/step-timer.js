const LESSON_MINUTES = 35;

function normalizedPlan(plan) {
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
    throw new TypeError("Plan must be an object.");
  }

  const name = typeof plan.name === "string" ? plan.name.trim() : "";
  if (!name) {
    throw new TypeError("Plan name must be a non-empty string.");
  }
  if (!Array.isArray(plan.steps) || plan.steps.length === 0) {
    throw new TypeError("Plan must include at least one step.");
  }

  const steps = plan.steps.map((step, index) => {
    if (!step || typeof step !== "object" || Array.isArray(step)) {
      throw new TypeError(`Step ${index + 1} must be an object.`);
    }

    const stepName = typeof step.name === "string" ? step.name.trim() : "";
    if (!stepName) {
      throw new TypeError(`Step ${index + 1} must have a non-empty name.`);
    }
    if (!Number.isInteger(step.minutes) || step.minutes <= 0) {
      throw new TypeError(`Step ${index + 1} minutes must be a positive integer.`);
    }

    return { name: stepName, minutes: step.minutes };
  });

  const totalMinutes = steps.reduce((total, step) => total + step.minutes, 0);
  if (totalMinutes !== LESSON_MINUTES) {
    throw new TypeError(`Plan steps must total ${LESSON_MINUTES} minutes.`);
  }

  const result = { name, steps };
  if (typeof plan.id === "string" && plan.id.trim()) {
    result.id = plan.id.trim();
  }
  return result;
}

function frozenPlan(plan) {
  for (const step of plan.steps) Object.freeze(step);
  Object.freeze(plan.steps);
  return Object.freeze(plan);
}

export const OUTDOOR_MICROCLIMATE_MAP_PLAN = frozenPlan({
  id: "outdoor-microclimate-map",
  name: "Outdoor Microclimate Map",
  steps: [
    { name: "Meet the mission", minutes: 2 },
    { name: "Get your team job", minutes: 3 },
    { name: "Choose two map spots", minutes: 3 },
    { name: "Measure and mark the map", minutes: 12 },
    { name: "Compare hot and cool spots", minutes: 5 },
    { name: "Add labels and one pattern", minutes: 5 },
    { name: "Share one finding", minutes: 3 },
    { name: "Clean up and exit", minutes: 2 }
  ]
});

export function createStepTimer(plan, { classDurationSeconds = LESSON_MINUTES * 60 } = {}) {
  const normalized = normalizedPlan(plan);
  if (
    !Number.isInteger(classDurationSeconds) ||
    classDurationSeconds < 1 ||
    classDurationSeconds > LESSON_MINUTES * 60
  ) {
    throw new TypeError(
      `classDurationSeconds must be an integer from 1 through ${LESSON_MINUTES * 60}.`
    );
  }
  const serializablePlan = normalized.id
    ? { id: normalized.id, name: normalized.name, steps: normalized.steps }
    : normalized;

  return {
    schemaVersion: 1,
    plan: serializablePlan,
    status: "ready",
    currentStepIndex: 0,
    currentStepRemainingSeconds: serializablePlan.steps[0].minutes * 60,
    totalRemainingSeconds: classDurationSeconds
  };
}

function copyState(state) {
  return {
    ...state,
    plan: {
      ...state.plan,
      steps: state.plan.steps.map((step) => ({ ...step }))
    }
  };
}

export function startStepTimer(state) {
  const next = copyState(state);
  if (next.status === "ready") next.status = "running";
  return next;
}

export function pauseStepTimer(state) {
  const next = copyState(state);
  if (next.status === "running" || next.status === "step-expired") next.status = "paused";
  return next;
}

export function resumeStepTimer(state) {
  const next = copyState(state);
  if (next.status === "paused") next.status = "running";
  return next;
}

export function resetStepTimer(state) {
  return createStepTimer(state.plan);
}

function completeState(state) {
  state.status = "complete";
  state.currentStepRemainingSeconds = 0;
  state.totalRemainingSeconds = 0;
  return state;
}

export function addMinuteToStepTimer(state) {
  const next = copyState(state);
  if (next.status === "complete") return next;

  next.currentStepRemainingSeconds += 60;
  next.totalRemainingSeconds += 60;
  if (next.status === "step-expired") next.status = "running";
  return next;
}

export function nextStepTimer(state) {
  const next = copyState(state);
  if (next.status === "ready" || next.status === "complete") return next;

  const lastStepIndex = next.plan.steps.length - 1;
  if (next.currentStepIndex === lastStepIndex) return completeState(next);

  next.currentStepIndex += 1;
  next.currentStepRemainingSeconds =
    next.plan.steps[next.currentStepIndex].minutes * 60;
  if (next.status !== "paused") next.status = "running";
  return next;
}

export function previousStepTimer(state) {
  const next = copyState(state);
  if (next.status === "complete" || next.currentStepIndex === 0) return next;

  next.currentStepIndex -= 1;
  next.currentStepRemainingSeconds =
    next.plan.steps[next.currentStepIndex].minutes * 60;
  if (next.status !== "paused") next.status = "running";
  return next;
}

export function tickStepTimer(state, elapsedSeconds) {
  if (!Number.isInteger(elapsedSeconds) || elapsedSeconds < 0) {
    throw new TypeError("Elapsed seconds must be a non-negative integer.");
  }

  const next = copyState(state);
  if ((next.status !== "running" && next.status !== "step-expired") || elapsedSeconds === 0) return next;

  let unconsumedSeconds = elapsedSeconds;
  const lastStepIndex = next.plan.steps.length - 1;

  while (unconsumedSeconds > 0 && (next.status === "running" || next.status === "step-expired")) {
    if (next.totalRemainingSeconds === 0) return completeState(next);

    if (next.status === "step-expired") {
      const consumedSeconds = Math.min(unconsumedSeconds, next.totalRemainingSeconds);
      next.totalRemainingSeconds -= consumedSeconds;
      unconsumedSeconds -= consumedSeconds;
      if (next.totalRemainingSeconds === 0) return completeState(next);
      continue;
    }

    const consumedSeconds = Math.min(
      unconsumedSeconds,
      next.currentStepRemainingSeconds,
      next.totalRemainingSeconds
    );
    next.currentStepRemainingSeconds -= consumedSeconds;
    next.totalRemainingSeconds -= consumedSeconds;
    unconsumedSeconds -= consumedSeconds;

    if (next.totalRemainingSeconds === 0) return completeState(next);
    if (next.currentStepRemainingSeconds > 0) continue;
    if (next.currentStepIndex === lastStepIndex) return completeState(next);
    next.status = "step-expired";
  }

  return next;
}
