import {
  TECH_TERRARIUM_ARTIFACT_ID,
  validateSharedArtifact
} from "./shared-artifact.js";
import { validateExperienceRunner } from "./experience-runner.js";
import { validateTeacherPlan } from "./teacher-plan.js";
import {
  admitResource as admitClosedResource,
  findForbiddenField,
  isBoundedText,
  isCanonicalIso,
  isEventId,
  isLocalDate,
  isLocalId,
  isOwnerKey,
  ownerKeyForTeacher
} from "./schema-admission.js";

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isPlainRecord(value) {
  if (!isRecord(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

const RESOURCE_APP_ORIGIN = "https://circ-hq.invalid";
const RESOURCE_APP_PATHS = new Set([
  "/",
  "/index.html",
  "/mission-control.html"
]);
const RESOURCE_SOURCES = new Set(["local", "authorized-cloud"]);

function decodedForInspection(value) {
  let decoded = value;
  for (let pass = 0; pass < 3; pass += 1) {
    let next;
    try {
      next = decodeURIComponent(decoded);
    } catch {
      return null;
    }
    if (next === decoded) return decoded;
    decoded = next;
  }
  return decoded;
}

function hasUnsafeRawEncoding(value) {
  return /%(?![0-9a-f]{2})/i.test(value) ||
    /%(?:0[0-9a-f]|1[0-9a-f]|20|23|25|2e|2f|3a|3f|5c|7f)/i.test(value);
}

function hasUnsafeRawPath(pathname, rejectInternalSegments) {
  if (!pathname || pathname.includes("%")) return true;
  const segments = pathname.split("/").filter(Boolean);
  return segments.some((segment) =>
    segment === "." ||
    segment === ".." ||
    (rejectInternalSegments && segment.startsWith("."))
  );
}

function splitRelativeHref(value) {
  const query = value.indexOf("?");
  const fragment = value.indexOf("#");
  const boundaries = [query, fragment].filter((index) => index !== -1);
  const pathEnd = boundaries.length ? Math.min(...boundaries) : value.length;
  return {
    rawPath: value.slice(0, pathEnd),
    suffix: value.slice(pathEnd)
  };
}

function admittedResourceHref(value) {
  if (value === undefined) return { href: null, external: false };
  if (typeof value !== "string" || value === "" || value !== value.trim()) return null;
  const inspected = decodedForInspection(value);
  if (
    inspected === null ||
    /[\u0000-\u0020\u007f]/.test(inspected) ||
    inspected.includes("\\") ||
    inspected.startsWith("//") ||
    hasUnsafeRawEncoding(value)
  ) return null;

  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(inspected)?.[1]?.toLowerCase() ?? null;
  if (scheme) {
    if (scheme !== "https") return null;
    try {
      const rawAbsolute = /^https:\/\/[^/?#]+([^?#]*)(?:[?#]|$)/i.exec(value);
      if (!rawAbsolute || hasUnsafeRawPath(rawAbsolute[1] || "/", false)) return null;
      const parsed = new URL(value);
      if (
        parsed.protocol !== "https:" ||
        !parsed.hostname ||
        parsed.username ||
        parsed.password
      ) return null;
      return { href: parsed.href, external: true };
    } catch {
      return null;
    }
  }

  try {
    const { rawPath, suffix } = splitRelativeHref(value);
    const admittedPath = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
    if (
      hasUnsafeRawPath(admittedPath, true) ||
      !RESOURCE_APP_PATHS.has(admittedPath)
    ) return null;
    const parsed = new URL(value, `${RESOURCE_APP_ORIGIN}/`);
    if (
      parsed.origin !== RESOURCE_APP_ORIGIN ||
      parsed.pathname !== admittedPath ||
      `${parsed.search}${parsed.hash}` !== suffix
    ) return null;
    return {
      href: `${parsed.pathname}${parsed.search}${parsed.hash}`,
      external: false
    };
  } catch {
    return null;
  }
}

export function admitResource(resource) {
  return admitClosedResource(resource);
}

export function admitResourceState(state, { source = "local" } = {}) {
  const admittedSource = RESOURCE_SOURCES.has(source) ? source : null;
  const value = isRecord(state) ? structuredClone(state) : {};
  const admit = (resources) => admittedSource
    ? (Array.isArray(resources) ? resources : []).map(admitResource).filter(Boolean)
    : [];
  if (Object.hasOwn(value, "resources")) value.resources = admit(value.resources);
  if (isRecord(value.plan) && Object.hasOwn(value.plan, "resources")) {
    value.plan.resources = admit(value.plan.resources);
  }
  return value;
}

function admitSharedArtifacts(value) {
  const admitted = {};
  if (!isPlainRecord(value)) return admitted;
  for (const [key, artifact] of Object.entries(value)) {
    if (key !== TECH_TERRARIUM_ARTIFACT_ID || artifact?.artifactId !== key) continue;
    const validated = validateSharedArtifact(artifact);
    if (validated) admitted[key] = validated;
  }
  return admitted;
}

function stateError() {
  throw new TypeError("local-state-invalid");
}

function canonicalStringList(value, { allowEmpty = true } = {}) {
  if (!Array.isArray(value)) return allowEmpty ? [] : null;
  const result = value.filter((entry) => isBoundedText(entry, { max: 4000 }));
  return result.length === value.length ? result : null;
}

function canonicalTeacherProgress(value, plan, updatedAt) {
  if (!isPlainRecord(value)) return {};
  const teacherIds = new Set((Array.isArray(plan?.teachers) ? plan.teachers : []).map((teacher) => teacher.id));
  const defaultOwner = plan?.teachers?.[0]?.id
    ? ownerKeyForTeacher(plan.teachers[0].id)
    : "local:default";
  const result = {};
  const entries = Object.entries(value);
  const rootLegacy = ["currentProjectNumber", "completedProjectNumbers", "complete", "updatedAt"]
    .some((key) => Object.hasOwn(value, key));
  const sourceEntries = rootLegacy ? [[defaultOwner, value]] : entries;
  for (const [rawKey, record] of sourceEntries) {
    if (!isPlainRecord(record)) continue;
    let owner = null;
    if (isOwnerKey(rawKey)) owner = rawKey;
    else if (rawKey === "default") owner = "local:default";
    else if (teacherIds.has(rawKey)) owner = ownerKeyForTeacher(rawKey);
    if (!owner) continue;
    const recognized = ["currentProjectNumber", "completedProjectNumbers", "complete", "updatedAt"]
      .some((key) => Object.hasOwn(record, key));
    if (!recognized) continue;
    const currentProjectNumber = Number.isInteger(record.currentProjectNumber) &&
      record.currentProjectNumber >= 1 && record.currentProjectNumber <= 36
      ? record.currentProjectNumber
      : 2;
    const sourceCompleted = Array.isArray(record.completedProjectNumbers)
      ? record.completedProjectNumbers
      : Array.from({ length: Math.max(0, currentProjectNumber - 1) }, (_, index) => index + 1);
    if (!sourceCompleted.every((number) => Number.isInteger(number) && number >= 1 && number <= 36)) {
      stateError();
    }
    const completedProjectNumbers = [...new Set(sourceCompleted)].sort((left, right) => left - right);
    result[owner] = {
      currentProjectNumber,
      completedProjectNumbers,
      complete: record.complete === true || completedProjectNumbers.length === 36,
      updatedAt: isCanonicalIso(record.updatedAt) ? record.updatedAt : updatedAt
    };
  }
  return result;
}

function canonicalRunnerStep(step) {
  if (!isPlainRecord(step)) stateError();
  const teacher = isPlainRecord(step.teacher)
    ? Object.fromEntries(["directions", "cue", "model"]
        .filter((key) => Object.hasOwn(step.teacher, key))
        .map((key) => [key, structuredClone(step.teacher[key])]))
    : null;
  return {
    id: step.id,
    label: step.label,
    kind: step.kind,
    minutes: step.minutes,
    directions: Array.isArray(step.directions) ? [...step.directions] : step.directions,
    ...(teacher && Object.keys(teacher).length ? { teacher } : {})
  };
}

function canonicalRunnerTimer(timer) {
  if (!isPlainRecord(timer) || !isPlainRecord(timer.plan) || !Array.isArray(timer.plan.steps)) {
    stateError();
  }
  return {
    schemaVersion: timer.schemaVersion,
    plan: {
      id: timer.plan.id,
      name: timer.plan.name,
      steps: timer.plan.steps.map((step) => ({ name: step?.name, minutes: step?.minutes }))
    },
    status: timer.status,
    currentStepIndex: timer.currentStepIndex,
    currentStepRemainingSeconds: timer.currentStepRemainingSeconds,
    totalRemainingSeconds: timer.totalRemainingSeconds
  };
}

function canonicalRunnerJob(job) {
  if (!isPlainRecord(job)) stateError();
  return {
    id: job.id,
    label: job.label,
    maxStudents: job.maxStudents,
    directions: Array.isArray(job.directions) ? [...job.directions] : job.directions
  };
}

function canonicalRunner(runner, owner) {
  if (!isPlainRecord(runner)) stateError();
  const canonical = {
    schemaVersion: runner.schemaVersion,
    teacherKey: runner.teacherKey,
    projectNumber: runner.projectNumber,
    title: runner.title,
    steps: Array.isArray(runner.steps) ? runner.steps.map(canonicalRunnerStep) : runner.steps,
    timer: canonicalRunnerTimer(runner.timer),
    lastTickAt: runner.lastTickAt,
    updatedAt: runner.updatedAt
  };
  if (runner.modeId !== undefined) canonical.modeId = runner.modeId;
  if (runner.parallelJobs !== undefined) {
    canonical.parallelJobs = Array.isArray(runner.parallelJobs)
      ? runner.parallelJobs.map(canonicalRunnerJob)
      : runner.parallelJobs;
  }
  if (runner.preservation !== undefined) {
    canonical.preservation = isPlainRecord(runner.preservation)
      ? Object.fromEntries([
          "preserveExisting",
          "requiresExistingArtifact",
          "requiresTeacherPlan",
          "dismantleGluedStructure"
        ].filter((key) => Object.hasOwn(runner.preservation, key)).map((key) => [key, runner.preservation[key]]))
      : runner.preservation;
  }
  if (runner.selectedFallbackId !== undefined) canonical.selectedFallbackId = runner.selectedFallbackId;
  if (runner.fallbackReason !== undefined) canonical.fallbackReason = runner.fallbackReason;
  if (runner.fallbacks !== undefined) {
    if (!isPlainRecord(runner.fallbacks)) stateError();
    canonical.fallbacks = Object.fromEntries(Object.entries(runner.fallbacks).map(([key, fallback]) => {
      if (!isPlainRecord(fallback)) stateError();
      return [key, {
        reason: fallback.reason,
        steps: Array.isArray(fallback.steps) ? fallback.steps.map(canonicalRunnerStep) : fallback.steps
      }];
    }));
  }
  if (runner.assistiveBoundary !== undefined) {
    canonical.assistiveBoundary = isPlainRecord(runner.assistiveBoundary)
      ? Object.fromEntries([
          "sharedPrototypeLimit",
          "educationalPrototypeOnly",
          "studentPiiAllowed",
          "medicalClaimsAllowed"
        ].map((key) => [key, runner.assistiveBoundary[key]]))
      : runner.assistiveBoundary;
  }
  if (runner.parallelRoles !== undefined) {
    canonical.parallelRoles = Array.isArray(runner.parallelRoles)
      ? runner.parallelRoles.map(canonicalRunnerJob)
      : runner.parallelRoles;
  }
  if (runner.detour !== undefined) {
    canonical.detour = isPlainRecord(runner.detour)
      ? { status: runner.detour.status, remainingSeconds: runner.detour.remainingSeconds }
      : runner.detour;
  }
  if (!validateExperienceRunner(canonical, { teacherKey: owner }).ok) stateError();
  return canonical;
}

function canonicalExperienceRunners(value) {
  if (value === undefined) return {};
  if (!isPlainRecord(value)) stateError();
  const result = {};
  for (const [owner, runner] of Object.entries(value)) {
    if (!isOwnerKey(owner)) continue;
    result[owner] = canonicalRunner(runner, owner);
  }
  return result;
}

function canonicalChecklist(value, updatedAt) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isPlainRecord(item) || !isLocalId(item.id) || !isBoundedText(item.text, { max: 4000 })) return [];
    return [{
      id: item.id,
      text: item.text,
      updatedAt: isCanonicalIso(item.updatedAt) ? item.updatedAt : updatedAt
    }];
  });
}

