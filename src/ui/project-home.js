import {
  PROJECTS,
  getIndependencePath,
  getProjectByNumber
} from "../model/project-catalog.js";
import { isOwnerKey, ownerKeyForTeacher } from "../model/state.js";

const DEFAULT_PROJECT_NUMBER = 2;

const INDEPENDENCE_STAGES = Object.freeze([
  Object.freeze({ label: "Watch me", start: 1, end: 2 }),
  Object.freeze({ label: "Guided Crew", start: 3, end: 8 }),
  Object.freeze({ label: "Shared Crew", start: 9, end: 16 }),
  Object.freeze({ label: "Team Run", start: 17, end: 27 }),
  Object.freeze({ label: "Student Studio", start: 28, end: 36 })
]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isProjectNumber(value) {
  return Number.isInteger(value) && value >= 1 && value <= PROJECTS.length;
}

function teacherProgressKey(teacherId) {
  return ownerKeyForTeacher(teacherId);
}

function compatibleRawProgress(progress, teacherId) {
  if (teacherId === null) {
    return Object.hasOwn(progress, "default") && isRecord(progress.default)
      ? progress.default
      : null;
  }
  if (
    typeof teacherId === "string" &&
    teacherId.trim() !== "" &&
    teacherId !== "default" &&
    !isOwnerKey(teacherId) &&
    Object.hasOwn(progress, teacherId) &&
    isRecord(progress[teacherId])
  ) {
    return progress[teacherId];
  }
  return null;
}

function progressRecord(state, teacherId) {
  const progress = isRecord(state?.teacherProgress) ? state.teacherProgress : {};
  const keyed = progress[teacherProgressKey(teacherId)];
  if (isRecord(keyed)) return keyed;
  const compatibleRaw = compatibleRawProgress(progress, teacherId);
  if (compatibleRaw) return compatibleRaw;
  const hasLegacyRecord =
    isProjectNumber(progress.currentProjectNumber) ||
    Array.isArray(progress.completedProjectNumbers);
  return hasLegacyRecord ? progress : {};
}

function completedProjectNumbers(state, teacherId, currentProjectNumber) {
  const record = progressRecord(state, teacherId);
  if (Array.isArray(record.completedProjectNumbers)) {
    return new Set(record.completedProjectNumbers.filter(isProjectNumber));
  }
  return new Set(
    Array.from({ length: Math.max(0, currentProjectNumber - 1) }, (_, index) => index + 1)
  );
}

export function resolveCurrentProjectNumber(state = {}, teacherId = null) {
  const value = progressRecord(state, teacherId).currentProjectNumber;
  return Number.isInteger(value) && value >= 1 && value <= PROJECTS.length
    ? value
    : DEFAULT_PROJECT_NUMBER;
}

export function advanceProjectProgress(
  state = {},
  teacherId = null,
  completedProjectNumber,
  nowIso
) {
  const nextState = structuredClone(isRecord(state) ? state : {});
  if (!isProjectNumber(completedProjectNumber) || typeof nowIso !== "string" || !nowIso) {
    return nextState;
  }
  if (completedProjectNumber !== resolveCurrentProjectNumber(state, teacherId)) {
    return nextState;
  }

  const key = teacherProgressKey(teacherId);
  const allProgress = isRecord(nextState.teacherProgress) ? nextState.teacherProgress : {};
  const prior = isRecord(allProgress[key])
    ? allProgress[key]
    : progressRecord(state, teacherId);
  const completed = completedProjectNumbers(state, teacherId, completedProjectNumber);
  completed.add(completedProjectNumber);
  const currentProjectNumber = Math.min(completedProjectNumber + 1, PROJECTS.length);

  nextState.teacherProgress = {
    ...allProgress,
    [key]: {
      ...prior,
      currentProjectNumber,
      completedProjectNumbers: [...completed].sort((left, right) => left - right),
      complete: completedProjectNumber === PROJECTS.length,
      updatedAt: nowIso
    }
  };
  nextState.updatedAt = nowIso;
  return nextState;
}

export function buildProjectHomeView(state = {}, { teacherId = null, previewOnly = false } = {}) {
  const currentNumber = resolveCurrentProjectNumber(state, teacherId);
  const currentProject = getProjectByNumber(currentNumber) ?? getProjectByNumber(DEFAULT_PROJECT_NUMBER);
  const activeStage = getIndependencePath(currentNumber);
  const completed = completedProjectNumbers(state, teacherId, currentNumber);
  const progressComplete =
    currentNumber === PROJECTS.length && progressRecord(state, teacherId).complete === true;

  return {
    previewOnly: previewOnly === true,
    currentProject,
    progressComplete,
    projectLabel: progressComplete
      ? `All ${PROJECTS.length} experiences complete`
      : `Experience ${currentNumber} of ${PROJECTS.length}`,
    trail: PROJECTS.map((project) => ({
      number: project.number,
      title: project.title,
      state:
        completed.has(project.number)
            ? "complete"
            : project.number === currentNumber
              ? "current"
            : "upcoming"
    })),
    independencePath: INDEPENDENCE_STAGES.map((stage) => ({
      ...stage,
      active: stage.label === activeStage,
      complete: Array.from(
        { length: stage.end - stage.start + 1 },
        (_, index) => stage.start + index
      ).every((number) => completed.has(number))
    })),
    actions: {
      run: "Run today's experience",
      teacher: "Teacher script",
      student: "Student directions",
      admin: "Download admin plan"
    },
    fastFinish: currentProject.fastFinish
  };
}
