import {
  getExperienceTimingPlan,
  validateExperienceTimingPlan,
} from "./experience-timing-plans.js";
import {
  addMinuteToStepTimer,
  createStepTimer,
  nextStepTimer,
  pauseStepTimer,
  previousStepTimer,
  resetStepTimer,
  resumeStepTimer,
  startStepTimer,
  tickStepTimer,
} from "./step-timer.js";
import { isOwnerKey } from "./state.js";

const TEACHER_FIELDS = new Set(["directions", "cue", "model"]);
const STEP_KINDS = new Set(["ready", "safety", "transition", "work", "cleanup", "exit"]);
const TIMER_STATUSES = new Set(["ready", "running", "paused", "step-expired", "complete"]);
const MODE_IDS = new Set(["build-new", "refresh-existing", "alternate-shared-build"]);
const PRESERVATION_FIELDS = new Set([
  "preserveExisting",
  "requiresExistingArtifact",
  "requiresTeacherPlan",
  "dismantleGluedStructure",
]);
const REQUIRED_ASSISTIVE_BOUNDARY = Object.freeze({
  sharedPrototypeLimit: 1,
  educationalPrototypeOnly: true,
  studentPiiAllowed: false,
  medicalClaimsAllowed: false,
});

function canonicalIso(value, fieldName) {
  if (typeof value !== "string") {
    throw new TypeError(`${fieldName} must be a canonical ISO timestamp.`);
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new TypeError(`${fieldName} must be a canonical ISO timestamp.`);
  }
  return value;
}