function canonicalClasses(value, updatedAt) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isPlainRecord(item) || !isLocalId(item.id) || !isBoundedText(item.title, { max: 500 })) return [];
    const visibility = ["teacher-private", "classroom"].includes(item.visibility)
      ? item.visibility
      : "teacher-private";
    return [{
      id: item.id,
      title: item.title,
      visibility,
      reviewedForBoard: visibility === "classroom" && item.reviewedForBoard === true,
      updatedAt: isCanonicalIso(item.updatedAt) ? item.updatedAt : updatedAt
    }];
  });
}

function canonicalLessonGuides(value, updatedAt) {
  if (!Array.isArray(value)) return [];
  const textFields = [
    "objective", "opening", "safety", "cleanup", "transition", "exitPrompt",
    "currentProcessStep", "privateNote", "status"
  ];
  return value.flatMap((guide) => {
    if (!isPlainRecord(guide) || !isLocalId(guide.id) || !isBoundedText(guide.title, { max: 500 })) return [];
    const result = {
      id: guide.id,
      title: guide.title,
      visibility: ["teacher-private", "classroom"].includes(guide.visibility)
        ? guide.visibility
        : "teacher-private",
      reviewedForBoard: guide.visibility === "classroom" && guide.reviewedForBoard === true,
      updatedAt: isCanonicalIso(guide.updatedAt) ? guide.updatedAt : updatedAt
    };
    for (const field of ["classId", "rotationId"]) {
      if (guide[field] !== undefined && isLocalId(guide[field])) result[field] = guide[field];
    }
    for (const field of textFields) {
      const source = field === "privateNote" && guide.privateNote === undefined
        ? guide.teacherNotes
        : guide[field];
      if (source !== undefined && isBoundedText(source, { max: 4000, allowEmpty: true, trimmed: field !== "privateNote" })) {
        result[field] = source;
      }
    }
    for (const field of ["steps", "materials", "directions"]) {
      const list = canonicalStringList(guide[field]);
      if (guide[field] !== undefined && list) result[field] = list;
    }
    return [result];
  });
}

