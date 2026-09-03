import { validateTeacherPlan } from "./teacher-plan.js";

export const SETUP_STEPS = Object.freeze([
  "account", "teacher", "schedule", "sync", "verify", "ready"
]);

export function createSetupState(seed = {}) {
  return {
    current: seed.account ? "teacher" : "account",
    account: seed.account ?? null,
    teacherConfirmed: false,
    planPreview: null,
    uploadConfirmed: false,
    verification: null
  };
}

export function advanceSetup(state, target) {
  const currentIndex = SETUP_STEPS.indexOf(state.current);
  const targetIndex = SETUP_STEPS.indexOf(target);
  if (targetIndex !== currentIndex + 1) throw new Error("setup-step-blocked");
  return { ...structuredClone(state), current: target };
}

export function summarizeTeacherPlan(candidate) {
  const validation = validateTeacherPlan(candidate);
  if (!validation.ok) {
    return {
      valid: false,
      errors: validation.errors,
      warnings: validation.warnings
    };
  }

  const plan = validation.value;
  const cycleDays = new Set();
  let eventCount = plan.specialEvents.length;
  for (const teacher of plan.teachers) {
    for (const [cycleDay, events] of Object.entries(teacher.days)) {
      cycleDays.add(cycleDay);
      eventCount += events.length;
    }
  }

  return {
    valid: true,
    teacherName: plan.teachers.map((teacher) => teacher.name).filter(Boolean).join(", "),
    cycleDayCount: cycleDays.size,
    eventCount,
    dateRange: `${plan.calendar.anchorDate} to ${plan.calendar.lastDate}`,
    warnings: validation.warnings
  };
}

export function setupCompletionSummary(state) {
  const snapshot = structuredClone(state);
  return {
    current: snapshot.current,
    complete: snapshot.current === "ready",
    accountConnected: Boolean(snapshot.account),
    teacherConfirmed: snapshot.teacherConfirmed === true,
    planLoaded: snapshot.planPreview !== null,
    scheduleReady: snapshot.planPreview !== null,
    privateSyncEnabled: snapshot.uploadConfirmed === true,
    verified: snapshot.verification !== null
  };
}