function normalizedTeacherKey(value) {
  if (!isOwnerKey(value)) {
    throw new TypeError(
      "teacherKey must be local:default or teacher: followed by a nonempty teacher ID.",
    );
  }
  return value;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizedText(value, fieldName) {
  if (typeof value !== "string" || value.trim() === "" || value !== value.trim()) {
    throw new TypeError(`${fieldName} must contain non-empty trimmed text.`);
  }
  return value;
}

function normalizedTextList(value, fieldName) {
  const values = typeof value === "string" ? [value] : value;
  if (!Array.isArray(values) || values.length === 0) {
    throw new TypeError(`${fieldName} must contain text.`);
  }
  return values.map((entry, index) => normalizedText(entry, `${fieldName}.${index}`));
}

function normalizedTeacher(step) {
  const teacher = {};
  if (step.teacher !== undefined) {
    if (!isRecord(step.teacher)) {
      throw new TypeError("step.teacher must be an object.");
    }
    for (const [key, value] of Object.entries(step.teacher)) {
      if (!TEACHER_FIELDS.has(key)) {
        throw new TypeError("step.teacher contains an invalid teacher field.");
      }
      teacher[key] = Array.isArray(value)
        ? normalizedTextList(value, `step.teacher.${key}`)
        : normalizedText(value, `step.teacher.${key}`);
    }
  }
  if (step.teacherDirections !== undefined) {
    if (Array.isArray(step.teacherDirections) && step.teacherDirections.length === 0) {
      return Object.keys(teacher).length === 0 ? null : teacher;
    }
    if (Object.hasOwn(teacher, "directions")) {
      throw new TypeError("step-teacher-directions-conflict");
    }
    teacher.directions = normalizedTextList(step.teacherDirections, "step.teacherDirections");
  }
  return Object.keys(teacher).length === 0 ? null : teacher;
}

function resolvedPlanSelection(plan, modeId, fallbackId) {
  if (modeId !== undefined && fallbackId !== undefined) {
    throw new TypeError("runner-selection-conflict");
  }

  if (modeId !== undefined) {
    if (!isRecord(plan?.modeVariants)) throw new TypeError("runner-mode-not-supported");
    if (!MODE_IDS.has(modeId) || !Object.hasOwn(plan.modeVariants, modeId)) {
      throw new TypeError("runner-mode-invalid");
    }
    const selected = getExperienceTimingPlan(plan.projectNumber, { modeId });
    if (!selected) throw new TypeError("runner-mode-invalid");
    return normalizedPlanInput(selected);
  }

  if (fallbackId !== undefined) {
    if (!isRecord(plan?.fallbacks)) throw new TypeError("runner-fallback-not-supported");
    if (!Object.hasOwn(plan.fallbacks, fallbackId)) {
      throw new TypeError("runner-fallback-invalid");
    }
    const selected = getExperienceTimingPlan(plan.projectNumber, { fallbackId });
    if (!selected) throw new TypeError("runner-fallback-invalid");
    return normalizedPlanInput(selected);
  }

  if (isRecord(plan?.modeVariants)) throw new TypeError("runner-mode-required");
  return plan;
}

function copiedParallelJobs(parallelJobs) {
  if (!Array.isArray(parallelJobs) || parallelJobs.length === 0) {
    throw new TypeError("runner-mode-parallel-jobs-invalid");
  }
  return parallelJobs.map((job, index) => {
    if (!isRecord(job)) throw new TypeError("runner-mode-parallel-jobs-invalid");
    return {
      id: normalizedText(job.id, `parallelJobs.${index}.id`),
      label: normalizedText(job.label, `parallelJobs.${index}.label`),
      maxStudents: job.maxStudents,
      directions: normalizedTextList(job.directions, `parallelJobs.${index}.directions`),
    };
  });
}

function copiedPreservation(preservation) {
  if (!isRecord(preservation)) throw new TypeError("runner-mode-preservation-invalid");
  const copy = {};
  for (const [key, value] of Object.entries(preservation)) {
    if (!PRESERVATION_FIELDS.has(key) || typeof value !== "boolean") {
      throw new TypeError("runner-mode-preservation-invalid");
    }
    copy[key] = value;
  }
  return copy;
}

function copiedParallelRoles(parallelRoles) {
  if (!Array.isArray(parallelRoles) || parallelRoles.length === 0) {
    throw new TypeError("runner-parallel-roles-invalid");
  }
  const roles = parallelRoles.map((role, index) => {
    if (
      !isRecord(role) ||
      Object.keys(role).some((field) => !["id", "label", "maxStudents", "directions"].includes(field)) ||
      typeof role.id !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(role.id) ||
      !Number.isInteger(role.maxStudents) ||
      role.maxStudents < 1
    ) {
      throw new TypeError("runner-parallel-roles-invalid");
    }
    return {
      id: normalizedText(role.id, `parallelRoles.${index}.id`),
      label: normalizedText(role.label, `parallelRoles.${index}.label`),
      maxStudents: role.maxStudents,
      directions: normalizedTextList(role.directions, `parallelRoles.${index}.directions`),
    };
  });
  if (
    new Set(roles.map((role) => role.id)).size !== roles.length ||
    roles.reduce((sum, role) => sum + role.maxStudents, 0) < 30
  ) {
    throw new TypeError("runner-parallel-roles-invalid");
  }
  return roles;
}

function copiedAssistiveBoundary(boundary) {
  if (
    !isRecord(boundary) ||
    Object.keys(boundary).length !== Object.keys(REQUIRED_ASSISTIVE_BOUNDARY).length
  ) {
    throw new TypeError("runner-assistive-boundary-invalid");
  }
  for (const [field, requiredValue] of Object.entries(REQUIRED_ASSISTIVE_BOUNDARY)) {
    if (boundary[field] !== requiredValue) {
      throw new TypeError("runner-assistive-boundary-invalid");
    }
  }
  return { ...REQUIRED_ASSISTIVE_BOUNDARY };
}

function normalizedPlanInput(plan) {
  const normalized = structuredClone(plan);
  const stepLists = [normalized?.steps];
  if (isRecord(normalized?.fallbacks)) {
    for (const fallback of Object.values(normalized.fallbacks)) {
      stepLists.push(fallback?.steps);
    }
  }
  if (isRecord(normalized?.modeVariants)) {
    for (const variant of Object.values(normalized.modeVariants)) {
      stepLists.push(variant?.steps);
    }
  }
  for (const steps of stepLists) {
    if (!Array.isArray(steps)) continue;
    for (const step of steps) {
      if (typeof step?.teacherDirections === "string") {
        step.teacherDirections = [step.teacherDirections];
      }
    }
  }
  return normalized;
}

function copiedSteps(steps) {
  return steps.map((step) => {
    const teacher = normalizedTeacher(step);
    return {
      id: step.id,
      label: step.label,
      kind: step.kind,
      minutes: step.minutes,
      directions: [...step.directions],
      ...(teacher ? { teacher } : {}),
    };
  });
}

function copiedFallbacks(plan) {
  if (!isRecord(plan.fallbacks)) return null;
  const copied = {};
  for (const [fallbackId, fallback] of Object.entries(plan.fallbacks)) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(fallbackId) || !isRecord(fallback)) {
      throw new TypeError("runner-fallback-invalid");
    }
    const fallbackPlan = {
      ...plan,
      steps: fallback.steps,
    };
    const validation = validateExperienceTimingPlan(fallbackPlan);
    if (!validation.ok) throw new TypeError("runner-fallback-invalid");
    copied[fallbackId] = {
      reason: normalizedText(fallback.reason, `fallbacks.${fallbackId}.reason`),
      steps: copiedSteps(fallback.steps),
    };
  }
  return copied;
}