function canonicalStateSpecialEvents(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((event) => {
    if (
      !isPlainRecord(event) ||
      !isEventId(event.id) ||
      event.type !== "special" ||
      !isBoundedText(event.label, { max: 500 }) ||
      !isLocalDate(event.date)
    ) return [];
    const hasTime = event.start !== undefined || event.end !== undefined;
    if (hasTime && (typeof event.start !== "string" || typeof event.end !== "string")) return [];
    return [{
      id: event.id,
      type: "special",
      label: event.label,
      date: event.date,
      ...(hasTime ? { start: event.start, end: event.end } : {})
    }];
  });
}

function canonicalNotes(value, updatedAt) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((note) => {
    if (
      !isPlainRecord(note) ||
      !isLocalId(note.id) ||
      !isBoundedText(note.text, { max: 8000, allowEmpty: true, trimmed: false })
    ) return [];
    return [{
      id: note.id,
      text: note.text,
      visibility: ["teacher-private", "classroom"].includes(note.visibility)
        ? note.visibility
        : "teacher-private",
      updatedAt: isCanonicalIso(note.updatedAt) ? note.updatedAt : updatedAt
    }];
  });
}

function canonicalPreferences(value) {
  if (!isPlainRecord(value)) return {};
  return typeof value.teacherId === "string" && value.teacherId.trim() !== ""
    ? { teacherId: value.teacherId }
    : {};
}

function canonicalTombstones(value) {
  if (!Array.isArray(value)) return [];
  const collections = new Set(["resources", "checklist", "classes", "lessonGuides", "specialEvents", "notes"]);
  return value.flatMap((item) =>
    isPlainRecord(item) &&
    collections.has(item.collection) &&
    isLocalId(item.id) &&
    isCanonicalIso(item.deletedAt)
      ? [{ collection: item.collection, id: item.id, deletedAt: item.deletedAt }]
      : []
  );
}

export function admitLocalState(state) {
  if (!isPlainRecord(state) || findForbiddenField(state)) stateError();
  if (
    state.format !== "playbook.state.v1" ||
    state.schemaVersion !== 1 ||
    !isCanonicalIso(state.updatedAt)
  ) stateError();
  let plan = null;
  if (state.plan !== null && state.plan !== undefined) {
    const validation = validateTeacherPlan(state.plan);
    if (!validation.ok) stateError();
    plan = validation.value;
  }
  const sourceArtifacts = state.sharedArtifacts;
  if (sourceArtifacts !== undefined && !isPlainRecord(sourceArtifacts)) stateError();
  if (
    isPlainRecord(sourceArtifacts) &&
    Object.hasOwn(sourceArtifacts, TECH_TERRARIUM_ARTIFACT_ID) &&
    !validateSharedArtifact(sourceArtifacts[TECH_TERRARIUM_ARTIFACT_ID])
  ) stateError();
  const resources = Array.isArray(state.resources)
    ? state.resources.map(admitClosedResource).filter(Boolean)
    : [];
  return {
    format: "playbook.state.v1",
    schemaVersion: 1,
    updatedAt: state.updatedAt,
    plan,
    teacherProgress: canonicalTeacherProgress(state.teacherProgress, plan, state.updatedAt),
    experienceRunners: canonicalExperienceRunners(state.experienceRunners),
    sharedArtifacts: admitSharedArtifacts(sourceArtifacts),
    checklist: canonicalChecklist(state.checklist, state.updatedAt),
    classes: canonicalClasses(state.classes, state.updatedAt),
    lessonGuides: canonicalLessonGuides(state.lessonGuides, state.updatedAt),
    specialEvents: canonicalStateSpecialEvents(state.specialEvents),
    resources,
    notes: canonicalNotes(state.notes, state.updatedAt),
    preferences: canonicalPreferences(state.preferences),
    tombstones: canonicalTombstones(state.tombstones),
    ...(state.classroomFacing === true ? { classroomFacing: true } : {})
  };
}