function validCanonicalIso(value) {
  if (typeof value !== "string") return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function validText(value) {
  return typeof value === "string" && value.length > 0 && value === value.trim();
}

function validTextList(value) {
  return Array.isArray(value) && value.length > 0 && value.every(validText);
}

function pushUnique(errors, code) {
  if (!errors.includes(code)) errors.push(code);
}

function validateTeacherSnapshot(teacher, errors) {
  if (!isRecord(teacher) || Object.keys(teacher).length === 0) {
    pushUnique(errors, "runner-teacher-invalid");
    return;
  }
  for (const [key, value] of Object.entries(teacher)) {
    if (!TEACHER_FIELDS.has(key)) {
      pushUnique(errors, "runner-teacher-field-invalid");
      continue;
    }
    if (!(validText(value) || validTextList(value))) {
      pushUnique(errors, "runner-teacher-invalid");
    }
  }
}

function validateModeSnapshot(runner, errors) {
  const hasAnyModeField = ["modeId", "parallelJobs", "preservation"].some((field) =>
    Object.hasOwn(runner, field));
  if (!hasAnyModeField) {
    if (runner.projectNumber === 2) pushUnique(errors, "runner-mode-invalid");
    return;
  }

  if (runner.projectNumber !== 2 || !MODE_IDS.has(runner.modeId)) {
    pushUnique(errors, "runner-mode-invalid");
  }
  if (!Array.isArray(runner.parallelJobs) || runner.parallelJobs.length === 0) {
    pushUnique(errors, "runner-mode-parallel-jobs-invalid");
  } else {
    for (const job of runner.parallelJobs) {
      const fields = isRecord(job) ? Object.keys(job) : [];
      if (
        !isRecord(job) ||
        fields.some((field) => !["id", "label", "maxStudents", "directions"].includes(field)) ||
        !validText(job.id) ||
        !validText(job.label) ||
        !Number.isInteger(job.maxStudents) ||
        job.maxStudents < 1 ||
        !validTextList(job.directions)
      ) {
        pushUnique(errors, "runner-mode-parallel-jobs-invalid");
      }
    }
  }
  if (!isRecord(runner.preservation)) {
    pushUnique(errors, "runner-mode-preservation-invalid");
  } else {
    for (const [key, value] of Object.entries(runner.preservation)) {
      if (!PRESERVATION_FIELDS.has(key) || typeof value !== "boolean") {
        pushUnique(errors, "runner-mode-preservation-invalid");
      }
    }
  }
}

function validateFallbackStepList(steps, projectNumber, errors) {
  if (!Array.isArray(steps) || steps.length < 7 || steps.length > 9) {
    pushUnique(errors, "runner-fallback-invalid");
    return;
  }
  const expectedPrefix = `p${String(projectNumber).padStart(2, "0")}-`;
  let totalMinutes = 0;
  for (const step of steps) {
    if (
      !isRecord(step) ||
      typeof step.id !== "string" ||
      !step.id.startsWith(expectedPrefix) ||
      !validText(step.label) ||
      !STEP_KINDS.has(step.kind) ||
      !Number.isInteger(step.minutes) ||
      step.minutes < 1 ||
      !validTextList(step.directions)
    ) {
      pushUnique(errors, "runner-fallback-invalid");
      continue;
    }
    totalMinutes += step.minutes;
    if (Object.hasOwn(step, "teacher")) validateTeacherSnapshot(step.teacher, errors);
  }
  if (totalMinutes !== 35) pushUnique(errors, "runner-fallback-invalid");
}

function validateFallbackSnapshot(runner, errors) {
  const selected = Object.hasOwn(runner, "selectedFallbackId") ||
    Object.hasOwn(runner, "fallbackReason");
  const hasFallbacks = Object.hasOwn(runner, "fallbacks");
  const canonicalPlan = getExperienceTimingPlan(runner.projectNumber);
  const supportedIds = isRecord(canonicalPlan?.fallbacks)
    ? new Set(Object.keys(canonicalPlan.fallbacks))
    : null;

  if (selected && hasFallbacks) pushUnique(errors, "runner-selection-conflict");
  if (selected) {
    if (
      !supportedIds?.has(runner.selectedFallbackId) ||
      !validText(runner.fallbackReason)
    ) {
      pushUnique(errors, "runner-fallback-invalid");
    }
  }

  if (hasFallbacks) {
    if (!supportedIds || !isRecord(runner.fallbacks)) {
      pushUnique(errors, "runner-fallback-invalid");
    } else {
      const fallbackIds = Object.keys(runner.fallbacks);
      if (
        fallbackIds.length !== supportedIds.size ||
        fallbackIds.some((fallbackId) => !supportedIds.has(fallbackId))
      ) {
        pushUnique(errors, "runner-fallback-invalid");
      }
      for (const fallback of Object.values(runner.fallbacks)) {
        if (
          !isRecord(fallback) ||
          Object.keys(fallback).some((field) => !["reason", "steps"].includes(field)) ||
          !validText(fallback.reason)
        ) {
          pushUnique(errors, "runner-fallback-invalid");
          continue;
        }
        validateFallbackStepList(fallback.steps, runner.projectNumber, errors);
      }
    }
  }

  if (supportedIds && !selected && !hasFallbacks) {
    pushUnique(errors, "runner-fallback-invalid");
  }
  if (!supportedIds && (selected || hasFallbacks)) {
    pushUnique(errors, "runner-fallback-invalid");
  }
  if (runner.modeId !== undefined && selected) {
    pushUnique(errors, "runner-selection-conflict");
  }
}

function validateAssistiveSnapshot(runner, errors) {
  const hasBoundary = Object.hasOwn(runner, "assistiveBoundary");
  const hasRoles = Object.hasOwn(runner, "parallelRoles");

  if (runner.projectNumber !== 23) {
    if (hasBoundary) pushUnique(errors, "runner-assistive-boundary-invalid");
    if (hasRoles) pushUnique(errors, "runner-parallel-roles-invalid");
    return;
  }

  try {
    copiedAssistiveBoundary(runner.assistiveBoundary);
  } catch {
    pushUnique(errors, "runner-assistive-boundary-invalid");
  }
  try {
    copiedParallelRoles(runner.parallelRoles);
  } catch {
    pushUnique(errors, "runner-parallel-roles-invalid");
  }
}

export function validateExperienceRunner(runner, { teacherKey } = {}) {
  const errors = [];
  if (!isRecord(runner)) {
    return { ok: false, errors: ["runner-not-object"] };
  }

  let expectedTeacherKey = null;
  try {
    expectedTeacherKey = normalizedTeacherKey(teacherKey);
  } catch {
    pushUnique(errors, "teacher-key-invalid");
  }
  if (!isOwnerKey(runner.teacherKey)) {
    pushUnique(errors, "runner-teacher-key-invalid");
  } else if (expectedTeacherKey !== null && runner.teacherKey !== expectedTeacherKey) {
    pushUnique(errors, "runner-teacher-mismatch");
  }

  if (runner.schemaVersion !== 1) pushUnique(errors, "runner-schema-version-invalid");
  const validProject = Number.isInteger(runner.projectNumber) &&
    runner.projectNumber >= 1 && runner.projectNumber <= 36;
  if (!validProject) pushUnique(errors, "runner-project-invalid");
  if (!validText(runner.title)) pushUnique(errors, "runner-title-invalid");

  const steps = runner.steps;
  if (!Array.isArray(steps) || steps.length < 7 || steps.length > 9) {
    pushUnique(errors, "runner-step-count-invalid");
  }
  const expectedPrefix = validProject
    ? `p${String(runner.projectNumber).padStart(2, "0")}-`
    : null;
  let totalMinutes = 0;
  const stepIds = new Set();
  for (const step of Array.isArray(steps) ? steps : []) {
    if (!isRecord(step)) {
      pushUnique(errors, "runner-step-invalid");
      continue;
    }
    if (
      typeof step.id !== "string" ||
      !/^p\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(step.id) ||
      stepIds.has(step.id)
    ) {
      pushUnique(errors, "runner-step-invalid");
    } else {
      stepIds.add(step.id);
      if (expectedPrefix && !step.id.startsWith(expectedPrefix)) {
        pushUnique(errors, "runner-project-mismatch");
      }
    }
    if (!validText(step.label) || !STEP_KINDS.has(step.kind) || !validTextList(step.directions)) {
      pushUnique(errors, "runner-step-invalid");
    }
    if (!Number.isInteger(step.minutes) || step.minutes < 1) {
      pushUnique(errors, "runner-step-minutes-mismatch");
    } else {
      totalMinutes += step.minutes;
    }
    if (Object.hasOwn(step, "teacher")) validateTeacherSnapshot(step.teacher, errors);
  }
  if (Array.isArray(steps) && totalMinutes !== 35) {
    pushUnique(errors, "runner-step-minutes-mismatch");
  }

  const timer = runner.timer;
  if (!isRecord(timer) || timer.schemaVersion !== 1 || !isRecord(timer?.plan)) {
    pushUnique(errors, "runner-timer-invalid");
  } else {
    const expectedPlanId = validProject ? `experience-${runner.projectNumber}` : null;
    if (expectedPlanId && timer.plan.id !== expectedPlanId) {
      pushUnique(errors, "runner-project-mismatch");
    }
    if (timer.plan.name !== runner.title) pushUnique(errors, "runner-title-mismatch");
    if (!Array.isArray(timer.plan.steps) || !Array.isArray(steps) || timer.plan.steps.length !== steps.length) {
      pushUnique(errors, "runner-step-count-mismatch");
    } else {
      for (const [index, timerStep] of timer.plan.steps.entries()) {
        if (
          !isRecord(timerStep) ||
          timerStep.name !== steps[index].label ||
          timerStep.minutes !== steps[index].minutes
        ) {
          pushUnique(errors, "runner-step-minutes-mismatch");
        }
      }
    }
    if (!TIMER_STATUSES.has(timer.status)) pushUnique(errors, "runner-timer-status-invalid");
    if (
      !Number.isInteger(timer.currentStepIndex) ||
      !Array.isArray(steps) ||
      timer.currentStepIndex < 0 ||
      timer.currentStepIndex >= steps.length
    ) {
      pushUnique(errors, "runner-step-index-invalid");
    }
    if (
      !Number.isInteger(timer.currentStepRemainingSeconds) ||
      timer.currentStepRemainingSeconds < 0 ||
      !Number.isInteger(timer.totalRemainingSeconds) ||
      timer.totalRemainingSeconds < 0
    ) {
      pushUnique(errors, "runner-timer-remaining-invalid");
    }
    if (
      timer.status === "complete" &&
      (timer.currentStepRemainingSeconds !== 0 || timer.totalRemainingSeconds !== 0)
    ) {
      pushUnique(errors, "runner-timer-remaining-invalid");
    }
    if (timer.status !== "complete" && timer.totalRemainingSeconds === 0) {
      pushUnique(errors, "runner-timer-remaining-invalid");
    }
    if (timer.status === "step-expired" && timer.currentStepRemainingSeconds !== 0) {
      pushUnique(errors, "runner-timer-remaining-invalid");
    }
  }

  if (!validCanonicalIso(runner.lastTickAt)) pushUnique(errors, "runner-last-tick-invalid");
  if (!validCanonicalIso(runner.updatedAt)) pushUnique(errors, "runner-updated-at-invalid");
  if (
    validCanonicalIso(runner.lastTickAt) &&
    validCanonicalIso(runner.updatedAt) &&
    new Date(runner.lastTickAt).getTime() > new Date(runner.updatedAt).getTime()
  ) {
    pushUnique(errors, "runner-clock-order-invalid");
  }

  validateModeSnapshot(runner, errors);
  validateFallbackSnapshot(runner, errors);
  validateAssistiveSnapshot(runner, errors);
  return { ok: errors.length === 0, errors };
}

function assertValidExperienceRunner(runner, teacherKey) {
  const validation = validateExperienceRunner(runner, { teacherKey });
  if (!validation.ok) {
    throw new TypeError(`invalid-experience-runner:${validation.errors.join(",")}`);
  }
}

function assertValidExperiencePlan(plan) {
  const validation = validateExperienceTimingPlan(plan);
  if (!validation.ok) {
    const codes = [...new Set(validation.errors.map((error) => error.code))];
    throw new TypeError(`invalid-experience-plan:${codes.join(",")}`);
  }
}

export function createExperienceRunner(
  plan,
  { teacherKey, nowIso, modeId, fallbackId, classDurationSeconds = 35 * 60 } = {},
) {
  if (
    !Number.isInteger(classDurationSeconds) ||
    classDurationSeconds < 1 ||
    classDurationSeconds > 35 * 60
  ) {
    throw new TypeError("classDurationSeconds must be an integer from 1 through 2100.");
  }
  const normalizedInput = normalizedPlanInput(plan);
  assertValidExperiencePlan(normalizedInput);
  const normalizedPlan = resolvedPlanSelection(
    normalizedInput,
    modeId,
    fallbackId,
  );
  assertValidExperiencePlan(normalizedPlan);

  const owner = normalizedTeacherKey(teacherKey);
  const timestamp = canonicalIso(nowIso, "nowIso");
  const steps = copiedSteps(normalizedPlan.steps);
  const timer = createStepTimer(
    {
      id: `experience-${normalizedPlan.projectNumber}`,
      name: normalizedPlan.title,
      steps: steps.map((step) => ({
        name: step.label,
        minutes: step.minutes,
      })),
    },
    { classDurationSeconds },
  );
  const fallbacks = copiedFallbacks(normalizedPlan);

  const runner = {
    schemaVersion: 1,
    teacherKey: owner,
    projectNumber: normalizedPlan.projectNumber,
    title: normalizedPlan.title,
    steps,
    timer,
    lastTickAt: timestamp,
    updatedAt: timestamp,
    ...(normalizedPlan.activeModeId
      ? {
        modeId: normalizedPlan.activeModeId,
        parallelJobs: copiedParallelJobs(normalizedPlan.parallelJobs),
        preservation: copiedPreservation(normalizedPlan.preservation),
      }
      : {}),
    ...(normalizedPlan.activeFallbackId
      ? {
        selectedFallbackId: normalizedPlan.activeFallbackId,
        fallbackReason: normalizedText(normalizedPlan.fallbackReason, "fallbackReason"),
      }
      : {}),
    ...(fallbacks ? { fallbacks } : {}),
    ...(normalizedPlan.projectNumber === 23
      ? {
        assistiveBoundary: copiedAssistiveBoundary(normalizedPlan.assistiveBoundary),
        parallelRoles: copiedParallelRoles(normalizedPlan.parallelRoles),
      }
      : {}),
  };
  assertValidExperienceRunner(runner, owner);
  return runner;
}

export function getActiveRunnerStep(runner, { teacherKey } = {}) {
  assertValidExperienceRunner(runner, teacherKey);
  const index = runner.timer.currentStepIndex;
  return structuredClone(runner.steps[index]);
}

export function advanceExperienceRunnerClock(runner, { teacherKey, nowIso } = {}) {
  assertValidExperienceRunner(runner, teacherKey);
  const timestamp = canonicalIso(nowIso, "nowIso");
  const lastTickAt = canonicalIso(runner?.lastTickAt, "lastTickAt");
  const nowTime = new Date(timestamp).getTime();
  const lastTime = new Date(lastTickAt).getTime();
  if (nowTime < lastTime) {
    throw new TypeError("runner-clock-moved-backward");
  }

  const next = structuredClone(runner);
  if (next.timer.status !== "running" && next.timer.status !== "step-expired") return next;
  const elapsedSeconds = Math.floor((nowTime - lastTime) / 1000);
  if (elapsedSeconds === 0) return next;

  next.timer = tickStepTimer(next.timer, elapsedSeconds);
  next.lastTickAt = new Date(lastTime + elapsedSeconds * 1000).toISOString();
  next.updatedAt = timestamp;
  assertValidExperienceRunner(next, teacherKey);
  return next;
}

const TIMER_ACTIONS = Object.freeze({
  start: startStepTimer,
  pause: pauseStepTimer,
  resume: resumeStepTimer,
  "add-minute": addMinuteToStepTimer,
  next: nextStepTimer,
  previous: previousStepTimer,
  reset: resetStepTimer,
});

export function applyExperienceRunnerAction(
  runner,
  action,
  { teacherKey, nowIso } = {},
) {
  assertValidExperienceRunner(runner, teacherKey);
  const applyAction = TIMER_ACTIONS[action];
  if (!applyAction) throw new TypeError("runner-action-invalid");
  const timestamp = canonicalIso(nowIso, "nowIso");
  const next = advanceExperienceRunnerClock(runner, {
    teacherKey,
    nowIso: timestamp,
  });
  next.timer = applyAction(next.timer);
  next.lastTickAt = timestamp;
  next.updatedAt = timestamp;
  assertValidExperienceRunner(next, teacherKey);
  return next;
}