function findById(items, id) {
  return (Array.isArray(items) ? items : []).find((item) => item?.id === id) ?? null;
}

function findPlanEvent(plan, id) {
  for (const teacher of Array.isArray(plan?.teachers) ? plan.teachers : []) {
    for (const events of Object.values(isRecord(teacher?.days) ? teacher.days : {})) {
      const match = findById(events, id);
      if (match) return match;
    }
  }
  return null;
}

function publicStrings(value) {
  return (Array.isArray(value) ? value : []).filter((item) => typeof item === "string");
}

function reviewedForBoard(value) {
  return isRecord(value) &&
    value.visibility === "classroom" &&
    value.reviewedForBoard === true;
}

function generatedCountdown(options, eventId) {
  const live = options?.liveCountdown;
  if (!isRecord(live)) return "";
  const keys = Object.keys(live).sort();
  if (
    keys.length !== 3 ||
    keys[0] !== "eventId" ||
    keys[1] !== "minutes" ||
    keys[2] !== "target" ||
    live.eventId !== eventId ||
    !Number.isInteger(live.minutes) ||
    live.minutes < 0 ||
    live.minutes > 1440 ||
    live.target !== "end"
  ) return "";
  return `${live.minutes}m to end`;
}

export function getAccessMode(session = {}) {
  if (!session.configured) return "local";
  if (!session.user?.uid) return "signed-out";
  if (session.requestedShared && session.membership?.trusted !== true) return "shared-blocked";
  if (session.membership?.trusted === true) return "teacher";
  return "private-sync";
}

export function buildBoardProjection(state, eventId, options = {}) {
  const source = isRecord(state) ? state : {};
  const event = findById(source.specialEvents, eventId) ?? findPlanEvent(source.plan, eventId) ?? {};
  if (event.type !== "teach") return {};
  const classroom = findById(source.classes, event.classId);
  const lesson = findById(source.lessonGuides, event.lessonGuideId);
  if (!reviewedForBoard(classroom) || !reviewedForBoard(lesson)) return {};
  return {
    classTitle: typeof classroom.title === "string" ? classroom.title : "",
    countdown: generatedCountdown(options, eventId),
    lessonTitle: typeof lesson.title === "string" ? lesson.title : "",
    materials: publicStrings(lesson.materials),
    directions: publicStrings(lesson.directions),
    ...(typeof lesson.objective === "string" ? { objective: lesson.objective } : {}),
    ...(typeof lesson.safety === "string" ? { safety: lesson.safety } : {}),
    ...(typeof lesson.cleanup === "string" ? { cleanup: lesson.cleanup } : {}),
    ...(typeof lesson.exitPrompt === "string" ? { exitPrompt: lesson.exitPrompt } : {}),
    currentProcessStep: typeof lesson.currentProcessStep === "string" ? lesson.currentProcessStep : ""
  };
}
